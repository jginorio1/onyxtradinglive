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
  const expectancy = n ? net / n : 0;

  function group(keyFn: (t: T) => string): Record<string, Bucket> {
    const m: Record<string, Bucket> = {};
    for (const t of trades) {
      const k = keyFn(t); if (k === '') continue;
      const p = +t.net_profit || 0;
      if (!m[k]) m[k] = { net: 0, count: 0, wins: 0 };
      m[k].net += p; m[k].count++; if (p >= 0) m[k].wins++;
    }
    return m;
  }

  const byWeekday = group((t) => String(new Date(entryTime(t)).getUTCDay()));
  const byHour = group((t) => String(new Date(entryTime(t)).getUTCHours()));
  const byMonth = group((t) => {
    const d = new Date(t.close_time);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const byWeek = group((t) => isoWeek(new Date(t.close_time)));
  const bySymbol = group((t) => t.symbol || '');
  const bySession = group((t) => {
    const h = new Date(entryTime(t)).getUTCHours();
    if (h >= 8 && h < 13) return 'Londres';
    if (h >= 13 && h < 21) return 'Nueva York';
    return 'Asia';
  });

  // P&L por día (para el calendario), por fecha de cierre
  const daily: Record<string, Bucket> = {};
  for (const t of trades) {
    const d = new Date(t.close_time);
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const p = +t.net_profit || 0;
    if (!daily[k]) daily[k] = { net: 0, count: 0, wins: 0 };
    daily[k].net += p; daily[k].count++; if (p >= 0) daily[k].wins++;
  }

  // curva de equity + drawdown
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let run = 0, peak = 0, maxDD = 0;
  const equity: { t: string; v: number }[] = [];
  for (const t of sorted) {
    run += +t.net_profit || 0;
    equity.push({ t: t.close_time, v: run });
    if (run > peak) peak = run;
    const dd = peak - run; if (dd > maxDD) maxDD = dd;
  }

  // rachas
  let curStreak = 0, maxWin = 0, maxLoss = 0, cw = 0, cl = 0;
  for (const t of sorted) {
    const p = +t.net_profit || 0;
    if (p >= 0) { cw++; cl = 0; if (cw > maxWin) maxWin = cw; } else { cl++; cw = 0; if (cl > maxLoss) maxLoss = cl; }
  }
  if (sorted.length) { const last = +sorted[sorted.length - 1].net_profit || 0; curStreak = last >= 0 ? cw : -cl; }

  return {
    n, net, wins, losses, winRate, profitFactor, avgWin, avgLoss, expectancy,
    maxDD, best: n ? best : 0, worst: n ? worst : 0, curStreak, maxWin, maxLoss,
    byWeekday, byHour, byMonth, byWeek, bySymbol, bySession, daily, equity,
  };
}

// Devuelve la mejor clave de un grupo (por net)
export function bestOf(m: Record<string, Bucket>): [string, Bucket] | null {
  let bk: string | null = null, bv = -Infinity;
  for (const k in m) if (m[k].net > bv) { bv = m[k].net; bk = k; }
  return bk ? [bk, m[bk]] : null;
}
