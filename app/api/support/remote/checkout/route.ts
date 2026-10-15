import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';
import { getRemoteConfig } from '@/lib/remoteSupport';
import { pickLang } from '@/lib/i18n';
import { rateLimit, clientIp, tooMany } from '@/lib/ratelimit';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST público · crea el Stripe Checkout para pagar una sesión de soporte remoto.
// Con sesión usa el correo del usuario; sin sesión pide el correo en el body.
// Al pagar, el webhook (kind: 'remote_support') crea el ticket, avisa al equipo
// y le manda al cliente el enlace de la herramienta.
export async function POST(req: Request) {
  try {
    const cfg = await getRemoteConfig();
    if (!cfg.on) return NextResponse.json({ error: 'El soporte remoto no está disponible ahora.', code: 'off' }, { status: 400 });
    const amount = Math.max(1, Math.round(Number(cfg.price) || 0));
    if (amount <= 0) return NextResponse.json({ error: 'Precio no configurado.', code: 'noprice' }, { status: 400 });

    const rl = await rateLimit('remote_checkout', clientIp(req), 8, 60);
    if (!rl.ok) return tooMany(rl.retryAfter, 'es');

    const b = await req.json().catch(() => ({} as any));
    const lang = pickLang(b.lang);
    const en = lang === 'en';

    // Identidad: usuario con sesión → su correo; invitado → correo del body.
    let userId: string | null = null;
    let email = '';
    try {
      const sb = createSupabaseServer();
      const { data: { user } } = await sb.auth.getUser();
      if (user) { userId = user.id; email = user.email || ''; }
    } catch {}
    if (!email) email = String(b.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: en ? 'Enter a valid email.' : 'Pon un correo válido.', code: 'need_email' }, { status: 400 });
    }

    let base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    if (!base) { const u = new URL(req.url); base = `${u.protocol}//${u.host}`; }
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

    const name = en ? `Onyx remote support (${cfg.minutes} min)` : `Soporte remoto Onyx (${cfg.minutes} min)`;
    const desc = en ? 'One-time remote support session' : 'Sesión de soporte remoto (pago único)';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amount * 100, product_data: { name, description: desc } } }],
      customer_email: email,
      success_url: `${base}/?remote=ok`,
      cancel_url: `${base}/?remote=cancel`,
      metadata: { kind: 'remote_support', email, userId: userId || '', lang, amount: String(amount) },
    });

    return NextResponse.json({ ok: true, url: session.url, amount });
  } catch (e: any) {
    await logError('remote_checkout', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
