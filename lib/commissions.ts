import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// MOTOR ÚNICO DE COMISIONES (Fase 1 · Fundación).
// Plomería genérica del dinero que la plataforma debe a quien refiere, para los
// 4 programas (sales | ambassador | academy | member). Cada programa decide su
// política (quién gana, qué %, cuántos días de retención, sobre qué líneas) y
// llama a estas funciones; aquí NO hay reglas de negocio de ningún programa.
//
// Estados de una comisión: pending -> (madura por available_at) -> available
//                          -> paid | reversed.
// Idempotente por (program, invoice_id, referrer_id, level): acreditar dos veces
// la misma factura NO duplica.
// ============================================================

export type Program = 'sales' | 'ambassador' | 'academy' | 'member';
export type Balance = { pending: number; available: number; paid: number };

// Una línea de comisión a acreditar (un beneficiario de un pago).
export type CommissionRow = {
  referrerId: string;              // id del que gana EN la tabla de su programa
  level: string;                   // 'direct' | 'override1' | 'override2' | 'bonus' | ...
  pct: number;                     // % aplicado (0 permitido para bonos de monto fijo)
  amount?: number;                 // si se da, manda sobre base*pct (bonos de monto fijo)
  beneficiaryUserId?: string | null;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Acredita una o varias comisiones de un mismo cobro a la cadena de beneficiarios.
// Devuelve cuántas filas quedaron registradas (nuevas; las repetidas se ignoran).
export async function creditCommissions(opts: {
  program: Program;
  invoiceId: string;
  clientUserId?: string | null;
  baseAmount: number;
  currency?: string;
  line?: string;
  holdDays?: number;               // retención anti-reembolso (días) antes de poder cobrar
  rows: CommissionRow[];
}): Promise<{ credited: number; error?: string }> {
  const base = Number(opts.baseAmount) || 0;
  const currency = opts.currency || 'USD';
  const availableAt = new Date(Date.now() + Math.max(0, Number(opts.holdDays) || 0) * 86400000).toISOString();
  const rows = (opts.rows || [])
    .filter((x) => x && x.referrerId && (Number(x.pct) > 0 || Number(x.amount) > 0))
    .map((x) => ({
      program: opts.program,
      referrer_id: x.referrerId,
      beneficiary_user_id: x.beneficiaryUserId ?? null,
      client_user_id: opts.clientUserId ?? null,
      level: x.level || 'direct',
      invoice_id: opts.invoiceId,
      base_amount: base,
      pct: Number(x.pct) || 0,
      amount: x.amount != null ? r2(x.amount) : r2(base * (Number(x.pct) || 0) / 100),
      currency,
      line: opts.line || null,
      status: 'pending',
      available_at: availableAt,
    }));
  if (!rows.length) return { credited: 0 };
  const { error } = await supabaseAdmin
    .from('comm_commissions')
    .upsert(rows, { onConflict: 'program,invoice_id,referrer_id,level', ignoreDuplicates: true });
  if (error) return { credited: 0, error: error.message };
  return { credited: rows.length };
}

// Cuántos meses/pagos "direct" ya se generaron para un cliente (tope de meses).
export async function monthsCredited(program: Program, clientUserId: string, level = 'direct'): Promise<number> {
  const { count } = await supabaseAdmin.from('comm_commissions')
    .select('*', { count: 'exact', head: true })
    .eq('program', program).eq('client_user_id', clientUserId).eq('level', level).neq('status', 'reversed');
  return count || 0;
}

// Reversa (clawback) por reembolso/contracargo: anula lo no pagado de esa factura.
export async function reverseInvoice(program: Program, invoiceId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('comm_commissions')
    .update({ status: 'reversed' })
    .eq('program', program).eq('invoice_id', invoiceId).neq('status', 'paid').select('id');
  return (data || []).length;
}

// Saldos de UN referidor (retenido, disponible, pagado). Madura por available_at.
export async function balances(program: Program, referrerId: string): Promise<Balance> {
  const map = await balancesBatch(program, [referrerId]);
  return map[referrerId] || { pending: 0, available: 0, paid: 0 };
}

// Saldos de MUCHOS referidores en pocas consultas (sin N+1).
export async function balancesBatch(program: Program, referrerIds: string[]): Promise<Record<string, Balance>> {
  const out: Record<string, Balance> = {};
  for (const id of referrerIds) out[id] = { pending: 0, available: 0, paid: 0 };
  if (!referrerIds.length) return out;
  const now = Date.now();
  for (let i = 0; i < referrerIds.length; i += 100) {
    const chunk = referrerIds.slice(i, i + 100);
    const { data } = await supabaseAdmin.from('comm_commissions')
      .select('referrer_id,amount,status,available_at')
      .eq('program', program).in('referrer_id', chunk).neq('status', 'reversed').limit(100000);
    (data || []).forEach((c: any) => {
      const b = out[c.referrer_id]; if (!b) return;
      const amt = Number(c.amount) || 0;
      if (c.status === 'paid') b.paid += amt;
      else if (c.status === 'available' || (c.available_at && new Date(c.available_at).getTime() <= now)) b.available += amt;
      else b.pending += amt;
    });
  }
  for (const id of referrerIds) { const b = out[id]; b.pending = r2(b.pending); b.available = r2(b.available); b.paid = r2(b.paid); }
  return out;
}

// Marca como pagadas las comisiones disponibles de un referidor y registra el pago.
// Devuelve el monto pagado (0 si no había nada disponible). Idempotente por naturaleza:
// solo toma las que estaban 'available'/maduras y no pagadas.
export async function settlePayout(opts: {
  program: Program; referrerId: string; beneficiaryUserId?: string | null;
  method?: string; ref?: string; createdBy?: string | null;
}): Promise<{ amount: number; payoutId?: string; count: number }> {
  const now = new Date();
  // Comisiones elegibles: no pagadas, no revertidas, ya maduras.
  const { data: elig } = await supabaseAdmin.from('comm_commissions')
    .select('id,amount')
    .eq('program', opts.program).eq('referrer_id', opts.referrerId)
    .in('status', ['available', 'pending'])
    .lte('available_at', now.toISOString())
    .limit(100000);
  const rows = (elig || []) as any[];
  if (!rows.length) return { amount: 0, count: 0 };
  const amount = r2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const currency = 'USD';
  const { data: pay } = await supabaseAdmin.from('comm_payouts').insert({
    program: opts.program, referrer_id: opts.referrerId, beneficiary_user_id: opts.beneficiaryUserId ?? null,
    amount, currency, method: opts.method || 'manual', ref: opts.ref || null, status: 'paid', created_by: opts.createdBy ?? null,
  }).select('id').maybeSingle();
  const payoutId = (pay as any)?.id;
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    await supabaseAdmin.from('comm_commissions')
      .update({ status: 'paid', paid_at: now.toISOString(), payout_id: payoutId || null })
      .in('id', ids.slice(i, i + 200));
  }
  return { amount, payoutId, count: ids.length };
}
