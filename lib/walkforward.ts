// ============================================================
// Onyx Bot Factory · Walk-Forward Matrix (estilo StrategyQuant, PURO)
// Divide los datos en tramos (folds) y prueba varias variaciones del parámetro
// principal en cada tramo out-of-sample. Una estrategia robusta es rentable en
// MUCHAS celdas (meseta), no solo en un pico afortunado.
// ============================================================

import { runBacktest, defPeriod, type Bar, type Spec, type Costs } from '@/lib/backtest';

export type WfMatrix = { values: number[]; folds: number; cells: number[][]; nets: number[][]; stability: number };

export function walkForwardMatrix(bars: Bar[], spec: Spec, costs: Costs, opts: { folds?: number; values?: number[] } = {}): WfMatrix {
  const folds = Math.max(2, Math.min(10, opts.folds || 5));
  const base = spec.p1 || defPeriod(spec.ind1);
  const values = opts.values || Array.from(new Set([Math.max(3, Math.round(base * 0.6)), Math.round(base * 0.8), base, Math.round(base * 1.2), Math.round(base * 1.5), Math.round(base * 2)]));
  const n = bars.length;
  const fw = Math.floor(n / folds);
  const cells: number[][] = [], nets: number[][] = [];
  let green = 0, total = 0;
  for (const v of values) {
    const rowPf: number[] = [], rowNet: number[] = [];
    for (let f = 0; f < folds; f++) {
      const seg = bars.slice(f * fw, f === folds - 1 ? n : (f + 1) * fw);
      const r = runBacktest(seg, { ...spec, p1: v }, costs);
      const pf = r.n > 0 ? r.pf : 0;
      rowPf.push(pf); rowNet.push(r.net);
      total++; if (pf >= 1.1 && r.n >= 5) green++;
    }
    cells.push(rowPf); nets.push(rowNet);
  }
  return { values, folds, cells, nets, stability: total ? Math.round((green / total) * 100) : 0 };
}
