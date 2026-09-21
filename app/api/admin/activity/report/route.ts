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
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const member = sp.get('member') || '';
  const [from, to] = range(sp);
  const fromISO = from + 'T00:00:00Z', toISO = to + 'T23:59:59Z';

  let q = supabaseAdmin.from('admin_log').select('admin_email,action,target,created_at').gte('created_at', fromISO).lte('created_at', toISO).order('created_at', { ascending: false }).limit(3000);
  if (member) q = q.eq('admin_email', member);
  const { data } = await q;
  const rows = data || [];

  const T = es
    ? { title: 'Registro de actividad', total: 'Acciones', who: 'Miembro', act: 'Acción', tgt: 'Objetivo', date: 'Fecha y hora' }
    : { title: 'Activity log', total: 'Actions', who: 'Member', act: 'Action', tgt: 'Target', date: 'Date & time' };

  if (sp.get('export') === 'csv') {
    const csv = toCsvRows([[T.date, T.who, T.act, T.tgt], ...rows.map((r) => [new Date(r.created_at).toISOString(), (r.admin_email || '').split('@')[0], r.action || '', String(r.target || '').slice(0, 40)])]);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-actividad-${from}.csv"` } });
  }

  const html = reportPage({
    lang: es ? 'es' : 'en', title: T.title + (member ? ' · ' + member.split('@')[0] : ''), from, to,
    kpis: [{ label: T.total, value: String(rows.length) }],
    tables: [{ head: [T.date, T.who, T.act, T.tgt], rows: rows.slice(0, 500).map((r) => [new Date(r.created_at).toLocaleString(es ? 'es' : 'en'), (r.admin_email || '').split('@')[0], r.action || '', String(r.target || '').slice(0, 32)]) }],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
