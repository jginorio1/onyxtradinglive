import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleInboundEmail } from '@/lib/supportInbound';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Webhook de Resend INBOUND (correo entrante). Cuando un cliente RESPONDE al
// correo de su ticket, Resend envía aquí un evento 'email.received'. Lo metemos
// en el hilo del ticket para que se vea en Soporte (correo de vuelta → ticket).
// Firma verificada (Svix) con RESEND_INBOUND_SECRET (o RESEND_WEBHOOK_SECRET).
// ============================================================
function verify(payload: string, headers: Headers): boolean {
  const secret = process.env.RESEND_INBOUND_SECRET || process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto: aceptar (configúralo en producción)
  const id = headers.get('svix-id') || '';
  const ts = headers.get('svix-timestamp') || '';
  const sigHeader = headers.get('svix-signature') || '';
  if (!id || !ts || !sigHeader) return false;
  try {
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signed = `${id}.${ts}.${payload}`;
    const expected = crypto.createHmac('sha256', secretBytes).update(signed).digest('base64');
    const sigs = sigHeader.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
    return sigs.some((s) => { try { return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)); } catch { return false; } });
  } catch { return false; }
}

export async function POST(req: Request) {
  const payload = await req.text();
  if (!verify(payload, req.headers)) return NextResponse.json({ error: 'firma no válida' }, { status: 401 });
  let evt: any;
  try { evt = JSON.parse(payload); } catch { return NextResponse.json({ error: 'json' }, { status: 400 }); }

  try {
    if (evt?.type === 'email.received') {
      await handleInboundEmail(evt.data || {});
    }
  } catch (e) {
    await logError('resend_inbound', e);
  }
  // Siempre 200 para que Resend no reintente en bucle por un error nuestro.
  return NextResponse.json({ received: true });
}
