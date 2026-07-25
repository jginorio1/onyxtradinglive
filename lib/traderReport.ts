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

const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
const money0 = (n: number) => (n >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');

// Tarjeta de reporte con la estética Onyx (SVG oscuro), lista para rasterizar.
export function traderCardSvg(rep: TraderReport, opts: { name?: string; from: string; to: string; es?: boolean }): string {
  const es = opts.es !== false;
  const cur = rep.currency;
  const net = (t: any) => Number(t.net_profit ?? t.profit ?? 0) || 0;
  // Curva de resultados (acumulado por operación, en orden cronológico)
  const sorted = [...rep.trades].sort((a, b) => new Date(a.close_time || 0).getTime() - new Date(b.close_time || 0).getTime());
  let cum = 0; const series = [0, ...sorted.map((t) => (cum += net(t)))];
  const px0 = 42, px1 = 470, py0 = 190, py1 = 300;
  const lo = Math.min(0, ...series), hi = Math.max(0, ...series), span = hi - lo || 1;
  const X = (i: number) => px0 + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (px1 - px0));
  const Y = (v: number) => py1 - ((v - lo) / span) * (py1 - py0);
  const pts = series.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = series.length ? `${px0},${py1} ${pts} ${px1},${py1}` : '';
  const up = rep.netTotal >= 0;
  const line = up ? '#34e2a0' : '#ff6b7d';
  const best = rep.bySym[0]; const worst = rep.bySym[rep.bySym.length - 1];

  const kpi = (x: number, label: string, val: string, color = '#ffffff') =>
    `<rect x="${x}" y="70" width="104" height="46" rx="10" fill="#161c2e"/>`
    + `<text x="${x + 12}" y="88" font-size="10" fill="#8b96b0" font-family="Arial">${esc(label)}</text>`
    + `<text x="${x + 12}" y="108" font-size="17" font-weight="bold" fill="${color}" font-family="Arial">${esc(val)}</text>`;

  const sub = (x: number, w: number, label: string, name: string, val: string, color: string) =>
    `<rect x="${x}" y="312" width="${w}" height="46" rx="10" fill="#161c2e"/>`
    + `<text x="${x + 12}" y="330" font-size="10" fill="#8b96b0" font-family="Arial">${esc(label)}</text>`
    + `<text x="${x + 12}" y="349" font-size="13" font-weight="bold" fill="#ffffff" font-family="Arial">${esc(name)} <tspan fill="${color}">${esc(val)}</tspan></text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384" viewBox="0 0 512 384">
  <rect x="0" y="0" width="512" height="384" rx="18" fill="#0e1220" stroke="#26304a"/>
  <rect x="22" y="20" width="30" height="30" rx="8" fill="#7c8cff"/>
  <text x="62" y="34" font-size="15" font-weight="bold" fill="#ffffff" font-family="Arial">${esc(es ? 'Tu semana en Onyx' : 'Your week on Onyx')}</text>
  <text x="62" y="50" font-size="11" fill="#8b96b0" font-family="Arial">${esc(opts.from)} – ${esc(opts.to)}${opts.name ? '  ·  ' + esc(opts.name) : ''}</text>
  <rect x="430" y="24" width="60" height="22" rx="11" fill="#133a2c"/>
  <text x="460" y="39" font-size="11" fill="#7fe9c0" font-family="Arial" text-anchor="middle">Onyx</text>
  ${kpi(22, es ? 'Neto' : 'Net', `${money0(rep.netTotal)}`, up ? '#34e2a0' : '#ff6b7d')}
  ${kpi(136, es ? 'Ops' : 'Trades', String(rep.total))}
  ${kpi(250, es ? 'Aciertos' : 'Win %', `${rep.winRate}%`)}
  ${kpi(364, es ? 'P. Factor' : 'P. Factor', String(rep.pf))}
  <rect x="22" y="132" width="468" height="180" rx="12" fill="#12172680"/>
  <text x="42" y="156" font-size="11" fill="#c3ccff" font-family="Arial">${esc(es ? 'Curva de resultados' : 'Equity curve')}</text>
  <line x1="${px0}" y1="${Y(0).toFixed(1)}" x2="${px1}" y2="${Y(0).toFixed(1)}" stroke="#2a3450" stroke-width="1" stroke-dasharray="3 3"/>
  ${area ? `<polygon points="${area}" fill="${line}" fill-opacity="0.14"/>` : ''}
  ${series.length ? `<polyline points="${pts}" fill="none" stroke="${line}" stroke-width="2.5"/>` : ''}
  ${best ? sub(22, 230, es ? 'Mejor par' : 'Best', best.sym, money0(best.net), '#34e2a0') : ''}
  ${worst && rep.bySym.length > 1 ? sub(260, 230, es ? 'Peor par' : 'Worst', worst.sym, money0(worst.net), worst.net >= 0 ? '#34e2a0' : '#ff6b7d') : ''}
  <text x="256" y="374" font-size="10" fill="#5f6a85" font-family="Arial" text-anchor="middle">onyxtradinglive.com · reporte automático</text>
</svg>`;
}

// Rasteriza la tarjeta a PNG con sharp (dinámico). Si falla, devuelve null.
export async function traderCardPng(rep: TraderReport, opts: { name?: string; from: string; to: string; es?: boolean }): Promise<Uint8Array | null> {
  try {
    // @ts-ignore
    const sharp = (await import('sharp')).default;
    const svg = traderCardSvg(rep, opts);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return new Uint8Array(png);
  } catch { return null; }
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
  // La fuente estándar solo dibuja WinAnsi; limpiamos cualquier carácter fuera
  // de ese rango (flechas, emojis…) para que nunca falle el PDF.
  const clean = (s: string) => String(s).replace(/[^\x00-\xFF]/g, '-');
  const text = (s: string, x: number, size: number, f = font, color = dark) => { page.drawText(clean(s), { x, y, size, font: f, color }); };

  text('Onyx Trading Live', 40, 14, bold, brand); y -= 26;
  text(es ? 'Reporte de rendimiento' : 'Performance report', 40, 20, bold); y -= 18;
  text(`${es ? 'Periodo' : 'Period'}: ${opts.from} - ${opts.to}   ·   ${opts.name}`, 40, 10, font, gray); y -= 24;
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
