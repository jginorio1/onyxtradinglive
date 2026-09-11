import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, priceIdForPlan } from '@/lib/stripe';
import { resolveActiveDiscount } from '@/lib/promoDiscount';

// Prueba de auto-servicio (con tarjeta): el cliente entra al plan y no se le cobra
// hasta el día N; si no cancela, Stripe cobra solo. Con tarjeta al inicio
// (payment_method_collection:'always') convierte mejor y evita abusos. Los días de
// prueba de CADA plan se editan en Admin → Planes (capabilities.trial_days, 0 = sin
// prueba). Solo se da a suscriptores NUEVOS, para que nadie la repita re-suscribiéndose.

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
    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id,stripe_subscription_id').eq('id', user.id).maybeSingle();
    let customer = prof?.stripe_customer_id;
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email!, metadata: { userId: user.id } });
      customer = c.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }

    // Días de prueba del plan (configurable en Admin → Planes). Solo a suscriptores
    // nuevos, para que nadie repita la prueba re-suscribiéndose.
    const { data: planRow } = await supabaseAdmin.from('plans').select('capabilities').eq('id', String(plan)).maybeSingle();
    const trialDays = Math.max(0, Math.min(90, Math.round(Number((planRow as any)?.capabilities?.trial_days) || 0)));
    const wantTrial = trialDays > 0 && !(prof as any)?.stripe_subscription_id;
    // subscription_data: metadata siempre; con prueba, N días sin cobro y, si al
    // terminar no hay tarjeta válida, se cancela (no se cobra sorpresa).
    const subData: any = { metadata: { userId: user.id } };
    if (wantTrial) {
      subData.trial_period_days = trialDays;
      subData.trial_settings = { end_behavior: { missing_payment_method: 'cancel' } };
    }
    // Pedimos la tarjeta SIEMPRE (también durante la prueba) para que el cobro sea
    // automático al terminar y para filtrar a los que solo quieren gratis.
    const pmc = wantTrial ? { payment_method_collection: 'always' } : {};

    // Checkout EMBEBIDO: se renderiza dentro de Onyx (mismo diseño), no redirige.
    if (embedded) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ui_mode: 'embedded',
        customer,
        line_items: [{ price: priceId, quantity: 1 }],
        ...discountOpt, // descuento auto (barra/embajador) o dejar pegar a mano
        ...pmc,
        subscription_data: subData,
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
      ...pmc,
      subscription_data: subData,
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancel`,
      metadata: { userId: user.id },
    } as any);
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('checkout error', e);
    return NextResponse.json({ error: `Stripe: ${e?.message || 'unknown error'}`, code: 'stripe' }, { status: 500 });
  }
}
