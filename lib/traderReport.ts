import { toCsvRows } from '@/lib/reportHtml';

// Reporte de rendimiento de un trader para un rango de fechas.
// Lo usa la tarea que envía por Telegram (y puede reutilizarse en el dashboard).

export type TraderReport = {
  currency: string; total: number; netTotal: number; winRate: number; pf: number;
  avg: number; best: number; worst: number;
  bySym: { sym: string; n: number; net: number }[];
  trades: any[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// `sb` puede ser supabaseAdmin (cron) o el cliente de sesión (dashboard).
export async function computeTraderReport(sb: any, userId: string, fromISO: string, toISO: string): Promise<TraderReport> {
  const { data: accs } = await sb.from('trading_accounts').select('id,currency').eq('user_id', userId);
  const accIds = (accs || []).map((a: any) => a.id);
  const currency = ((accs || [])[0]?.currency || 'USD').toUpperCase();
  let trades: any[] = [];
  if (accIds.length) {
    const { data } = await sb.from('trades').select('symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap')
      .in('account_id', accIds).gte('close_time', fromISO).lte('close_time', toISO)
      .order('close_time', { ascending: false }).limit(10000);
    trades = data || [];
  }
  const net = (t: any) => Number(t.net_profit ?? t.profit ?? 0) || 0;

  let wins = 0, grossWin = 0, grossLoss = 0, netTotal = 0, best = -Infinity, worst = Infinity;
  const sym: Record<string, { n: number; net: number }> = {};
  for (const t of trades) {
    const p = net(t); netTotal += p;
    if (p >= 0) { wins++; grossWin += p; } else grossLoss += -p;
    best = Math.max(best, p); worst = Math.min(worst, p);
    const k = t.symbol || '—'; sym[k] = sym[k] || { n: 0, net: 0 }; sym[k].n++; sym[k].net += p;
  }
  const total = trades.length;
  return {
    currency, total, netTotal: r2(netTotal),
    winRate: total ? Math.round((wins / total) * 1000) / 10 : 0,
    pf: grossLoss > 0 ? r2(grossWin / grossLoss) : (grossWin > 0 ? 99 : 0),
    avg: total ? r2(netTotal / total) : 0,
    best: total ? r2(best) : 0, worst: total ? r2(worst) : 0,
    bySym: Object.entries(sym).map(([s, v]) => ({ sym: s, n: v.n, net: r2(v.net) })).sort((a, b) => b.net - a.net),
    trades,
  };
}

export function traderCsv(rep: TraderReport): string {
  const net = (t: any) => Number(t.net_profit ?? t.profit ?? 0) || 0;
  return toCsvRows([
    ['close_time', 'symbol', 'side', 'volume', 'net_profit', 'commission', 'swap'],
    ...rep.trades.map((t) => [(t.close_time || '').slice(0, 19).replace('T', ' '), t.symbol || '', t.side || '', String(t.volume ?? ''), r2(net(t)), String(t.commission ?? ''), String(t.swap ?? '')]),
  ]);
}

// URL de un gráfico de barras (neto por instrumento) vía QuickChart.
export function traderChartUrl(rep: TraderReport, es = true): string {
  const top = rep.bySym.slice(0, 8);
  const cfg = {
    type: 'bar',
    data: { labels: top.map((s) => s.sym), datasets: [{ label: es ? 'Neto' : 'Net', data: top.map((s) => s.net), backgroundColor: top.map((s) => (s.net >= 0 ? '#34e2a0' : '#ff6b7d')) }] },
    options: { plugins: { legend: { display: false }, title: { display: true, text: (es ? 'Neto por instrumento' : 'Net by instrument') } } },
  };
  return 'https://quickchart.io/chart?w=600&h=320&bkg=white&c=' + encodeURIComponent(JSON.stringify(cfg));
}

// PDF con marca Onyx (pdf-lib se instala en Vercel; import dinámico para que tsc no falle).
export async function traderPdf(rep: TraderReport, opts: { name: string; from: string; to: string; es?: boolean }): Promise<Uint8Array> {
  // @ts-ignore
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const es = opts.es !== false;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.486, 0.549, 1);
  const dark = rgb(0.06, 0.075, 0.14);
  const gray = rgb(0.42, 0.45, 0.5);
  let y = 800;
  const text = (s: string, x: number, size: number, f = font, color = dark) => { page.drawText(s, { x, y, size, font: f, color }); };

  text('Onyx Trading Live', 40, 14, bold, brand); y -= 26;
  text(es ? 'Reporte de rendimiento' : 'Performance report', 40, 20, bold); y -= 18;
  text(`${es ? 'Período' : 'Period'}: ${opts.from} → ${opts.to}   ·   ${opts.name}`, 40, 10, font, gray); y -= 24;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: brand }); y -= 24;

  const cur = rep.currency;
  const rows: [string, string][] = [
    [es ? 'Resultado neto' : 'Net result', `${cur} ${rep.netTotal.toFixed(2)}`],
    [es ? 'Operaciones' : 'Trades', String(rep.total)],
    [es ? 'Aciertos' : 'Win rate', rep.winRate + '%'],
    [es ? 'Factor de beneficio' : 'Profit factor', String(rep.pf)],
    [es ? 'Media por operación' : 'Avg per trade', `${cur} ${rep.avg.toFixed(2)}`],
    [`${es ? 'Mejor' : 'Best'} / ${es ? 'Peor' : 'Worst'}`, `${rep.best.toFixed(2)} / ${rep.worst.toFixed(2)}`],
  ];
  for (const [k, v] of rows) { text(k, 40, 12, font, gray); text(v, 320, 12, bold); y -= 20; }
  y -= 10;
  text(es ? 'Por instrumento' : 'By instrument', 40, 13, bold); y -= 18;
  text(es ? 'Instrumento' : 'Instrument', 40, 10, font, gray); text(es ? 'Ops' : 'Trades', 320, 10, font, gray); text(es ? 'Neto' : 'Net', 420, 10, font, gray); y -= 4;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: gray }); y -= 16;
  for (const s of rep.bySym.slice(0, 20)) {
    if (y < 60) break;
    text(s.sym, 40, 11); text(String(s.n), 320, 11); text(`${cur} ${s.net.toFixed(2)}`, 420, 11, font, s.net >= 0 ? rgb(0.1, 0.7, 0.4) : rgb(0.9, 0.3, 0.35));
    y -= 16;
  }
  return await doc.save();
}
