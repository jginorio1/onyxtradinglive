import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// NÓMINA del equipo interno. Sueldo fijo por periodo (mensual). Se apoya en el
// mismo nodo Stripe Connect compartido (ventas/embajadores) para transferir, o
// pago manual/USDT. Vive sobre el área Equipo del panel.
// ============================================================

// Un concepto de nómina. kind 'earning' SUMA al bruto (bono), 'deduction' RESTA
// (impuesto, seguro, préstamo…). mode: porcentaje del sueldo o monto fijo.
export type PayItem = { label: string; kind: 'earning' | 'deduction'; mode: 'percent' | 'fixed'; value: number };

export type PayrollSettings = {
  enabled: boolean;
  pay_day: number;            // día del mes para el pago (1-28)
  auto_pay: boolean;          // pagar solo en la fecha (cron)
  review_before_pay: boolean; // freno global: arma la nómina pero apruebas tú
  currency: string;
  departments: string[];
  deductions: PayItem[];      // conceptos por defecto (aplican a todos si el empleado no tiene propios)
  company_name: string;       // nombre para el recibo
};

const DEFAULTS: PayrollSettings = {
  enabled: true, pay_day: 1, auto_pay: false, review_before_pay: true,
  currency: 'USD', departments: ['dev', 'management', 'marketing', 'design', 'ops', 'other'],
  deductions: [], company_name: 'Onyx Trading Live',
};

// Calcula bruto → conceptos → neto. Los % se calculan sobre el SUELDO base.
export function computePay(salary: number, items: PayItem[]): { gross: number; net: number; applied: { label: string; kind: string; amount: number }[] } {
  const base = Math.max(0, Number(salary) || 0);
  const applied: { label: string; kind: string; amount: number }[] = [];
  let gross = base, net = base;
  for (const it of (items || [])) {
    if (!it || !it.label) continue;
    const amt = it.mode === 'percent' ? Math.round(base * (Number(it.value) || 0)) / 100 : (Number(it.value) || 0);
    if (!(amt > 0)) continue;
    if (it.kind === 'earning') { gross += amt; net += amt; applied.push({ label: it.label, kind: 'earning', amount: amt }); }
    else { net -= amt; applied.push({ label: it.label, kind: 'deduction', amount: amt }); }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { gross: r(gross), net: r(Math.max(0, net)), applied: applied.map((a) => ({ ...a, amount: r(a.amount) })) };
}

export async function payrollSettings(): Promise<PayrollSettings> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'payroll').maybeSingle();
    return { ...DEFAULTS, ...((data?.value as any) || {}) };
  } catch { return DEFAULTS; }
}
export async function savePayrollSettings(patch: Partial<PayrollSettings>): Promise<PayrollSettings> {
  const prev = await payrollSettings();
  const value = { ...prev, ...patch };
  await supabaseAdmin.from('app_settings').upsert({ key: 'payroll', value, updated_at: new Date().toISOString() });
  return value;
}

export type Staff = {
  id: string; user_id: string | null; name: string; email: string | null;
  department: string; position: string | null; salary: number; currency: string;
  pay_cycle?: PayCycle | null;
  payout_method: 'stripe' | 'usdt' | 'manual'; status: 'active' | 'paused' | 'ended';
  start_date: string | null; stripe_account_id: string | null; payouts_enabled: boolean;
  on_hold: boolean; payout_usdt_trc20: string | null; payout_usdt_erc20: string | null;
  payout_usdt_network: string | null; note: string | null; deductions?: PayItem[] | null;
};

export const thisPeriod = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM' (mensual)

// ── FRECUENCIA DE PAGO por empleado ──────────────────────────────────
//  semanal (weekly, 52/año) · bisemanal (biweekly, cada 2 semanas, 26/año) ·
//  quincenal (semimonthly, 2 veces/mes el 1–15 y 16–fin, 24/año) · mensual (12/año).
export type PayCycle = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export const PAY_CYCLES: PayCycle[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];
export const CYCLE_LABEL: Record<PayCycle, { es: string; en: string }> = {
  weekly: { es: 'Semanal', en: 'Weekly' },
  biweekly: { es: 'Bisemanal (cada 2 semanas)', en: 'Biweekly (every 2 weeks)' },
  semimonthly: { es: 'Quincenal (2 veces al mes)', en: 'Semimonthly (twice a month)' },
  monthly: { es: 'Mensual', en: 'Monthly' },
};
export function normCycle(v: any): PayCycle { return (PAY_CYCLES as string[]).includes(v) ? (v as PayCycle) : 'monthly'; }
// Nº de periodos al mes (para estimar el costo mensual equivalente).
export function periodsPerMonth(cycle: PayCycle): number {
  return cycle === 'weekly' ? 52 / 12 : cycle === 'biweekly' ? 26 / 12 : cycle === 'semimonthly' ? 2 : 1;
}
// Lunes (UTC) de la semana de una fecha.
function mondayUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - wd); return x;
}
// Clave de PERIODO según la frecuencia (idempotente y ordenable). Mensual queda
// como 'YYYY-MM' (sin prefijo) para no romper los pagos mensuales ya existentes.
export function periodForCycle(cycle: PayCycle, date: Date = new Date()): string {
  if (cycle === 'weekly') return 'W' + mondayUTC(date).toISOString().slice(0, 10);
  if (cycle === 'biweekly') {
    let m = mondayUTC(date);
    const wk = Math.floor(m.getTime() / (7 * 86400000));
    if (wk % 2 === 1) m = new Date(m.getTime() - 7 * 86400000);   // ancla = lunes del par de semanas
    return 'B' + m.toISOString().slice(0, 10);
  }
  if (cycle === 'semimonthly') return 'Q' + date.toISOString().slice(0, 7) + (date.getUTCDate() <= 15 ? '1' : '2');
  return date.toISOString().slice(0, 7);   // mensual
}
// A qué MES (YYYY-MM) pertenece una clave de periodo (para el filtro del panel).
export function monthOfPeriod(key: string): string {
  if (/^\d{4}-\d{2}$/.test(key)) return key;                    // mensual
  if (key[0] === 'W' || key[0] === 'B') return key.slice(1, 8);  // 'YYYY-MM-DD' → 'YYYY-MM'
  if (key[0] === 'Q') return key.slice(1, 8);                    // 'QYYYY-MM?' → 'YYYY-MM'
  return key.slice(0, 7);
}
// Etiqueta legible de un periodo (para mostrar en la tabla).
export function periodHuman(key: string): string {
  if (key[0] === 'W') return 'Semana ' + key.slice(1);
  if (key[0] === 'B') return 'Quincena ' + key.slice(1);
  if (key[0] === 'Q') return key.slice(1, 8) + (key.endsWith('1') ? ' · 1ª quincena' : ' · 2ª quincena');
  return key;
}

export async function listStaff(): Promise<Staff[]> {
  const { data } = await supabaseAdmin.from('staff').select('*').order('created_at', { ascending: true }).limit(500);
  return (data as any) || [];
}
export async function staffById(id: string): Promise<Staff | null> {
  const { data } = await supabaseAdmin.from('staff').select('*').eq('id', id).maybeSingle();
  return (data as any) || null;
}
export async function staffByUser(userId: string): Promise<Staff | null> {
  const { data } = await supabaseAdmin.from('staff').select('*').eq('user_id', userId).maybeSingle();
  return (data as any) || null;
}

const clean = (s: any, n = 200) => (s == null ? null : String(s).trim().slice(0, n) || null);

// Crea o edita un empleado. Si trae email y no user_id, intenta ligarlo a una
// cuenta existente (para su panel self-serve).
export async function upsertStaff(p: any): Promise<{ ok: boolean; id?: string; error?: string }> {
  const patch: any = {
    name: clean(p.name, 120), email: clean(p.email, 160),
    department: clean(p.department, 40) || 'other', position: clean(p.position, 120),
    salary: Math.max(0, Number(p.salary) || 0), currency: (clean(p.currency, 8) || 'USD').toUpperCase(),
    pay_cycle: normCycle(p.pay_cycle),
    payout_method: ['stripe', 'usdt', 'manual'].includes(p.payout_method) ? p.payout_method : 'stripe',
    status: ['active', 'paused', 'ended'].includes(p.status) ? p.status : 'active',
    start_date: p.start_date || null, note: clean(p.note, 500),
  };
  if (Array.isArray(p.deductions)) {
    patch.deductions = p.deductions.filter((d: any) => d && d.label).slice(0, 20).map((d: any) => ({
      label: String(d.label).slice(0, 60), kind: d.kind === 'earning' ? 'earning' : 'deduction',
      mode: d.mode === 'fixed' ? 'fixed' : 'percent', value: Math.max(0, Number(d.value) || 0),
    }));
  } else if (p.deductions === null) patch.deductions = null;
  if (!patch.name) return { ok: false, error: 'falta el nombre' };
  // Ligar a cuenta por correo (opcional).
  if (patch.email) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', patch.email.toLowerCase()).maybeSingle();
    if (prof) patch.user_id = (prof as any).id;
  }
  if (p.id) {
    await supabaseAdmin.from('staff').update(patch).eq('id', p.id);
    return { ok: true, id: p.id };
  }
  const { data, error } = await supabaseAdmin.from('staff').insert(patch).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any)?.id };
}

// Total pagado a un empleado (histórico) y en el año actual.
export async function staffPaidTotals(staffId: string): Promise<{ total: number; ytd: number; last?: string }> {
  const { data } = await supabaseAdmin.from('staff_payments').select('amount,paid_at,status').eq('staff_id', staffId).eq('status', 'paid');
  const year = new Date().getFullYear();
  let total = 0, ytd = 0, last: string | undefined;
  (data || []).forEach((r: any) => {
    const a = Number(r.amount) || 0; total += a;
    if (r.paid_at) { if (new Date(r.paid_at).getFullYear() === year) ytd += a; if (!last || r.paid_at > last) last = r.paid_at; }
  });
  return { total: Math.round(total * 100) / 100, ytd: Math.round(ytd * 100) / 100, last };
}

// Arma la nómina de un periodo: crea un pago 'pending' por cada empleado activo
// con sueldo > 0 que aún no lo tenga. Idempotente por (staff_id, period).
// `asOf` = fecha de referencia (por defecto hoy). Cada empleado recibe el pago de
// SU periodo actual según su frecuencia (semanal/bisemanal/quincenal/mensual), así
// que una sola corrida cubre todas las cadencias sin duplicar (idempotente por periodo).
export async function buildPayrun(asOf?: string): Promise<{ created: number; period: string }> {
  const now = asOf ? new Date(asOf) : new Date();
  const s0 = await payrollSettings();
  const staff = (await listStaff()).filter((s) => s.status === 'active' && Number(s.salary) > 0);
  let created = 0;
  for (const s of staff) {
    const p = periodForCycle(normCycle(s.pay_cycle), now);   // periodo propio de su cadencia
    const { data: exists } = await supabaseAdmin.from('staff_payments').select('id').eq('staff_id', s.id).eq('period', p).maybeSingle();
    if (exists) continue;
    // Conceptos: los del empleado si tiene; si no, los globales.
    const items = (s.deductions && s.deductions.length) ? s.deductions : (s0.deductions || []);
    const calc = computePay(s.salary, items);
    await supabaseAdmin.from('staff_payments').insert({
      staff_id: s.id, period: p, gross: calc.gross, net: calc.net, amount: calc.net,
      deductions: calc.applied, currency: s.currency, method: s.payout_method, status: 'pending',
    });
    created++;
  }
  return { created, period: thisPeriod() };
}

// Pagos de un MES con datos del empleado. Como ahora hay varias cadencias, el
// filtro es por mes: se incluyen el pago mensual de ese mes, las 2 quincenas, y
// las semanas/bisemanas cuyo periodo cae en ese mes (vía monthOfPeriod). Cada fila
// trae `period_label` legible para la tabla.
export async function paymentsForPeriod(period?: string): Promise<any[]> {
  const month = (period || thisPeriod()).slice(0, 7);
  // Traemos los pagos recientes y filtramos en memoria por mes del periodo (el
  // equipo interno es pequeño; evita SQL complejo para las claves 'W…'/'B…'/'Q…').
  const { data: pays } = await supabaseAdmin.from('staff_payments').select('*').order('created_at', { ascending: false }).limit(600);
  const rows = ((pays || []) as any[]).filter((r) => monthOfPeriod(String(r.period || '')) === month)
    .map((r) => ({ ...r, period_label: periodHuman(String(r.period || '')) }))
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  if (!rows.length) return [];
  const ids = Array.from(new Set(rows.map((r) => r.staff_id)));
  const { data: staff } = await supabaseAdmin.from('staff').select('id,name,department,position,payout_method,payouts_enabled,stripe_account_id,on_hold').in('id', ids);
  const byId: Record<string, any> = {}; (staff || []).forEach((s: any) => { byId[s.id] = s; });
  return rows.map((r) => ({ ...r, staff: byId[r.staff_id] || null }));
}

// Marca un pago como pagado manualmente (transferencia/efectivo/USDT fuera de Stripe).
export async function markPaymentManual(paymentId: string, method = 'manual', ref?: string): Promise<{ ok: boolean }> {
  await supabaseAdmin.from('staff_payments').update({ status: 'paid', method, ref: ref || null, paid_at: new Date().toISOString() }).eq('id', paymentId);
  return { ok: true };
}

// Resumen del periodo (para tarjetas del panel).
export async function payrollSummary(period?: string): Promise<{ period: string; headcount: number; monthly: number; pending: number; paid: number }> {
  const p = period || thisPeriod();
  const staff = await listStaff();
  const active = staff.filter((s) => s.status === 'active');
  // Costo MENSUAL EQUIVALENTE: el sueldo es "por periodo", así que lo escalamos por
  // cuántos periodos hay al mes según la cadencia (semanal ×4.33, bisemanal ×2.17,
  // quincenal ×2, mensual ×1). Así la tarjeta "nómina mensual" sigue siendo real.
  const monthly = active.reduce((a, s) => a + (Number(s.salary) || 0) * periodsPerMonth(normCycle(s.pay_cycle)), 0);
  const pays = await paymentsForPeriod(p);
  const paid = pays.filter((x) => x.status === 'paid').reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const pending = pays.filter((x) => x.status !== 'paid' && x.status !== 'skipped').reduce((a, x) => a + (Number(x.amount) || 0), 0);
  return { period: p, headcount: active.length, monthly: Math.round(monthly * 100) / 100, pending: Math.round(pending * 100) / 100, paid: Math.round(paid * 100) / 100 };
}
