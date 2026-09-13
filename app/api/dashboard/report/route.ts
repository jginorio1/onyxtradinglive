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

  const { data: accs } = await sb.from('trading_accounts').select('id,currency,balance').eq('user_id', user.id);
  const accIds = (accs || []).map((a) => a.id);
  const cur = ((accs || [])[0]?.currency || 'USD').toUpperCase();
  const totalBalance = (accs || []).reduce((s, a: any) => s + Number(a.balance || 0), 0);
  // Perfil del trader para la cabecera del reporte (tolerante si faltan columnas).
  let prof: any = {};
  try { const r = await sb.from('profiles').select('full_name,avatar_url,trade_style,experience,goal,country').eq('id', user.id).maybeSingle(); prof = r.data || {}; } catch {}
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
    // CSV rico: cabecera + resumen + portafolio + perfil + por instrumento + lista
    // completa de operaciones (con apertura, cierre, duración y desglose de costes).
    const styleMapC: any = { scalping: 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: 'Algo/Robots' };
    const expMapC: any = { novato: es ? 'Principiante' : 'Beginner', intermedio: es ? 'Intermedio' : 'Intermediate', avanzado: es ? 'Avanzado' : 'Advanced', pro: 'Pro' };
    const goalMapC: any = { pasar_challenge: es ? 'Pasar reto' : 'Pass challenge', consistencia: es ? 'Consistencia' : 'Consistency', crecer: es ? 'Crecer cuenta' : 'Grow account', vivir: es ? 'Vivir del trading' : 'Trade for a living' };
    const dur = (t: any) => {
      const a = t.open_time ? Date.parse(t.open_time) : NaN, b = t.close_time ? Date.parse(t.close_time) : NaN;
      if (!isFinite(a) || !isFinite(b) || b < a) return '';
      const m = Math.round((b - a) / 60000);
      if (m < 60) return m + 'm';
      if (m < 1440) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
      return Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
    };
    const symRowsC = Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => [s, String(v.n), num(v.net)]);
    const L = es
      ? { app: 'Onyx Trading — Reporte de rendimiento', period: 'Período', gen: 'Generado', currency: 'Moneda', S_prof: 'PERFIL DEL TRADER', name: 'Nombre', style: 'Estilo', exp: 'Experiencia', goal: 'Meta', country: 'País', S_port: 'PORTAFOLIO', bal: 'Balance total', accs: 'Cuentas', S_sum: 'RESUMEN', S_sym: 'POR INSTRUMENTO', S_list: 'OPERACIONES', open: 'Apertura', close: 'Cierre', durc: 'Duración', gross: 'Bruto', metric: 'Métrica', value: 'Valor' }
      : { app: 'Onyx Trading — Performance report', period: 'Period', gen: 'Generated', currency: 'Currency', S_prof: 'TRADER PROFILE', name: 'Name', style: 'Style', exp: 'Experience', goal: 'Goal', country: 'Country', S_port: 'PORTFOLIO', bal: 'Total balance', accs: 'Accounts', S_sum: 'SUMMARY', S_sym: 'BY INSTRUMENT', S_list: 'TRADES', open: 'Open', close: 'Close', durc: 'Duration', gross: 'Gross', metric: 'Metric', value: 'Value' };
    const blank: string[] = [];
    const rows: string[][] = [
      [L.app],
      [L.period, from + ' → ' + to],
      [L.gen, new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
      [L.currency, cur],
      blank,
      [L.S_prof],
      [L.name, prof.full_name || '—'],
      [L.style, styleMapC[prof.trade_style] || prof.trade_style || '—'],
      [L.exp, expMapC[prof.experience] || '—'],
      [L.goal, goalMapC[prof.goal] || '—'],
      [L.country, prof.country || '—'],
      blank,
      [L.S_port],
      [L.bal, cur + ' ' + num(totalBalance)],
      [L.accs, String(accIds.length)],
      blank,
      [L.S_sum],
      [L.metric, L.value],
      [T.pnl, cur + ' ' + num(netTotal)],
      [T.trades, String(total)],
      [T.win, winRate + '%'],
      [T.pf, String(pf)],
      [T.avg, cur + ' ' + num(avg)],
      [T.best, total ? num(best) : '—'],
      [T.worst, total ? num(worst) : '—'],
      blank,
      [L.S_sym],
      [T.sym, T.n, T.net],
      ...symRowsC,
      blank,
      [L.S_list],
      [L.open, L.close, T.sym, T.side, T.vol, L.durc, T.net, L.gross, 'commission', 'swap'],
      ...trades.map((t) => [
        (t.open_time || '').slice(0, 19).replace('T', ' '),
        (t.close_time || '').slice(0, 19).replace('T', ' '),
        t.symbol || '', t.side || '', String(t.volume ?? ''), dur(t),
        num(net(t)), t.profit != null ? num(Number(t.profit)) : '', String(t.commission ?? ''), String(t.swap ?? ''),
      ]),
    ];
    const csv = toCsvRows(rows);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="onyx-reporte-${from}.csv"` } });
  }

  const symRows = Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => [s, String(v.n), cur + ' ' + num(v.net)]);
  // Curva de resultados: acumulado cronológico (los trades vienen desc → invertir).
  const chrono = [...trades].reverse();
  let cum = 0; const equity = [0, ...chrono.map((t) => (cum += net(t)))];
  const losses = total - wins;
  // Etiquetas legibles del perfil (los códigos del catálogo → texto).
  const styleMap: any = { scalping: es ? 'Scalper' : 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: es ? 'Algo/Robots' : 'Algo/Robots' };
  const expMap: any = { novato: es ? 'Principiante' : 'Beginner', intermedio: es ? 'Intermedio' : 'Intermediate', avanzado: es ? 'Avanzado' : 'Advanced', pro: 'Pro' };
  const goalMap: any = { pasar_challenge: es ? 'Pasar reto' : 'Pass challenge', consistencia: es ? 'Consistencia' : 'Consistency', crecer: es ? 'Crecer cuenta' : 'Grow account', vivir: es ? 'Vivir del trading' : 'Trade for a living' };

  // ---- Excel (.xlsx) con formato + gráficas incrustadas ----
  if (sp.get('export') === 'xlsx') {
    const { buildReportXlsx } = await import('@/lib/reportXlsx');
    const durX = (t: any) => {
      const a = t.open_time ? Date.parse(t.open_time) : NaN, b = t.close_time ? Date.parse(t.close_time) : NaN;
      if (!isFinite(a) || !isFinite(b) || b < a) return '';
      const m = Math.round((b - a) / 60000);
      if (m < 60) return m + 'm';
      if (m < 1440) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
      return Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
    };
    const buf = await buildReportXlsx({
      lang: es ? 'es' : 'en', from, to, generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
      currency: cur,
      profile: {
        name: prof.full_name || '', style: styleMap[prof.trade_style] || prof.trade_style || '',
        experience: expMap[prof.experience] || '', goal: goalMap[prof.goal] || '', country: prof.country || '',
      },
      portfolio: { totalBalance, accounts: accIds.length },
      kpis: [
        { label: T.pnl, value: cur + ' ' + num(netTotal), tone: netTotal >= 0 ? 'good' : 'bad' },
        { label: T.trades, value: String(total), tone: 'neutral' },
        { label: T.win, value: winRate + '%', tone: winRate >= 50 ? 'good' : 'neutral' },
        { label: T.pf, value: String(pf), tone: pf >= 1.3 ? 'good' : pf < 1 ? 'bad' : 'neutral' },
        { label: T.avg, value: cur + ' ' + num(avg), tone: avg >= 0 ? 'good' : 'bad' },
        { label: T.best, value: total ? num(best) : '—', tone: 'good' },
        { label: T.worst, value: total ? num(worst) : '—', tone: 'bad' },
      ],
      equity,
      bySym: Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => ({ sym: s, n: v.n, net: v.net })),
      winLoss: { wins, losses },
      trades: trades.map((t) => ({
        open: (t.open_time || '').slice(0, 16).replace('T', ' '), close: (t.close_time || '').slice(0, 16).replace('T', ' '),
        sym: t.symbol || '', side: t.side || '', vol: String(t.volume ?? ''), dur: durX(t),
        net: net(t), gross: t.profit != null ? String(Number(t.profit)) : '', commission: String(t.commission ?? ''), swap: String(t.swap ?? ''),
      })),
    });
    return new NextResponse(buf as any, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="onyx-reporte-${from}.xlsx"` } });
  }

  const html = reportPage({
    lang: es ? 'es' : 'en', from, to,
    profile: {
      name: prof.full_name || '', avatar: prof.avatar_url || '',
      style: styleMap[prof.trade_style] || prof.trade_style || '',
      experience: expMap[prof.experience] || '', goal: goalMap[prof.goal] || '', country: prof.country || '',
    },
    portfolio: { totalBalance, accounts: accIds.length, currency: cur },
    equity,
    winLoss: { wins, losses },
    bySym: Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([s, v]) => ({ sym: s, n: v.n, net: v.net })),
    kpis: [
      { label: T.pnl, value: cur + ' ' + num(netTotal), tone: netTotal >= 0 ? 'good' : 'bad' },
      { label: T.trades, value: String(total), tone: 'neutral' },
      { label: T.win, value: winRate + '%', tone: winRate >= 50 ? 'good' : 'neutral' },
      { label: T.pf, value: String(pf), tone: pf >= 1.3 ? 'good' : pf < 1 ? 'bad' : 'neutral' },
      { label: T.avg, value: cur + ' ' + num(avg), tone: avg >= 0 ? 'good' : 'bad' },
      { label: T.best, value: total ? num(best) : '—', tone: 'good' },
      { label: T.worst, value: total ? num(worst) : '—', tone: 'bad' },
    ],
    tables: [
      { title: T.bySym, head: [T.sym, T.n, T.net], alignRight: [1, 2], rows: symRows },
      { title: T.list, head: [T.close, T.sym, T.side, T.vol, T.net], alignRight: [3, 4], rows: trades.slice(0, 200).map((t) => [(t.close_time || '').slice(0, 16).replace('T', ' '), t.symbol || '', t.side || '', String(t.volume ?? ''), num(net(t))]) },
    ],
  });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
