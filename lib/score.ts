// ============================================================
// Onyx Bot Factory · ONYX ROBUSTNESS SCORE (0–100).
// Un solo número, transparente, que resume qué tan robusta (no sobre-ajustada)
// es una estrategia. Combina 5 factores con pesos claros:
//   1. Consistencia dentro/fuera de muestra (IS≈OOS)  — 30
//   2. Rentabilidad fuera de muestra (gana en lo no visto) — 20
//   3. Control de drawdown                              — 15
//   4. Resistencia a Monte Carlo (barajar operaciones)  — 20
//   5. Simplicidad (menos piezas = menos sobreajuste)   — 15
// Mejor que StrategyQuant: SQ te da 20 métricas sueltas; aquí un veredicto claro
// que PENALIZA la complejidad, la trampa nº1 del curve-fitting.
// LÍNEA ROJA: histórico, no predice el mercado.
// ============================================================
import { runBacktest, type Bar, type Spec, type Costs } from './backtest';
import { mcSuite } from './montecarlo';
import { complexity } from './evolve';

export type ScorePart = { label: string; got: number; max: number; note: string };
export type OnyxScore = {
  score: number;                 // 0..100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  parts: ScorePart[];
  isNet: number; oosNet: number; isPf: number; oosPf: number;
  mcLossProb: number; dd: number; cx: number;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function onyxScore(bars: Bar[], spec: Spec, costs: Costs, oosPct = 30): OnyxScore {
  const frac = Math.max(0.1, Math.min(0.5, oosPct / 100));
  const cut = Math.floor(bars.length * (1 - frac));
  const mAll = runBacktest(bars, spec, costs);
  const mIs = runBacktest(bars.slice(0, cut), spec, costs);
  const mOos = runBacktest(bars.slice(cut), spec, costs);
  const cx = complexity(spec);

  // Confianza por nº de operaciones OOS: con pocas ops fuera de muestra el
  // resultado es ruido, así que los factores que dependen del OOS pesan menos.
  // Necesita ≥25 operaciones OOS para peso pleno (antes cualquier survivor con
  // OOS≥1 sacaba nota máxima → todo salía 97).
  const tradeConf = clamp01(mOos.n / 25);

  // 1. Consistencia IS≈OOS — ESTRICTA. Solo retención alta puntúa: por debajo
  //    del 45% de retención = 0. Este es el freno nº1 al sobreajuste. 30 pts.
  const retention = mIs.pf > 0 ? clamp01(mOos.pf / mIs.pf) : 0;
  const retStrict = clamp01((retention - 0.45) / 0.55);   // ret 0.45→0, 1.0→lleno
  const p1 = Math.round(retStrict * tradeConf * 30);
  // 2. Rentabilidad OOS — necesita PF de verdad (2.0 = lleno, no 1.6). 20 pts.
  const oosGood = mOos.net > 0 && mOos.pf >= 1 ? clamp01((mOos.pf - 1) / 1.0) : 0;
  const p2 = Math.round(oosGood * tradeConf * 20);
  // 3. Drawdown — 8% o menos = lleno; cae hasta 33%. 15 pts.
  const ddScore = clamp01(1 - (mAll.maxddPct - 8) / 25);
  const p3 = Math.round(ddScore * 15);
  // 4. Monte Carlo — ESTRICTO: 0% de prob. de pérdida = lleno, 35% = 0. 20 pts.
  const mc = mcSuite(mAll.trades.map((t) => t.profit), { runs: 300, maxLossProb: 35 });
  const mcScore = clamp01(1 - mc.worstLossProb / 35);
  const p4 = Math.round(mcScore * 20);
  // 5. Simplicidad — 2 piezas = lleno; cada pieza extra descuenta. 15 pts.
  const simple = clamp01(1 - (cx - 2) / 5);
  const p5 = Math.round(simple * 15);

  const score = Math.max(0, Math.min(100, p1 + p2 + p3 + p4 + p5));
  // Notas repartidas de verdad: la A es exigente (≥85) para que deje de saturar.
  const grade: OnyxScore['grade'] = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  const parts: ScorePart[] = [
    { label: 'Consistencia IS≈OOS', got: p1, max: 30, note: `retención PF ${Math.round(retention * 100)}%${mOos.n < 25 ? ` · solo ${mOos.n} ops OOS` : ''}` },
    { label: 'Rentable fuera de muestra', got: p2, max: 20, note: mOos.net > 0 ? `OOS PF ${mOos.pf.toFixed(2)} · +$${mOos.net.toLocaleString('en-US')}` : 'OOS en pérdida' },
    { label: 'Control de drawdown', got: p3, max: 15, note: `DD ${mAll.maxddPct}%` },
    { label: 'Resiste Monte Carlo', got: p4, max: 20, note: `peor prob. pérdida ${mc.worstLossProb}%` },
    { label: 'Simplicidad', got: p5, max: 15, note: `${cx} piezas` },
  ];
  return { score, grade, parts, isNet: mIs.net, oosNet: mOos.net, isPf: mIs.pf, oosPf: mOos.pf, mcLossProb: mc.worstLossProb, dd: mAll.maxddPct, cx };
}
