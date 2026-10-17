import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · abre un Stripe Checkout en modo 'setup' para GUARDAR una tarjeta (sin
// cobrar). Al terminar, el webhook (kind 'wallet_setup') guarda el método de
// pago en wallet_autoreload. Nunca vemos el número de la tarjeta.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });

    // Cliente Stripe (reutiliza si ya guardamos uno).
    let customer: string | null = null;
    try { const { data } = await (await import('@/lib/supabaseAdmin')).supabaseAdmin.from('wallet_autoreload').select('stripe_customer').eq('user_id', user.id).maybeSingle(); customer = (data as any)?.stripe_customer || null; } catch {}
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email || undefined, metadata: { userId: user.id } });
      customer = c.id;
    }

    let base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    if (!base) { const u = new URL(req.url); base = `${u.protocol}//${u.host}`; }
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      currency: 'usd',                       // requerido por Stripe en modo 'setup'
      customer,
      success_url: `${base}/dashboard/wallet?card=ok`,
      cancel_url: `${base}/dashboard/wallet?card=cancel`,
      metadata: { kind: 'wallet_setup', userId: user.id, customer },
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) { await logError('wallet_setup', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
