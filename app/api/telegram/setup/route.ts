import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Registra (o comprueba) el webhook del bot en Telegram. Solo admin.
// Abre /api/telegram/setup en el navegador estando logueado como owner una
// vez tras el despliegue, y Telegram empezará a mandar los mensajes a la web.
export async function GET(req: Request) {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return NextResponse.json({ error: 'Falta TELEGRAM_BOT_TOKEN en las variables de entorno.' }, { status: 400 });

    const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '');
    const url = `${base}/api/telegram/webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

    const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secret || undefined,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }),
    });
    const j = await r.json();

    // También devolvemos el estado actual para confirmar
    const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((x) => x.json()).catch(() => null);

    return NextResponse.json({ set: j, webhookInfo: info?.result || null, pointedTo: url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
