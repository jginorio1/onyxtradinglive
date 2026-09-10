import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { runBotPayout, markPayoutPaid } from '@/lib/botlab';
import { runPayout as runAmbPayout, markPaidManual as markAmbPaid } from '@/lib/ambassadorPayout';

// ============================================================
// HUB DE PAGOS Y RETIROS (ADMIN) · un solo tablero para trabajar las solicitudes
// de retiro de TODOS los programas que el admin gestiona (Bot Lab + Embajadores),
// con acciones Pagar / Retener y KPIs. Cada pago sigue usando el motor y las
// protecciones de su programa: esto solo agrega y despacha.
//
// Programas de cobro DIRECTO a Stripe (Onyx Copy proveedor, Academia mentor) no
// generan solicitudes que el admin deba pagar, así que no aparecen aquí.
// Los créditos (Invita y gana) tampoco: se aplican solos a la factura.
// ============================================================

export type AdminPayoutRow = {
  id: string;
  program: 'botlab' | 'ambassador' | 'academy_ref' | 'funded';
  programLabel: string;
  icon: string;
  userId: string | null;
  who: string;                 // email / código para identificar a la persona
  amountCents: number;
  currency: string;
  method: string;              // stripe | usdt | bank | credit | otro
  destination: string;         // wallet / detalle de cobro
  status: 'pending' | 'on_hold' | 'paid' | 'rejected';
  createdAt: string;
  paidAt: string | null;
  note: string;
  readonly?: boolean;          // informativo: no lo paga el admin (mentor / registro)
  by?: string;                 // quién lo paga (p.ej. "el mentor") en informativos
};

export type AdminPayoutsData = {
  currency: 'USD';
  kpis: {
    toPayCents: number; onHoldCents: number; usdtUnconfirmed: number; paidMonthCents: number; pendingCount: number;
    directMonthCents: number;   // cobrado directo a Stripe este mes (Academia mentor + Onyx Copy) · informativo
  };
  rows: AdminPayoutRow[];         // accionable: Bot Lab + Embajador
  infoRows: AdminPayoutRow[];     // informativo: Academia·afiliados + cuentas fondeadas (solo lectura)
};

const isActionable = (s: string) => s === 'pending' || s === 'requested';
const normStatus = (s: string): AdminPayoutRow['status'] =>
  s === 'requested' ? 'pending' : (s === 'on_hold' || s === 'paid' || s === 'rejected') ? s : 'pending';

// Trae TODAS las solicitudes (pendientes, retenidas y pagadas recientes) de los
// dos programas, ya normalizadas a una sola forma, más los KPIs del mes.
export async function adminPayouts(): Promise<AdminPayoutsData> {
  const rows: AdminPayoutRow[] = [];
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  // ---- BOT LAB ----
  try {
    const { data } = await supabaseAdmin.from('bot_payouts').select('*').order('created_at', { ascending: false }).limit(300);
    const list = (data || []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.seller_id).filter(Boolean)));
    const emails = await emailMap(ids);
    for (const r of list) {
      rows.push({
        id: r.id, program: 'botlab', programLabel: 'Bot Lab', icon: '🤖',
        userId: r.seller_id || null, who: emails[r.seller_id] || short(r.seller_id),
        amountCents: Math.round(r.amount_cents || 0), currency: (r.currency || 'usd').toUpperCase(),
        method: r.method || 'stripe', destination: r.destination || '',
        status: normStatus(r.status), createdAt: r.created_at, paidAt: r.paid_at || null, note: r.note || '',
      });
    }
  } catch { /* sin Bot Lab */ }

  // ---- EMBAJADORES ----
  try {
    const { data } = await supabaseAdmin.from('ambassador_payouts').select('*').order('requested_at', { ascending: false }).limit(300);
    const list = (data || []) as any[];
    const ambIds = Array.from(new Set(list.map((r) => r.ambassador_id).filter(Boolean)));
    let ambMap: Record<string, { code: string; userId: string }> = {};
    if (ambIds.length) {
      const { data: ambs } = await supabaseAdmin.from('ambassadors').select('id,code,user_id').in('id', ambIds);
      for (const a of (ambs || []) as any[]) ambMap[a.id] = { code: a.code || '', userId: a.user_id };
    }
    const emails = await emailMap(Object.values(ambMap).map((a) => a.userId).filter(Boolean));
    for (const r of list) {
      const amb = ambMap[r.ambassador_id];
      const who = (amb?.code ? amb.code : '') || (amb?.userId ? emails[amb.userId] : '') || short(r.ambassador_id);
      rows.push({
        id: r.id, program: 'ambassador', programLabel: 'Embajador', icon: '📣',
        userId: amb?.userId || null, who,
        amountCents: Math.round((Number(r.amount) || 0) * 100), currency: 'USD',
        method: r.method || 'stripe', destination: r.details || '',
        status: normStatus(r.status), createdAt: r.requested_at, paidAt: r.paid_at || null, note: r.note || '',
      });
    }
  } catch { /* sin embajadores */ }

  // KPIs
  let toPayCents = 0, onHoldCents = 0, usdtUnconfirmed = 0, paidMonthCents = 0, pendingCount = 0;
  for (const r of rows) {
    if (r.status === 'pending') { toPayCents += r.amountCents; pendingCount++; if (isUsdt(r.method) && !r.destination.trim()) usdtUnconfirmed++; }
    else if (r.status === 'on_hold') onHoldCents += r.amountCents;
    else if (r.status === 'paid' && r.paidAt && new Date(r.paidAt) >= monthStart) paidMonthCents += r.amountCents;
  }

  // Orden: primero lo accionable (pendiente), luego retenido, luego pagado.
  const rank = (s: string) => s === 'pending' ? 0 : s === 'on_hold' ? 1 : 2;
  rows.sort((a, b) => rank(a.status) - rank(b.status) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

  // ---- INFORMATIVO (no lo pagas tú) ----
  const infoRows: AdminPayoutRow[] = [];
  let directMonthCents = 0;

  // Academia · afiliados: el MENTOR paga a sus referidos. Solo visibilidad.
  try {
    const { data } = await supabaseAdmin.from('academy_referral_payouts').select('*').order('created_at', { ascending: false }).limit(80);
    const list = (data || []) as any[];
    const emails = await emailMap(list.map((r) => r.referrer_id));
    for (const r of list) {
      infoRows.push({
        id: r.id, program: 'academy_ref', programLabel: 'Academia · afiliado', icon: '🎓',
        userId: r.referrer_id || null, who: emails[r.referrer_id] || short(r.referrer_id),
        amountCents: Math.round(r.total_cents || 0), currency: (r.currency || 'usd').toUpperCase(),
        method: r.method || 'otro', destination: '', status: 'paid', createdAt: r.created_at, paidAt: r.created_at,
        note: r.note || '', readonly: true, by: 'mentor',
      });
    }
  } catch { /* sin academia */ }

  // Cuentas fondeadas: registro personal de retiros del trader (no lo paga la plataforma).
  try {
    const { data } = await supabaseAdmin.from('payouts').select('*').order('created_at', { ascending: false }).limit(80);
    const list = (data || []) as any[];
    const emails = await emailMap(list.map((r) => r.user_id));
    for (const r of list) {
      infoRows.push({
        id: r.id, program: 'funded', programLabel: 'Cuenta fondeada', icon: '💵',
        userId: r.user_id || null, who: emails[r.user_id] || short(r.user_id),
        amountCents: Math.round((Number(r.amount) || 0) * 100), currency: 'USD',
        method: 'registro', destination: '', status: 'paid', createdAt: r.created_at || r.date, paidAt: r.date || r.created_at,
        note: r.note || '', readonly: true, by: 'trader',
      });
    }
  } catch { /* sin cuentas fondeadas */ }

  // Directo a Stripe este mes (Academia mentor + Onyx Copy): total informativo.
  try {
    const iso = monthStart.toISOString();
    const [ac, cf, cp] = await Promise.all([
      supabaseAdmin.from('onyx_commissions').select('gross_cents,fee_cents,created_at').neq('status', 'reversed').gte('created_at', iso),
      supabaseAdmin.from('copy_follow_commissions').select('net_cents,created_at').gte('created_at', iso),
      supabaseAdmin.from('copy_perf_charges').select('net_cents,status,created_at').eq('status', 'charged').gte('created_at', iso),
    ]);
    directMonthCents += ((ac.data || []) as any[]).reduce((s, r) => s + ((r.gross_cents || 0) - (r.fee_cents || 0)), 0);
    directMonthCents += ((cf.data || []) as any[]).reduce((s, r) => s + (r.net_cents || 0), 0);
    directMonthCents += ((cp.data || []) as any[]).reduce((s, r) => s + (r.net_cents || 0), 0);
  } catch { /* sin datos directos */ }

  return { currency: 'USD', kpis: { toPayCents, onHoldCents, usdtUnconfirmed, paidMonthCents, pendingCount, directMonthCents }, rows, infoRows };
}

const isUsdt = (m: string) => /usdt|crypto|cripto|trc|erc/i.test(m || '');
function short(id?: string | null) { return id ? String(id).slice(0, 8) + '…' : '—'; }
async function emailMap(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (!clean.length) return out;
  try {
    const { data } = await supabaseAdmin.from('profiles').select('id,email').in('id', clean);
    for (const p of (data || []) as any[]) out[p.id] = p.email || '';
  } catch {}
  return out;
}

// Paga una solicitud usando el motor de su programa (Stripe = transferencia real;
// USDT/banco = se marca pagada tras el envío manual).
export async function adminPayOne(program: string, id: string): Promise<{ ok: boolean; error?: string; manual?: boolean }> {
  if (program === 'botlab') {
    const { data: p } = await supabaseAdmin.from('bot_payouts').select('method,status').eq('id', id).maybeSingle();
    if (!p) return { ok: false, error: 'no_encontrado' };
    if ((p as any).status === 'paid') return { ok: false, error: 'ya_pagado' };
    if ((p as any).method === 'stripe') { const r = await runBotPayout(id); return r.ok ? { ok: true } : { ok: false, error: r.error }; }
    await markPayoutPaid(id); return { ok: true, manual: true };   // USDT/banco: enviado a mano
  }
  if (program === 'ambassador') {
    const { data: p } = await supabaseAdmin.from('ambassador_payouts').select('method,status').eq('id', id).maybeSingle();
    if (!p) return { ok: false, error: 'no_encontrado' };
    if ((p as any).status === 'paid') return { ok: false, error: 'ya_pagado' };
    const m = String((p as any).method || 'stripe');
    if (m === 'stripe' || m === 'credit' || m === '') { const r = await runAmbPayout(id); return r.ok ? { ok: true } : { ok: false, error: r.error }; }
    const r = await markAmbPaid(id, m); return r.ok ? { ok: true, manual: true } : { ok: false, error: r.error };
  }
  return { ok: false, error: 'programa_desconocido' };
}

// Retiene (congela) o libera una solicitud sin pagarla.
export async function adminHoldOne(program: string, id: string, hold: boolean): Promise<{ ok: boolean; error?: string }> {
  const table = program === 'botlab' ? 'bot_payouts' : program === 'ambassador' ? 'ambassador_payouts' : '';
  if (!table) return { ok: false, error: 'programa_desconocido' };
  const released = program === 'ambassador' ? 'requested' : 'pending';
  const { data: p } = await supabaseAdmin.from(table).select('status').eq('id', id).maybeSingle();
  if (!p) return { ok: false, error: 'no_encontrado' };
  if ((p as any).status === 'paid') return { ok: false, error: 'ya_pagado' };
  await supabaseAdmin.from(table).update({ status: hold ? 'on_hold' : released }).eq('id', id);
  return { ok: true };
}
