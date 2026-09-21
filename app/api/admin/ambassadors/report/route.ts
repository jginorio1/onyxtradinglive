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
const usd = (n: number) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function GET(req: Request) {
  const { ok } = await requirePerm('embajadores', 'view');
  if (!ok) return new NextResponse('No autorizado', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = range(sp);
  const fromISO = from + 'T00:00:00Z', toISO = to + 'T23:59:59Z';

  const T = es
    ? { title: 'Estado de embajadores', earned: 'Comisiones generadas', owed: 'Pendiente de pago', ambs: 'Embajadores con actividad', refs: 'Referidos (período)', tRows: 'Detalle por embajador', amb: 'Embajador', ref: 'Referidos', gen: 'Generado', pend: 'Pendiente' }
    : { title: 'Ambassador statement', earned: 'Commissions earned', owed: 'Owed (unpaid)', ambs: 'Active ambassadors', refs: 'Referrals (period)', tRows: 'Detail by ambassador', amb: 'Ambassador', ref: 'Referrals', gen: 'Earned', pend: 'Owed' };

  try {
    const { data: comms } = await supabaseAdmin.from('commissions').select('ambassador_id,amount,status,created_at').gte('created_at', fromISO).lte('created_at', toISO).limit(5000);
    const { data: refs } = await supabaseAdmin.from('referrals').select('ambassador_id,created_at').gte('created_at', fromISO).lte('created_at', toISO).limit(5000);
    const { data: ambs } = await supabaseAdmin.from('ambassadors').select('id,code,user_id');
    const emailById: Record<string, string> = {};
    const codeById: Record<string, string> = {};
    for (const a of ambs || []) codeById[a.id] = a.code || a.id.slice(0, 6);
    const userIds = (ambs || []).map((a) => a.user_id).filter(Boolean);
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin.from('profiles').select('id,email').in('id', userIds);
      const pmap: Record<string, string> = {}; for (const p of profs || []) pmap[p.id] = p.email;
      for (const a of ambs || []) emailById[a.id] = pmap[a.user_id] || '';
    }

    const agg: Record<string, { earned: number; owed: number; refs: number }> = {};
    const g = (id: string) => (agg[id] = agg[id] || { earned: 0, owed: 0, refs: 0 });
    for (const c of comms || []) {
      if (c.status === 'reversed') continue;
      const amt = Number(c.amount) || 0;
      const a = g(c.ambassador_id); a.earned += amt; if (c.status !== 'paid') a.owed += amt;
    }
    for (const r of refs || []) g(r.ambassador_id).refs++;

    const totalEarned = Object.values(agg).reduce((s, a) => s + a.earned, 0);
    const totalOwed = Object.values(agg).reduce((s, a) => s + a.owed, 0);
    const totalRefs = (refs || []).length;

    const rowsArr = Object.entries(agg)
      .map(([id, a]) => ({ name: emailById[id] || codeById[id] || id.slice(0, 6), refs: a.refs, earned: a.earned, owed: a.owed }))
      .sort((a, b) => b.earned - a.earned);

    if (sp.get('export') === 'csv') {
      const csv = toCsvRows([[T.amb, T.ref, T.gen, T.pend], ...rowsArr.map((r) => [r.name, String(r.refs), r.earned.toFixed(2), r.owed.toFixed(2)])]);
      return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-embajadores-${from}.csv"` } });
    }

    const html = reportPage({
      lang: es ? 'es' : 'en', title: T.title, from, to,
      kpis: [
        { label: T.earned, value: usd(totalEarned) },
        { label: T.owed, value: usd(totalOwed) },
        { label: T.ambs, value: String(rowsArr.length) },
        { label: T.refs, value: String(totalRefs) },
      ],
      tables: [{ title: T.tRows, head: [T.amb, T.ref, T.gen, T.pend], alignRight: [1, 2, 3], rows: rowsArr.map((r) => [r.name, String(r.refs), usd(r.earned), usd(r.owed)]) }],
    });
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (e: any) {
    return new NextResponse('Error: ' + (e?.message || 'reporte'), { status: 500 });
  }
}
