import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { addonSettings } from '@/lib/settings';
import { canUserAction } from '@/lib/perms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Add-ons RECURRENTES (los que viven en la suscripción de Stripe: cuenta extra,
// esclava, master, módulo de robots). Permite al admin VER cuáles tiene activos
// y AÑADIR/QUITAR a mano cuando una activación automática falló. El cobro lo
// prorratea Stripe en la próxima factura (no cobro inmediato).
//
// Cada add-on se identifica por su Price ID configurado en Planes → Complementos.
const KEYS = ['extra_account', 'extra_slave', 'extra_master', 'algo'] as const;
type Key = typeof KEYS[number];
const LABEL: Record<Key, string> = {
  extra_account: 'Cuenta extra', extra_slave: 'Esclava extra (Copy)',
  extra_master: 'Master extra (Copy)', algo: 'Módulo de robots',
};

async function defs() {
  const a: any = await addonSettings();
  return KEYS.map((k) => ({
    key: k, label: LABEL[k],
    priceId: String(a[`${k}_price_id`] || ''),
    price: Number(a[`${k}_price`]) || 0,
    enabled: a[`${k}_enabled`] !== false,
  }));
}

export async function GET(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id').eq('id', id).maybeSingle();
    const subId = (prof as any)?.stripe_subscription_id;
    const d = await defs();
    if (!subId) return NextResponse.json({ hasSub: false, addons: d.map((x) => ({ ...x, qty: 0 })) });
    const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] } as any);
    const items: any[] = sub?.items?.data || [];
    // Mapea cada add-on a la cantidad que tiene en la suscripción (por su Price ID).
    const addons = d.map((x) => {
      const it = x.priceId ? items.find((i) => i.price?.id === x.priceId) : null;
      return { ...x, qty: it ? (it.quantity || 1) : 0 };
    });
    return NextResponse.json({ hasSub: true, status: sub.status, addons });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin, user, role, perms } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    // Asignar/quitar add-ons cambia la facturación: exige el permiso fino 'addons'.
    if (!canUserAction(role, perms, 'addons')) return NextResponse.json({ error: 'Sin permiso para asignar add-ons del plan', code: 'noperm' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const id = String(b.id || '');
    const key = String(b.key || '') as Key;
    const action = String(b.action || 'add');   // 'add' | 'remove' | 'setqty'
    const qty = Math.max(0, Math.min(99, Math.round(Number(b.qty))));
    if (!id || !KEYS.includes(key)) return NextResponse.json({ error: 'Parámetros inválidos.', code: 'bad_params' }, { status: 400 });

    const d = (await defs()).find((x) => x.key === key)!;
    if (!d.priceId) return NextResponse.json({ error: `El add-on "${d.label}" no tiene Price ID configurado en Planes.`, code: 'no_price' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_subscription_id').eq('id', id).maybeSingle();
    const subId = (prof as any)?.stripe_subscription_id;
    if (!subId) return NextResponse.json({ error: 'El usuario no tiene una suscripción activa.', code: 'no_sub' }, { status: 400 });

    const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] } as any);
    const items: any[] = sub?.items?.data || [];
    const existing = items.find((i) => i.price?.id === d.priceId);
    const PR = { proration_behavior: 'create_prorations' } as any;

    if (action === 'remove') {
      if (existing) await stripe.subscriptionItems.del(existing.id, PR);
    } else if (action === 'setqty') {
      if (qty <= 0) { if (existing) await stripe.subscriptionItems.del(existing.id, PR); }
      else if (existing) await stripe.subscriptionItems.update(existing.id, { quantity: qty, ...PR });
      else await stripe.subscriptionItems.create({ subscription: subId, price: d.priceId, quantity: qty, ...PR });
    } else { // add: +1 (o crea en 1)
      if (existing) await stripe.subscriptionItems.update(existing.id, { quantity: (existing.quantity || 1) + 1, ...PR });
      else await stripe.subscriptionItems.create({ subscription: subId, price: d.priceId, quantity: 1, ...PR });
    }

    await logAdmin(user.email, 'user_addon', id, { key, action, qty });
    // Devuelve el estado actualizado.
    const sub2: any = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] } as any);
    const items2: any[] = sub2?.items?.data || [];
    const now = items2.find((i) => i.price?.id === d.priceId);
    return NextResponse.json({ ok: true, key, qty: now ? (now.quantity || 1) : 0 });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
