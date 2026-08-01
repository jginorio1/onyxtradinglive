import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { computeFinance, addExpense, updateExpense, deleteExpense, setCash } from '@/lib/finanzas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function defaultRange(): [number, number] {
  // Últimos 6 meses (para ver la tendencia), terminando ahora.
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).getTime();
  return [from, Date.now()];
}
function parseRange(sp: URLSearchParams): [number, number] {
  const f = sp.get('from'), t = sp.get('to');
  if (f && t) {
    const fm = new Date(f + 'T00:00:00Z').getTime();
    const tm = new Date(t + 'T23:59:59Z').getTime();
    if (!isNaN(fm) && !isNaN(tm) && fm < tm) return [fm, tm];
  }
  return defaultRange();
}

// GET · datos del P&L (ingresos vs gastos, series, categorías, gastos, caja).
export async function GET(req: Request) {
  const { ok } = await requirePerm('finanzas', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const [from, to] = parseRange(sp);
  const mode = sp.get('income') === 'mrr' ? 'mrr' : 'collected';
  const es = sp.get('lang') !== 'en';
  const data = await computeFinance(from, to, mode, es);
  return NextResponse.json(data);
}

// POST · añadir / editar / borrar un gasto. Requiere 'manage'.
export async function POST(req: Request) {
  const { ok, user } = await requirePerm('finanzas', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'delete' && b.id) {
      await deleteExpense(String(b.id));
      await logAdmin(user.email, 'finanzas_delete', String(b.id));
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'update' && b.id) {
      await updateExpense(String(b.id), b);
      await logAdmin(user.email, 'finanzas_update', String(b.id));
      return NextResponse.json({ ok: true });
    }
    const e = await addExpense(b);
    await logAdmin(user.email, 'finanzas_add', e.id, { name: e.name, amount: e.amount });
    return NextResponse.json({ ok: true, expense: e });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'error' }, { status: 500 });
  }
}

// PUT · fijar la caja (saldo del negocio) para el runway. Requiere 'manage'.
export async function PUT(req: Request) {
  const { ok, user } = await requirePerm('finanzas', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const cash = await setCash(Number(b.balance));
  await logAdmin(user.email, 'finanzas_cash', String(cash.balance));
  return NextResponse.json({ ok: true, cash });
}
