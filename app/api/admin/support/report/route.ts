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
  const { ok } = await requirePerm('soporte', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = range(sp);
  const { data } = await supabaseAdmin.from('support_tickets')
    .select('email,subject,status,created_at')
    .gte('created_at', from + 'T00:00:00Z').lte('created_at', to + 'T23:59:59Z')
    .order('created_at', { ascending: false }).limit(3000);
  const rows = data || [];

  const T = es
    ? { title: 'Reporte de soporte', total: 'Tickets', open: 'Abiertos', resolved: 'Resueltos', byStatus: 'Por estado', status: 'Estado', count: 'Cantidad', list: 'Detalle', date: 'Fecha', email: 'Usuario', subject: 'Asunto' }
    : { title: 'Support report', total: 'Tickets', open: 'Open', resolved: 'Resolved', byStatus: 'By status', status: 'Status', count: 'Count', list: 'Detail', date: 'Date', email: 'User', subject: 'Subject' };

  const byStatus: Record<string, number> = {};
  for (const r of rows) { const k = r.status || 'open'; byStatus[k] = (byStatus[k] || 0) + 1; }

  if (sp.get('export') === 'csv') {
    const csv = toCsvRows([[T.date, T.email, T.subject, T.status], ...rows.map((r) => [(r.created_at || '').slice(0, 10), r.email || '', String(r.subject || '').slice(0, 80), r.status || ''])]);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-soporte-${from}.csv"` } });
  }
  const html = reportPage({
    lang: es ? 'es' : 'en', title: T.title, from, to,
    kpis: [{ label: T.total, value: String(rows.length) }, { label: T.open, value: String(byStatus['open'] || 0) }, { label: T.resolved, value: String(byStatus['resolved'] || 0) }],
    tables: [
      { title: T.byStatus, head: [T.status, T.count], alignRight: [1], rows: Object.entries(byStatus).sort((a, b) => b[1] - a[1]) },
      { title: T.list, head: [T.date, T.email, T.subject, T.status], rows: rows.slice(0, 300).map((r) => [(r.created_at || '').slice(0, 10), r.email || '', String(r.subject || '').slice(0, 60), r.status || '']) },
    ],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
