import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// REVISIÓN / INTEGRIDAD DEL DINERO (solo lectura + arreglos seguros)
// Un solo lugar que verifica que las comisiones y pagos de TODOS los programas
// cuadran. No ejecuta pagos (eso es PayoutsHub), no reporta ingresos (Revenue),
// no calcula P&L (Finanzas): solo confirma que el libro es consistente.
//
// Lee el libro único comm_commissions / comm_payouts (sales + ambassador) y,
// para el resumen, también academy_reward_events e "Invita y gana" member_rewards.
// Todos los chequeos son 100% locales (sin llamar a Stripe).
// ============================================================

export type CheckStatus = 'ok' | 'warn' | 'bad';
export type Check = {
  key: string;
  es: string; en: string;        // título
  subEs: string; subEn: string;  // explicación corta
  status: CheckStatus;
  count: number;
  sample: string[];              // ids de ejemplo (hasta 20) para "Ver filas"
  fix?: 'fix_payout_totals';     // acción segura disponible, si aplica
};

export type ProgramSummary = {
  key: string; es: string; en: string;
  generated: number; available: number; paid: number; reversed: number;
  note?: string;
};

export type IntegrityReport = {
  at: string;
  overall: CheckStatus;
  checks: Check[];
  programs: ProgramSummary[];
  automations: { label: string; sub: string; status: CheckStatus }[];
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const worst = (a: CheckStatus, b: CheckStatus): CheckStatus =>
  a === 'bad' || b === 'bad' ? 'bad' : a === 'warn' || b === 'warn' ? 'warn' : 'ok';

// Trae todo el libro (volúmenes pequeños; sin paginar hace falta).
async function loadLedger() {
  const { data: comm } = await supabaseAdmin.from('comm_commissions')
    .select('id,program,referrer_id,level,invoice_id,base_amount,pct,amount,status,available_at,paid_at,payout_id,created_at')
    .limit(100000);
  const { data: pays } = await supabaseAdmin.from('comm_payouts')
    .select('id,program,referrer_id,amount,status,created_at')
    .limit(100000);
  return { comm: (comm || []) as any[], pays: (pays || []) as any[] };
}

export async function runIntegrity(): Promise<IntegrityReport> {
  const now = Date.now();
  const { comm, pays } = await loadLedger();
  const checks: Check[] = [];

  // --- 1) Duplicados por clave única (program, invoice, referrer, level) ---
  const seen: Record<string, string[]> = {};
  for (const c of comm) {
    const k = `${c.program}|${c.invoice_id}|${c.referrer_id}|${c.level}`;
    (seen[k] = seen[k] || []).push(c.id);
  }
  const dups = Object.values(seen).filter((ids) => ids.length > 1).flatMap((ids) => ids.slice(1));
  checks.push({
    key: 'duplicates', es: 'Comisiones duplicadas', en: 'Duplicate commissions',
    subEs: 'La misma factura no debe acreditarse dos veces al mismo beneficiario.',
    subEn: 'The same invoice must not be credited twice to the same beneficiary.',
    status: dups.length ? 'bad' : 'ok', count: dups.length, sample: dups.slice(0, 20),
  });

  // --- 2) Comisiones huérfanas: el beneficiario no existe en su programa ---
  const salesIds = new Set((((await supabaseAdmin.from('sales_reps').select('id').limit(100000)).data) || []).map((x: any) => x.id));
  const ambIds = new Set((((await supabaseAdmin.from('ambassadors').select('id').limit(100000)).data) || []).map((x: any) => x.id));
  const orphans = comm.filter((c) =>
    (c.program === 'sales' && !salesIds.has(c.referrer_id)) ||
    (c.program === 'ambassador' && !ambIds.has(c.referrer_id))
  ).map((c) => c.id);
  checks.push({
    key: 'orphan_referrer', es: 'Comisión sin beneficiario válido', en: 'Commission with no valid beneficiary',
    subEs: 'Cada comisión debe apuntar a un vendedor o embajador que exista.',
    subEn: 'Every commission must point to an existing sales rep or ambassador.',
    status: orphans.length ? 'bad' : 'ok', count: orphans.length, sample: orphans.slice(0, 20),
  });

  // --- 3) Pagadas sin pago registrado ---
  const paidNoPayout = comm.filter((c) => c.status === 'paid' && !c.payout_id).map((c) => c.id);
  checks.push({
    key: 'paid_no_payout', es: 'Pagadas sin pago registrado', en: 'Paid without a payout record',
    subEs: 'Una comisión pagada debe estar ligada a un pago en el registro.',
    subEn: 'A paid commission must be linked to a payout record.',
    status: paidNoPayout.length ? 'warn' : 'ok', count: paidNoPayout.length, sample: paidNoPayout.slice(0, 20),
  });

  // --- 4) Enlace de pago huérfano: payout_id que no existe ---
  const payIds = new Set(pays.map((p) => p.id));
  const orphanLink = comm.filter((c) => c.payout_id && !payIds.has(c.payout_id)).map((c) => c.id);
  checks.push({
    key: 'orphan_payout_link', es: 'Enlace de pago roto', en: 'Broken payout link',
    subEs: 'Comisiones que apuntan a un pago que ya no existe.',
    subEn: 'Commissions pointing to a payout that no longer exists.',
    status: orphanLink.length ? 'bad' : 'ok', count: orphanLink.length, sample: orphanLink.slice(0, 20),
  });

  // --- 5) Pagos descuadrados: comm_payouts.amount ≠ suma de sus comisiones ---
  const byPayout: Record<string, number> = {};
  for (const c of comm) if (c.payout_id && c.status === 'paid') byPayout[c.payout_id] = (byPayout[c.payout_id] || 0) + (Number(c.amount) || 0);
  const mismatched = pays.filter((p) => Math.abs(r2(byPayout[p.id] || 0) - r2(Number(p.amount) || 0)) > 0.01).map((p) => p.id);
  checks.push({
    key: 'payout_mismatch', es: 'Pagos que no cuadran', en: 'Payouts that don\'t reconcile',
    subEs: 'El total del pago debe coincidir con las comisiones que agrupa.',
    subEn: 'A payout total must match the commissions it groups.',
    status: mismatched.length ? 'warn' : 'ok', count: mismatched.length, sample: mismatched.slice(0, 20),
    fix: mismatched.length ? 'fix_payout_totals' : undefined,
  });

  // --- 6) Reversa inconsistente: revertida pero marcada como pagada ---
  const reversedPaid = comm.filter((c) => c.status === 'reversed' && c.paid_at).map((c) => c.id);
  checks.push({
    key: 'reversed_paid', es: 'Reversa sobre algo ya pagado', en: 'Reversal on already-paid item',
    subEs: 'Una reversa no debería tocar comisiones que ya se pagaron.',
    subEn: 'A reversal should not touch commissions that were already paid.',
    status: reversedPaid.length ? 'warn' : 'ok', count: reversedPaid.length, sample: reversedPaid.slice(0, 20),
  });

  // --- 7) Monto ≠ base × % (excluye bonos de monto fijo) ---
  const amtBad = comm.filter((c) => {
    if (String(c.level || '').startsWith('bonus')) return false;
    const pct = Number(c.pct) || 0;
    if (!(pct > 0)) return false;
    const expected = r2((Number(c.base_amount) || 0) * pct / 100);
    return Math.abs(expected - r2(Number(c.amount) || 0)) > 0.01;
  }).map((c) => c.id);
  checks.push({
    key: 'amount_mismatch', es: 'Monto distinto a base × %', en: 'Amount differs from base × %',
    subEs: 'El monto acreditado debe ser la base por el porcentaje.',
    subEn: 'The credited amount must equal base times percentage.',
    status: amtBad.length ? 'warn' : 'ok', count: amtBad.length, sample: amtBad.slice(0, 20),
  });

  // --- Resumen por programa ---
  const programs: ProgramSummary[] = [];
  const sumComm = (program: string) => {
    let generated = 0, available = 0, paid = 0, reversed = 0;
    for (const c of comm) {
      if (c.program !== program) continue;
      const amt = Number(c.amount) || 0;
      if (c.status === 'reversed') { reversed += amt; continue; }
      generated += amt;
      if (c.status === 'paid') paid += amt;
      else if (c.status === 'available' || (c.available_at && new Date(c.available_at).getTime() <= now)) available += amt;
    }
    return { generated: r2(generated), available: r2(available), paid: r2(paid), reversed: r2(reversed) };
  };
  programs.push({ key: 'sales', es: 'Vendedores', en: 'Sales', ...sumComm('sales') });
  programs.push({ key: 'ambassador', es: 'Embajadores', en: 'Ambassadors', ...sumComm('ambassador') });

  // Academia (academy_reward_events · centavos)
  try {
    const { data: ac } = await supabaseAdmin.from('academy_reward_events').select('amount_cents,status').limit(100000);
    let g = 0, av = 0, pd = 0, rv = 0;
    for (const e of (ac || []) as any[]) {
      const amt = (Number(e.amount_cents) || 0) / 100;
      if (e.status === 'reversed') { rv += amt; continue; }
      g += amt; if (e.status === 'paid') pd += amt; else if (e.status === 'available') av += amt;
    }
    programs.push({ key: 'academy', es: 'Academia', en: 'Academy', generated: r2(g), available: r2(av), paid: r2(pd), reversed: r2(rv), note: 'propia' });
  } catch { /* opcional */ }

  // Invita y gana (member_rewards · crédito en dólares, estado 'applied')
  try {
    const { data: mr } = await supabaseAdmin.from('member_rewards').select('amount,status').limit(100000);
    let g = 0, ap = 0, rv = 0;
    for (const e of (mr || []) as any[]) {
      const amt = Number(e.amount) || 0;
      if (e.status === 'reversed') { rv += amt; continue; }
      g += amt; if (e.status === 'applied') ap += amt;
    }
    programs.push({ key: 'member', es: 'Invita y gana', en: 'Invite & earn', generated: r2(g), available: r2(ap), paid: 0, reversed: r2(rv), note: 'crédito' });
  } catch { /* opcional */ }

  // --- Automatismos (crons y frescura de tiers) ---
  const automations: IntegrityReport['automations'] = [];
  try {
    const { data: reps } = await supabaseAdmin.from('sales_reps').select('tier_at,status').limit(100000);
    const active = ((reps || []) as any[]).filter((r) => r.status === 'active');
    const stamps = active.map((r) => r.tier_at).filter(Boolean).map((t: string) => new Date(t).getTime());
    const freshest = stamps.length ? Math.max(...stamps) : null;
    const ageH = freshest ? Math.round((now - freshest) / 3600000) : null;
    const stale = active.length > 0 && (freshest == null || (now - freshest) > 24 * 3600000);
    automations.push({
      label: 'Niveles de vendedor (cron)',
      sub: active.length === 0 ? 'Sin vendedores activos aún' : freshest == null ? 'Aún no se han calculado' : `Último recálculo hace ${ageH}h`,
      status: stale ? 'warn' : 'ok',
    });
  } catch { /* opcional */ }
  try {
    const stamps = comm.map((c) => c.created_at).filter(Boolean).map((t: string) => new Date(t).getTime());
    const last = stamps.length ? Math.max(...stamps) : null;
    automations.push({
      label: 'Última comisión acreditada',
      sub: last ? new Date(last).toISOString().slice(0, 16).replace('T', ' ') : 'Ninguna todavía',
      status: 'ok',
    });
  } catch { /* opcional */ }

  const overall = checks.reduce<CheckStatus>((acc, c) => worst(acc, c.status), 'ok');
  return { at: new Date().toISOString(), overall, checks, programs, automations };
}

// Arreglo SEGURO: recalcula el total de cada pago descuadrado a partir de las
// comisiones que agrupa (no crea ni borra dinero; solo corrige el total guardado
// para que coincida con sus líneas). Reversible por naturaleza.
export async function fixPayoutTotals(): Promise<{ fixed: number }> {
  const { comm, pays } = await loadLedger();
  const byPayout: Record<string, number> = {};
  for (const c of comm) if (c.payout_id && c.status === 'paid') byPayout[c.payout_id] = (byPayout[c.payout_id] || 0) + (Number(c.amount) || 0);
  let fixed = 0;
  for (const p of pays) {
    const real = r2(byPayout[p.id] || 0);
    if (Math.abs(real - r2(Number(p.amount) || 0)) > 0.01) {
      await supabaseAdmin.from('comm_payouts').update({ amount: real }).eq('id', p.id);
      fixed++;
    }
  }
  return { fixed };
}
