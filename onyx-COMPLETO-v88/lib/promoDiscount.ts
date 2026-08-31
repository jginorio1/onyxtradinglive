// Resolución del descuento AUTOMÁTICO del checkout, en un solo sitio (lo usan el
// checkout y el diagnóstico del admin, para que nunca se desincronicen).
//
// Devuelve la opción lista para Stripe (`discountOpt`) + un diagnóstico de por qué.
import { getSetting } from '@/lib/settings';
import { type Promo, type PromoQueue } from '@/lib/promo';

// Cupón de la barra activa AHORA (encendida + dentro de fechas + con cupón).
// Ignora página/público: si algo se promociona, el descuento aplica igual.
export async function activeBarCoupon(): Promise<{ code: string; barName: string; reason: string }> {
  try {
    const q = await getSetting<PromoQueue | null>('promo_queue', null as any);
    let bars = (q?.bars || []) as Promo[];
    if (!bars.length) { const old = await getSetting<Promo | null>('promo', null as any); if (old) bars = [old]; }
    if (!bars.length) return { code: '', barName: '', reason: 'no_bars' };
    const now = Date.now();
    let sawActiveNoCoupon = false;
    for (const b of bars) {
      if (!b || !b.on) continue;
      if (b.startsAt && new Date(b.startsAt).getTime() > now) continue;   // aún no empieza
      if (b.endsAt && new Date(b.endsAt).getTime() <= now) continue;      // ya terminó
      if (!b.coupon || !String(b.coupon).trim()) { sawActiveNoCoupon = true; continue; }
      return { code: String(b.coupon).trim(), barName: b.name || '', reason: 'ok' };
    }
    return { code: '', barName: '', reason: sawActiveNoCoupon ? 'active_bar_without_coupon' : 'no_active_bar' };
  } catch (e: any) {
    return { code: '', barName: '', reason: 'error:' + (e?.message || '') };
  }
}

export type DiscountResolution = {
  code: string;
  barName: string;
  promotionCodeId: string | null;
  couponId: string | null;
  percent: number | null;
  discountOpt: any;   // { discounts:[...] }  o  { allow_promotion_codes:true }
  reason: string;     // por qué (ver abajo)
};

// Resuelve el descuento a aplicar. `explicitCode` gana (p. ej. cupón de embajador).
// Prioridad: 1) Promotion Code activo con ese texto → discounts:[{promotion_code}]
//            2) Coupon "Onyx {CODE}" válido       → discounts:[{coupon}]
//            3) nada → allow_promotion_codes (campo manual)
export async function resolveActiveDiscount(stripe: any, explicitCode?: string): Promise<DiscountResolution> {
  const fromBar = explicitCode && explicitCode.trim() ? { code: explicitCode.trim(), barName: '(cliente)', reason: 'ok' } : await activeBarCoupon();
  const base: DiscountResolution = { code: fromBar.code, barName: fromBar.barName, promotionCodeId: null, couponId: null, percent: null, discountOpt: { allow_promotion_codes: true }, reason: fromBar.reason };
  if (!fromBar.code) return { ...base, reason: fromBar.reason };  // no hay barra/cupón

  const up = fromBar.code.toUpperCase();

  // 1) Promotion Code activo con ese texto.
  try {
    const r = await stripe.promotionCodes.list({ code: up, active: true, limit: 1 });
    const pc: any = r.data[0];
    if (pc) return { code: up, barName: fromBar.barName, promotionCodeId: pc.id, couponId: pc.coupon?.id || null, percent: pc.coupon?.percent_off ?? null, discountOpt: { discounts: [{ promotion_code: pc.id }] }, reason: 'promotion_code' };
  } catch (e: any) { return { ...base, code: up, reason: 'stripe_error:' + (e?.message || '') }; }

  // 2) Cupón suelto "Onyx {CODE}" (por si existe el coupon pero no el promotion code).
  try {
    const cs = await stripe.coupons.list({ limit: 100 });
    const c: any = cs.data.find((x: any) => x.valid && String(x.name || '').toUpperCase() === `ONYX ${up}`);
    if (c) return { code: up, barName: fromBar.barName, promotionCodeId: null, couponId: c.id, percent: c.percent_off ?? null, discountOpt: { discounts: [{ coupon: c.id }] }, reason: 'coupon' };
  } catch {}

  // 3) No existe en Stripe → campo manual.
  return { ...base, code: up, reason: 'not_in_stripe' };
}
