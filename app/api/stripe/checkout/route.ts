import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, priceIdForPlan } from '@/lib/stripe';
import { resolveActiveDiscount } from '@/lib/promoDiscount';

export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'You must sign in to subscribe.', code: 'no_auth' }, { status: 401 });

    const { plan, annual, embedded, coupon } = await req.json();
    const priceId = await priceIdForPlan(plan, !!annual);
    if (!priceId) return NextResponse.json({ error: `Plan "${plan}" has no Stripe Price ID configured (${annual ? 'yearly' : 'monthly'}).`, code: 'no_price' }, { status: 400 });

    // Descuento AUTOMÁTICO: cupón explícito del cliente (p. ej. embajador) o, si no,
    // el de la barra activa. La misma lógica que usa el diagnóstico del admin.
    const disc = await resolveActiveDiscount(stripe, typeof coupon === 'string' ? coupon : undefined);
    const discountOpt: any = disc.discountOpt;
    console.log('[checkout] descuento:', disc.reason, 'code=', disc.code, 'percent=', disc.percent, 'bar=', disc.barName);

    // La URL base debe ser absoluta; si falta o está mal, Stripe rechaza la sesión.
    let base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
    if (!base) { const u = new URL(req.url); base = `${u.protocol}//${u.host}`; }
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

    // cliente de Stripe (crear si no existe)
    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    let customer = prof?.stripe_customer_id;
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email!, metadata: { userId: user.id } });
      customer = c.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }

    // Checkout EMBEBIDO: se renderiza dentro de Onyx (mismo diseño), no redirige.
    if (embedded) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ui_mode: 'embedded',
        customer,
        line_items: [{ price: priceId, quantity: 1 }],
        ...discountOpt, // descuento auto (barra/embajador) o dejar pegar a mano
        return_url: `${base}/dashboard?checkout=success`,
        metadata: { userId: user.id },
      } as any);
      return NextResponse.json({ clientSecret: (session as any).client_secret });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      ...discountOpt, // descuento auto (barra/embajador) o dejar pegar el cupón a mano
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancel`,
      metadata: { userId: user.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('checkout error', e);
    return NextResponse.json({ error: `Stripe: ${e?.message || 'unknown error'}`, code: 'stripe' }, { status: 500 });
  }
}
