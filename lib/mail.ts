import { logError } from '@/lib/errlog';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type MailOpts = { kind?: string; userId?: string | null; meta?: any; unsub?: string | null;
  from?: string;        // remitente completo, p. ej. "Academia de Juan <no-reply@onyxtradinglive.com>"
  brandName?: string;   // nombre en la cabecera del correo (por defecto "Onyx Trading Live")
  brandLogo?: string;   // logo en la cabecera (por defecto el de Onyx)
  replyTo?: string;     // a dónde llega la respuesta del destinatario (Reply-To)
};

// Construye un remitente "Nombre <dirección>" reutilizando la dirección verificada
// de SUPPORT_FROM_EMAIL. Así un correo puede salir con el nombre de la academia
// sin cambiar de dominio (que es lo que Resend tiene verificado).
export function fromWithName(name: string): string {
  const base = process.env.SUPPORT_FROM_EMAIL || 'Onyx Trading Live <no-reply@onyxtradinglive.com>';
  const m = base.match(/<([^>]+)>/);
  const addr = m ? m[1] : base;
  const clean = String(name || '').replace(/[<>"]/g, '').trim().slice(0, 60) || 'Onyx Trading Live';
  return `${clean} <${addr}>`;
}

// --- Formato de correo: convierte el texto (con markdown básico) a HTML
// limpio y profesional, con la marca Onyx. Compatible con clientes de correo
// (estilos en línea, tablas). Devuelve { html, text } listos para enviar.
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function inlineMd(s: string) {
  let out = esc(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');           // **negrita**
  out = out.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#5b6cff;text-decoration:underline;">$1</a>'); // enlaces
  return out;
}

function bodyToHtml(text: string) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let html = ''; let inList = false; let para: string[] = [];
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  const flushPara = () => { if (para.length) { html += `<p style="margin:0 0 14px;line-height:1.6;color:#1a1d24;">${para.join('<br>')}</p>`; para = []; } };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flushPara(); closeList(); continue; }
    const m = t.match(/^[-•*]\s+(.*)$/);
    if (m) { flushPara(); if (!inList) { html += '<ul style="margin:0 0 14px;padding-left:20px;color:#1a1d24;">'; inList = true; } html += `<li style="margin:0 0 6px;line-height:1.5;">${inlineMd(m[1])}</li>`; }
    else if (t === '—' || t === '--') { flushPara(); closeList(); html += '<hr style="border:none;border-top:1px solid #e7e9ef;margin:16px 0;">'; }
    else { closeList(); para.push(inlineMd(t)); }
  }
  flushPara(); closeList();
  return html;
}

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
const LOGO = process.env.EMAIL_LOGO_URL || `${SITE}/onyx-symbol.png`;

function renderEmailHtml(text: string, unsub?: string | null, brand?: { name?: string; logo?: string }) {
  const body = bodyToHtml(text);
  const bName = esc(brand?.name || 'Onyx Trading Live');
  const bLogo = brand?.logo || LOGO;
  const unsubRow = unsub
    ? `<br><a href="${unsub}" style="color:#8a90a0;text-decoration:underline;">Darte de baja de estos correos / Unsubscribe</a>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eef0f4;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e6ec;">
<tr><td style="background:#121829;padding:16px 28px;">
<img src="${bLogo}" alt="${bName}" width="26" height="26" style="vertical-align:middle;border:0;display:inline-block;">
<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.3px;vertical-align:middle;margin-left:9px;">${bName}</span>
</td></tr>
<tr><td style="padding:26px 28px;font-size:15px;color:#1a1d24;">${body}</td></tr>
<tr><td style="background:#f6f7f9;padding:16px 28px;color:#8a90a0;font-size:12px;border-top:1px solid #eceef2;line-height:1.5;">
✉️ Puedes responder a este correo y te contestamos.<br>
Onyx Trading Live · <a href="https://www.onyxtradinglive.com" style="color:#5b6cff;text-decoration:none;">onyxtradinglive.com</a>${unsubRow}
</td></tr>
</table></td></tr></table></body></html>`;
}

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
  return (await sendEmailId(to, subject, text, opts)).ok;
}

// Igual que sendEmail pero devuelve además el id del mensaje de Resend, para
// poder correlacionar aperturas/clics del webhook con quién lo recibió.
export async function sendEmailId(to: string, subject: string, text: string, opts?: MailOpts): Promise<{ ok: boolean; id: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { ok: false, id: null };
  const from = opts?.from || process.env.SUPPORT_FROM_EMAIL || 'Onyx Trading Live <no-reply@onyxtradinglive.com>';
  // Versión de texto plano (sin markdown) como respaldo, y versión HTML con marca.
  const plain = String(text || '').replace(/\*\*(.+?)\*\*/g, '$1') + (opts?.unsub ? `\n\n—\nDarte de baja / Unsubscribe: ${opts.unsub}` : '');
  const html = renderEmailHtml(text, opts?.unsub, (opts?.brandName || opts?.brandLogo) ? { name: opts?.brandName, logo: opts?.brandLogo } : undefined);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: plain, html, ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}) }),
    });
    let id: string | null = null;
    if (r.ok) { try { const j = await r.json(); id = j?.id || j?.data?.id || null; } catch {} }
    else { const t = await r.text().catch(() => ''); await logError('mail', `Resend ${r.status}: ${t.slice(0, 200)}`, { code: String(r.status) }); }
    await logMail(to, subject, r.ok, opts);
    return { ok: r.ok, id };
  } catch (e) {
    await logError('mail', e);
    await logMail(to, subject, false, opts);
    return { ok: false, id: null };
  }
}

export function mailEnabled() {
  return !!process.env.RESEND_API_KEY;
}

// Dirección de envío configurada (la que ve el destinatario como remitente).
export function mailFromAddress(): string {
  const base = process.env.SUPPORT_FROM_EMAIL || 'Onyx Trading Live <no-reply@onyxtradinglive.com>';
  const m = base.match(/<([^>]+)>/);
  return m ? m[1] : base;
}
export function mailFromDomain(): string {
  const addr = mailFromAddress();
  const at = addr.indexOf('@');
  return at >= 0 ? addr.slice(at + 1) : '';
}

// Estado del dominio en Resend: para avisar en el panel si NO está verificado
// (que es la causa #1 de que los correos no salgan o caigan en spam).
// Devuelve { enabled, from, domain, verified, checked }.
export async function mailDomainStatus(): Promise<{ enabled: boolean; from: string; domain: string; verified: boolean | null; checked: boolean; note?: string }> {
  const enabled = mailEnabled();
  const from = mailFromAddress();
  const domain = mailFromDomain();
  if (!enabled) return { enabled: false, from, domain, verified: null, checked: false, note: 'Sin RESEND_API_KEY' };
  try {
    const r = await fetch('https://api.resend.com/domains', {
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!r.ok) return { enabled, from, domain, verified: null, checked: false, note: `Resend ${r.status}` };
    const j = await r.json().catch(() => ({}));
    const list: any[] = j?.data || j?.domains || [];
    const match = list.find((d) => String(d?.name || '').toLowerCase() === domain.toLowerCase());
    const verified = match ? String(match.status || '').toLowerCase() === 'verified' : false;
    return { enabled, from, domain, verified, checked: true };
  } catch (e) {
    return { enabled, from, domain, verified: null, checked: false, note: 'No se pudo consultar Resend' };
  }
}
