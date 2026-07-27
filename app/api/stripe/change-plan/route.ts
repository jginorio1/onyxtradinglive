import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, priceIdForPlan } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · cambia el plan de la suscripción ACTUAL (sin crear otra).
//   body: { plan, annual }
//   - Subir de plan  → inmediato, cobra la diferencia prorrateada.
//   - Bajar de plan  → se aplica al final del periodo (no cobra ahora, no quita nada).
// El webhook customer.subscription.updated actualiza profiles.plan solo.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

    const { plan, annual } = await req.json();
    if (!plan) return NextResponse.json({ error: 'missing plan' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id,plan').eq('id', user.id).maybeSingle();
    if (!prof?.stripe_subscription_id) return NextResponse.json({ error: 'No active subscription.', code: 'no_sub' }, { status: 400 });
    if (prof.plan === plan) return NextResponse.json({ error: 'Ya estás en ese plan.', code: 'same' }, { status: 400 });

    const newPrice = await priceIdForPlan(plan, !!annual);
    if (!newPrice) return NextResponse.json({ error: `El plan "${plan}" no tiene Price ID configurado.`, code: 'no_price' }, { status: 400 });

    // Orden de los planes para saber si sube o baja (precio del plan en la tabla).
    const { data: plans } = await supabaseAdmin.from('plans').select('id,price_month').order('price_month', { ascending: true });
    const rank = (id: string) => (plans || []).findIndex((p: any) => p.id === id);
    const isUpgrade = rank(plan) > rank(prof.plan);

    const sub: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
    // Solo tocamos el ítem del plan (el del precio anterior), no los add-ons.
    const currentPrice = await priceIdForPlan(prof.plan, sub.items.data[0]?.price?.recurring?.interval === 'year');
    const item = sub.items.data.find((i: any) => i.price?.id === currentPrice) || sub.items.data[0];

    await stripe.subscriptions.update(prof.stripe_subscription_id, {
      items: [{ id: item.id, price: newPrice }],
      // Subir: cobra la diferencia ya. Bajar: sin prorrateo (el precio nuevo aplica al renovar).
      proration_behavior: isUpgrade ? 'always_invoice' : 'none',
    } as any);

    // Al subir, el cambio es inmediato → reflejamos el plan ya (el webhook lo confirma).
    if (isUpgrade) await supabaseAdmin.from('profiles').update({ plan }).eq('id', user.id);

    return NextResponse.json({ ok: true, upgrade: isUpgrade });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
