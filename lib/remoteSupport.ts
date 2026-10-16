import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting } from '@/lib/settings';
import { notifyNewTicket } from '@/lib/supportNotify';

// ============================================================
// Soporte remoto DE PAGO. La config OPERATIVA (on/precio/minutos/herramienta/
// enlace) vive en app_settings bajo 'remote_support' (la edita Admin → Soporte).
// El TEXTO del correo de confirmación vive en el sistema de plantillas
// (emailTemplates: 'remote_support'), editable y testeable desde Admin → Correos.
// Tras pagar (Stripe Checkout), fulfillRemoteSession deja el ticket en la
// bandeja, avisa al equipo y le manda al cliente el correo de la plantilla.
// ============================================================
export type RemoteSupport = {
  on: boolean; price: number; minutes: number; tool: string; link: string;
  schedule_link: string;   // enlace de agenda/cita (Calendly, etc.); opcional
};

export const REMOTE_DEFAULT: RemoteSupport = {
  on: false, price: 25, minutes: 30, tool: 'AnyDesk', link: 'https://anydesk.com/download',
  schedule_link: '',
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
  const sched = (cfg.schedule_link || '').trim();
  const firstMsg = (en
    ? `The client PAID for a remote support session ($${amt} · ${cfg.minutes} min). Tool: ${cfg.tool}. Contact them to agree a time and run the session.`
    : `El cliente PAGÓ una sesión de soporte remoto ($${amt} · ${cfg.minutes} min). Herramienta: ${cfg.tool}. Contáctalo para acordar hora y hacer la sesión.`)
    + (sched ? (en ? `\nScheduling link sent to the client: ${sched}` : `\nEnlace de cita enviado al cliente: ${sched}`) : '');
  try { await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'note', body: firstMsg }); } catch {}

  // Aviso al equipo (Telegram) de que entró una sesión remota pagada.
  try { await notifyNewTicket({ email, subject, isLead: !opts.userId }); } catch {}

  // Correo al cliente desde la PLANTILLA editable (Admin → Correos → 'remote_support').
  if (email) {
    try {
      const { emailTplLive } = await import('@/lib/emailTemplates');
      const { sendEmail } = await import('@/lib/mail');
      const em = await emailTplLive('remote_support', en ? 'en' : 'es', { minutos: cfg.minutes, tool: cfg.tool, link: cfg.link, cita: sched });
      // Si hay enlace de cita, lo añadimos al correo (texto y HTML) para que el
      // cliente agende su hora de una vez, sin depender de que el equipo escriba.
      let text = em.text, html = em.html || undefined;
      if (sched) {
        const line = en ? `Book your time here: ${sched}` : `Agenda tu hora aquí: ${sched}`;
        text = `${text}\n\n${line}`;
        if (html) html = `${html}<p style="margin:16px 0"><a href="${sched}">${en ? 'Book your time' : 'Agenda tu hora'}</a></p>`;
      }
      if (em.subject) await sendEmail(email, em.subject, text, { kind: 'support', htmlBody: html });
    } catch {}
  }

  return { ok: true, ticketId };
}
