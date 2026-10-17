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
  // Tras gastar, si el saldo quedó bajo el umbral, intenta auto-recargar (no bloquea).
  try { await maybeAutoReload(opts.userId); } catch {}
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

// ============================================================
// AUTO-RECARGA (recarga sola cuando el saldo baja de un umbral · web/Android)
// ============================================================
export type AutoReload = {
  enabled: boolean; threshold_cents: number; amount_cents: number;
  has_card: boolean; max_per_day: number;
};

export async function getAutoReload(userId: string): Promise<AutoReload> {
  const def: AutoReload = { enabled: false, threshold_cents: 1000, amount_cents: 2500, has_card: false, max_per_day: 3 };
  if (!userId) return def;
  const { data } = await supabaseAdmin.from('wallet_autoreload').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return def;
  const d = data as any;
  return { enabled: !!d.enabled, threshold_cents: Number(d.threshold_cents) || 1000, amount_cents: Number(d.amount_cents) || 2500, has_card: !!d.stripe_pm, max_per_day: Number(d.max_per_day) || 3 };
}

export async function saveAutoReload(userId: string, patch: { enabled?: boolean; threshold_cents?: number; amount_cents?: number }): Promise<void> {
  if (!userId) return;
  const row: any = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) row.enabled = !!patch.enabled;
  if (patch.threshold_cents !== undefined) row.threshold_cents = Math.max(0, Math.round(patch.threshold_cents));
  if (patch.amount_cents !== undefined) row.amount_cents = Math.max(500, Math.round(patch.amount_cents)); // mínimo $5
  await supabaseAdmin.from('wallet_autoreload').upsert(row, { onConflict: 'user_id' });
}

// Guarda la tarjeta (cliente + método de pago de Stripe) para cobrar off-session.
export async function setAutoReloadCard(userId: string, stripeCustomer: string, stripePm: string): Promise<void> {
  await supabaseAdmin.from('wallet_autoreload').upsert(
    { user_id: userId, stripe_customer: stripeCustomer, stripe_pm: stripePm, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

// Se llama tras cada gasto: si el saldo quedó bajo el umbral y hay auto-recarga
// con tarjeta, cobra off-session y acredita. Topes por día para no entrar en bucle.
// Nunca lanza: una recarga fallida no debe romper el gasto que la disparó.
export async function maybeAutoReload(userId: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin.from('wallet_autoreload').select('*').eq('user_id', userId).maybeSingle();
    const a = data as any;
    if (!a || !a.enabled || !a.stripe_pm || !a.stripe_customer) return;
    const bal = await balance(userId);
    if (bal >= Number(a.threshold_cents)) return;                   // aún hay saldo suficiente
    const today = new Date().toISOString().slice(0, 10);
    const count = a.day_date === today ? (Number(a.day_count) || 0) : 0;
    if (count >= (Number(a.max_per_day) || 3)) return;              // tope diario
    const amount = Math.max(500, Math.round(Number(a.amount_cents) || 2500));
    const { stripe } = await import('@/lib/stripe');
    // Reserva el "cupo diario" ANTES de cobrar para no disparar dos veces en paralelo.
    await supabaseAdmin.from('wallet_autoreload').update({ day_date: today, day_count: count + 1 }).eq('user_id', userId);
    const pi: any = await stripe.paymentIntents.create({
      amount, currency: 'usd', customer: a.stripe_customer, payment_method: a.stripe_pm,
      off_session: true, confirm: true,
      metadata: { kind: 'wallet_autoreload', userId },
    });
    if (pi && (pi.status === 'succeeded')) {
      await credit({ userId, amountCents: amount, kind: 'topup', method: 'card', source: 'stripe', extRef: pi.id, note: 'Auto-recarga' });
    }
  } catch { /* si falla el cobro off-session, se intenta de nuevo en el próximo gasto */ }
}

// ============================================================
// AJUSTES DE ADMIN (crédito/reembolso manual al monedero de un usuario)
// ============================================================
export async function adminAdjust(userId: string, deltaCents: number, kind: 'adjust' | 'refund', note: string, byEmail?: string): Promise<{ ok: boolean; reason?: string }> {
  const cents = Math.round(Number(deltaCents) || 0);
  if (!userId || cents === 0) return { ok: false, reason: 'bad' };
  if (cents > 0) {
    const r = await credit({ userId, amountCents: cents, kind, method: 'system', source: 'admin', extRef: `admin-${Date.now()}`, note, meta: { by: byEmail || null } });
    return { ok: r.ok };
  }
  // negativo = quitar saldo
  const bal = await balance(userId);
  if (bal < Math.abs(cents)) return { ok: false, reason: 'insufficient' };
  const { error } = await supabaseAdmin.from('wallet_ledger').insert({
    user_id: userId, amount_cents: cents, kind: 'adjust', method: 'system', source: 'admin',
    ext_ref: `admin-${Date.now()}`, note, meta: { by: byEmail || null },
  });
  return { ok: !error };
}
