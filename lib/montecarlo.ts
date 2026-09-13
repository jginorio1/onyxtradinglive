// ============================================================
// Onyx Bot Factory · Suite de Monte Carlo (8 tipos, estilo StrategyQuant)
// PURO (corre en el navegador). Toma la serie de beneficios de las operaciones
// y simula variaciones aleatorias para medir la robustez: probabilidad de acabar
// en pérdida y drawdown en el peor 5% de escenarios.
// LÍNEA ROJA: es análisis histórico, no predice el mercado.
// ============================================================

export type McType = { key: string; es: string; en: string; lossProb: number; p95DD: number; medianDD: number };
export type McSuite = { types: McType[]; worstLossProb: number; worstP95DD: number; pass: boolean };

function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Drawdown máximo (%) de una secuencia de beneficios, con equity inicial 10k.
function seqDD(profits: number[]): number {
  let cum = 10000, peak = 10000, dd = 0;
  for (const p of profits) { cum += p; if (cum > peak) peak = cum; const d = (peak - cum) / peak * 100; if (d > dd) dd = d; }
  return dd;
}
function net(profits: number[]): number { let s = 0; for (const p of profits) s += p; return s; }
function pct(arr: number[], q: number): number { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; }

// Ejecuta `runs` simulaciones de un generador y resume la distribución.
function dist(gen: (rng: () => number) => number[], runs: number, seed: number): { lossProb: number; p95DD: number; medianDD: number } {
  const rng = mulberry32(seed);
  const nets: number[] = [], dds: number[] = [];
  let losses = 0;
  for (let i = 0; i < runs; i++) { const p = gen(rng); const nt = net(p); nets.push(nt); if (nt < 0) losses++; dds.push(seqDD(p)); }
  return { lossProb: Math.round((losses / runs) * 1000) / 10, p95DD: Math.round(pct(dds, 0.95) * 10) / 10, medianDD: Math.round(pct(dds, 0.5) * 10) / 10 };
}

function shuffle<T>(a: T[], rng: () => number): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// 8 tipos de Monte Carlo sobre la serie de beneficios (una op = un número).
export function mcSuite(profits: number[], opts: { runs?: number; maxLossProb?: number } = {}): McSuite {
  const runs = opts.runs || 400;
  const P = profits.filter((x) => typeof x === 'number' && !isNaN(x));
  if (P.length < 20) return { types: [], worstLossProb: 100, worstP95DD: 100, pass: false };
  const n = P.length;
  const gens: { key: string; es: string; en: string; gen: (rng: () => number) => number[] }[] = [
    { key: 'order', es: 'Orden de operaciones', en: 'Trade order', gen: (r) => shuffle(P, r) },
    { key: 'bootstrap', es: 'Remuestreo (bootstrap)', en: 'Bootstrap resample', gen: (r) => Array.from({ length: n }, () => P[Math.floor(r() * n)]) },
    { key: 'skip', es: 'Saltar operaciones', en: 'Skip trades', gen: (r) => P.filter(() => r() > 0.1) },
    { key: 'resize', es: 'Redimensionar posición', en: 'Resize position', gen: (r) => P.map((p) => p * (0.5 + r())) },
    { key: 'slippage', es: 'Slippage extra', en: 'Extra slippage', gen: (r) => P.map((p) => p - r() * (Math.abs(net(P)) / n) * 0.3) },
    { key: 'reduce', es: 'Menos operaciones (80%)', en: 'Fewer trades (80%)', gen: (r) => shuffle(P, r).slice(0, Math.floor(n * 0.8)) },
    { key: 'start', es: 'Inicio aleatorio', en: 'Random start', gen: (r) => { const s = Math.floor(r() * (n * 0.2)); return P.slice(s).concat(P.slice(0, s)); } },
    { key: 'worst', es: 'Peores primero', en: 'Worst first', gen: (r) => { const sh = shuffle(P, r); return sh.sort((a, b) => a - b); } },
  ];
  const types: McType[] = gens.map((g, i) => { const d = dist(g.gen, runs, 12345 + i * 7); return { key: g.key, es: g.es, en: g.en, ...d }; });
  const worstLossProb = Math.max(...types.map((t) => t.lossProb));
  const worstP95DD = Math.max(...types.map((t) => t.p95DD));
  const pass = worstLossProb <= (opts.maxLossProb ?? 35);
  return { types, worstLossProb, worstP95DD, pass };
}
