// ============================================================
// ENTITLEMENTS — plan efectivo del usuario a partir de varias fuentes.
//
// El plan de Onyx puede venir de:
//   · Stripe  (web / Android)  → profiles.stripe_plan
//   · Apple / RevenueCat (iOS) → profiles.iap_plan (+ iap_status/iap_expires_at)
//
// El plan EFECTIVO (profiles.plan, que lee toda la app) es el de MAYOR rango entre
// los que estén activos. Si la suscripción de Apple caduca/cancela, el usuario baja
// automáticamente al plan de Stripe (o a 'free'). Así un mismo trader puede pagar en
// la web o en iOS y siempre ve lo que le corresponde, sin duplicar cobros.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { planRank, enforcePlanLimits } from '@/lib/planNotify';

const FREE = 'free';

// ¿La compra de Apple sigue vigente? (activa y sin caducar)
function iapActive(p: any): boolean {
  if (!p?.iap_plan) return false;
  const st = String(p.iap_status || '').toLowerCase();
  if (st === 'expired' || st === 'cancelled' || st === 'canceled' || st === 'none') return false;
  if (p.iap_expires_at && new Date(p.iap_expires_at).getTime() < Date.now()) return false;
  return true;
}

// Recalcula profiles.plan como el de mayor rango entre Stripe e IAP (Apple), y aplica
// los límites si el efectivo BAJÓ. Devuelve el plan efectivo.
export async function applyEffectivePlan(userId: string): Promise<string> {
  const { data: p } = await supabaseAdmin.from('profiles')
    .select('id,plan,stripe_plan,iap_plan,iap_status,iap_expires_at').eq('id', userId).maybeSingle() as any;
  if (!p) return FREE;

  const rank = await planRank();
  const rk = (id?: string | null) => (id && rank[id] != null ? rank[id] : -1);

  const stripePlan = p.stripe_plan || (p.iap_plan ? FREE : p.plan) || FREE;   // respaldo: si no hay stripe_plan, usa el actual
  const apple = iapActive(p) ? p.iap_plan : null;

  // Efectivo = el de mayor rango entre Stripe y Apple.
  let effective = stripePlan;
  if (apple && rk(apple) > rk(effective)) effective = apple;
  if (rk(effective) < 0) effective = FREE;

  if (effective !== p.plan) {
    await supabaseAdmin.from('profiles').update({ plan: effective }).eq('id', userId);
    // Si BAJÓ, aplica los límites del plan nuevo (pausa cuentas/copy que sobren; nada se borra).
    if (rk(effective) < rk(p.plan)) { try { await enforcePlanLimits(userId, effective); } catch {} }
  }
  return effective;
}

// Fija el plan comprado en iOS (Apple/RevenueCat) y recalcula el efectivo.
// plan=null → sin compra activa de Apple (expiró/canceló) → vuelve al de Stripe.
export async function setIapPlan(userId: string, info: { plan: string | null; product?: string; status?: string; expiresAt?: string | null }) {
  await supabaseAdmin.from('profiles').update({
    iap_plan: info.plan,
    iap_product: info.product || null,
    iap_status: info.status || (info.plan ? 'active' : 'none'),
    iap_expires_at: info.expiresAt || null,
    iap_updated_at: new Date().toISOString(),
  }).eq('id', userId);
  return applyEffectivePlan(userId);
}

// Fija el plan que proviene de Stripe (lo llama el webhook de Stripe) y recalcula.
export async function setStripePlan(userId: string, plan: string) {
  await supabaseAdmin.from('profiles').update({ stripe_plan: plan }).eq('id', userId);
  return applyEffectivePlan(userId);
}
