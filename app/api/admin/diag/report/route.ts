import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reportPage, toCsvRows } from '@/lib/reportHtml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function range(sp: URLSearchParams): [string, string] {
  const now = new Date();
  const f = sp.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const t = sp.get('to') || now.toISOString().slice(0, 10);
  return [f, t];
}

export async function GET(req: Request) {
  const { ok } = await requirePerm('diag', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = range(sp);
  const { data } = await supabaseAdmin.from('app_errors')
    .select('source,code,message,created_at')
    .gte('created_at', from + 'T00:00:00Z').lte('created_at', to + 'T23:59:59Z')
    .order('created_at', { ascending: false }).limit(5000);
  const rows = data || [];

  const T = es
    ? { title: 'Reporte de errores', total: 'Errores', bySource: 'Por origen', source: 'Origen', count: 'Cantidad', list: 'Detalle', date: 'Fecha', code: 'Código', msg: 'Mensaje' }
    : { title: 'Error report', total: 'Errors', bySource: 'By source', source: 'Source', count: 'Count', list: 'Detail', date: 'Date', code: 'Code', msg: 'Message' };

  const bySource: Record<string, number> = {};
  for (const r of rows) { const k = r.source || '—'; bySource[k] = (bySource[k] || 0) + 1; }

  if (sp.get('export') === 'csv') {
    const csv = toCsvRows([[T.date, T.source, T.code, T.msg], ...rows.map((r) => [new Date(r.created_at).toISOString(), r.source || '', r.code || '', String(r.message || '').slice(0, 200)])]);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-errores-${from}.csv"` } });
  }
  const html = reportPage({
    lang: es ? 'es' : 'en', title: T.title, from, to,
    kpis: [{ label: T.total, value: String(rows.length) }],
    tables: [
      { title: T.bySource, head: [T.source, T.count], alignRight: [1], rows: Object.entries(bySource).sort((a, b) => b[1] - a[1]) },
      { title: T.list, head: [T.date, T.source, T.code, T.msg], rows: rows.slice(0, 300).map((r) => [new Date(r.created_at).toLocaleString(es ? 'es' : 'en'), r.source || '', r.code || '', String(r.message || '').slice(0, 80)]) },
    ],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
