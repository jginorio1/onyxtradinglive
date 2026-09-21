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
  payout_method: 'stripe' | 'usdt' | 'manual'; status: 'active' | 'paused' | 'ended';
  start_date: string | null; stripe_account_id: string | null; payouts_enabled: boolean;
  on_hold: boolean; payout_usdt_trc20: string | null; payout_usdt_erc20: string | null;
  payout_usdt_network: string | null; note: string | null; deductions?: PayItem[] | null;
};

export const thisPeriod = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

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
export async function buildPayrun(period?: string): Promise<{ created: number; period: string }> {
  const p = period || thisPeriod();
  const s0 = await payrollSettings();
  const staff = (await listStaff()).filter((s) => s.status === 'active' && Number(s.salary) > 0);
  let created = 0;
  for (const s of staff) {
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
  return { created, period: p };
}

// Pagos de un periodo con datos del empleado.
export async function paymentsForPeriod(period?: string): Promise<any[]> {
  const p = period || thisPeriod();
  const { data: pays } = await supabaseAdmin.from('staff_payments').select('*').eq('period', p).order('created_at', { ascending: true });
  const rows = (pays || []) as any[];
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
  const monthly = active.reduce((a, s) => a + (Number(s.salary) || 0), 0);
  const pays = await paymentsForPeriod(p);
  const paid = pays.filter((x) => x.status === 'paid').reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const pending = pays.filter((x) => x.status !== 'paid' && x.status !== 'skipped').reduce((a, x) => a + (Number(x.amount) || 0), 0);
  return { period: p, headcount: active.length, monthly: Math.round(monthly * 100) / 100, pending: Math.round(pending * 100) / 100, paid: Math.round(paid * 100) / 100 };
}
