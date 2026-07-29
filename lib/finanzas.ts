import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';
import { computeRevenue } from '@/lib/revenue';

// ============================================================
// Finanzas de Onyx · P&L del negocio.
// Ingresos: se leen de Stripe (lib/revenue). Gastos: los registra el dueño en la
// tabla onyx_expenses (recurrentes y puntuales). Aquí los cruzamos.
// ============================================================

export type ExpenseKind = 'recurring' | 'one_off';
export type Expense = {
  id: string; name: string; category: string; amount: number;
  kind: ExpenseKind; interval: 'monthly' | 'yearly';
  incurred_on: string; ends_on: string | null; active: boolean;
  vendor: string | null; note: string | null;
};
export const CATEGORIES = ['infra', 'sueldos', 'ads', 'herramientas', 'legal', 'otros'] as const;

const DAY = 864e5;
const clampNum = (n: any, lo = 0, hi = 1e12) => { const x = Number(n); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0; };
const monthlyOf = (e: { amount: number; interval: string }) => e.interval === 'yearly' ? e.amount / 12 : e.amount;
const asDate = (s: string) => new Date(s + 'T00:00:00Z').getTime();

// ---- Caja (saldo del negocio), en app_settings ----
export type Cash = { balance: number; updated_at: string | null };
export const getCash = () => getSetting<Cash>('onyx_cash', { balance: 0, updated_at: null });
export async function setCash(balance: number) {
  const c: Cash = { balance: clampNum(balance, 0, 1e12), updated_at: new Date().toISOString() };
  await saveSetting('onyx_cash', c);
  return c;
}

// ---- CRUD de gastos ----
export async function listExpenses(): Promise<Expense[]> {
  const { data } = await supabaseAdmin.from('onyx_expenses').select('*').order('incurred_on', { ascending: false });
  return (data || []) as any;
}
export async function addExpense(b: any): Promise<Expense> {
  const row = {
    name: String(b.name || '').slice(0, 120) || 'Gasto',
    category: (CATEGORIES as readonly string[]).includes(b.category) ? b.category : 'otros',
    amount: clampNum(b.amount),
    kind: b.kind === 'one_off' ? 'one_off' : 'recurring',
    interval: b.interval === 'yearly' ? 'yearly' : 'monthly',
    incurred_on: /^\d{4}-\d{2}-\d{2}$/.test(b.incurred_on) ? b.incurred_on : new Date().toISOString().slice(0, 10),
    ends_on: /^\d{4}-\d{2}-\d{2}$/.test(b.ends_on) ? b.ends_on : null,
    active: b.active !== false,
    vendor: b.vendor ? String(b.vendor).slice(0, 80) : null,
    note: b.note ? String(b.note).slice(0, 300) : null,
  };
  const { data, error } = await supabaseAdmin.from('onyx_expenses').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data as any;
}
export async function updateExpense(id: string, b: any): Promise<void> {
  const patch: any = {};
  if (b.name !== undefined) patch.name = String(b.name).slice(0, 120);
  if (b.category !== undefined) patch.category = (CATEGORIES as readonly string[]).includes(b.category) ? b.category : 'otros';
  if (b.amount !== undefined) patch.amount = clampNum(b.amount);
  if (b.kind !== undefined) patch.kind = b.kind === 'one_off' ? 'one_off' : 'recurring';
  if (b.interval !== undefined) patch.interval = b.interval === 'yearly' ? 'yearly' : 'monthly';
  if (b.incurred_on !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.incurred_on)) patch.incurred_on = b.incurred_on;
  if (b.ends_on !== undefined) patch.ends_on = /^\d{4}-\d{2}-\d{2}$/.test(b.ends_on) ? b.ends_on : null;
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.vendor !== undefined) patch.vendor = b.vendor ? String(b.vendor).slice(0, 80) : null;
  if (b.note !== undefined) patch.note = b.note ? String(b.note).slice(0, 300) : null;
  await supabaseAdmin.from('onyx_expenses').update(patch).eq('id', id);
}
export async function deleteExpense(id: string): Promise<void> {
  await supabaseAdmin.from('onyx_expenses').delete().eq('id', id);
}

// ¿Cuánto aporta un gasto al mes [mStart, mEnd]? (recurrente prorrateado, o el
// puntual si cae dentro).
function contribForMonth(e: Expense, mStart: number, mEnd: number): number {
  if (!e.active) return 0;
  const start = asDate(e.incurred_on);
  if (e.kind === 'one_off') return (start >= mStart && start <= mEnd) ? e.amount : 0;
  const end = e.ends_on ? asDate(e.ends_on) : Infinity;
  return (start <= mEnd && end >= mStart) ? monthlyOf(e) : 0;
}

export type FinanceMonth = { label: string; income: number; expense: number; net: number };
export type FinanceData = {
  configured: boolean; incomeMode: 'collected' | 'mrr'; currency: string;
  thisMonth: { income: number; expense: number; net: number; margin: number | null };
  burn: number;               // gasto fijo mensual actual (recurrentes activos)
  cash: number; runway: number | null;
  mrr: number; collected: number;
  series: FinanceMonth[];
  categories: { category: string; recurring: number; one_off: number; total: number }[];
  expenses: Expense[];
};

export async function computeFinance(fromMs: number, toMs: number, incomeMode: 'collected' | 'mrr' = 'collected', es = true): Promise<FinanceData> {
  const [rev, expenses, cashRow] = await Promise.all([computeRevenue(fromMs, toMs, es), listExpenses(), getCash()]);
  const months = rev.monthly && rev.monthly.length ? rev.monthly : [{ label: '—', total: rev.collected }];
  const anchor = new Date(toMs);
  const n = months.length;

  const series: FinanceMonth[] = months.map((m: any, i: number) => {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (n - 1 - i), 1));
    const mStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const mEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
    const expense = expenses.reduce((s, e) => s + contribForMonth(e, mStart, mEnd), 0);
    const income = incomeMode === 'mrr' ? rev.mrr : Number(m.total || 0);
    return { label: m.label, income: Math.round(income), expense: Math.round(expense), net: Math.round(income - expense) };
  });

  const tm = series[series.length - 1] || { income: 0, expense: 0, net: 0 };
  const margin = tm.income > 0 ? Math.round((tm.net / tm.income) * 100) : null;

  // Burn: recurrentes activos hoy (dentro de su ventana).
  const now = Date.now();
  const burn = Math.round(expenses.filter((e) => e.active && e.kind === 'recurring'
    && asDate(e.incurred_on) <= now && (!e.ends_on || asDate(e.ends_on) >= now))
    .reduce((s, e) => s + monthlyOf(e), 0));

  const cash = Number(cashRow?.balance || 0);
  const runway = burn > 0 ? Math.round((cash / burn) * 10) / 10 : null;

  // Categorías del mes en curso (recurrente vs puntual).
  const curStart = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1);
  const curEnd = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1) - 1;
  const catMap: Record<string, { recurring: number; one_off: number }> = {};
  for (const e of expenses) {
    const c = contribForMonth(e, curStart, curEnd);
    if (c <= 0) continue;
    (catMap[e.category] ||= { recurring: 0, one_off: 0 });
    if (e.kind === 'recurring') catMap[e.category].recurring += c; else catMap[e.category].one_off += c;
  }
  const categories = Object.entries(catMap).map(([category, v]) => ({
    category, recurring: Math.round(v.recurring), one_off: Math.round(v.one_off), total: Math.round(v.recurring + v.one_off),
  })).sort((a, b) => b.total - a.total);

  return {
    configured: rev.configured, incomeMode, currency: rev.currency || 'usd',
    thisMonth: { income: tm.income, expense: tm.expense, net: tm.net, margin },
    burn, cash, runway, mrr: Math.round(rev.mrr), collected: Math.round(rev.collected),
    series, categories, expenses,
  };
}
