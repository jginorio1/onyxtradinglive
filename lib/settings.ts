import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Retention = {
  enabled: boolean; discount_percent: number; discount_months: number; pause_months: number; allow_downgrade: boolean;
  // --- Anti-abuso ---
  repeat_percent: number;    // % de la 2ª+ vez (oferta decreciente)
  repeat_months: number;     // meses de la 2ª+ vez
  cooldown_months: number;   // no repetir descuento antes de N meses
  max_grants: number;        // veces de descuento por usuario de por vida (0 = sin tope)
  min_tenure_months: number; // antigüedad mínima pagando para poder recibir descuento
  monthly_cap: number;       // tope GLOBAL de descuentos por mes natural (0 = sin tope)
};
export type Addons = {
  extra_account_enabled: boolean; extra_account_price: number; extra_account_price_id: string;
  extra_slave_enabled: boolean; extra_slave_price: number; extra_slave_price_id: string;
  extra_master_enabled: boolean; extra_master_price: number; extra_master_price_id: string;
  algo_enabled: boolean; algo_price: number; algo_price_id: string;
};

const R: Retention = {
  enabled: true, discount_percent: 50, discount_months: 3, pause_months: 2, allow_downgrade: true,
  repeat_percent: 20, repeat_months: 1, cooldown_months: 12, max_grants: 2, min_tenure_months: 1, monthly_cap: 0,
};
const A: Addons = {
  extra_account_enabled: true, extra_account_price: 4, extra_account_price_id: '',
  extra_slave_enabled: false, extra_slave_price: 9, extra_slave_price_id: '',
  extra_master_enabled: false, extra_master_price: 15, extra_master_price_id: '',
  algo_enabled: true, algo_price: 15, algo_price_id: '',
};

// ¿El usuario tiene el módulo de bots? Por plan (capabilities.algo) o por add-on.
export async function hasAlgo(userId: string): Promise<boolean> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan,addon_algo').eq('id', userId).maybeSingle();
  if ((prof as any)?.addon_algo) return true;
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return !!(plan?.capabilities as any)?.algo;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).maybeSingle();
    return { ...fallback, ...(data?.value || {}) };
  } catch { return fallback; }
}
export async function saveSetting(key: string, value: any) {
  await supabaseAdmin.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
}
export const retentionSettings = () => getSetting<Retention>('retention', R);
export const addonSettings = () => getSetting<Addons>('addons', A);

// "Invita y gana" — referidos del usuario común (recompensa en crédito de cuenta)
export type MemberReferral = {
  enabled: boolean;
  referrer_credit: number;   // crédito para quien invita (por cada amigo que paga)
  friend_credit: number;     // crédito para el amigo en su primer pago
  hold_days: number;         // ventana anti-reembolso antes de aplicar el crédito
  max_per_month: number;     // tope de recompensas por invitador al mes (0 = sin tope)
  max_lifetime: number;      // tope de recompensas por invitador de por vida (0 = sin tope)
  bridge_threshold: number;  // referidos que pagan para invitar a ser Embajador
};
const MR: MemberReferral = {
  enabled: true, referrer_credit: 10, friend_credit: 10, hold_days: 21,
  max_per_month: 0, max_lifetime: 0, bridge_threshold: 5,
};
export const memberReferralSettings = () => getSetting<MemberReferral>('member_referral', MR);

// Onyx Academy · comisión por defecto (editable por el dueño en el panel).
export type AcademyFee = { default_pct: number };
const AF: AcademyFee = { default_pct: Number(process.env.ONYX_ACADEMY_FEE_PCT || 10) };
export const academyFeeSettings = () => getSetting<AcademyFee>('academy_fee', AF);

// Onyx Academy · perks. ¿Un nivel VIP puede conceder Onyx Guardian automáticamente?
// APAGADO por defecto: regala una feature de pago de Onyx, el dueño lo activa a mano.
export type AcademyPerks = { guardian_autogrant: boolean };
export const academyPerksSettings = () => getSetting<AcademyPerks>('academy_perks', { guardian_autogrant: false });

// Cuántas cuentas MT puede tener: las del plan + las compradas como complemento
export async function accountLimit(userId: string) {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan,extra_accounts').eq('id', userId).maybeSingle();
  const planId = prof?.plan || 'free';
  const { data: planRow } = await supabaseAdmin.from('plans').select('id,name,name_en,max_accounts').eq('id', planId).maybeSingle();
  const base = Number(planRow?.max_accounts ?? 1);
  const extra = Number(prof?.extra_accounts || 0);
  const unlimited = base >= 999;
  return {
    planId, planName: planRow?.name || planId, planNameEn: planRow?.name_en || planRow?.name || planId,
    base, extra, unlimited, max: unlimited ? 9999 : base + extra,
  };
}

// Si el usuario no tiene fila en profiles, la crea. Evita que todo caiga a 'free'
// cuando el disparador de registro no llego a ejecutarse.
export async function ensureProfile(userId: string, email?: string | null) {
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (data) return false;
  await supabaseAdmin.from('profiles').insert({ id: userId, email: email || null, plan: 'free' });
  return true;
}
