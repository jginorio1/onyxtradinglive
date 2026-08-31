import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Webhook de Resend: recibe eventos de entrega/apertura/clic/rebote y actualiza
// campaign_sends para tener métricas reales por campaña. La firma se verifica
// con RESEND_WEBHOOK_SECRET (esquema Svix). Si no hay secreto configurado, no
// verifica (útil en pruebas) pero lo ideal es ponerlo en Vercel.
// ============================================================

// Verificación de firma Svix (la que usa Resend).
function verify(payload: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto: aceptar (configúralo para producción)
  const id = headers.get('svix-id') || '';
  const ts = headers.get('svix-timestamp') || '';
  const sigHeader = headers.get('svix-signature') || '';
  if (!id || !ts || !sigHeader) return false;
  try {
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signed = `${id}.${ts}.${payload}`;
    const expected = crypto.createHmac('sha256', secretBytes).update(signed).digest('base64');
    // El header trae una o más firmas "v1,<base64>" separadas por espacio.
    const sigs = sigHeader.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
    return sigs.some((s) => {
      try { return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)); } catch { return false; }
    });
  } catch { return false; }
}

export async function POST(req: Request) {
  const payload = await req.text();
  if (!verify(payload, req.headers)) return NextResponse.json({ error: 'firma no válida' }, { status: 401 });

  let evt: any;
  try { evt = JSON.parse(payload); } catch { return NextResponse.json({ error: 'json' }, { status: 400 }); }

  const type: string = evt?.type || '';
  const data = evt?.data || {};
  const emailId: string = data?.email_id || data?.id || '';
  const to: string = Array.isArray(data?.to) ? data.to[0] : (data?.to || '');
  const nowIso = new Date().toISOString();

  // Filtro: preferimos el id de Resend; si no, caemos al correo del evento.
  const by = emailId ? 'resend_id' : 'email';
  const val = emailId || to;
  if (!val) return NextResponse.json({ ok: true, ignored: 'no-ref' });

  const patch: any = {};
  if (type === 'email.delivered') patch.delivered_at = nowIso;
  else if (type === 'email.opened') patch.opened_at = nowIso;
  else if (type === 'email.clicked') { patch.clicked_at = nowIso; patch.opened_at = nowIso; }
  else if (type === 'email.bounced') patch.status = 'bounced';
  else if (type === 'email.complained') patch.status = 'complained';
  else return NextResponse.json({ ok: true, ignored: type });

  try {
    await supabaseAdmin.from('campaign_sends').update(patch).eq(by, val);
    // Un rebote/queja marca al usuario para no volver a mandarle marketing.
    if ((type === 'email.bounced' || type === 'email.complained') && to) {
      await supabaseAdmin.from('profiles').update({ marketing_emails: false }).eq('email', to);
    }
  } catch (e) { await logError('resend_webhook', e); }

  return NextResponse.json({ ok: true });
}
