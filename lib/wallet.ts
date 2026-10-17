import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// MONEDERO (saldo recargable del usuario). Todo en CENTAVOS.
// Saldo = suma de wallet_ledger del usuario. Crédito/gasto idempotentes por
// (source, ext_ref). El saldo es SOLO para comprar dentro de Onyx; no es retirable.
// ============================================================

export type Movement = {
  id: string; amount_cents: number; kind: string; method: string | null;
  source: string | null; note: string | null; created_at: string;
};

// Saldo de un usuario (centavos). Suma todas sus filas.
export async function balance(userId: string): Promise<number> {
  if (!userId) return 0;
  const map = await balanceBatch([userId]);
  return map[userId] || 0;
}

// Saldos de varios usuarios en pocas consultas (sin N+1).
export async function balanceBatch(userIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const id of userIds) out[id] = 0;
  const ids = userIds.filter(Boolean);
  if (!ids.length) return out;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await supabaseAdmin.from('wallet_ledger')
      .select('user_id,amount_cents').in('user_id', chunk).limit(100000);
    (data || []).forEach((r: any) => { out[r.user_id] = (out[r.user_id] || 0) + (Number(r.amount_cents) || 0); });
  }
  return out;
}

// Acredita saldo (recarga/reembolso). Idempotente por (source, ext_ref):
// si ya existe esa fila, no duplica. Devuelve si registró algo nuevo.
export async function credit(opts: {
  userId: string; amountCents: number; kind?: 'topup' | 'refund' | 'adjust';
  method?: string; source: string; extRef?: string | null; note?: string; meta?: any;
}): Promise<{ ok: boolean; credited: boolean }> {
  const cents = Math.round(Number(opts.amountCents) || 0);
  if (!opts.userId || cents <= 0) return { ok: false, credited: false };
  const row = {
    user_id: opts.userId, amount_cents: Math.abs(cents), kind: opts.kind || 'topup',
    method: opts.method || null, source: opts.source, ext_ref: opts.extRef ?? null,
    note: opts.note || null, meta: opts.meta ?? null,
  };
  if (row.ext_ref) {
    const { error } = await supabaseAdmin.from('wallet_ledger')
      .upsert(row, { onConflict: 'source,ext_ref', ignoreDuplicates: true }).select('id');
    if (error) return { ok: false, credited: false };
    // ¿se insertó o ya existía? Consulta corta por la clave.
    const { data } = await supabaseAdmin.from('wallet_ledger').select('id').eq('source', row.source).eq('ext_ref', row.ext_ref).maybeSingle();
    return { ok: true, credited: !!data };
  }
  const { error } = await supabaseAdmin.from('wallet_ledger').insert(row);
  return { ok: !error, credited: !error };
}

// Gasta del saldo (pagar algo dentro de Onyx). Falla si no alcanza. Idempotente
// por (source, ext_ref) para no cobrar dos veces el mismo pedido.
export async function debit(opts: {
  userId: string; amountCents: number; source: string; extRef?: string | null;
  method?: string; note?: string; meta?: any;
}): Promise<{ ok: boolean; reason?: string; balance?: number }> {
  const cents = Math.round(Number(opts.amountCents) || 0);
  if (!opts.userId || cents <= 0) return { ok: false, reason: 'bad_amount' };
  // ¿ya se cobró este pedido? (idempotencia)
  if (opts.extRef) {
    const { data: dup } = await supabaseAdmin.from('wallet_ledger').select('id').eq('source', opts.source).eq('ext_ref', opts.extRef).maybeSingle();
    if (dup) return { ok: true };
  }
  const bal = await balance(opts.userId);
  if (bal < cents) return { ok: false, reason: 'insufficient', balance: bal };
  const { error } = await supabaseAdmin.from('wallet_ledger').insert({
    user_id: opts.userId, amount_cents: -Math.abs(cents), kind: 'spend',
    method: opts.method || 'wallet', source: opts.source, ext_ref: opts.extRef ?? null,
    note: opts.note || null, meta: opts.meta ?? null,
  });
  if (error) return { ok: false, reason: 'db' };
  return { ok: true, balance: bal - cents };
}

// Últimos movimientos del usuario (para la página del monedero).
export async function movements(userId: string, limit = 50): Promise<Movement[]> {
  if (!userId) return [];
  const { data } = await supabaseAdmin.from('wallet_ledger')
    .select('id,amount_cents,kind,method,source,note,created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  return (data || []) as Movement[];
}
