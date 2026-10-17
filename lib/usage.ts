import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting } from '@/lib/settings';
import { balance, debit } from '@/lib/wallet';
import { aiAllowance } from '@/lib/aiLimits';

// ============================================================
// PAGO POR USO (plan gratis) · comisión de recarga + cobro por uso del saldo.
// Es un negocio: ganamos con (1) la comisión escalonada de cada recarga y (2) el
// margen del precio por uso. El cliente no paga mensualidad; paga lo que usa y
// decide cuándo le conviene subir de plan. Todo en CENTAVOS.
//
// El "incluido gratis" NO vive aquí: son los topes del propio plan gratis
// (capabilities.ai_monthly, max_accounts), editables en Admin → Planes. Al
// pasar esos topes, en vez de bloquear, se cobra del saldo.
// ============================================================

export type FeeTier = { min: number; pct: number };   // min en USD, pct 0-100
export type UsageConfig = {
  // Comisión de recarga: a más recarga, menor %. Se evalúa de mayor min a menor.
  topup_fee_tiers: FeeTier[];
  topup_fee_min_cents: number;     // comisión mínima por recarga
  ai_call_cents: number;           // costo de una consulta de IA sobre el tope
  account_month_cents: number;     // costo de una cuenta extra por mes
  usage_on: boolean;               // interruptor maestro del cobro por uso
};

const DEFAULTS: UsageConfig = {
  topup_fee_tiers: [
    { min: 200, pct: 2 }, { min: 100, pct: 3 }, { min: 50, pct: 4 },
    { min: 25, pct: 5 }, { min: 0, pct: 7 },
  ],
  topup_fee_min_cents: 0,
  ai_call_cents: 20,
  account_month_cents: 400,
  usage_on: true,
};

export async function usageConfig(): Promise<UsageConfig> {
  const raw = await getSetting<Partial<UsageConfig>>('usage_fees', {});
  const tiers = Array.isArray(raw?.topup_fee_tiers) && raw!.topup_fee_tiers!.length
    ? raw!.topup_fee_tiers!.map((t: any) => ({ min: Math.max(0, Number(t.min) || 0), pct: Math.max(0, Number(t.pct) || 0) })).sort((a, b) => b.min - a.min)
    : DEFAULTS.topup_fee_tiers;
  return {
    topup_fee_tiers: tiers,
    topup_fee_min_cents: Number(raw?.topup_fee_min_cents ?? DEFAULTS.topup_fee_min_cents),
    ai_call_cents: Number(raw?.ai_call_cents ?? DEFAULTS.ai_call_cents),
    account_month_cents: Number(raw?.account_month_cents ?? DEFAULTS.account_month_cents),
    usage_on: raw?.usage_on !== false,
  };
}

// Comisión de servicio de una recarga (centavos). amountUsd = lo que se ABONA.
// El cliente paga amountUsd + comisión; el saldo recibe solo amountUsd.
export async function topupFeeCents(amountUsd: number, cfg?: UsageConfig): Promise<number> {
  const c = cfg || await usageConfig();
  const amt = Math.max(0, Number(amountUsd) || 0);
  const tier = c.topup_fee_tiers.find((t) => amt >= t.min) || c.topup_fee_tiers[c.topup_fee_tiers.length - 1];
  const pct = tier ? tier.pct : 0;
  const fee = Math.round(amt * 100 * pct / 100);
  return Math.max(c.topup_fee_min_cents, fee);
}

// El % de comisión que aplica a un monto (para mostrarlo en la UI).
export async function topupFeePct(amountUsd: number, cfg?: UsageConfig): Promise<number> {
  const c = cfg || await usageConfig();
  const amt = Math.max(0, Number(amountUsd) || 0);
  const tier = c.topup_fee_tiers.find((t) => amt >= t.min);
  return tier ? tier.pct : 0;
}

function monthStartISO(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString();
}
function monthKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---- PORTERO DE IA CON PAGO POR USO ----
// Úsalo en las rutas de IA del trader en vez de checkAiLimit a secas. Si está
// dentro del tope del plan → ok. Si lo pasó y es plan gratis con saldo → cobra
// una consulta del saldo y deja pasar. Si no alcanza → bloquea con needsTopup.
export type AiGate = {
  ok: boolean; paid: boolean; chargedCents: number;
  needsTopup: boolean; balanceCents: number; allowance: any;
};

export async function aiGate(userId: string): Promise<AiGate> {
  const allowance = await aiAllowance(userId);
  if (allowance.unlimited || allowance.remaining > 0) {
    return { ok: true, paid: false, chargedCents: 0, needsTopup: false, balanceCents: 0, allowance };
  }
  // Pasó el tope. El pago por uso es para el plan GRATIS (los de pago compran
  // el paquete de IA como hasta ahora). Equipo nunca llega aquí (unlimited).
  const cfg = await usageConfig();
  if (!cfg.usage_on || allowance.plan !== 'free' || allowance.staff) {
    const bal = await balance(userId);
    return { ok: false, paid: false, chargedCents: 0, needsTopup: false, balanceCents: bal, allowance };
  }
  const cents = Math.max(0, Math.round(cfg.ai_call_cents));
  if (cents <= 0) return { ok: true, paid: false, chargedCents: 0, needsTopup: false, balanceCents: 0, allowance };
  const extRef = `ai_${userId}_${Date.now()}`;
  const d = await debit({ userId, amountCents: cents, source: 'usage_ai', extRef, note: 'Onyx AI · pago por uso' });
  if (d.ok) return { ok: true, paid: true, chargedCents: cents, needsTopup: false, balanceCents: d.balance ?? 0, allowance };
  return { ok: false, paid: false, chargedCents: 0, needsTopup: true, balanceCents: d.balance ?? 0, allowance };
}

// ---- RESUMEN PARA LA VISTA (saldo, gasto del mes, tarifas, upsell) ----
export type UsageSummary = {
  on: boolean;
  balanceCents: number;
  monthSpentCents: number;
  byCategory: { key: string; label_es: string; label_en: string; cents: number }[];
  rates: { ai_call_cents: number; account_month_cents: number };
  free: { ai: number; accounts: number };      // incluido gratis (topes del plan)
  ai: { used: number; limit: number };
  plan: string;
  feeTiers: FeeTier[];
  upsell: { cheapestPlanId: string | null; cheapestPlanName: string | null; priceMonth: number } | null;
};

const CATS: Record<string, { es: string; en: string }> = {
  usage_ai: { es: 'Llamadas de IA', en: 'AI calls' },
  usage_account: { es: 'Cuentas conectadas', en: 'Connected accounts' },
  botlab: { es: 'Bot Lab', en: 'Bot Lab' },
  remote_support: { es: 'Soporte remoto', en: 'Remote support' },
  stripe_credit: { es: 'Aplicado a factura', en: 'Applied to invoice' },
};

export async function usageSummary(userId: string): Promise<UsageSummary> {
  const cfg = await usageConfig();
  const [bal, allowance] = await Promise.all([balance(userId), aiAllowance(userId)]);

  // Gasto del mes por categoría (filas negativas del libro desde el 1 del mes).
  const since = monthStartISO();
  const byMap: Record<string, number> = {};
  let monthSpent = 0;
  try {
    const { data } = await supabaseAdmin.from('wallet_ledger')
      .select('amount_cents,source,created_at')
      .eq('user_id', userId).lt('amount_cents', 0).gte('created_at', since).limit(5000);
    for (const r of (data || []) as any[]) {
      const c = Math.abs(Number(r.amount_cents) || 0);
      monthSpent += c;
      const k = r.source || 'otros';
      byMap[k] = (byMap[k] || 0) + c;
    }
  } catch {}
  const byCategory = Object.entries(byMap)
    .map(([key, cents]) => ({ key, cents, label_es: CATS[key]?.es || key, label_en: CATS[key]?.en || key }))
    .sort((a, b) => b.cents - a.cents);

  // Incluido gratis = topes del plan (cuentas del plan gratis y cupo de IA).
  let freeAccounts = 1;
  try {
    const { accountLimit } = await import('@/lib/settings');
    const lim = await accountLimit(userId);
    freeAccounts = lim.base;
  } catch {}

  // Upsell: plan de pago más barato (para "deja de pagar por uso").
  let upsell: UsageSummary['upsell'] = null;
  try {
    const { data: plans } = await supabaseAdmin.from('plans')
      .select('id,name,price_month,active').eq('active', true).gt('price_month', 0).order('price_month', { ascending: true }).limit(1);
    const p = (plans || [])[0] as any;
    if (p) upsell = { cheapestPlanId: p.id, cheapestPlanName: p.name, priceMonth: Number(p.price_month) || 0 };
  } catch {}

  return {
    on: cfg.usage_on,
    balanceCents: bal,
    monthSpentCents: monthSpent,
    byCategory,
    rates: { ai_call_cents: cfg.ai_call_cents, account_month_cents: cfg.account_month_cents },
    free: { ai: allowance.quota, accounts: freeAccounts },
    ai: { used: allowance.used, limit: allowance.limit },
    plan: allowance.plan,
    feeTiers: cfg.topup_fee_tiers,
    upsell,
  };
}

// ---- COBRO MENSUAL DE CUENTAS EXTRA (cron) ----
// Cobra del saldo una vez por mes por cada cuenta conectada que exceda el
// incluido gratis del plan. Idempotente por (user, periodo). Solo plan gratis.
export async function monthlyAccountChargeAll(): Promise<{ charged: number; cents: number; skipped: number }> {
  const cfg = await usageConfig();
  let charged = 0, cents = 0, skipped = 0;
  if (!cfg.usage_on || cfg.account_month_cents <= 0) return { charged, cents, skipped };
  const period = monthKey();
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,plan').eq('plan', 'free').limit(100000);
  for (const pr of (profs || []) as any[]) {
    try {
      const { accountLimit } = await import('@/lib/settings');
      const lim = await accountLimit(pr.id);
      const { count } = await supabaseAdmin.from('trading_accounts').select('id', { count: 'exact', head: true }).eq('user_id', pr.id);
      const extraAccts = Math.max(0, (count || 0) - lim.base);
      if (extraAccts <= 0) { skipped++; continue; }
      const amount = extraAccts * cfg.account_month_cents;
      const d = await debit({ userId: pr.id, amountCents: amount, source: 'usage_account', extRef: `acct_${period}`, note: `${extraAccts} cuenta(s) extra · ${period}` });
      if (d.ok && d.balance !== undefined) { charged++; cents += amount; } else skipped++;
    } catch { skipped++; }
  }
  return { charged, cents, skipped };
}
