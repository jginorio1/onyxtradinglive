import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, priceIdForPlan } from '@/lib/stripe';
import { getSetting } from '@/lib/settings';
import { type Promo, type PromoQueue } from '@/lib/promo';

// Cupón de la barra de descuentos que está activa AHORA (on + dentro de fechas + con
// cupón). Ignora página/público a propósito: si algo se promociona, el descuento debe
// aplicarse igual en el checkout, venga de donde venga el visitante.
async function activeBarCoupon(): Promise<string> {
  try {
    const q = await getSetting<PromoQueue | null>('promo_queue', null as any);
    let bars = (q?.bars || []) as Promo[];
    if (!bars.length) { const old = await getSetting<Promo | null>('promo', null as any); if (old) bars = [old]; }
    const now = Date.now();
    for (const b of bars) {
      if (!b || !b.on || !b.coupon) continue;
      if (b.startsAt && new Date(b.startsAt).getTime() > now) continue;
      if (b.endsAt && new Date(b.endsAt).getTime() <= now) continue;
      return String(b.coupon).trim();
    }
  } catch {}
  return '';
}
// Convierte un código legible (PRO30) en el id del promotion code de Stripe (si existe y está activo).
async function promotionCodeId(code: string): Promise<string | null> {
  if (!code) return null;
  try { const r = await stripe.promotionCodes.list({ code: code.toUpperCase(), active: true, limit: 1 }); return (r.data[0] as any)?.id || null; } catch { return null; }
}

export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'You must sign in to subscribe.', code: 'no_auth' }, { status: 401 });

    const { plan, annual, embedded, coupon } = await req.json();
    const priceId = await priceIdForPlan(plan, !!annual);
    if (!priceId) return NextResponse.json({ error: `Plan "${plan}" has no Stripe Price ID configured (${annual ? 'yearly' : 'monthly'}).`, code: 'no_price' }, { status: 400 });

    // Descuento AUTOMÁTICO: cupón explícito del cliente (p. ej. embajador) o, si no,
    // el de la barra activa. Si lo resolvemos, lo aplicamos solo (discounts); si no,
    // dejamos que el cliente pegue uno a mano (allow_promotion_codes).
    const wantCode = (typeof coupon === 'string' && coupon.trim()) ? coupon.trim() : await activeBarCoupon();
    const discountId = await promotionCodeId(wantCode);
    const discountOpt: any = discountId ? { discounts: [{ promotion_code: discountId }] } : { allow_promotion_codes: true };

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
