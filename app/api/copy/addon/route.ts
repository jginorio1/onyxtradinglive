import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { addonSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · fija cuántas cuentas esclava extra quiere el usuario (add-on de copy trading).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const s = await addonSettings();
    if (!s.extra_slave_enabled) return NextResponse.json({ error: 'Add-on disabled.', code: 'addon_off' }, { status: 400 });
    if (!s.extra_slave_price_id) return NextResponse.json({ error: 'Add-on price not configured.', code: 'no_price' }, { status: 400 });

    const { qty } = await req.json();
    const want = Math.max(0, Math.min(50, Number(qty) || 0));

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id,plan,extra_slaves').eq('id', user.id).maybeSingle();
    if (!prof?.stripe_subscription_id) return NextResponse.json({ error: 'No active subscription.', code: 'no_sub' }, { status: 400 });

    // Regla: para comprar esclavas extra hay que tener al menos 2 cuentas
    // conectadas (una Master + una Esclava). Comprar capacidad sin cuentas no sirve.
    if (want > (Number(prof.extra_slaves) || 0)) {
      const { count: accs } = await supabaseAdmin.from('trading_accounts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((accs || 0) < 2) return NextResponse.json({ error: 'Conecta al menos 2 cuentas (Master y Esclava) para comprar esclavas extra.', code: 'need_accounts' }, { status: 400 });
    }

    // No bajar por debajo de los enlaces que ya tiene creados.
    const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
    const base = Number((plan?.capabilities as any)?.copy_slaves) || 2;
    const { count: used } = await supabaseAdmin.from('copy_links').select('*', { count: 'exact', head: true }).eq('owner_id', user.id);
    if ((used || 0) > base + want) {
      return NextResponse.json({ error: 'Borra enlaces primero.', code: 'below_used', used, allowed: base + want }, { status: 400 });
    }

    const sub: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
    const item = sub.items.data.find((i: any) => i.price?.id === s.extra_slave_price_id);

    if (want === 0 && item) await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
    else if (want > 0 && item) await stripe.subscriptionItems.update(item.id, { quantity: want, proration_behavior: 'create_prorations' });
    else if (want > 0 && !item) await stripe.subscriptionItems.create({ subscription: prof.stripe_subscription_id, price: s.extra_slave_price_id, quantity: want, proration_behavior: 'create_prorations' } as any);

    await supabaseAdmin.from('profiles').update({ extra_slaves: want }).eq('id', user.id);
    return NextResponse.json({ ok: true, qty: want });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
