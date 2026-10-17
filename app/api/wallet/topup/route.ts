import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';
import { pickLang } from '@/lib/i18n';
import { rateLimit, clientIp, tooMany } from '@/lib/ratelimit';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIN_USD = 5;
const MAX_USD = 2000;

// POST · recargar el monedero. method 'card' → Stripe Checkout; 'usdt' → pago cripto.
// Requiere sesión (el saldo es por usuario). El abono real lo hace el webhook de
// Stripe (kind 'wallet_topup') o la confirmación del pago USDT.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Inicia sesión para recargar.', code: 'auth' }, { status: 401 });

    const rl = await rateLimit('wallet_topup', clientIp(req), 10, 60);
    if (!rl.ok) return tooMany(rl.retryAfter, 'es');

    const b = await req.json().catch(() => ({} as any));
    const lang = pickLang(b.lang);
    const en = lang === 'en';
    const method = b.method === 'usdt' ? 'usdt' : 'card';
    const amount = Math.round(Number(b.amount) || 0);
    if (!(amount >= MIN_USD && amount <= MAX_USD)) {
      return NextResponse.json({ error: en ? `Amount between $${MIN_USD} and $${MAX_USD}.` : `Monto entre $${MIN_USD} y $${MAX_USD}.`, code: 'amount' }, { status: 400 });
    }

    // ---- USDT ----
    if (method === 'usdt') {
      const { cryptoEnabled, createCryptoPayment } = await import('@/lib/cryptoPay');
      if (!(await cryptoEnabled())) return NextResponse.json({ error: en ? 'USDT is not available now.' : 'USDT no está disponible ahora.', code: 'usdt_off' }, { status: 400 });
      const row = await createCryptoPayment({ userId: user.id, purpose: 'topup', refId: 'wallet', amountUsd: amount, name: en ? 'Onyx wallet top-up' : 'Recarga de monedero Onyx', network: b.network });
      return NextResponse.json({ ok: true, method: 'usdt', payment: { id: row.id, address: row.address, matchAmount: row.match_amount, network: row.network, hostedUrl: row.hosted_url || null } });
    }

    // ---- Tarjeta (Stripe Checkout) ----
    let base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    if (!base) { const u = new URL(req.url); base = `${u.protocol}//${u.host}`; }
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

    // Comisión de servicio escalonada (a más recarga, menor %). El cliente paga
    // amount + comisión en la tarjeta; el saldo recibe solo `amount` (el webhook
    // acredita metadata.amount, la base). La diferencia es nuestro ingreso.
    const { topupFeeCents } = await import('@/lib/usage');
    const feeCents = await topupFeeCents(amount);
    const chargeCents = amount * 100 + feeCents;

    const name = en ? 'Onyx wallet top-up' : 'Recarga de monedero Onyx';
    const feeLine = feeCents > 0 ? (en ? ` (incl. $${(feeCents / 100).toFixed(2)} service fee)` : ` (incl. comisión $${(feeCents / 100).toFixed(2)})`) : '';
    const embedded = b.embedded === true;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: chargeCents, product_data: { name: name + feeLine } } }],
      customer_email: user.email || undefined,
      metadata: { kind: 'wallet_topup', userId: user.id, amount: String(amount), fee_cents: String(feeCents), lang },
      ...(embedded
        // EMBEBIDO: dentro de Onyx, sin salir. Devuelve client_secret y al terminar
        // Stripe redirige a return_url (misma página, que detecta ?topup=ok).
        ? { ui_mode: 'embedded' as const, return_url: `${base}/dashboard/wallet?topup=ok` }
        // ALOJADO: para la app nativa, se abre en el navegador del sistema.
        : { success_url: `${base}/dashboard/wallet?topup=ok`, cancel_url: `${base}/dashboard/wallet?topup=cancel` }),
    });
    return NextResponse.json(embedded
      ? { ok: true, method: 'card', clientSecret: (session as any).client_secret, feeCents, chargeCents }
      : { ok: true, method: 'card', url: session.url, feeCents, chargeCents });
  } catch (e: any) {
    await logError('wallet_topup', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
