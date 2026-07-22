import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Retention = { enabled: boolean; discount_percent: number; discount_months: number; pause_months: number; allow_downgrade: boolean };
export type Addons = { extra_account_enabled: boolean; extra_account_price: number; extra_account_price_id: string };

const R: Retention = { enabled: true, discount_percent: 50, discount_months: 3, pause_months: 2, allow_downgrade: true };
const A: Addons = { extra_account_enabled: true, extra_account_price: 4, extra_account_price_id: '' };

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

// Cuántas cuentas MT puede tener: las del plan + las compradas como complemento
export async function accountLimit(userId: string) {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan,extra_accounts').eq('id', userId).single();
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
