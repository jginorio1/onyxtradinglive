import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, priceIdForPlan } from '@/lib/stripe';

export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const { plan, annual } = await req.json();
  const priceId = await priceIdForPlan(plan, !!annual);
  if (!priceId) return NextResponse.json({ error: 'plan inválido o precio no configurado en Stripe' }, { status: 400 });

  // cliente de Stripe (crear si no existe)
  const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  let customer = prof?.stripe_customer_id;
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email!, metadata: { userId: user.id } });
    customer = c.id;
    await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
  }

  const base = process.env.NEXT_PUBLIC_APP_URL;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/dashboard?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancel`,
    metadata: { userId: user.id },
  });
  return NextResponse.json({ url: session.url });
}
