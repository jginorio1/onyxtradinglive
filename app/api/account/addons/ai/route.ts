import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { addonSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · fija cuántos paquetes de consultas de Onyx AI quiere el usuario.
// Cada paquete suma `ai_pack_qty` consultas a su tope mensual. Se cobra como un
// item recurrente en su suscripción (igual que las cuentas extra).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const s = await addonSettings();
    if (!s.ai_pack_enabled) return NextResponse.json({ error: 'Add-on disabled.', code: 'addon_off' }, { status: 400 });
    if (!s.ai_pack_price_id) return NextResponse.json({ error: 'Add-on price not configured.', code: 'no_price' }, { status: 400 });

    const { qty } = await req.json();
    const want = Math.max(0, Math.min(50, Number(qty) || 0));

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id,plan').eq('id', user.id).maybeSingle();
    if ((prof?.plan || 'free') === 'free') return NextResponse.json({ error: 'Upgrade to a paid plan to buy AI packs.', code: 'free_no_addon' }, { status: 400 });
    if (!prof?.stripe_subscription_id) return NextResponse.json({ error: 'No active subscription.', code: 'no_sub' }, { status: 400 });

    const sub: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
    const item = sub.items.data.find((i: any) => i.price?.id === s.ai_pack_price_id);

    if (want === 0 && item) {
      await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
    } else if (want > 0 && item) {
      await stripe.subscriptionItems.update(item.id, { quantity: want, proration_behavior: 'create_prorations' });
    } else if (want > 0 && !item) {
      await stripe.subscriptionItems.create({
        subscription: prof.stripe_subscription_id,
        price: s.ai_pack_price_id,
        quantity: want,
        proration_behavior: 'create_prorations',
      } as any);
    }

    await supabaseAdmin.from('profiles').update({ ai_packs: want }).eq('id', user.id);
    return NextResponse.json({ ok: true, qty: want, perPack: s.ai_pack_qty });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
