// Calcula estadisticas del journal a partir de las operaciones cerradas.
export type Trade = {
  symbol: string; side: string; volume: number;
  close_time: string; net_profit: number;
};

export function computeStats(trades: Trade[]) {
  const n = trades.length;
  let wins = 0, gp = 0, gl = 0, net = 0;
  for (const t of trades) {
    const p = Number(t.net_profit) || 0;
    net += p;
    if (p >= 0) { wins++; gp += p; } else { gl += -p; }
  }
  const winRate = n ? (100 * wins / n) : 0;
  const profitFactor = gl > 0 ? gp / gl : (gp > 0 ? 999 : 0);
  const avgWin = wins ? gp / wins : 0;
  const losses = n - wins;
  const avgLoss = losses ? gl / losses : 0;
  const expectancy = n ? net / n : 0;   // $ medio por operacion

  // curva de equity (orden cronologico ascendente)
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let run = 0, peak = 0, maxDD = 0;
  const equity: { t: string; v: number }[] = [];
  for (const t of sorted) {
    run += Number(t.net_profit) || 0;
    equity.push({ t: t.close_time, v: run });
    if (run > peak) peak = run;
    const dd = peak - run;
    if (dd > maxDD) maxDD = dd;
  }
  return {
    trades: n, wins, losses, winRate, profitFactor,
    net, avgWin, avgLoss, expectancy, maxDD, equity,
  };
}
