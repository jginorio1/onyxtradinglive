// ============================================================
// Onyx Bot Factory · Reporte completo estilo StrategyQuant.
// A partir de la lista de operaciones (t + profit) y el capital inicial, deriva
// TODAS las métricas que muestra SQ: curva de equity, drawdown, rachas de
// ganadas/perdidas consecutivas, estancamiento (stagnation), Sharpe, SQN,
// expectancy, payout, mayores ganancia/pérdida, y la tabla de rendimiento
// mensual año × mes. Puro cálculo, corre en el navegador.
// LÍNEA ROJA: es histórico, no predice el mercado.
// ============================================================
export type Trade = { t: number; profit: number };

export type MonthCell = { y: number; m: number; pnl: number };
export type FullReport = {
  capital: number;
  net: number; grossProfit: number; grossLoss: number; pf: number;
  trades: number; wins: number; losses: number; winRate: number;
  avgTrade: number; avgWin: number; avgLoss: number; payout: number;
  largestWin: number; largestLoss: number;
  maxConsecWins: number; maxConsecLosses: number; avgConsecWins: number; avgConsecLosses: number;
  maxDD: number; maxDDpct: number; retDD: number;
  sharpe: number; sqn: number; expectancy: number;
  stagnationDays: number; stagnationPct: number;
  cagr: number; years: number;
  equity: { t: number; eq: number }[];         // curva de equity (peak-to-peak)
  ddSeries: { t: number; dd: number }[];        // drawdown $ bajo el pico
  months: Record<number, Record<number, number>>; // year → month(0-11) → pnl
  ytd: Record<number, number>;
  monthKeys: number[];                          // años presentes, orden asc
};

function std(v: number[]): number {
  const n = v.length; if (n < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / n;
  let s = 0; for (const x of v) s += (x - m) ** 2;
  return Math.sqrt(s / (n - 1));
}

export function buildReport(trades: Trade[], capital: number): FullReport {
  const cap = capital > 0 ? capital : 10000;
  const sorted = [...trades].sort((a, b) => a.t - b.t);
  const n = sorted.length;
  const empty: FullReport = {
    capital: cap, net: 0, grossProfit: 0, grossLoss: 0, pf: 0, trades: 0, wins: 0, losses: 0, winRate: 0,
    avgTrade: 0, avgWin: 0, avgLoss: 0, payout: 0, largestWin: 0, largestLoss: 0,
    maxConsecWins: 0, maxConsecLosses: 0, avgConsecWins: 0, avgConsecLosses: 0,
    maxDD: 0, maxDDpct: 0, retDD: 0, sharpe: 0, sqn: 0, expectancy: 0,
    stagnationDays: 0, stagnationPct: 0, cagr: 0, years: 0,
    equity: [{ t: 0, eq: cap }], ddSeries: [], months: {}, ytd: {}, monthKeys: [],
  };
  if (!n) return empty;

  let gp = 0, gl = 0, wins = 0, losses = 0, largestWin = 0, largestLoss = 0;
  const profits: number[] = [];
  const equity: { t: number; eq: number }[] = [{ t: sorted[0].t, eq: cap }];
  const ddSeries: { t: number; dd: number }[] = [];
  let cum = cap, peak = cap, maxDD = 0;
  // rachas
  let curWin = 0, curLoss = 0, maxCW = 0, maxCL = 0;
  const winRuns: number[] = [], lossRuns: number[] = [];
  // estancamiento: tiempo bajo el pico anterior
  let peakTime = sorted[0].t, maxStagMs = 0;
  // mensual
  const months: Record<number, Record<number, number>> = {};
  const ytd: Record<number, number> = {};
  const years = new Set<number>();

  for (const tr of sorted) {
    const p = tr.profit; profits.push(p);
    if (p >= 0) { gp += p; if (p > 0) wins++; largestWin = Math.max(largestWin, p); }
    else { gl += -p; losses++; largestLoss = Math.min(largestLoss, p); }
    // rachas
    if (p >= 0) { if (curLoss > 0) { lossRuns.push(curLoss); curLoss = 0; } curWin++; maxCW = Math.max(maxCW, curWin); }
    else { if (curWin > 0) { winRuns.push(curWin); curWin = 0; } curLoss++; maxCL = Math.max(maxCL, curLoss); }
    // equity + drawdown
    cum += p; equity.push({ t: tr.t, eq: Math.round(cum) });
    if (cum > peak) { peak = cum; peakTime = tr.t; }
    const dd = peak - cum; if (dd > maxDD) maxDD = dd;
    ddSeries.push({ t: tr.t, dd: Math.round(-dd) });
    const stag = tr.t - peakTime; if (stag > maxStagMs) maxStagMs = stag;
    // mensual
    const d = new Date(tr.t); const y = d.getUTCFullYear(), mo = d.getUTCMonth();
    years.add(y); (months[y] ||= {}); months[y][mo] = (months[y][mo] || 0) + p; ytd[y] = (ytd[y] || 0) + p;
  }
  if (curWin > 0) winRuns.push(curWin);
  if (curLoss > 0) lossRuns.push(curLoss);

  const net = gp - gl;
  const winRate = n ? (wins / n) * 100 : 0;
  const avgWin = wins ? gp / wins : 0;
  const avgLoss = losses ? gl / losses : 0;
  const payout = avgLoss ? avgWin / avgLoss : (avgWin > 0 ? 99 : 0);
  const expectancy = n ? net / n : 0;
  const sd = std(profits);
  const sharpe = sd ? (expectancy / sd) * Math.sqrt(n) : 0;   // Sharpe por operación (anualizado por nº ops)
  const sqn = sd ? (Math.sqrt(n) * expectancy) / sd : 0;      // System Quality Number
  const spanMs = sorted[n - 1].t - sorted[0].t;
  const yearsSpan = Math.max(spanMs / (365.25 * 86400000), 1 / 365);
  const finalEq = cap + net;
  const cagr = finalEq > 0 && yearsSpan > 0 ? (Math.pow(finalEq / cap, 1 / yearsSpan) - 1) * 100 : 0;
  const maxDDpct = peak > 0 ? (maxDD / (cap + Math.max(0, peak - cap))) * 100 : 0;
  const stagnationDays = maxStagMs / 86400000;
  const stagnationPct = spanMs > 0 ? (maxStagMs / spanMs) * 100 : 0;
  const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

  return {
    capital: cap,
    net: Math.round(net), grossProfit: Math.round(gp), grossLoss: Math.round(gl),
    pf: gl > 0 ? Math.round((gp / gl) * 100) / 100 : (gp > 0 ? 99 : 0),
    trades: n, wins, losses, winRate: Math.round(winRate * 10) / 10,
    avgTrade: Math.round(expectancy * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100,
    payout: Math.round(payout * 100) / 100,
    largestWin: Math.round(largestWin), largestLoss: Math.round(largestLoss),
    maxConsecWins: maxCW, maxConsecLosses: maxCL,
    avgConsecWins: Math.round(avg(winRuns) * 100) / 100, avgConsecLosses: Math.round(avg(lossRuns) * 100) / 100,
    maxDD: Math.round(maxDD), maxDDpct: Math.round(maxDDpct * 100) / 100,
    retDD: maxDD > 0 ? Math.round((net / maxDD) * 100) / 100 : 0,
    sharpe: Math.round(sharpe * 100) / 100, sqn: Math.round(sqn * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    stagnationDays: Math.round(stagnationDays), stagnationPct: Math.round(stagnationPct * 10) / 10,
    cagr: Math.round(cagr * 100) / 100, years: Math.round(yearsSpan * 10) / 10,
    equity, ddSeries, months, ytd, monthKeys: [...years].sort((a, b) => a - b),
  };
}
