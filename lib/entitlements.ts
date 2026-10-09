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

// ¿Sigue vigente una prueba de cortesía (comp)?
function compActive(p: any): boolean {
  if (!p?.comp_plan || !p?.comp_until) return false;
  if (p.stripe_subscription_id) return false;   // con suscripción real de Stripe, la prueba no cuenta
  return new Date(p.comp_until).getTime() > Date.now();
}

// ¿Sigue vigente un ajuste MANUAL del admin (override)? until nulo = permanente.
function overrideActive(p: any): boolean {
  if (!p?.plan_override) return false;
  if (p.plan_override_until && new Date(p.plan_override_until).getTime() < Date.now()) return false;
  return true;
}

// Recalcula profiles.plan como el de MAYOR rango entre TODAS las fuentes activas:
//   · Stripe (web/Android)        · Apple/RevenueCat (iOS)
//   · Prueba de cortesía (comp)   · Ajuste manual del admin (plan_override)
// Así un plan que el admin subió a mano NO se revierte solo cuando entra un webhook
// de Stripe o corre el cron: el override cuenta como una fuente más y, por ser el de
// mayor rango, gana. Aplica los límites solo si el efectivo BAJÓ. Devuelve el efectivo.
export async function applyEffectivePlan(userId: string): Promise<string> {
  const { data: p } = await supabaseAdmin.from('profiles')
    .select('id,plan,stripe_plan,iap_plan,iap_status,iap_expires_at,comp_plan,comp_until,stripe_subscription_id,plan_override,plan_override_until')
    .eq('id', userId).maybeSingle() as any;
  if (!p) return FREE;

  const rank = await planRank();
  const rk = (id?: string | null) => (id && rank[id] != null ? rank[id] : -1);

  // Fuentes activas (cada una puede otorgar un plan).
  const sources: (string | null)[] = [
    p.stripe_plan || null,
    iapActive(p) ? p.iap_plan : null,
    compActive(p) ? p.comp_plan : null,
    overrideActive(p) ? p.plan_override : null,
  ];
  const cands = sources.filter(Boolean) as string[];

  let effective: string;
  if (!cands.length) {
    // Sin ninguna fuente: respeta lo que ya tenga (no lo bajamos a la fuerza).
    effective = p.plan || FREE;
  } else {
    effective = cands.reduce((best, c) => (rk(c) > rk(best) ? c : best), FREE);
    if (rk(effective) < 0) effective = FREE;
  }

  if (effective !== p.plan) {
    await supabaseAdmin.from('profiles').update({ plan: effective }).eq('id', userId);
    // Si BAJÓ, aplica los límites del plan nuevo (pausa cuentas/copy que sobren; nada se borra).
    if (rk(effective) < rk(p.plan)) { try { await enforcePlanLimits(userId, effective); } catch {} }
  }
  return effective;
}

// Fija (o quita) el ajuste MANUAL del admin y recalcula el efectivo.
// plan=null → quita el override. until opcional (ISO) → override temporal; sin until = permanente.
export async function setPlanOverride(userId: string, plan: string | null, until?: string | null) {
  await supabaseAdmin.from('profiles').update({
    plan_override: plan,
    plan_override_until: plan ? (until || null) : null,
    plan_override_at: new Date().toISOString(),
  }).eq('id', userId);
  return applyEffectivePlan(userId);
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
