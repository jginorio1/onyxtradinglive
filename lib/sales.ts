import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Red de VENTAS · motor. Árbol de 3 niveles (vendedor → N1 → N2),
// comisión recurrente por cada pago mensual, con maduración + reversa +
// frenos (mismo esquema de seguridad que Embajadores).
// ============================================================

export type SalesSettings = {
  enabled: boolean;
  direct_rate: number;        // % para el vendedor que trajo al cliente
  override1_rate: number;     // % override para su supervisor N1
  override2_rate: number;     // % override para el supervisor N2
  commission_months: number;  // meses de comisión por cliente; 0 = ilimitado (∞)
  hold_days: number;          // retención anti-reembolso antes de poder cobrar
  min_payout: number;         // mínimo para pagar
  trial_max_days: number;     // tope de días de prueba que puede dar un vendedor
  discount_max_pct: number;   // tope de descuento (%) que puede dar un vendedor
  auto_payout: boolean;       // paga solo cuando el saldo madura
  review_before_pay: boolean; // freno global: encola pero apruebas tú
  allow_recruit: boolean;     // los supervisores pueden reclutar su equipo
};

const DEFAULTS: SalesSettings = {
  enabled: true, direct_rate: 20, override1_rate: 7, override2_rate: 4,
  commission_months: 0, hold_days: 30, min_payout: 50,
  trial_max_days: 14, discount_max_pct: 20,
  auto_payout: true, review_before_pay: false, allow_recruit: true,
};

export async function salesSettings(): Promise<SalesSettings> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'sales').maybeSingle();
    return { ...DEFAULTS, ...((data?.value as any) || {}) };
  } catch { return DEFAULTS; }
}

export async function saveSalesSettings(patch: Partial<SalesSettings>): Promise<SalesSettings> {
  const prev = await salesSettings();
  const value = { ...prev, ...patch };
  await supabaseAdmin.from('app_settings').upsert({ key: 'sales', value, updated_at: new Date().toISOString() });
  return value;
}

// Código de invitación único y legible (base del enlace ?sv=).
function slug(s: string): string {
  return String(s || 'sv').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'sv';
}
export async function uniqueRepCode(seed: string): Promise<string> {
  const base = slug(seed);
  for (let i = 0; i < 12; i++) {
    const code = i === 0 ? base : base + Math.random().toString(36).slice(2, 5);
    const { data } = await supabaseAdmin.from('sales_reps').select('id').eq('code', code).maybeSingle();
    if (!data) return code;
  }
  return base + Date.now().toString(36).slice(-4);
}

export type Rep = {
  id: string; user_id: string; level: 'vendedor' | 'l1' | 'l2'; parent_id: string | null;
  code: string; status: string; rate_override: number | null; display_name: string | null;
  stripe_account_id: string | null; payouts_enabled: boolean; on_hold: boolean; note?: string | null;
};

export async function repByUser(userId: string): Promise<Rep | null> {
  const { data } = await supabaseAdmin.from('sales_reps').select('*').eq('user_id', userId).maybeSingle();
  return (data as any) || null;
}
export async function repById(id: string): Promise<Rep | null> {
  const { data } = await supabaseAdmin.from('sales_reps').select('*').eq('id', id).maybeSingle();
  return (data as any) || null;
}
export async function repByCode(code: string): Promise<Rep | null> {
  const { data } = await supabaseAdmin.from('sales_reps').select('*').eq('code', code).eq('status', 'active').maybeSingle();
  return (data as any) || null;
}

// Cadena de beneficiarios hacia arriba desde el vendedor dueño del cliente:
//   direct (el vendedor) · override1 (su padre) · override2 (el abuelo).
export async function beneficiaryChain(directRepId: string): Promise<{ direct: Rep | null; up1: Rep | null; up2: Rep | null }> {
  const direct = await repById(directRepId);
  const up1 = direct?.parent_id ? await repById(direct.parent_id) : null;
  const up2 = up1?.parent_id ? await repById(up1.parent_id) : null;
  return { direct, up1, up2 };
}

// Todos los descendientes de un rep (para el rollup del supervisor y el admin).
export async function subtreeRepIds(rootId: string): Promise<string[]> {
  const out: string[] = [];
  let frontier = [rootId];
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const { data } = await supabaseAdmin.from('sales_reps').select('id').in('parent_id', frontier);
    const kids = (data || []).map((r: any) => r.id).filter((id: string) => !out.includes(id));
    out.push(...kids);
    frontier = kids;
  }
  return out;
}

// % que le toca a un beneficiario según su nivel en el reparto (el override del
// rep manda si está puesto).
export function pctFor(rep: Rep | null, slot: 'direct' | 'override1' | 'override2', s: SalesSettings): number {
  if (!rep) return 0;
  if (rep.rate_override != null && rep.rate_override !== ('' as any)) return Number(rep.rate_override);
  return slot === 'direct' ? s.direct_rate : slot === 'override1' ? s.override1_rate : s.override2_rate;
}

// Cuántos meses de comisión ya se generaron para un cliente (nivel direct).
async function monthsBilled(clientUserId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('sales_commissions')
    .select('*', { count: 'exact', head: true })
    .eq('client_user_id', clientUserId).eq('level', 'direct').neq('status', 'reversed');
  return count || 0;
}

// Acredita comisiones de un cobro a toda la cadena. Idempotente por invoice_id.
export async function creditFromPayment(opts: {
  clientUserId: string; invoiceId: string; baseAmount: number; currency?: string;
}): Promise<{ credited: number; reason?: string }> {
  const s = await salesSettings();
  if (!s.enabled) return { credited: 0, reason: 'disabled' };

  const { data: sc } = await supabaseAdmin.from('sales_clients').select('rep_id').eq('user_id', opts.clientUserId).maybeSingle();
  const directRepId = (sc as any)?.rep_id;
  if (!directRepId) return { credited: 0, reason: 'no_rep' };

  if (s.commission_months > 0) {
    const done = await monthsBilled(opts.clientUserId);
    if (done >= s.commission_months) return { credited: 0, reason: 'cap_months' };
  }

  const { direct, up1, up2 } = await beneficiaryChain(directRepId);
  const availableAt = new Date(Date.now() + (s.hold_days || 0) * 86400000).toISOString();
  const base = Number(opts.baseAmount) || 0;
  const currency = opts.currency || 'USD';
  const rows: any[] = [];
  const add = (rep: Rep | null, slot: 'direct' | 'override1' | 'override2', level: string) => {
    if (!rep || rep.status !== 'active') return;
    const pct = pctFor(rep, slot, s);
    if (!(pct > 0)) return;
    rows.push({
      rep_id: rep.id, client_user_id: opts.clientUserId, level, invoice_id: opts.invoiceId,
      base_amount: base, pct, amount: Math.round(base * pct) / 100, currency,
      status: 'pending', available_at: availableAt,
    });
  };
  add(direct, 'direct', 'direct');
  add(up1, 'override1', 'override1');
  add(up2, 'override2', 'override2');
  if (!rows.length) return { credited: 0, reason: 'no_rates' };

  // upsert idempotente por (invoice_id, rep_id, level)
  const { error } = await supabaseAdmin.from('sales_commissions').upsert(rows, { onConflict: 'invoice_id,rep_id,level', ignoreDuplicates: true });
  if (error) return { credited: 0, reason: error.message };

  try { await supabaseAdmin.from('sales_clients').update({ first_paid_at: new Date().toISOString() }).eq('user_id', opts.clientUserId).is('first_paid_at', null); } catch {}
  return { credited: rows.length };
}

// Reversa (clawback) por reembolso/contracargo: anula las comisiones de esa factura.
export async function reverseFromInvoice(invoiceId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('sales_commissions')
    .update({ status: 'reversed' }).eq('invoice_id', invoiceId).neq('status', 'paid').select('id');
  return (data || []).length;
}

// Saldos de un rep: retenido, disponible y pagado.
export async function balances(repId: string): Promise<{ pending: number; available: number; paid: number }> {
  const { data } = await supabaseAdmin.from('sales_commissions').select('amount,status,available_at').eq('rep_id', repId);
  const now = Date.now();
  let pending = 0, available = 0, paid = 0;
  (data || []).forEach((c: any) => {
    const amt = Number(c.amount) || 0;
    if (c.status === 'paid') paid += amt;
    else if (c.status === 'reversed') return;
    else if (c.status === 'available' || (c.available_at && new Date(c.available_at).getTime() <= now)) available += amt;
    else pending += amt;
  });
  return { pending: Math.round(pending * 100) / 100, available: Math.round(available * 100) / 100, paid: Math.round(paid * 100) / 100 };
}

// Cuántos clientes activos (pagando) tiene un rep ahora mismo.
export async function activeClients(repId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('sales_clients').select('user_id').eq('rep_id', repId);
  const ids = (data || []).map((r: any) => r.user_id);
  if (!ids.length) return 0;
  const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
    .in('id', ids).neq('plan', 'free').in('subscription_status', ['active', 'trialing']);
  return count || 0;
}
