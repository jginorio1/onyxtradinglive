// ============================================================
// Onyx Bot Factory · Fase 5 — Evolución genética (GenomeLab, mejorado).
// Evoluciona estrategias generación tras generación. El fitness premia el
// rendimiento IN-SAMPLE **solo si se mantiene OUT-OF-SAMPLE**, y castiga el
// drawdown y el sobreajuste. Así solo sobrevive lo robusto de verdad.
// ============================================================

import { runBacktest, type Bar, type Spec, type Costs } from '@/lib/backtest';
import { BLOCKS } from '@/lib/stratgen';

function pools(): Record<string, string[]> {
  const p: Record<string, string[]> = {};
  for (const b of BLOCKS) if (b.key !== 'indicators') p[b.key] = b.opts.map((o) => o.id);
  p.indicators = BLOCKS[0].opts.map((o) => o.id);
  return p;
}
function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export type EvalResult = { fit: number; isPf: number; oosPf: number; isNet: number; oosNet: number; trades: number; dd: number };

function randomSpec(P: Record<string, string[]>, rng: () => number): Spec {
  const pick = (a: string[]) => a[Math.floor(rng() * a.length)];
  let i1 = pick(P.indicators), i2 = pick(P.indicators); if (i2 === i1) i2 = rng() > 0.5 ? '' : i2;
  return {
    ind1: i1, ind2: i2 || undefined, entry: pick(P.entry), exit: pick(P.exit), sessions: pick(P.sessions),
    tp: pick(P.tp), sl: pick(P.sl), be: pick(P.be), trailing: pick(P.trailing),
    p1: 5 + Math.floor(rng() * 55), p2: 10 + Math.floor(rng() * 110), dir: 'both',
  };
}

// Complejidad de una estrategia: cuantas más piezas activas, más fácil es que
// esté sobre-ajustada. La usamos para PENALIZAR lo enrevesado (mejor que SQ).
export function complexity(s: Spec): number {
  let c = 1; // el indicador base siempre cuenta
  if (s.ind2) c++;
  if (s.be && s.be !== 'off') c++;
  if (s.trailing && s.trailing !== 'off') c++;
  if (s.filter && s.filter !== 'none') c++;
  if (s.customEntry && s.customEntry.conds?.length) c += s.customEntry.conds.length;
  return c;
}

// Fitness: robusto = bueno IS y que NO se caiga OOS, penalizando la complejidad.
export function evaluate(spec: Spec, isBars: Bar[], oosBars: Bar[], costs: Costs): EvalResult {
  const mIs = runBacktest(isBars, spec, costs);
  if (mIs.n < 15 || mIs.blown) return { fit: -1e9, isPf: mIs.pf, oosPf: 0, isNet: mIs.net, oosNet: 0, trades: mIs.n, dd: mIs.maxddPct };
  const mOos = runBacktest(oosBars, spec, costs);
  const scoreIs = (mIs.pf - 1) * 40 * Math.min(1, mIs.n / 40) - Math.max(0, mIs.maxddPct - 15) * 0.8;
  const retention = mIs.pf > 0 ? clamp(mOos.pf / mIs.pf, 0, 1.3) : 0;
  const oosPenalty = mOos.net < 0 ? 20 : 0;
  const cxPenalty = Math.max(0, complexity(spec) - 3) * 3;  // castiga cada pieza extra por encima de 3
  const fit = Math.round((scoreIs * (0.4 + 0.6 * retention) - oosPenalty - cxPenalty) * 100) / 100;
  return { fit, isPf: mIs.pf, oosPf: mOos.pf, isNet: mIs.net, oosNet: mOos.net, trades: mIs.n, dd: mIs.maxddPct };
}

function crossover(a: Spec, b: Spec, rng: () => number): Spec {
  const g = <T,>(x: T, y: T) => (rng() > 0.5 ? x : y);
  return {
    ind1: g(a.ind1, b.ind1), ind2: g(a.ind2, b.ind2), entry: g(a.entry, b.entry), exit: g(a.exit, b.exit),
    sessions: g(a.sessions, b.sessions), tp: g(a.tp, b.tp), sl: g(a.sl, b.sl), be: g(a.be, b.be), trailing: g(a.trailing, b.trailing),
    p1: g(a.p1, b.p1), p2: g(a.p2, b.p2), dir: 'both',
  };
}
function mutate(s: Spec, P: Record<string, string[]>, rng: () => number, rate: number): Spec {
  const pick = (a: string[]) => a[Math.floor(rng() * a.length)];
  const o: Spec = { ...s };
  if (rng() < rate) o.ind1 = pick(P.indicators);
  if (rng() < rate) o.ind2 = rng() > 0.4 ? pick(P.indicators) : undefined;
  if (rng() < rate) o.entry = pick(P.entry);
  if (rng() < rate) o.exit = pick(P.exit);
  if (rng() < rate) o.sessions = pick(P.sessions);
  if (rng() < rate) o.tp = pick(P.tp);
  if (rng() < rate) o.sl = pick(P.sl);
  if (rng() < rate) o.be = pick(P.be);
  if (rng() < rate) o.trailing = pick(P.trailing);
  if (rng() < rate) o.p1 = clamp((o.p1 || 20) + Math.floor((rng() - 0.5) * 20), 5, 80);
  if (rng() < rate) o.p2 = clamp((o.p2 || 50) + Math.floor((rng() - 0.5) * 40), 10, 160);
  return o;
}
const keyOf = (s: Spec) => [s.ind1, s.ind2, s.entry, s.exit, s.sessions, s.tp, s.sl, s.be, s.trailing, s.p1, s.p2].join('|');

export type Survivor = { spec: Spec; ev: EvalResult };
export type EvolveOut = { best: Survivor[]; history: number[]; evaluated: number };

// Bucle evolutivo. Determinista con semilla. Simple y transparente:
// élite + torneo + cruce + mutación, con REINICIO por estancamiento (fresh blood).
export function evolve(
  bars: Bar[],
  costs: Costs,
  opt: { pop?: number; gens?: number; keep?: number; seed?: number; mut?: number; restart?: number; oosPct?: number; onGen?: (info: { gen: number; gens: number; evaluated: number; scored: Survivor[]; history: number[] }) => void } = {},
): EvolveOut {
  const pop = Math.min(200, Math.max(20, opt.pop || 60));
  const gens = Math.min(40, Math.max(3, opt.gens || 8));
  const keep = opt.keep || 12;
  const mutRate = clamp(opt.mut ?? 0.25, 0.05, 0.6);
  const restart = Math.max(0, Math.floor(opt.restart ?? 6)); // reinicia si no mejora en N gens (0 = off)
  const rng = mulberry32(opt.seed || 987654321);
  const P = pools();
  const oosFrac = clamp((opt.oosPct ?? 30) / 100, 0.1, 0.5);
  const cut = Math.floor(bars.length * (1 - oosFrac));
  const isBars = bars.slice(0, cut), oosBars = bars.slice(cut);
  let generation: Spec[] = Array.from({ length: pop }, () => randomSpec(P, rng));
  const history: number[] = [];
  let evaluated = 0;
  let scored: Survivor[] = [];
  let bestFit = -Infinity, stagn = 0;

  for (let gen = 0; gen < gens; gen++) {
    scored = generation.map((spec) => { evaluated++; return { spec, ev: evaluate(spec, isBars, oosBars, costs) }; })
      .sort((a, b) => b.ev.fit - a.ev.fit);
    const top = scored[0]?.ev.fit || 0;
    history.push(Math.round(top * 100) / 100);
    // Progreso en vivo por generación (para el monitor estilo StrategyQuant).
    try { opt.onGen?.({ gen, gens, evaluated, scored, history: history.slice() }); } catch { /* nunca romper la evolución por el monitor */ }
    // Control de estancamiento: si el mejor no mejora, cuenta; al llegar al umbral, inyecta sangre nueva.
    if (top > bestFit + 1e-6) { bestFit = top; stagn = 0; } else stagn++;
    if (gen === gens - 1) break;
    const eliteN = Math.max(2, Math.floor(pop * 0.25));
    const elite = scored.slice(0, eliteN).map((s) => s.spec);
    const next: Spec[] = [...elite];
    const seen = new Set(elite.map(keyOf));
    const tour = () => { const a = scored[Math.floor(rng() * eliteN * 2)] || scored[0]; const b = scored[Math.floor(rng() * eliteN * 2)] || scored[0]; return (a.ev.fit >= b.ev.fit ? a : b).spec; };
    // Reinicio por estancamiento: rellena la mitad de la población con individuos nuevos.
    const doRestart = restart > 0 && stagn >= restart;
    if (doRestart) { stagn = 0; while (next.length < pop / 2) { const r = randomSpec(P, rng); const k = keyOf(r); if (!seen.has(k)) { seen.add(k); next.push(r); } } }
    let guard = 0;
    while (next.length < pop && guard < pop * 20) { guard++; const child = mutate(crossover(tour(), tour(), rng), P, rng, mutRate); const k = keyOf(child); if (seen.has(k)) continue; seen.add(k); next.push(child); }
    generation = next;
  }
  const best = scored.filter((s) => s.ev.fit > -1e8).slice(0, keep);
  return { best, history, evaluated };
}
