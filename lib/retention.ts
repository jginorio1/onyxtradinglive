import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { retentionSettings, type Retention } from '@/lib/settings';
import { sendEmail } from '@/lib/mail';

// ============================================================
// Anti-abuso del descuento de retención. El backend consulta esto ANTES de crear
// el cupón, para que nadie pueda cancelar cada 3 meses y farmear el 40% (ni una
// comunidad coordinada). Reglas: antigüedad mínima, cooldown, tope de veces por
// usuario, tope global mensual, oferta decreciente y bloqueo por abuso.
// ============================================================

const MONTH = 30 * 864e5;

export type Eligibility = {
  eligible: boolean;
  percent: number;
  months: number;
  tier: number;
  reason: 'ok' | 'blocked' | 'new' | 'max' | 'cooldown' | 'cap' | 'disabled';
  nextEligibleAt?: number | null;   // ms, cuándo volvería a poder (cooldown)
};

async function grantsOf(userId: string) {
  const { data } = await supabaseAdmin.from('retention_grants')
    .select('id,tier,percent,months,created_at').eq('user_id', userId).order('created_at', { ascending: false });
  return data || [];
}
async function monthlyGrantCount(): Promise<number> {
  const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin.from('retention_grants').select('*', { count: 'exact', head: true }).gte('created_at', from.toISOString());
  return count || 0;
}

// ¿Puede recibir descuento y con qué % / meses? tenureMonths = meses pagando.
export async function discountEligibility(userId: string, tenureMonths: number): Promise<Eligibility> {
  const s: Retention = await retentionSettings();
  const off = (r: Eligibility['reason']): Eligibility => ({ eligible: false, percent: 0, months: 0, tier: 0, reason: r });

  if (!s.enabled) return off('disabled');

  const { data: prof } = await supabaseAdmin.from('profiles').select('retention_blocked').eq('id', userId).maybeSingle();
  if ((prof as any)?.retention_blocked) return off('blocked');

  if (s.min_tenure_months > 0 && tenureMonths < s.min_tenure_months) return off('new');

  const grants = await grantsOf(userId);
  const count = grants.length;
  if (s.max_grants > 0 && count >= s.max_grants) return off('max');

  if (count > 0 && s.cooldown_months > 0) {
    const last = new Date(grants[0].created_at).getTime();
    const nextEligibleAt = last + s.cooldown_months * MONTH;
    if (Date.now() < nextEligibleAt) return { ...off('cooldown'), nextEligibleAt };
  }

  if (s.monthly_cap > 0 && (await monthlyGrantCount()) >= s.monthly_cap) return off('cap');

  // Oferta decreciente: 1ª vez = discount_*, siguientes = repeat_*
  const tier = count + 1;
  const percent = tier === 1 ? Number(s.discount_percent) || 0 : Number(s.repeat_percent) || 0;
  const months = tier === 1 ? Number(s.discount_months) || 0 : Number(s.repeat_months) || 0;
  if (percent <= 0 || months <= 0) return off('max');   // sin oferta repetida configurada
  return { eligible: true, percent, months, tier, reason: 'ok' };
}

// Registra el descuento concedido y avisa al admin si hay pico o se toca el tope.
export async function recordGrant(userId: string, email: string | null, tier: number, percent: number, months: number) {
  await supabaseAdmin.from('retention_grants').insert({ user_id: userId, email, tier, percent, months });
  try {
    const s = await retentionSettings();
    // Pico en 24 h (posible comunidad coordinada) o tope mensual alcanzado.
    const since = new Date(Date.now() - 864e5).toISOString();
    const { count: day } = await supabaseAdmin.from('retention_grants').select('*', { count: 'exact', head: true }).gte('created_at', since);
    const month = await monthlyGrantCount();
    const spike = (day || 0) >= 8;
    const capHit = s.monthly_cap > 0 && month >= s.monthly_cap;
    if (spike || capHit) {
      const owners = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim()).filter(Boolean);
      const subject = capHit ? '⚠️ Onyx · Tope mensual de descuentos alcanzado' : '⚠️ Onyx · Pico de descuentos de retención';
      const body = `${capHit ? `Se alcanzó el tope mensual de descuentos de rescate (${month}/${s.monthly_cap}).` : `Hubo ${day} descuentos de rescate en las últimas 24 h (posible abuso coordinado).`}\n\nRevisa la pestaña Retención. El sistema seguirá ofreciendo descuentos solo si la configuración lo permite.`;
      for (const to of owners) { try { await sendEmail(to, subject, body); } catch {} }
    }
  } catch {}
}

// Penaliza al que toma el descuento y cancela dentro de su ventana.
export async function penalizeIfAbuse(userId: string) {
  try {
    const grants = await grantsOf(userId);
    if (!grants.length) return;
    const g = grants[0];
    const windowEnd = new Date(g.created_at).getTime() + (Number(g.months) || 1) * MONTH;
    if (Date.now() < windowEnd) {
      await supabaseAdmin.from('profiles').update({ retention_blocked: true }).eq('id', userId);
    }
  } catch {}
}
