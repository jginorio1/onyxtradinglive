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

    const name = en ? 'Onyx wallet top-up' : 'Recarga de monedero Onyx';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amount * 100, product_data: { name } } }],
      customer_email: user.email || undefined,
      success_url: `${base}/dashboard/wallet?topup=ok`,
      cancel_url: `${base}/dashboard/wallet?topup=cancel`,
      metadata: { kind: 'wallet_topup', userId: user.id, amount: String(amount), lang },
    });
    return NextResponse.json({ ok: true, method: 'card', url: session.url });
  } catch (e: any) {
    await logError('wallet_topup', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
