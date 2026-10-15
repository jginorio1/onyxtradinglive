import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyNewTicket } from '@/lib/supportNotify';

// ============================================================
// Correo ENTRANTE de soporte (Resend Inbound). Cuando un cliente responde al
// correo del ticket, Resend manda un webhook 'email.received'; aquí emparejamos
// esa respuesta con su ticket (por un token en la dirección Reply-To) y la
// metemos en el hilo como mensaje del cliente. Así SÍ se ve en Soporte.
// ============================================================

// Dominio de recepción configurado en Resend (p. ej. "inbound.onyxtradinglive.com").
export function inboundDomain(): string {
  return String(process.env.RESEND_INBOUND_DOMAIN || '').trim().toLowerCase();
}

// Reply-To con el token del ticket para poder emparejar la respuesta.
// Devuelve '' si no hay dominio de recepción configurado (entonces no se activa).
export function replyToForTicket(token: string): string {
  const d = inboundDomain();
  if (!d || !token) return '';
  return `soporte+${token}@${d}`;
}

// Garantiza que el ticket tenga un public_token (se reutiliza para Reply-To y
// para el hilo del invitado). Lo crea si falta. Devuelve el token (o '' si falla).
export async function ensureTicketToken(ticketId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from('support_tickets').select('public_token').eq('id', ticketId).maybeSingle();
    const cur = (data as any)?.public_token;
    if (cur) return cur;
    const tok = randomUUID();
    const r = await supabaseAdmin.from('support_tickets').update({ public_token: tok }).eq('id', ticketId);
    if ((r as any)?.error) return '';   // la columna aún no existe
    return tok;
  } catch { return ''; }
}

// Quita la cita de la respuesta (el "> ..." y lo que viene después de
// "El ... escribió:", firmas, etc.) para guardar solo lo que el cliente escribió.
export function cleanReply(text: string): string {
  let s = String(text || '').replace(/\r/g, '');
  const markers: RegExp[] = [
    /^On .+ wrote:\s*$/im,
    /^El .+ escribi[oó]:\s*$/im,
    /^-{2,}\s*Original Message\s*-{2,}/im,
    /^_{5,}/m,
    /^From:\s.+$/im,
    /^De:\s.+$/im,
    /Responde a este correo/i,
    /Reply to this email/i,
    /Equipo de Onyx Trading Live/i,
    /The Onyx Trading Live team/i,
  ];
  let cut = s.length;
  for (const re of markers) { const m = s.match(re); if (m && m.index != null && m.index < cut) cut = m.index; }
  s = s.slice(0, cut);
  s = s.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n').trim();   // quita líneas citadas
  return s.slice(0, 4000);
}

// Extrae el token del ticket desde una lista de destinatarios (busca el que va a
// nuestro dominio de recepción; el local-part es "soporte+<token>" o "<token>").
function tokenFromRecipients(list: string[]): string {
  const d = inboundDomain();
  for (const raw of list || []) {
    const addr = String(raw || '').toLowerCase().replace(/^.*<([^>]+)>.*$/, '$1').trim();
    const at = addr.indexOf('@');
    if (at < 0) continue;
    const local = addr.slice(0, at);
    const dom = addr.slice(at + 1);
    if (d && dom !== d) continue;
    const plus = local.indexOf('+');
    const tok = plus >= 0 ? local.slice(plus + 1) : local;
    if (tok && tok.length >= 8) return tok;
  }
  return '';
}

// Procesa un email.received: busca el ticket, inserta el mensaje del cliente,
// reabre el ticket y avisa al equipo. Idempotente por message_id.
export async function handleInboundEmail(data: any): Promise<{ ok: boolean; ticketId?: string; reason?: string }> {
  const emailId: string = data?.email_id || data?.id || '';
  const to: string[] = ([] as string[]).concat(data?.to || [], data?.received_for || []);
  const from: string = String(data?.from || '').toLowerCase().replace(/^.*<([^>]+)>.*$/, '$1').trim();
  const messageId: string = String(data?.message_id || '');

  // Token → ticket. Si no hay token, intentamos emparejar por el correo del remitente.
  let token = tokenFromRecipients(to);
  let ticket: any = null;
  if (token) {
    const { data: t } = await supabaseAdmin.from('support_tickets').select('id,status').eq('public_token', token).maybeSingle();
    ticket = t;
  }
  if (!ticket && from) {
    const { data: t } = await supabaseAdmin.from('support_tickets')
      .select('id,status').eq('email', from).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    ticket = t;
  }
  if (!ticket) return { ok: false, reason: 'no_ticket' };

  // Idempotencia: si ya guardamos este message_id, no duplicar.
  if (messageId) {
    try {
      const { data: dup } = await supabaseAdmin.from('support_messages')
        .select('id').eq('ticket_id', ticket.id).eq('email_message_id', messageId).maybeSingle();
      if (dup) return { ok: true, ticketId: ticket.id };
    } catch { /* si la columna no existe, seguimos sin dedup por message_id */ }
  }

  // Cuerpo del correo: la API de recepción de Resend (el webhook solo trae metadata).
  let bodyText = '';
  if (emailId && process.env.RESEND_API_KEY) {
    try {
      const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (r.ok) {
        const j = await r.json();
        bodyText = j?.text || String(j?.html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
      }
    } catch { /* si falla, guardamos un aviso */ }
  }
  const clean = cleanReply(bodyText) || '(respuesta por correo — ver en tu bandeja)';

  const row: any = { ticket_id: ticket.id, sender: 'user', body: clean };
  try { row.email_message_id = messageId || null; } catch {}
  try {
    let ins = await supabaseAdmin.from('support_messages').insert(row);
    if ((ins as any)?.error) { delete row.email_message_id; await supabaseAdmin.from('support_messages').insert(row); }
  } catch { return { ok: false, reason: 'insert' }; }

  // Reabrir si estaba resuelto + subir en la bandeja.
  const patch: any = { updated_at: new Date().toISOString() };
  if (ticket.status === 'resolved') patch.status = 'open';
  await supabaseAdmin.from('support_tickets').update(patch).eq('id', ticket.id);
  try { await notifyNewTicket({ email: from, subject: 'Respuesta por correo', isLead: false }); } catch {}

  return { ok: true, ticketId: ticket.id };
}
