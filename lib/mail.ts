import { logError } from '@/lib/errlog';

// Envío de correos transaccionales con Resend (API HTTP).
// Si no hay RESEND_API_KEY configurada, no envía y no falla:
// el soporte sigue funcionando dentro de la web.
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
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
    return r.ok;
  } catch (e) {
    await logError('mail', e);
    return false;
  }
}

export function mailEnabled() {
  return !!process.env.RESEND_API_KEY;
}
