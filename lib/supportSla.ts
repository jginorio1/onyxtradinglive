import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting } from '@/lib/settings';
import { sendMessage } from '@/lib/telegram';
import { sendEmail } from '@/lib/mail';
import { emailTplLive } from '@/lib/emailTemplates';
import { notify } from '@/lib/notify';

// ============================================================
// SLA de soporte: vigila tickets que llevan demasiado tiempo esperando, en las
// DOS direcciones, y actúa automáticamente (cron cada 15 min).
//
//  · Esperando al CLIENTE (el último mensaje fue del equipo/IA):
//      - a reminderH horas → correo de recordatorio al cliente.
//      - a closeH horas    → se cierra el ticket por inactividad (reabre solo
//                             si el cliente responde el correo → webhook inbound).
//
//  · Esperando al EQUIPO (el último mensaje fue del cliente):
//      - a ackMin minutos  → aviso al equipo (campana + Telegram): "esperando".
//      - a overdueMin min  → se marca VENCIDO (prioridad alta) y se avisa al dueño.
//
// Sin dependencias de columnas nuevas: el estado ("ya recordado", "ya vencido")
// se guarda como notas internas con un marcador machine-readable, de modo que el
// reloj se reinicia solo cuando entra un mensaje nuevo más reciente que la nota.
// ============================================================

export type SupportSla = {
  on: boolean;
  reminderH: number;   // horas sin respuesta del cliente → recordatorio
  closeH: number;      // horas sin respuesta del cliente → cierre automático
  ackMin: number;      // minutos esperando al equipo → avisar al equipo
  overdueMin: number;  // minutos esperando al equipo → marcar vencido + dueño
  quietOn: boolean;    // horario de silencio: no enviar avisos al equipo de noche
  quietStart: number;  // hora local de inicio del silencio (0-23), p. ej. 22
  quietEnd: number;    // hora local de fin del silencio (0-23), p. ej. 8
  quietTz: string;     // zona horaria IANA; '' = la del dueño (o America/New_York)
};

export const SLA_DEFAULT: SupportSla = { on: true, reminderH: 24, closeH: 72, ackMin: 30, overdueMin: 120, quietOn: true, quietStart: 22, quietEnd: 8, quietTz: '' };

// Hora local (0-23) en una zona horaria IANA. Si falla, usa la del servidor.
function hourInTz(tz: string): number {
  try { return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()), 10) % 24; }
  catch { return new Date().getHours(); }
}

// ¿Estamos ahora dentro del horario de silencio? (admite tramos que cruzan medianoche)
function inQuietHours(cfg: SupportSla, tz: string): boolean {
  if (!cfg.quietOn) return false;
  const h = hourInTz(tz);
  const s = cfg.quietStart, e = cfg.quietEnd;
  if (s === e) return false;
  return s < e ? (h >= s && h < e) : (h >= s || h < e);   // 22→8 cruza medianoche
}

export function slaConfig(): Promise<SupportSla> {
  return getSetting<SupportSla>('support_sla', SLA_DEFAULT).then((c) => ({ ...SLA_DEFAULT, ...(c || {}) }));
}

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Marcadores internos (van en una nota 'note', invisible para el cliente).
const M = {
  followup: '[[sla:followup]]',   // ya se envió recordatorio al cliente
  closed: '[[sla:closed]]',       // cerrado por inactividad
  ack: '[[sla:ack]]',             // ya se avisó al equipo que hay un cliente esperando
  overdue: '[[sla:overdue]]',     // ya se marcó vencido
};

// ¿Existe una nota con `marker` creada DESPUÉS de `afterIso`? (reloj por tramo)
function hasMarkerAfter(msgs: any[], marker: string, afterIso: string): boolean {
  const after = new Date(afterIso).getTime();
  return msgs.some((m) => m.sender === 'note' && typeof m.body === 'string' && m.body.includes(marker) && new Date(m.created_at).getTime() >= after);
}

async function addNote(ticketId: string, body: string) {
  try { await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'note', body }); } catch {}
}

// Avisa a todo el equipo por Telegram (los admins con chat vinculado).
async function pingTeamTelegram(text: string) {
  try {
    const { data: admins } = await supabaseAdmin.from('profiles').select('telegram_chat_id').eq('is_admin', true).not('telegram_chat_id', 'is', null);
    await Promise.all((admins || []).map((a: any) => a.telegram_chat_id).filter(Boolean).map((id: string) => sendMessage(id, text, { kind: 'support_sla' })));
  } catch {}
}

// Campana para todo el equipo (y, si se pide, solo dueños).
async function bellTeam(n: { title: string; body?: string; url?: string }, ownersOnly = false) {
  try {
    const { data: team } = await supabaseAdmin.from('profiles').select('id,email,role').eq('is_admin', true);
    const owners = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const targets = (team || []).filter((t: any) => !ownersOnly || t.role === 'owner' || owners.includes(String(t.email || '').toLowerCase()));
    await Promise.all(targets.map((t: any) => notify(t.id, { kind: 'support_sla', ...n })));
  } catch {}
}

export async function runSupportSla(dry = false): Promise<{ scanned: number; reminded: number; closed: number; acked: number; overdue: number }> {
  const out = { scanned: 0, reminded: 0, closed: 0, acked: 0, overdue: 0 };
  const cfg = await slaConfig();
  if (!cfg.on) return out;

  // Tickets vivos (abiertos / en progreso). Los resueltos no entran.
  const { data: tickets } = await supabaseAdmin
    .from('support_tickets')
    .select('id,email,subject,status,user_id,public_token')
    .in('status', ['open', 'in_progress'])
    .limit(500);
  if (!tickets?.length) return out;

  const ids = tickets.map((t: any) => t.id);
  const { data: allMsgs } = await supabaseAdmin
    .from('support_messages')
    .select('ticket_id,sender,body,created_at')
    .in('ticket_id', ids)
    .order('created_at', { ascending: true });
  const byTicket: Record<string, any[]> = {};
  (allMsgs || []).forEach((m: any) => { (byTicket[m.ticket_id] ||= []).push(m); });

  // Horario de silencio: usamos la zona del dueño (profiles.tz del primer admin) o la configurada.
  let tz = (cfg.quietTz || '').trim();
  if (!tz) {
    try { const { data } = await supabaseAdmin.from('profiles').select('tz').eq('is_admin', true).not('tz', 'is', null).limit(1).maybeSingle(); tz = (data as any)?.tz || 'America/New_York'; }
    catch { tz = 'America/New_York'; }
  }
  const quiet = inQuietHours(cfg, tz);

  const now = Date.now();
  for (const t of tickets) {
    const msgs = byTicket[t.id] || [];
    if (!msgs.length) continue;
    out.scanned++;

    // Último mensaje real (ignoramos notas internas) y de quién fue.
    const real = msgs.filter((m: any) => m.sender === 'user' || m.sender === 'admin' || m.sender === 'ai');
    if (!real.length) continue;
    const last = real[real.length - 1];
    const lastAt = last.created_at;
    const waitingOnClient = last.sender === 'admin' || last.sender === 'ai';
    const waitingOnTeam = last.sender === 'user';

    // --- Esperando al CLIENTE: recordatorio → cierre ---
    if (waitingOnClient) {
      const hrs = (now - new Date(lastAt).getTime()) / 3.6e6;
      if (hrs >= cfg.closeH) {
        if (!dry) {
          await supabaseAdmin.from('support_tickets').update({ status: 'resolved', updated_at: new Date().toISOString() }).eq('id', t.id);
          await addNote(t.id, `${M.closed} Cerrado automáticamente por inactividad (sin respuesta del cliente en ${cfg.closeH}h). Se reabre solo si el cliente responde el correo.`);
        }
        out.closed++;
        continue;
      }
      if (hrs >= cfg.reminderH && t.email && !hasMarkerAfter(msgs, M.followup, lastAt)) {
        if (!dry) {
          const { data: prof } = t.user_id
            ? await supabaseAdmin.from('profiles').select('lang').eq('id', t.user_id).maybeSingle()
            : { data: null } as any;
          const lang = (prof as any)?.lang === 'en' ? 'en' : 'es';
          const enlace = t.user_id ? `${SITE}/dashboard/soporte?ticket=${t.id}` : `${SITE}/contacto`;
          const tpl = await emailTplLive('support_followup', lang, { asunto: t.subject || (lang === 'en' ? 'your question' : 'tu consulta'), enlace });
          let replyTo = '';
          try { const { ensureTicketToken, replyToForTicket } = await import('@/lib/supportInbound'); replyTo = replyToForTicket(await ensureTicketToken(t.id)); } catch {}
          await sendEmail(t.email, tpl.subject, tpl.text, { htmlBody: tpl.html || undefined, ...(replyTo ? { replyTo } : {}) });
          await addNote(t.id, `${M.followup} Recordatorio enviado al cliente (sin respuesta en ${cfg.reminderH}h).`);
        }
        out.reminded++;
      }
      continue;
    }

    // --- Esperando al EQUIPO: avisar → vencido ---
    if (waitingOnTeam) {
      const mins = (now - new Date(lastAt).getTime()) / 6e4;
      const who = t.email || (t.user_id ? 'trader' : 'visitante');
      const link = `${SITE}/admin?tab=soporte&ticket=${t.id}`;
      if (mins >= cfg.overdueMin && !hasMarkerAfter(msgs, M.overdue, lastAt)) {
        if (!dry) {
          // Marcar prioridad alta se hace siempre (silencioso, no molesta a nadie).
          await supabaseAdmin.from('support_tickets').update({ priority: 'high', updated_at: new Date().toISOString() }).eq('id', t.id).then((r: any) => {
            if (r?.error) return supabaseAdmin.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', t.id);
          });
          // El aviso ruidoso (Telegram + campana) solo fuera del horario de silencio.
          // En silencio no escribimos el marcador, así que al terminar la noche sí avisa.
          if (!quiet) {
            await addNote(t.id, `${M.overdue} SLA incumplido: el cliente lleva más de ${Math.round(cfg.overdueMin)} min esperando sin respuesta del equipo.`);
            const subj = (t.subject || 'Sin asunto').slice(0, 100);
            await pingTeamTelegram(`🔴 <b>Ticket VENCIDO</b> (SLA incumplido)\n<b>${subj}</b>\nDe: ${who}\nLleva +${Math.round(mins)} min esperando. Respóndanlo ya.`);
            await bellTeam({ title: 'Ticket vencido (SLA)', body: `${subj} · esperando +${Math.round(mins)} min`, url: link }, true);
          }
        }
        if (!quiet) out.overdue++;
      } else if (mins >= cfg.ackMin && !hasMarkerAfter(msgs, M.ack, lastAt) && !hasMarkerAfter(msgs, M.overdue, lastAt)) {
        if (!dry && !quiet) {
          await addNote(t.id, `${M.ack} Aviso al equipo: cliente esperando hace ${Math.round(cfg.ackMin)} min.`);
          const subj = (t.subject || 'Sin asunto').slice(0, 100);
          await pingTeamTelegram(`⏰ <b>Cliente esperando</b>\n<b>${subj}</b>\nDe: ${who}\nSin respuesta hace ${Math.round(mins)} min. Ábranlo en Admin → Soporte.`);
          await bellTeam({ title: 'Cliente esperando respuesta', body: `${subj} · hace ${Math.round(mins)} min`, url: link });
        }
        if (!quiet) out.acked++;
      }
    }
  }
  return out;
}
