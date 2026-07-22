import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { addonSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · fija cuántas cuentas MT extra quiere el usuario
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const s = await addonSettings();
    if (!s.extra_account_enabled) return NextResponse.json({ error: 'Add-on disabled.', code: 'addon_off' }, { status: 400 });
    if (!s.extra_account_price_id) return NextResponse.json({ error: 'Add-on price not configured.', code: 'no_price' }, { status: 400 });

    const { qty } = await req.json();
    const want = Math.max(0, Math.min(50, Number(qty) || 0));

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id,extra_accounts').eq('id', user.id).maybeSingle();
    if (!prof?.stripe_subscription_id) return NextResponse.json({ error: 'No active subscription.', code: 'no_sub' }, { status: 400 });

    // No dejar bajar por debajo de las cuentas que ya tiene conectadas
    const { count: used } = await supabaseAdmin.from('api_keys').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('revoked', false);
    const { data: planRow } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const { data: plan } = await supabaseAdmin.from('plans').select('max_accounts').eq('id', planRow?.plan || 'free').maybeSingle();
    const base = Number(plan?.max_accounts ?? 1);
    if (base < 999 && (used || 0) > base + want) {
      return NextResponse.json({ error: 'Revoke keys first.', code: 'addon_below_used', used, allowed: base + want }, { status: 400 });
    }

    const sub: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
    const item = sub.items.data.find((i: any) => i.price?.id === s.extra_account_price_id);

    if (want === 0 && item) {
      await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
    } else if (want > 0 && item) {
      await stripe.subscriptionItems.update(item.id, { quantity: want, proration_behavior: 'create_prorations' });
    } else if (want > 0 && !item) {
      await stripe.subscriptionItems.create({
        subscription: prof.stripe_subscription_id,
        price: s.extra_account_price_id,
        quantity: want,
        proration_behavior: 'create_prorations',
      } as any);
    }

    await supabaseAdmin.from('profiles').update({ extra_accounts: want }).eq('id', user.id);
    return NextResponse.json({ ok: true, qty: want });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
