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

// Fitness: robusto = bueno IS y que NO se caiga OOS.
export function evaluate(spec: Spec, isBars: Bar[], oosBars: Bar[], costs: Costs): EvalResult {
  const mIs = runBacktest(isBars, spec, costs);
  if (mIs.n < 15) return { fit: -1e9, isPf: mIs.pf, oosPf: 0, isNet: mIs.net, oosNet: 0, trades: mIs.n, dd: mIs.maxddPct };
  const mOos = runBacktest(oosBars, spec, costs);
  const scoreIs = (mIs.pf - 1) * 40 * Math.min(1, mIs.n / 40) - Math.max(0, mIs.maxddPct - 15) * 0.8;
  const retention = mIs.pf > 0 ? clamp(mOos.pf / mIs.pf, 0, 1.3) : 0;
  const oosPenalty = mOos.net < 0 ? 20 : 0;
  const fit = Math.round((scoreIs * (0.4 + 0.6 * retention) - oosPenalty) * 100) / 100;
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

// Bucle evolutivo. Determinista con semilla.
export function evolve(bars: Bar[], costs: Costs, opt: { pop?: number; gens?: number; keep?: number; seed?: number } = {}): EvolveOut {
  const pop = Math.min(120, Math.max(20, opt.pop || 60));
  const gens = Math.min(20, Math.max(3, opt.gens || 8));
  const keep = opt.keep || 12;
  const rng = mulberry32(opt.seed || 987654321);
  const P = pools();
  const cut = Math.floor(bars.length * 0.7);
  const isBars = bars.slice(0, cut), oosBars = bars.slice(cut);
  let generation: Spec[] = Array.from({ length: pop }, () => randomSpec(P, rng));
  const history: number[] = [];
  let evaluated = 0;
  let scored: Survivor[] = [];

  for (let gen = 0; gen < gens; gen++) {
    scored = generation.map((spec) => { evaluated++; return { spec, ev: evaluate(spec, isBars, oosBars, costs) }; })
      .sort((a, b) => b.ev.fit - a.ev.fit);
    history.push(Math.round((scored[0]?.ev.fit || 0) * 100) / 100);
    if (gen === gens - 1) break;
    const eliteN = Math.max(2, Math.floor(pop * 0.25));
    const elite = scored.slice(0, eliteN).map((s) => s.spec);
    const next: Spec[] = [...elite];
    const seen = new Set(elite.map(keyOf));
    const tour = () => { const a = scored[Math.floor(rng() * eliteN * 2)] || scored[0]; const b = scored[Math.floor(rng() * eliteN * 2)] || scored[0]; return (a.ev.fit >= b.ev.fit ? a : b).spec; };
    let guard = 0;
    while (next.length < pop && guard < pop * 20) { guard++; const child = mutate(crossover(tour(), tour(), rng), P, rng, 0.25); const k = keyOf(child); if (seen.has(k)) continue; seen.add(k); next.push(child); }
    generation = next;
  }
  const best = scored.filter((s) => s.ev.fit > -1e8).slice(0, keep);
  return { best, history, evaluated };
}
