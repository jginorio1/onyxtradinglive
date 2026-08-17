// Prueba de pago con caducidad ("cortesía"). Lógica compartida por admin, cron,
// dashboard y webhook. Reglas:
//   • Concesión: plan de pago + fecha de fin, sin tarjeta.
//   • Al vencer: la cuenta vuelve a Free (cron). Se guarda el rastro para el popup.
//   • Si el usuario paga con tarjeta: su suscripción real manda (se limpia la prueba).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';

export type CompSettings = { warnDays: number };
export const COMP_DEFAULTS: CompSettings = { warnDays: 5 };
export const compSettings = async (): Promise<CompSettings> => {
  const s = await getSetting<CompSettings>('comp_settings', COMP_DEFAULTS);
  const n = Math.max(1, Math.min(60, Math.round(Number(s?.warnDays) || 5)));
  return { warnDays: n };
};
export const saveCompSettings = (warnDays: number) => saveSetting('comp_settings', { warnDays: Math.max(1, Math.min(60, Math.round(warnDays))) });

const PLANS = ['pro', 'elite', 'black'];

// Concede la prueba: fija plan + fecha de fin, reinicia banderas de aviso.
export async function grantComp(userId: string, plan: string, days: number) {
  const p = String(plan || '').toLowerCase();
  if (!PLANS.includes(p)) throw new Error('plan no válido');
  const d = Math.max(1, Math.min(90, Math.round(Number(days) || 0)));
  const until = new Date(Date.now() + d * 864e5).toISOString();
  await supabaseAdmin.from('profiles').update({
    plan: p, comp_plan: p, comp_until: until, comp_days: d, comp_warned: false, comp_expired_seen: false,
  }).eq('id', userId);
  return { plan: p, until, days: d };
}

// Quita la prueba y vuelve a Free (a mano, desde admin).
export async function revokeComp(userId: string) {
  await supabaseAdmin.from('profiles').update({
    plan: 'free', comp_plan: null, comp_until: null, comp_warned: false, comp_expired_seen: true,
  }).eq('id', userId);
}

// El usuario pagó con tarjeta → su suscripción real manda; borramos la prueba
// SIN tocar el plan (el webhook ya puso el plan real).
export async function clearCompOnPaid(userId: string) {
  try {
    await supabaseAdmin.from('profiles').update({
      comp_plan: null, comp_until: null, comp_warned: false, comp_expired_seen: true,
    }).eq('id', userId);
  } catch {}
}

// Estado de la prueba para el popup del dashboard. Tolerante si la columna no existe.
export type CompStatus =
  | { state: 'none' }
  | { state: 'active'; plan: string; daysLeft: number; expiring: boolean }
  | { state: 'expired'; plan: string };

export async function compStatus(userId: string): Promise<CompStatus> {
  try {
    const { data } = await supabaseAdmin.from('profiles')
      .select('plan,comp_plan,comp_until,comp_expired_seen,stripe_subscription_id').eq('id', userId).maybeSingle();
    const p: any = data || {};
    if (!p.comp_plan || !p.comp_until) return { state: 'none' };
    // Si tiene suscripción real de Stripe, la prueba no aplica.
    if (p.stripe_subscription_id) return { state: 'none' };
    const until = new Date(p.comp_until).getTime();
    const now = Date.now();
    if (until > now) {
      const daysLeft = Math.max(0, Math.ceil((until - now) / 864e5));
      const { warnDays } = await compSettings();
      return { state: 'active', plan: p.comp_plan, daysLeft, expiring: daysLeft <= warnDays };
    }
    // Vencida: mostramos el popup "expiró" hasta que la acepte.
    if (!p.comp_expired_seen) return { state: 'expired', plan: p.comp_plan };
    return { state: 'none' };
  } catch { return { state: 'none' }; }
}

// El usuario cerró el popup de "expiró" (se queda en Free).
export async function ackCompExpired(userId: string) {
  try { await supabaseAdmin.from('profiles').update({ comp_expired_seen: true }).eq('id', userId); } catch {}
}
