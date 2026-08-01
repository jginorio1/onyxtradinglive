// Analiticas del journal a partir de las operaciones cerradas.
export type T = {
  symbol: string; side: string; volume: number;
  open_time: string | null; close_time: string; net_profit: number;
};
export type Bucket = { net: number; count: number; wins: number };

export const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function isoWeek(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}
function k(n: number) { const a = Math.abs(n); return a >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)); }

export function analyze(trades: T[]) {
  const entryTime = (t: T) => t.open_time || t.close_time;

  let net = 0, wins = 0, gp = 0, gl = 0, best = -Infinity, worst = Infinity;
  for (const t of trades) {
    const p = +t.net_profit || 0;
    net += p; if (p >= 0) { wins++; gp += p; } else { gl += -p; }
    if (p > best) best = p; if (p < worst) worst = p;
  }
  const n = trades.length, losses = n - wins;
  const winRate = n ? 100 * wins / n : 0;
  const profitFactor = gl > 0 ? gp / gl : (gp > 0 ? 999 : 0);
  const avgWin = wins ? gp / wins : 0, avgLoss = losses ? gl / losses : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;
  const expectancy = n ? net / n : 0;

  // break even (banda relativa al tamaño medio de operacion)
  const avgAbs = n ? (gp + gl) / n : 0;
  const beBand = avgAbs * 0.1;
  let catWin = 0, catLoss = 0, catBE = 0;
  for (const t of trades) { const p = +t.net_profit || 0; if (Math.abs(p) <= beBand) catBE++; else if (p > 0) catWin++; else catLoss++; }

  // duracion media (minutos)
  let durSum = 0, durN = 0;
  for (const t of trades) {
    if (t.open_time) { const d = (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000; if (d >= 0) { durSum += d; durN++; } }
  }
  const avgDurMin = durN ? durSum / durN : 0;

  function group(keyFn: (t: T) => string): Record<string, Bucket> {
    const m: Record<string, Bucket> = {};
    for (const t of trades) {
      const key = keyFn(t); if (key === '') continue;
      const p = +t.net_profit || 0;
      if (!m[key]) m[key] = { net: 0, count: 0, wins: 0 };
      m[key].net += p; m[key].count++; if (p >= 0) m[key].wins++;
    }
    return m;
  }

  const byWeekday = group((t) => String(new Date(entryTime(t)).getUTCDay()));
  const byHour = group((t) => String(new Date(entryTime(t)).getUTCHours()));
  const byMonth = group((t) => { const d = new Date(t.close_time); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; });
  const byWeek = group((t) => isoWeek(new Date(t.close_time)));
  const bySymbol = group((t) => t.symbol || '');
  const bySide = group((t) => (t.side === 'buy' ? 'buy' : 'sell'));
  const bySession = group((t) => {
    const h = new Date(entryTime(t)).getUTCHours();
    if (h >= 8 && h < 13) return 'Londres';
    if (h >= 13 && h < 21) return 'Nueva York';
    return 'Asia';
  });

  const daily: Record<string, Bucket> = {};
  for (const t of trades) {
    const d = new Date(t.close_time);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const p = +t.net_profit || 0;
    if (!daily[key]) daily[key] = { net: 0, count: 0, wins: 0 };
    daily[key].net += p; daily[key].count++; if (p >= 0) daily[key].wins++;
  }

  // histograma de resultados
  let hist: { label: string; count: number; pos: boolean }[] = [];
  if (n) {
    const vals = trades.map((t) => +t.net_profit || 0);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const bins = 8, w = ((mx - mn) || 1) / bins;
    const bk = Array.from({ length: bins }, (_, i) => ({ lo: mn + i * w, count: 0 }));
    for (const v of vals) { let idx = Math.floor((v - mn) / w); if (idx >= bins) idx = bins - 1; if (idx < 0) idx = 0; bk[idx].count++; }
    hist = bk.map((b) => ({ label: '$' + k(b.lo + w / 2), count: b.count, pos: (b.lo + w / 2) >= 0 }));
  }

  // curva de equity + drawdown
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let run = 0, peak = 0, maxDD = 0;
  const equity: { t: string; v: number }[] = [];
  for (const t of sorted) { run += +t.net_profit || 0; equity.push({ t: t.close_time, v: run }); if (run > peak) peak = run; const dd = peak - run; if (dd > maxDD) maxDD = dd; }

  // rachas
  let maxWin = 0, maxLoss = 0, cw = 0, cl = 0, curStreak = 0;
  for (const t of sorted) { const p = +t.net_profit || 0; if (p >= 0) { cw++; cl = 0; if (cw > maxWin) maxWin = cw; } else { cl++; cw = 0; if (cl > maxLoss) maxLoss = cl; } }
  if (sorted.length) { const last = +sorted[sorted.length - 1].net_profit || 0; curStreak = last >= 0 ? cw : -cl; }

  return {
    n, net, wins, losses, winRate, profitFactor, avgWin, avgLoss, payoff, expectancy,
    maxDD, best: n ? best : 0, worst: n ? worst : 0, curStreak, maxWin, maxLoss,
    catWin, catLoss, catBE, avgDurMin,
    byWeekday, byHour, byMonth, byWeek, bySymbol, bySide, bySession, daily, equity, hist,
  };
}

export function bestOf(m: Record<string, Bucket>): [string, Bucket] | null {
  let bk: string | null = null, bv = -Infinity;
  for (const key in m) if (m[key].net > bv) { bv = m[key].net; bk = key; }
  return bk ? [bk, m[bk]] : null;
}
export function worstOf(m: Record<string, Bucket>): [string, Bucket] | null {
  let bk: string | null = null, bv = Infinity;
  for (const key in m) if (m[key].net < bv) { bv = m[key].net; bk = key; }
  return bk ? [bk, m[bk]] : null;
}
export function topPairs(m: Record<string, Bucket>, count = 5, worst = false) {
  return Object.entries(m).sort((a, b) => worst ? a[1].net - b[1].net : b[1].net - a[1].net).slice(0, count);
}
export function fmtDur(min: number) {
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${(min / 60).toFixed(1)} h`;
  return `${(min / 1440).toFixed(1)} d`;
}
