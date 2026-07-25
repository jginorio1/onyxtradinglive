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
  const { ok } = await requirePerm('usuarios', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = range(sp);
  const fromISO = from + 'T00:00:00Z', toISO = to + 'T23:59:59Z';

  const { data: rows } = await supabaseAdmin.from('profiles')
    .select('email,plan,created_at,subscription_status')
    .gte('created_at', fromISO).lte('created_at', toISO)
    .order('created_at', { ascending: false }).limit(2000);
  const users = rows || [];
  const { count: total } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });

  const paid = users.filter((u) => u.plan && u.plan !== 'free').length;
  const byPlan: Record<string, number> = {};
  for (const u of users) { const k = u.plan || 'free'; byPlan[k] = (byPlan[k] || 0) + 1; }

  const T = es
    ? { title: 'Reporte de crecimiento', newU: 'Nuevas altas', totalU: 'Usuarios totales', paidU: 'De pago (período)', tPlan: 'Altas por plan', plan: 'Plan', count: 'Altas', tList: 'Nuevos usuarios', email: 'Email', date: 'Fecha' }
    : { title: 'Growth report', newU: 'New sign-ups', totalU: 'Total users', paidU: 'Paid (period)', tPlan: 'Sign-ups by plan', plan: 'Plan', count: 'Sign-ups', tList: 'New users', email: 'Email', date: 'Date' };

  if (sp.get('export') === 'csv') {
    const csv = toCsvRows([[T.email, T.plan, T.date], ...users.map((u) => [u.email || '', u.plan || 'free', (u.created_at || '').slice(0, 10)])]);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-usuarios-${from}.csv"` } });
  }

  const html = reportPage({
    lang: es ? 'es' : 'en', title: T.title, from, to,
    kpis: [
      { label: T.newU, value: String(users.length) },
      { label: T.totalU, value: String(total || 0) },
      { label: T.paidU, value: String(paid) },
    ],
    tables: [
      { title: T.tPlan, head: [T.plan, T.count], rows: Object.entries(byPlan).sort((a, b) => b[1] - a[1]), alignRight: [1] },
      { title: T.tList, head: [T.email, T.plan, T.date], rows: users.slice(0, 200).map((u) => [u.email || '', u.plan || 'free', (u.created_at || '').slice(0, 10)]) },
    ],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
