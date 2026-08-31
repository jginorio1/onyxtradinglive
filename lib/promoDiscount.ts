// Resolución del descuento AUTOMÁTICO del checkout, en un solo sitio (lo usan el
// checkout y el diagnóstico del admin, para que nunca se desincronicen).
//
// PRIORIDAD (Stripe solo permite UN descuento por pago):
//   1) Código explícito que trae el cliente (enlace ?promo=CODE o cupón de embajador)
//   2) Promo general de una barra en modo 'auto' activa ahora
//   3) Campo manual (allow_promotion_codes) → el cliente pega su propio cupón
//   4) Precio completo
//
// Modos por barra:  'auto' = para todos durante la promo · 'link' = solo por enlace.
// Flag global promo_flags.letCustomerCoupon = true → aunque haya promo 'auto', NO se
// fuerza: se deja el campo manual para que el cliente use su propio cupón.
import { getSetting } from '@/lib/settings';
import { type Promo, type PromoQueue } from '@/lib/promo';

export type PromoFlags = { letCustomerCoupon: boolean };
export const PROMO_FLAGS_DEFAULT: PromoFlags = { letCustomerCoupon: false };
export const promoFlags = () => getSetting<PromoFlags>('promo_flags', PROMO_FLAGS_DEFAULT);

async function loadBars(): Promise<Promo[]> {
  const q = await getSetting<PromoQueue | null>('promo_queue', null as any);
  let bars = (q?.bars || []) as Promo[];
  if (!bars.length) { const old = await getSetting<Promo | null>('promo', null as any); if (old) bars = [old]; }
  return bars;
}
const withinWindow = (b: Promo, now: number) =>
  !!b && !!b.on &&
  !(b.startsAt && new Date(b.startsAt).getTime() > now) &&
  !(b.endsAt && new Date(b.endsAt).getTime() <= now);

// Cupón de la barra 'auto' activa AHORA (para todos). Las de modo 'link' NO cuentan aquí.
export async function activeBarCoupon(): Promise<{ code: string; barName: string; reason: string }> {
  try {
    const bars = await loadBars();
    if (!bars.length) return { code: '', barName: '', reason: 'no_bars' };
    const now = Date.now();
    let sawActiveNoCoupon = false;
    for (const b of bars) {
      if (!withinWindow(b, now)) continue;
      if ((b.mode || 'auto') === 'link') continue;                 // 'solo por enlace' no aplica a todos
      if (!b.coupon || !String(b.coupon).trim()) { sawActiveNoCoupon = true; continue; }
      return { code: String(b.coupon).trim(), barName: b.name || '', reason: 'ok' };
    }
    return { code: '', barName: '', reason: sawActiveNoCoupon ? 'active_bar_without_coupon' : 'no_active_bar' };
  } catch (e: any) { return { code: '', barName: '', reason: 'error:' + (e?.message || '') }; }
}

// ¿El código de un enlace ?promo= corresponde a una barra activa (cualquier modo)?
// Solo para saber el nombre; el descuento se valida contra Stripe igual.
async function barNameForCode(code: string): Promise<string> {
  try {
    const bars = await loadBars();
    const now = Date.now();
    const up = code.toUpperCase();
    const b = bars.find((x) => withinWindow(x, now) && String(x.coupon || '').toUpperCase() === up);
    return b?.name || '';
  } catch { return ''; }
}

export type DiscountResolution = {
  code: string;
  barName: string;
  promotionCodeId: string | null;
  couponId: string | null;
  percent: number | null;
  discountOpt: any;   // { discounts:[...] }  o  { allow_promotion_codes:true }
  reason: string;
};

// Busca el código en Stripe (Promotion Code activo, o Coupon "Onyx {CODE}" válido).
async function resolveCodeInStripe(stripe: any, up: string, barName: string): Promise<DiscountResolution | null> {
  try {
    const r = await stripe.promotionCodes.list({ code: up, active: true, limit: 1 });
    const pc: any = r.data[0];
    if (pc) return { code: up, barName, promotionCodeId: pc.id, couponId: pc.coupon?.id || null, percent: pc.coupon?.percent_off ?? null, discountOpt: { discounts: [{ promotion_code: pc.id }] }, reason: 'promotion_code' };
  } catch (e: any) { return { code: up, barName, promotionCodeId: null, couponId: null, percent: null, discountOpt: { allow_promotion_codes: true }, reason: 'stripe_error:' + (e?.message || '') }; }
  try {
    const cs = await stripe.coupons.list({ limit: 100 });
    const c: any = cs.data.find((x: any) => x.valid && String(x.name || '').toUpperCase() === `ONYX ${up}`);
    if (c) return { code: up, barName, promotionCodeId: null, couponId: c.id, percent: c.percent_off ?? null, discountOpt: { discounts: [{ coupon: c.id }] }, reason: 'coupon' };
  } catch {}
  return null;
}

// Resuelve el descuento a aplicar. `explicitCode` = enlace ?promo= o cupón del cliente.
export async function resolveActiveDiscount(stripe: any, explicitCode?: string): Promise<DiscountResolution> {
  const manual: DiscountResolution = { code: '', barName: '', promotionCodeId: null, couponId: null, percent: null, discountOpt: { allow_promotion_codes: true }, reason: 'manual' };

  // 1) Código explícito del cliente (enlace o embajador) → máxima prioridad.
  const explicit = (explicitCode || '').trim();
  if (explicit) {
    const up = explicit.toUpperCase();
    const found = await resolveCodeInStripe(stripe, up, await barNameForCode(up) || '(enlace)');
    if (found) return found;
    // Si el código explícito no existe en Stripe, seguimos a la promo general.
  }

  // 2) Promo general 'auto' activa — salvo que el dueño prefiera dejar cupón manual.
  const flags = await promoFlags().catch(() => PROMO_FLAGS_DEFAULT);
  if (!flags.letCustomerCoupon) {
    const bar = await activeBarCoupon();
    if (bar.code) {
      const found = await resolveCodeInStripe(stripe, bar.code.toUpperCase(), bar.barName);
      if (found) return found;
      return { ...manual, code: bar.code.toUpperCase(), barName: bar.barName, reason: 'not_in_stripe' };
    }
    return { ...manual, reason: bar.reason };   // no_active_bar / active_bar_without_coupon / no_bars
  }

  // 3) El dueño deja que el cliente use su propio cupón → campo manual.
  return { ...manual, reason: 'let_customer_coupon' };
}
