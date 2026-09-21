import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { addonSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · activa/desactiva el add-on del módulo de bots ({ on: true|false }).
// Añade o quita un item recurrente en la suscripción de Stripe y marca el perfil.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const s = await addonSettings();
    if (!s.algo_enabled) return NextResponse.json({ error: 'Add-on disabled.', code: 'addon_off' }, { status: 400 });
    if (!s.algo_price_id) return NextResponse.json({ error: 'Add-on price not configured.', code: 'no_price' }, { status: 400 });

    const { on } = await req.json();
    const want = !!on;

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id').eq('id', user.id).maybeSingle();
    if (!prof?.stripe_subscription_id) return NextResponse.json({ error: 'Necesitas una suscripción activa para añadir el módulo. | You need an active subscription to add the module.', code: 'no_sub' }, { status: 400 });

    const sub: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
    const item = sub.items.data.find((i: any) => i.price?.id === s.algo_price_id);

    if (want && !item) {
      await stripe.subscriptionItems.create({ subscription: prof.stripe_subscription_id, price: s.algo_price_id, quantity: 1, proration_behavior: 'create_prorations' } as any);
    } else if (!want && item) {
      await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
    }

    await supabaseAdmin.from('profiles').update({ addon_algo: want }).eq('id', user.id);
    return NextResponse.json({ ok: true, on: want });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
