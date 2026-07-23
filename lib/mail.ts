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
    return r.ok;
  } catch {
    return false;
  }
}

export function mailEnabled() {
  return !!process.env.RESEND_API_KEY;
}
