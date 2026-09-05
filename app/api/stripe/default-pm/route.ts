import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · tras confirmar el SetupIntent, marca esa tarjeta como la predeterminada
// del cliente y de su suscripción (para los cobros futuros).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

    const { paymentMethodId } = await req.json();
    if (!paymentMethodId) return NextResponse.json({ error: 'missing pm' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id,stripe_subscription_id').eq('id', user.id).maybeSingle();
    if (!prof?.stripe_customer_id) return NextResponse.json({ error: 'no customer' }, { status: 400 });

    await stripe.customers.update(prof.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    if (prof.stripe_subscription_id) {
      try { await stripe.subscriptions.update(prof.stripe_subscription_id, { default_payment_method: paymentMethodId }); } catch {}
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
