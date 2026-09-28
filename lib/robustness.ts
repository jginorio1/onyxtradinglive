// ============================================================
// Onyx Bot Factory · motor de robustez (Fase 2)
// Todo determinista (RNG con semilla) para que una misma corrida dé lo mismo.
// Entra la lista de operaciones cerradas del backtest; salen las pruebas
// anti-sobreoptimización + un score 0..100 + veredicto.
// ============================================================

export type Trade = { t: number; profit: number };
export type Grid = { profit: number }[]; // resultados de una optimización (opcional)

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function equity(seq: number[]) {
  let eq = 0, peak = 0, maxdd = 0; const curve = [0];
  for (const p of seq) { eq += p; if (eq > peak) peak = eq; const dd = peak - eq; if (dd > maxdd) maxdd = dd; curve.push(eq); }
  return { final: eq, maxdd, curve };
}
function pfStats(seq: number[]) {
  let gw = 0, gl = 0, w = 0;
  for (const p of seq) { if (p >= 0) { gw += p; if (p > 0) w++; } else gl += -p; }
  const net = seq.reduce((a, b) => a + b, 0);
  return { pf: gl > 0 ? gw / gl : (gw > 0 ? 99 : 0), winRate: seq.length ? (w / seq.length) * 100 : 0, expectancy: seq.length ? net / seq.length : 0, net };
}
function pct(sorted: number[], p: number) { if (!sorted.length) return 0; const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1)))); return sorted[i]; }
function downsample(a: number[], n: number) { if (a.length <= n) return a.map((x) => Math.round(x * 100) / 100); const out: number[] = []; const step = (a.length - 1) / (n - 1); for (let i = 0; i < n; i++) out.push(Math.round(a[Math.round(i * step)] * 100) / 100); return out; }
const r2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

export type Robustness = ReturnType<typeof robustnessRun>;

export function robustnessRun(tradesIn: Trade[], opts: { grid?: Grid; paramCount?: number } = {}) {
  const trades = tradesIn.filter((t) => isFinite(t.profit)).sort((a, b) => (a.t || 0) - (b.t || 0));
  const profits = trades.map((t) => t.profit);
  const n = profits.length;
  const base = equity(profits);
  const bs = pfStats(profits);
  const seed = (n * 2654435761) ^ Math.round(Math.abs(bs.net) * 1000) ^ 0x9e3779b1;
  const rng = mulberry32(seed >>> 0);

  // ---- Monte Carlo: baraja el orden 1000 veces ----
  const N = Math.min(1000, Math.max(200, 1000));
  const finals: number[] = [], dds: number[] = []; const samples: number[][] = [];
  for (let i = 0; i < N; i++) {
    const s = equity(shuffle(profits, rng));
    finals.push(s.final); dds.push(s.maxdd);
    if (i < 22) samples.push(downsample(s.curve, 50));
  }
  finals.sort((a, b) => a - b); dds.sort((a, b) => a - b);
  const mc = {
    medianFinal: r2(pct(finals, 50)), p5Final: r2(pct(finals, 5)), p95Final: r2(pct(finals, 95)),
    lossProb: r2(finals.filter((x) => x < 0).length / N),
    medianDD: r2(pct(dds, 50)), p95DD: r2(pct(dds, 95)),
  };

  // ---- In-sample / Out-of-sample (70/30 cronológico) ----
  const cut = Math.floor(n * 0.7);
  const isSt = pfStats(profits.slice(0, cut));
  const oosSt = pfStats(profits.slice(cut));
  const retention = isSt.pf > 0 ? clamp((oosSt.pf / isSt.pf) * 100, 0, 120) / 100 : 0; // 0..1.2

  // ---- Walk-forward: K ventanas, cuántas rentables ----
  const K = Math.min(8, Math.max(4, Math.floor(n / 25) || 4));
  const windows: number[] = [];
  for (let k = 0; k < K; k++) { const a = Math.floor((k * n) / K), b = Math.floor(((k + 1) * n) / K); windows.push(r2(pfStats(profits.slice(a, b)).net)); }
  const wfoConsistency = windows.length ? windows.filter((w) => w > 0).length / windows.length : 0;

  // ---- Sensibilidad (meseta vs pico) con grid de optimización ----
  let sensitivity: number | null = null; let gridChart: number[] | null = null;
  if (opts.grid && opts.grid.length >= 5) {
    const gp = opts.grid.map((g) => g.profit).filter((x) => isFinite(x)).sort((a, b) => b - a);
    const top = gp[0];
    const decile = gp.slice(0, Math.max(3, Math.floor(gp.length * 0.1)));
    const cluster = decile.reduce((a, b) => a + b, 0) / decile.length;
    // Si el mejor está pegado al pelotón → meseta (robusto). Si sobresale solo → pico (frágil).
    sensitivity = top > 0 ? r2(clamp((cluster / top) * 100)) : 0;
    gridChart = downsample(gp, 40);
  }

  // ---- Complejidad (grados de libertad) ----
  const pc = Math.max(1, opts.paramCount || 6);
  const complexityScore = clamp(112 - pc * 8);

  // ---- Puntuaciones parciales ----
  const ddRatio = mc.medianFinal > 0 ? mc.p95DD / mc.medianFinal : 3;
  const mcScore = clamp(100 - mc.lossProb * 120 - Math.min(45, ddRatio * 22));
  const oosScore = clamp(retention * 90 - (oosSt.net < 0 ? 30 : 0));
  const wfoScore = clamp(wfoConsistency * 100);
  const sensScore = sensitivity == null ? null : clamp(sensitivity);

  // Pesos (se redistribuyen si no hay sensibilidad).
  let w = { mc: 0.25, oos: 0.25, wfo: 0.20, sens: 0.15, cx: 0.15 };
  if (sensScore == null) w = { mc: 0.30, oos: 0.30, wfo: 0.23, sens: 0, cx: 0.17 };
  const score = Math.round(mcScore * w.mc + oosScore * w.oos + wfoScore * w.wfo + (sensScore || 0) * w.sens + complexityScore * w.cx);
  const verdict = score >= 70 ? 'robusto' : score >= 50 ? 'moderado' : 'fragil';

  // ---- Banderas legibles ----
  const flags: string[] = [];
  if (mc.lossProb > 0.15) flags.push(`Monte Carlo: ${Math.round(mc.lossProb * 100)}% de escenarios terminan en pérdida`);
  if (retention < 0.6) flags.push('El rendimiento se cae fuera de muestra (posible sobreajuste)');
  if (oosSt.net < 0) flags.push('Out-of-sample negativo');
  if (wfoConsistency < 0.5) flags.push('Poco consistente entre ventanas (walk-forward)');
  if (sensScore != null && sensScore < 55) flags.push('Los parámetros son un pico solitario, no una meseta');
  if (pc >= 12) flags.push(`Demasiados parámetros/reglas (${pc}): riesgo de sobreoptimización`);
  if (ddRatio > 2) flags.push('Drawdown del peor escenario muy grande frente a la ganancia');

  const expected = { net: r2(bs.net), pf: r2(bs.pf), winRate: r2(bs.winRate), maxdd: r2(base.maxdd), trades: n, expectancy: r2(bs.expectancy) };

  return {
    trades: n,
    ...expected,
    isPf: r2(isSt.pf), oosPf: r2(oosSt.pf), oosNet: r2(oosSt.net), retention: r2(retention),
    wfoConsistency: r2(wfoConsistency), windows,
    mc, ddRatio: r2(ddRatio),
    sensitivity: sensScore, paramCount: pc,
    parts: { mc: Math.round(mcScore), oos: Math.round(oosScore), wfo: Math.round(wfoScore), sens: sensScore == null ? null : Math.round(sensScore), cx: Math.round(complexityScore) },
    score: clamp(score), verdict, flags, expected,
    charts: { baseCurve: downsample(base.curve, 50), mcSamples: samples, ddDist: dds.map((x) => r2(x)).filter((_, i) => i % Math.ceil(dds.length / 60 || 1) === 0), windows, grid: gridChart, mcFinals: { p5: mc.p5Final, p50: mc.medianFinal, p95: mc.p95Final } },
  };
}

// Divergencia entre los KPIs esperados (lab) y el backtest REAL de MetaTrader.
// 0 = idénticos; se considera "similar" si <= 25.
export function compareBacktest(expected: any, mt: { net?: number; pf?: number; winRate?: number; maxdd?: number; trades?: number }) {
  const rel = (a: number, b: number) => { const d = Math.max(Math.abs(a), Math.abs(b), 1e-9); return Math.min(1, Math.abs(a - b) / d); };
  const parts: { k: string; label: string; exp: number; got: number; diff: number }[] = [];
  const add = (k: string, label: string, e: number, g: number) => parts.push({ k, label, exp: r2(e), got: r2(g), diff: Math.round(rel(e, g) * 100) });
  if (mt.pf != null) add('pf', 'Profit factor', expected.pf, mt.pf);
  if (mt.winRate != null) add('win', '% aciertos', expected.winRate, mt.winRate);
  if (mt.maxdd != null) add('dd', 'Drawdown máx', expected.maxdd, mt.maxdd);
  if (mt.net != null) add('net', 'Ganancia neta', expected.net, mt.net);
  if (mt.trades != null) add('trades', 'Operaciones', expected.trades, mt.trades);
  const divergence = parts.length ? Math.round(parts.reduce((a, b) => a + b.diff, 0) / parts.length) : 100;
  const similar = divergence <= 25;
  return { divergence, similar, parts };
}
