import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { computeRevenue, type RevenueData } from '@/lib/revenue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Rango por defecto: el mes en curso.
function defaultRange(): [number, number] {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
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

function toCsv(d: RevenueData): string {
  const rows: string[][] = [
    ['Métrica', 'Valor'],
    ['Rango', `${d.from.slice(0, 10)} a ${d.to.slice(0, 10)}`],
    ['MRR', String(d.mrr)],
    ['ARR', String(d.arr)],
    ['Suscripciones activas', String(d.activeSubs)],
    ['ARPU', String(d.arpu)],
    ['Cobrado en el rango', String(d.collected)],
    ['Cobrado período anterior', String(d.collectedPrev)],
    ['Nuevas suscripciones', String(d.newSubs)],
    ['Canceladas', String(d.canceledSubs)],
    ['Pagos fallidos', String(d.failed)],
    ['Churn %', String(d.churnPct)],
    ['MRR nuevo', String(d.moveNew)],
    ['MRR perdido', String(d.moveLost)],
    ['MRR neto', String(d.moveNet)],
    [],
    ['Plan', 'Suscripciones', 'MRR', '%'],
    ...d.plans.map((p) => [p.name, String(p.subs), String(p.mrr), String(p.pct)]),
    [],
    ['Mes', 'Cobrado'],
    ...d.monthly.map((m) => [m.label, String(m.total)]),
  ];
  return rows.map((r) => r.map((c) => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\n');
}

export async function GET(req: Request) {
  const { ok } = await requirePerm('planes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const [from, to] = parseRange(sp);
  const es = sp.get('lang') !== 'en';
  const data = await computeRevenue(from, to, es);

  if (sp.get('export') === 'csv') {
    const day = data.from.slice(0, 10);
    return new NextResponse(toCsv(data), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-ingresos-${day}.csv"` },
    });
  }
  return NextResponse.json(data);
}
