import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reportPage, toCsvRows } from '@/lib/reportHtml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function range(sp: URLSearchParams): [string, string] {
  const now = new Date();
  const f = sp.get('from') || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const t = sp.get('to') || now.toISOString().slice(0, 10);
  return [f, t];
}

export async function GET(req: Request) {
  const { ok } = await requirePerm('retencion', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = range(sp);
  const { data } = await supabaseAdmin.from('cancellations')
    .select('email,plan,reason,detail,outcome,created_at')
    .gte('created_at', from + 'T00:00:00Z').lte('created_at', to + 'T23:59:59Z')
    .order('created_at', { ascending: false }).limit(3000);
  const rows = data || [];

  const T = es
    ? { title: 'Reporte de cancelaciones', total: 'Cancelaciones', saved: 'Retenidas (rescate)', byReason: 'Por motivo', reason: 'Motivo', count: 'Cantidad', list: 'Detalle', email: 'Usuario', plan: 'Plan', date: 'Fecha', out: 'Resultado' }
    : { title: 'Cancellations report', total: 'Cancellations', saved: 'Saved (rescue)', byReason: 'By reason', reason: 'Reason', count: 'Count', list: 'Detail', email: 'User', plan: 'Plan', date: 'Date', out: 'Outcome' };

  const byReason: Record<string, number> = {};
  let saved = 0;
  for (const r of rows) { const k = r.reason || '—'; byReason[k] = (byReason[k] || 0) + 1; if (r.outcome === 'saved' || r.outcome === 'retained') saved++; }

  if (sp.get('export') === 'csv') {
    const csv = toCsvRows([[T.date, T.email, T.plan, T.reason, T.out], ...rows.map((r) => [(r.created_at || '').slice(0, 10), r.email || '', r.plan || '', r.reason || '', r.outcome || ''])]);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-cancelaciones-${from}.csv"` } });
  }
  const html = reportPage({
    lang: es ? 'es' : 'en', title: T.title, from, to,
    kpis: [{ label: T.total, value: String(rows.length) }, { label: T.saved, value: String(saved) }],
    tables: [
      { title: T.byReason, head: [T.reason, T.count], alignRight: [1], rows: Object.entries(byReason).sort((a, b) => b[1] - a[1]) },
      { title: T.list, head: [T.date, T.email, T.plan, T.reason, T.out], rows: rows.slice(0, 300).map((r) => [(r.created_at || '').slice(0, 10), r.email || '', r.plan || '', r.reason || '', r.outcome || '']) },
    ],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
