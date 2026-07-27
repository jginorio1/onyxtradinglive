import { logError } from '@/lib/errlog';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type MailOpts = { kind?: string; userId?: string | null; meta?: any };

// Deja constancia del envío (bandeja de salida / historial por usuario).
async function logMail(to: string, subject: string, ok: boolean, opts?: MailOpts) {
  try {
    await supabaseAdmin.from('email_log').insert({
      to_email: to, subject: subject?.slice(0, 200) || null,
      kind: opts?.kind || null, status: ok ? 'sent' : 'failed',
      user_id: opts?.userId || null, meta: opts?.meta || null,
    });
  } catch { /* si no está la tabla, no rompe el envío */ }
}

// Envío de correos transaccionales con Resend (API HTTP).
// Si no hay RESEND_API_KEY configurada, no envía y no falla:
// el soporte sigue funcionando dentro de la web.
export async function sendEmail(to: string, subject: string, text: string, opts?: MailOpts): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const from = process.env.SUPPORT_FROM_EMAIL || 'Onyx Trading Live <no-reply@onyxtradinglive.com>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); await logError('mail', `Resend ${r.status}: ${t.slice(0, 200)}`, { code: String(r.status) }); }
    await logMail(to, subject, r.ok, opts);
    return r.ok;
  } catch (e) {
    await logError('mail', e);
    await logMail(to, subject, false, opts);
    return false;
  }
}

export function mailEnabled() {
  return !!process.env.RESEND_API_KEY;
}
