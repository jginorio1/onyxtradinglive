import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting } from '@/lib/settings';
import { sendEmail } from '@/lib/mail';
import { notifyNewTicket } from '@/lib/supportNotify';

// ============================================================
// Soporte remoto DE PAGO. La config (on/precio/herramienta/enlace/instrucción)
// vive en app_settings bajo 'remote_support' (la edita Admin → Soporte).
// Tras pagar (Stripe Checkout), fulfillRemoteSession deja el ticket en la
// bandeja, avisa al equipo y le manda al cliente el enlace de la herramienta.
// ============================================================
export type RemoteSupport = {
  on: boolean; price: number; minutes: number; tool: string; link: string; note_es: string; note_en: string;
};

export const REMOTE_DEFAULT: RemoteSupport = {
  on: false, price: 25, minutes: 30, tool: 'AnyDesk', link: 'https://anydesk.com/download',
  note_es: 'Descarga AnyDesk, ábrelo y comparte con el agente el código de 9 dígitos que te muestra. No cierres la ventana durante la sesión.',
  note_en: 'Download AnyDesk, open it and share the 9-digit code it shows with the agent. Keep the window open during the session.',
};

export async function getRemoteConfig(): Promise<RemoteSupport> {
  try { const cfg = await getSetting<RemoteSupport>('remote_support', REMOTE_DEFAULT); return { ...REMOTE_DEFAULT, ...cfg }; }
  catch { return { ...REMOTE_DEFAULT }; }
}

// Idempotente por sessionId de Stripe: si el webhook reintenta, no duplica el ticket.
export async function fulfillRemoteSession(opts: { sessionId: string; email: string; userId?: string | null; lang?: string; amount?: number }): Promise<{ ok: boolean; ticketId?: string }> {
  const email = (opts.email || '').trim();
  const en = opts.lang === 'en';
  const cfg = await getRemoteConfig();

  // Idempotencia: ¿ya creamos un ticket para esta sesión de pago?
  try {
    const { data: dup } = await supabaseAdmin.from('support_tickets').select('id').eq('remote_session', opts.sessionId).maybeSingle();
    if (dup) return { ok: true, ticketId: (dup as any).id };
  } catch { /* si la columna no existe aún, seguimos (el panel pide correr la migración) */ }

  const subject = en ? `🖥️ Paid remote session (${cfg.minutes} min)` : `🖥️ Sesión remota pagada (${cfg.minutes} min)`;
  const row: any = { user_id: opts.userId || null, email: email || null, subject, category: 'general', status: 'open', priority: 'high', is_lead: !opts.userId, channel: 'ticket' };
  try { row.remote_session = opts.sessionId; } catch {}
  let ticketId = '';
  try {
    let ins = await supabaseAdmin.from('support_tickets').insert(row).select('id').single();
    if ((ins as any)?.error) { delete row.remote_session; ins = await supabaseAdmin.from('support_tickets').insert(row).select('id').single(); }
    ticketId = (ins.data as any)?.id || '';
  } catch { return { ok: false }; }
  if (!ticketId) return { ok: false };

  const amt = opts.amount || cfg.price;
  const firstMsg = en
    ? `The client PAID for a remote support session ($${amt} · ${cfg.minutes} min). Tool: ${cfg.tool}. Contact them to agree a time and run the session.`
    : `El cliente PAGÓ una sesión de soporte remoto ($${amt} · ${cfg.minutes} min). Herramienta: ${cfg.tool}. Contáctalo para acordar hora y hacer la sesión.`;
  try { await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'note', body: firstMsg }); } catch {}

  // Aviso al equipo (Telegram) de que entró una sesión remota pagada.
  try { await notifyNewTicket({ email, subject, isLead: !opts.userId }); } catch {}

  // Correo al cliente con la herramienta + instrucción.
  if (email) {
    const note = en ? cfg.note_en : cfg.note_es;
    const subj = en ? 'Your Onyx remote support session' : 'Tu sesión de soporte remoto de Onyx';
    const bodyTxt = en
      ? `Thanks — your remote support session is booked (${cfg.minutes} min).\n\nStep 1 — Download ${cfg.tool}: ${cfg.link}\nStep 2 — ${note}\n\nAn agent will contact you shortly to agree a time. Reply to this email if you need anything.`
      : `¡Gracias! Tu sesión de soporte remoto quedó reservada (${cfg.minutes} min).\n\nPaso 1 — Descarga ${cfg.tool}: ${cfg.link}\nPaso 2 — ${note}\n\nUn agente te contactará en breve para acordar la hora. Responde a este correo si necesitas algo.`;
    try { await sendEmail(email, subj, bodyTxt, { kind: 'support' }); } catch {}
  }

  return { ok: true, ticketId };
}
