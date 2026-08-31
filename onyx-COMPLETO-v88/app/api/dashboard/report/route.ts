import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { reportPage, toCsvRows } from '@/lib/reportHtml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function range(sp: URLSearchParams): [string, string] {
  const now = new Date();
  const f = sp.get('from') || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const t = sp.get('to') || now.toISOString().slice(0, 10);
  return [f, t];
}
const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Reporte de rendimiento del trader que ha iniciado sesión (solo sus datos).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('No autorizado', { status: 401 });

  const sp = new URL(req.url).searchParams;
  const es = sp.get('lang') !== 'en';
  const [from, to] = range(sp);

  const { data: accs } = await sb.from('trading_accounts').select('id,currency').eq('user_id', user.id);
  const accIds = (accs || []).map((a) => a.id);
  const cur = ((accs || [])[0]?.currency || 'USD').toUpperCase();
  let trades: any[] = [];
  if (accIds.length) {
    const { data } = await sb.from('trades').select('symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap')
      .in('account_id', accIds)
      .gte('close_time', from + 'T00:00:00Z').lte('close_time', to + 'T23:59:59Z')
      .order('close_time', { ascending: false }).limit(10000);
    trades = data || [];
  }
  const net = (t: any) => Number(t.net_profit ?? t.profit ?? 0) || 0;

  const total = trades.length;
  let wins = 0, grossWin = 0, grossLoss = 0, netTotal = 0, best = -Infinity, worst = Infinity;
  const bySym: Record<string, { n: number; net: number }> = {};
  for (const t of trades) {
    const p = net(t); netTotal += p;
    if (p >= 0) { wins++; grossWin += p; } else grossLoss += -p;
    best = Math.max(best, p); worst = Math.min(worst, p);
    const k = t.symbol || '—'; bySym[k] = bySym[k] || { n: 0, net: 0 }; bySym[k].n++; bySym[k].net += p;
  }
  const winRate = total ? Math.round((wins / total) * 1000) / 10 : 0;
  const pf = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : (grossWin > 0 ? 99 : 0);
  const avg = total ? netTotal / total : 0;

  const T = es
    ? { title: 'Reporte de rendimiento', pnl: 'Resultado neto', trades: 'Operaciones', win: 'Aciertos', pf: 'Factor de beneficio', avg: 'Media por operación', best: 'Mejor', worst: 'Peor', bySym: 'Por instrumento', sym: 'Instrumento', n: 'Ops', net: 'Neto', list: 'Operaciones', side: 'Tipo', vol: 'Vol', close: 'Cierre' }
    : { title: 'Performance report', pnl: 'Net result', trades: 'Trades', win: 'Win rate', pf: 'Profit factor', avg: 'Avg per trade', best: 'Best', worst: 'Worst', bySym: 'By instrument', sym: 'Instrument', n: 'Trades', net: 'Net', list: 'Trades', side: 'Side', vol: 'Vol', close: 'Close' };

  if (sp.get('export') === 'csv') {
    const csv = toCsvRows([
      [T.close, T.sym, T.side, T.vol, 'net_profit', 'commission', 'swap'],
      ...trades.map((t) => [(t.close_time || '').slice(0, 19).replace('T', ' '), t.symbol || '', t.side || '', String(t.volume ?? ''), num(net(t)), String(t.commission ?? ''), String(t.swap ?? '')]),
    ]);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-operaciones-${from}.csv"` } });
  }

  const symRows = Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => [s, String(v.n), cur + ' ' + num(v.net)]);
  const html = reportPage({
    lang: es ? 'es' : 'en', title: T.title, from, to,
    kpis: [
      { label: T.pnl, value: cur + ' ' + num(netTotal) },
      { label: T.trades, value: String(total) },
      { label: T.win, value: winRate + '%' },
      { label: T.pf, value: String(pf) },
      { label: T.avg, value: cur + ' ' + num(avg) },
      { label: `${T.best} / ${T.worst}`, value: total ? `${num(best)} / ${num(worst)}` : '—' },
    ],
    tables: [
      { title: T.bySym, head: [T.sym, T.n, T.net], alignRight: [1, 2], rows: symRows },
      { title: T.list, head: [T.close, T.sym, T.side, T.vol, T.net], alignRight: [3, 4], rows: trades.slice(0, 200).map((t) => [(t.close_time || '').slice(0, 16).replace('T', ' '), t.symbol || '', t.side || '', String(t.volume ?? ''), num(net(t))]) },
    ],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
