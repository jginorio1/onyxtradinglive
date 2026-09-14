// ============================================================
// Onyx Bot Factory · Portafolio multi-símbolo / multi-timeframe con CORRELACIÓN.
// Corre uno o varios robots (specs) sobre uno o varios datasets (par + TF) y
// combina sus curvas de equity. Mide la CORRELACIÓN mensual entre robots: un
// portafolio de robots poco correlacionados baja el drawdown combinado y sube la
// estabilidad. Así se arma una cartera, no un solo bot suelto.
// StrategyQuant tiene "portfolio" pero aquí la correlación filtra la selección.
// ============================================================
import { runBacktest, type Bar, type Spec, type Costs } from './backtest';

export type PortMember = { name: string; dataset: string; bars: Bar[]; spec: Spec };
export type PortLeg = {
  name: string; dataset: string;
  net: number; pf: number; n: number; dd: number; blown: boolean;
  months: Record<number, number>;      // clave AñoMes → P&L del mes
};
export type PortResult = {
  legs: PortLeg[];
  monthKeys: number[];                  // meses (unión) ordenados
  combinedMonthly: number[];            // P&L combinado por mes (unión)
  combinedNet: number;
  combinedPf: number;
  combinedDDpct: number;                // DD del equity combinado (% sobre pico)
  corr: number[][];                     // matriz de correlación entre legs
  avgCorr: number;                      // correlación media (fuera de la diagonal)
  diversification: number;              // 0..1 — 1 = perfectamente diversificado
};

const monthKey = (t: number) => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length); if (n < 3) return 0;
  let sa = 0, sb = 0; for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n; let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  const den = Math.sqrt(da * db); return den ? Math.max(-1, Math.min(1, num / den)) : 0;
}

export function buildPortfolio(members: PortMember[], costs: Costs): PortResult {
  const legs: PortLeg[] = [];
  const allMonths = new Set<number>();
  for (const m of members) {
    const r = runBacktest(m.bars, m.spec, costs);
    const months: Record<number, number> = {};
    for (const t of r.trades) { const k = monthKey(t.t); months[k] = (months[k] || 0) + t.profit; allMonths.add(k); }
    legs.push({ name: m.name, dataset: m.dataset, net: r.net, pf: r.pf, n: r.n, dd: r.maxddPct, blown: !!r.blown, months });
  }
  const monthKeys = [...allMonths].sort((a, b) => a - b);

  // Serie mensual alineada por leg (0 donde no operó ese mes).
  const seriesByLeg = legs.map((l) => monthKeys.map((k) => l.months[k] || 0));

  // P&L combinado por mes + métricas del equity combinado.
  const combinedMonthly = monthKeys.map((_, i) => seriesByLeg.reduce((a, s) => a + s[i], 0));
  const capital = costs.capital && costs.capital > 0 ? costs.capital : 10000;
  let cum = capital, peak = capital, dd = 0, combinedNet = 0, gp = 0, gl = 0;
  for (const m of combinedMonthly) { combinedNet += m; cum += m; if (cum > peak) peak = cum; dd = Math.max(dd, peak - cum); }
  for (const l of legs) for (const k of monthKeys) { const v = l.months[k] || 0; if (v >= 0) gp += v; else gl += -v; }
  const combinedPf = gl > 0 ? Math.round((gp / gl) * 100) / 100 : (gp > 0 ? 99 : 0);
  const combinedDDpct = peak > 0 ? Math.round((dd / peak) * 1000) / 10 : 0;

  // Matriz de correlación entre legs (correlación mensual).
  const L = legs.length;
  const corr: number[][] = Array.from({ length: L }, () => new Array(L).fill(0));
  let corrSum = 0, corrCnt = 0;
  for (let i = 0; i < L; i++) {
    corr[i][i] = 1;
    for (let j = i + 1; j < L; j++) {
      const c = Math.round(pearson(seriesByLeg[i], seriesByLeg[j]) * 100) / 100;
      corr[i][j] = c; corr[j][i] = c; corrSum += c; corrCnt++;
    }
  }
  const avgCorr = corrCnt ? Math.round((corrSum / corrCnt) * 100) / 100 : 0;
  const diversification = Math.round(Math.max(0, 1 - Math.max(0, avgCorr)) * 100) / 100;

  return { legs, monthKeys, combinedMonthly, combinedNet: Math.round(combinedNet), combinedPf, combinedDDpct, corr, avgCorr, diversification };
}

// Selección voraz de una cartera poco correlacionada: parte del mejor por net y
// va añadiendo el que menos correlaciona con lo ya elegido, hasta `size`.
export function pickUncorrelated(members: PortMember[], costs: Costs, size: number): { chosen: PortMember[]; result: PortResult } {
  const base = buildPortfolio(members, costs);
  const order = base.legs.map((l, i) => ({ i, net: l.net, blown: l.blown })).filter((x) => !x.blown).sort((a, b) => b.net - a.net);
  if (!order.length) return { chosen: [], result: buildPortfolio([], costs) };
  const chosenIdx: number[] = [order[0].i];
  while (chosenIdx.length < Math.min(size, order.length)) {
    let bestI = -1, bestScore = Infinity;
    for (const o of order) {
      if (chosenIdx.includes(o.i)) continue;
      // correlación media contra los ya elegidos (menor es mejor); desempata por net alto.
      let c = 0; for (const ci of chosenIdx) c += base.corr[o.i][ci]; c /= chosenIdx.length;
      const s = c - o.net / 1e9;
      if (s < bestScore) { bestScore = s; bestI = o.i; }
    }
    if (bestI < 0) break; chosenIdx.push(bestI);
  }
  const chosen = chosenIdx.map((i) => members[i]);
  return { chosen, result: buildPortfolio(chosen, costs) };
}
