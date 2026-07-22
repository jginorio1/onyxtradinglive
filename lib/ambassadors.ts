import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type AmbSettings = {
  enabled: boolean; base_rate: number; tier_rate: number; tier_threshold: number;
  hold_days: number; min_payout: number; coupon_percent: number; coupon_months: number;
};

const DEFAULTS: AmbSettings = {
  enabled: true, base_rate: 20, tier_rate: 30, tier_threshold: 10,
  hold_days: 30, min_payout: 50, coupon_percent: 20, coupon_months: 1,
};

// Ajustes del programa (los edita el admin desde el panel)
export async function ambSettings(): Promise<AmbSettings> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'ambassadors').maybeSingle();
    return { ...DEFAULTS, ...(data?.value || {}) };
  } catch { return DEFAULTS; }
}

// Cuántos referidos suyos están pagando ahora mismo
export async function activeCount(ambassadorId: string): Promise<number> {
  const { data: refs } = await supabaseAdmin.from('referrals').select('user_id').eq('ambassador_id', ambassadorId);
  const ids = (refs || []).map((r: any) => r.user_id);
  if (!ids.length) return 0;
  const { count } = await supabaseAdmin
    .from('profiles').select('*', { count: 'exact', head: true })
    .in('id', ids).neq('plan', 'free').in('subscription_status', ['active', 'trialing']);
  return count || 0;
}

// Porcentaje que le toca: el manual del admin manda; si no, por nivel.
export async function rateFor(amb: any, s?: AmbSettings): Promise<{ rate: number; tier: 'silver' | 'gold'; active: number; settings: AmbSettings }> {
  const settings = s || (await ambSettings());
  const active = await activeCount(amb.id);
  const tier: 'silver' | 'gold' = active >= settings.tier_threshold ? 'gold' : 'silver';
  const auto = tier === 'gold' ? settings.tier_rate : settings.base_rate;
  const rate = amb.rate != null && amb.rate !== '' ? Number(amb.rate) : auto;
  return { rate, tier, active, settings };
}

// Saldos: retenido, disponible y ya pagado
export async function balances(ambassadorId: string) {
  const { data } = await supabaseAdmin.from('commissions').select('amount,status,available_at').eq('ambassador_id', ambassadorId);
  const now = Date.now();
  let pending = 0, available = 0, paid = 0;
  (data || []).forEach((c: any) => {
    const amt = Number(c.amount) || 0;
    if (c.status === 'paid') paid += amt;
    else if (c.status === 'reversed') return;
    else if (c.status === 'available' || (c.available_at && new Date(c.available_at).getTime() <= now)) available += amt;
    else pending += amt;
  });
  const r = (n: number) => Math.round(n * 100) / 100;
  return { pending: r(pending), available: r(available), paid: r(paid) };
}

// Genera un código a partir del email, sin caracteres raros
export function codeFromEmail(email: string) {
  const base = (email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'onyx';
  return base + Math.floor(Math.random() * 900 + 100);
}
