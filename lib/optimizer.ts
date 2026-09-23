// ============================================================
// Onyx Bot Factory · Optimizador de parámetros con BÚSQUEDA DE MESETA.
// Barre rangos de período / TP / SL, puntúa cada combinación con el motor de
// backtest, y —a diferencia de un optimizador ingenuo— NO elige el pico aislado
// (que casi siempre está sobre-ajustado). Elige la MESETA: la zona donde también
// los parámetros vecinos rinden bien. Eso da robots que sobreviven fuera de
// muestra. LÍNEA ROJA: sigue siendo histórico, no predice el mercado.
// ============================================================
import { runBacktest, type Bar, type Spec, type Costs } from './backtest';

export type OptAxis = 'p1' | 'tp' | 'sl';
export type OptCell = {
  idx: number[];                 // índice en cada eje
  p1?: number; tp?: number; sl?: number;
  pf: number; net: number; n: number; dd: number; blown: boolean;
  score: number;                 // puntuación robusta de la celda
  nbr?: number;                  // media del vecindario (meseta)
};
export type OptResult = {
  axes: OptAxis[];
  values: number[][];            // valores por eje
  cells: OptCell[];
  best: OptCell | null;          // pico bruto (máximo score)
  plateau: OptCell | null;       // recomendado: centro de la mejor meseta
  stability: number;             // 0..1 — qué tan sostenida es la meseta vs el pico
  tested: number;
};

// Puntuación robusta: premia ventaja (PF) y consistencia (nº ops), penaliza
// drawdown; descarta cuentas reventadas o con muy pocas operaciones.
function scoreOf(pf: number, net: number, n: number, dd: number, blown: boolean): number {
  if (blown || n < 10 || net <= 0 || pf <= 1) return 0;
  const edge = pf - 1;                       // ventaja sobre break-even
  const consistency = Math.sqrt(Math.min(n, 400)) / 20; // 0..1 aprox
  const ddPen = Math.max(0, 1 - dd / 50);    // castiga DD alto
  return edge * consistency * ddPen;
}

function applyAxis(spec: Spec, axis: OptAxis, v: number): void {
  if (axis === 'p1') spec.p1 = v;
  else if (axis === 'tp') spec.tp = String(v);
  else if (axis === 'sl') spec.sl = String(v);
}

// opts: qué ejes barrer y con qué valores. Si no se pasan, usa rangos sensatos.
export function optimize(
  bars: Bar[],
  baseSpec: Spec,
  costs: Costs,
  opts?: { axes?: { axis: OptAxis; values: number[] }[]; maxCells?: number },
): OptResult {
  const axesCfg = opts?.axes && opts.axes.length
    ? opts.axes
    : [
        { axis: 'p1' as OptAxis, values: [10, 14, 20, 30, 50] },
        { axis: 'tp' as OptAxis, values: [20, 40, 60, 90, 120] },
        { axis: 'sl' as OptAxis, values: [20, 30, 40, 60] },
      ];
  const axes = axesCfg.map((a) => a.axis);
  const values = axesCfg.map((a) => a.values.slice());
  const dims = values.map((v) => v.length);
  const total = dims.reduce((a, b) => a * b, 1);
  const maxCells = opts?.maxCells || 400;

  // Recorre el producto cartesiano de todos los ejes (con tope de seguridad).
  const cells: OptCell[] = [];
  const counters = new Array(dims.length).fill(0);
  let tested = 0;
  for (let flat = 0; flat < total && tested < maxCells; flat++) {
    // decodifica flat → índice por eje
    let rem = flat;
    for (let d = dims.length - 1; d >= 0; d--) { counters[d] = rem % dims[d]; rem = Math.floor(rem / dims[d]); }
    const spec: Spec = { ...baseSpec };
    const cell: OptCell = { idx: counters.slice(), pf: 0, net: 0, n: 0, dd: 0, blown: false, score: 0 };
    axes.forEach((ax, d) => { const v = values[d][counters[d]]; applyAxis(spec, ax, v); (cell as any)[ax] = v; });
    const r = runBacktest(bars, spec, costs);
    cell.pf = r.pf; cell.net = r.net; cell.n = r.n; cell.dd = r.maxddPct; cell.blown = !!r.blown;
    cell.score = scoreOf(r.pf, r.net, r.n, r.maxddPct, !!r.blown);
    cells.push(cell);
    tested++;
  }

  // Pico bruto.
  let best: OptCell | null = null;
  for (const c of cells) if (!best || c.score > best.score) best = c;

  // Mapa por índice para buscar vecinos.
  const key = (idx: number[]) => idx.join(',');
  const map = new Map<string, OptCell>();
  for (const c of cells) map.set(key(c.idx), c);

  // Media del vecindario (celdas a ±1 en cada eje): mide la meseta.
  for (const c of cells) {
    let sum = c.score, cnt = 1;
    for (let d = 0; d < dims.length; d++) {
      for (const step of [-1, 1]) {
        const j = c.idx.slice(); j[d] += step;
        if (j[d] < 0 || j[d] >= dims[d]) continue;
        const nb = map.get(key(j));
        if (nb) { sum += nb.score; cnt++; }
      }
    }
    c.nbr = sum / cnt;
  }

  // Meseta recomendada: mayor media de vecindario (robusta), no el pico aislado.
  let plateau: OptCell | null = null;
  for (const c of cells) if (!plateau || (c.nbr || 0) > (plateau.nbr || 0)) plateau = c;

  // Estabilidad: qué fracción del pico se sostiene en la meseta (0..1).
  const stability = best && best.score > 0 && plateau ? Math.max(0, Math.min(1, (plateau.nbr || 0) / best.score)) : 0;

  return { axes, values, cells, best, plateau, stability: Math.round(stability * 100) / 100, tested };
}

// Aplica los parámetros de una celda a un spec (para "usar el ganador").
export function specFromCell(baseSpec: Spec, axes: OptAxis[], cell: OptCell): Spec {
  const s: Spec = { ...baseSpec };
  axes.forEach((ax) => { const v = (cell as any)[ax]; if (v != null) applyAxis(s, ax, v); });
  return s;
}
