// Analiticas del journal a partir de las operaciones cerradas.
export type T = {
  symbol: string; side: string; volume: number;
  open_time: string | null; close_time: string; net_profit: number;
  // Ganancias parciales: cada cierre puede pertenecer a una posición mayor.
  position_id?: string | null; exit_reason?: string | null; closed_volume?: number | null;
  id?: string; account_id?: string;
  // Robot que abrió la operación (magic number del EA) + su comentario/etiqueta.
  magic?: number | null; ea_comment?: string | null;
};
export type Bucket = { net: number; count: number; wins: number };

// Colapsa los cierres (deals) de una MISMA posición en UNA operación lógica.
// Suma el profit de TP1+TP2+runner, cuenta como una sola operación, y guarda el
// desglose (parciales, motivo de salida, ganancia parcial vs aporte del runner).
// Si no hay position_id (cuenta con EA antiguo), cada fila es su propia operación
// y el comportamiento es idéntico al anterior.
export type Logical = T & {
  partials: number;        // nº de cierres de la posición (>1 = hubo parciales)
  isPartial: boolean;      // se cerró en varias partes
  isFullTP: boolean;       // se cerró entero al objetivo, de una
  finalReason: string;     // motivo del último cierre
  partialProfit: number;   // $ banqueado en cierres anteriores al último
  runnerProfit: number;    // $ del último cierre (lo que se dejó correr)
};

export function groupByPosition(trades: T[]): Logical[] {
  const groups = new Map<string, T[]>();
  let auto = 0;
  for (const t of trades) {
    const pid = t.position_id ? String(t.position_id) : `__solo_${t.id || auto++}`;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push(t);
  }
  const out: Logical[] = [];
  for (const deals of groups.values()) {
    const sorted = [...deals].sort((a, b) => String(a.close_time).localeCompare(String(b.close_time)));
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    let net = 0, vol = 0, earliestOpen = first.open_time || first.close_time;
    for (const d of sorted) {
      net += +d.net_profit || 0;
      vol += (d.closed_volume != null ? +d.closed_volume : (+d.volume || 0));
      const ot = d.open_time || d.close_time;
      if (ot && String(ot) < String(earliestOpen)) earliestOpen = ot;
    }
    const partials = sorted.length;
    const finalReason = (last.exit_reason || '').toLowerCase();
    const runnerProfit = +last.net_profit || 0;
    const partialProfit = net - runnerProfit;
    out.push({
      symbol: first.symbol, side: first.side, volume: vol,
      open_time: earliestOpen, close_time: last.close_time, net_profit: net,
      position_id: first.position_id || null, exit_reason: finalReason, closed_volume: vol,
      account_id: first.account_id, magic: first.magic ?? null, ea_comment: first.ea_comment ?? null,
      partials, isPartial: partials > 1, isFullTP: partials === 1 && finalReason === 'tp',
      finalReason, partialProfit, runnerProfit,
    });
  }
  return out;
}

// Métricas específicas de parciales sobre las operaciones lógicas.
export function partialStats(logical: Logical[]) {
  let fullTP = 0, partialTrades = 0, partialProfit = 0, runnerProfit = 0;
  const exitReasons: Record<string, number> = { tp: 0, trailing: 0, manual: 0, sl: 0, so: 0, other: 0 };
  let anyReason = false;
  for (const l of logical) {
    if (l.isFullTP) fullTP++;
    if (l.isPartial) { partialTrades++; partialProfit += l.partialProfit; runnerProfit += l.runnerProfit; }
    const r = l.finalReason && exitReasons[l.finalReason] !== undefined ? l.finalReason : (l.finalReason ? 'other' : '');
    if (r) { exitReasons[r]++; anyReason = true; }
  }
  // Nº de operaciones que SÍ traen dato de salida (motivo). Es el denominador
  // correcto para los % de Full TP / parcial: las viejas sin dato no cuentan.
  const reasonN = Object.values(exitReasons).reduce((s, v) => s + v, 0);
  return { fullTP, partialTrades, partialProfit, runnerProfit, exitReasons, hasReasons: anyReason, reasonN };
}

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
function k(n: number) { const a = Math.abs(n); return a >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)); }

export function analyze(rawTrades: T[]) {
  // Primero colapsamos los cierres parciales en operaciones lógicas, así el
  // conteo (ganadoras/perdedoras), win rate, pares, etc. cuentan cada posición
  // UNA vez y no una por cada trozo (TP1/TP2/runner).
  const logical = groupByPosition(rawTrades);
  const trades = logical as T[];
  const partial = partialStats(logical);
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
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;
  const expectancy = n ? net / n : 0;

  // break even (banda relativa al tamaño medio de operacion)
  const avgAbs = n ? (gp + gl) / n : 0;
  const beBand = avgAbs * 0.1;
  let catWin = 0, catLoss = 0, catBE = 0;
  for (const t of trades) { const p = +t.net_profit || 0; if (Math.abs(p) <= beBand) catBE++; else if (p > 0) catWin++; else catLoss++; }

  // duracion media (minutos)
  let durSum = 0, durN = 0;
  for (const t of trades) {
    if (t.open_time) { const d = (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000; if (d >= 0) { durSum += d; durN++; } }
  }
  const avgDurMin = durN ? durSum / durN : 0;

  function group(keyFn: (t: T) => string): Record<string, Bucket> {
    const m: Record<string, Bucket> = {};
    for (const t of trades) {
      const key = keyFn(t); if (key === '') continue;
      const p = +t.net_profit || 0;
      if (!m[key]) m[key] = { net: 0, count: 0, wins: 0 };
      m[key].net += p; m[key].count++; if (p >= 0) m[key].wins++;
    }
    return m;
  }

  const byWeekday = group((t) => String(new Date(entryTime(t)).getUTCDay()));
  const byHour = group((t) => String(new Date(entryTime(t)).getUTCHours()));
  const byMonth = group((t) => { const d = new Date(t.close_time); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; });
  const byWeek = group((t) => isoWeek(new Date(t.close_time)));
  const bySymbol = group((t) => t.symbol || '');
  const bySide = group((t) => (t.side === 'buy' ? 'buy' : 'sell'));
  const bySession = group((t) => {
    const h = new Date(entryTime(t)).getUTCHours();
    if (h >= 8 && h < 13) return 'Londres';
    if (h >= 13 && h < 21) return 'Nueva York';
    return 'Asia';
  });

  const daily: Record<string, Bucket> = {};
  for (const t of trades) {
    const d = new Date(t.close_time);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const p = +t.net_profit || 0;
    if (!daily[key]) daily[key] = { net: 0, count: 0, wins: 0 };
    daily[key].net += p; daily[key].count++; if (p >= 0) daily[key].wins++;
  }

  // histograma de resultados
  let hist: { label: string; count: number; pos: boolean }[] = [];
  if (n) {
    const vals = trades.map((t) => +t.net_profit || 0);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const bins = 8, w = ((mx - mn) || 1) / bins;
    const bk = Array.from({ length: bins }, (_, i) => ({ lo: mn + i * w, count: 0 }));
    for (const v of vals) { let idx = Math.floor((v - mn) / w); if (idx >= bins) idx = bins - 1; if (idx < 0) idx = 0; bk[idx].count++; }
    hist = bk.map((b) => ({ label: '$' + k(b.lo + w / 2), count: b.count, pos: (b.lo + w / 2) >= 0 }));
  }

  // curva de equity + drawdown
  const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
  let run = 0, peak = 0, maxDD = 0;
  const equity: { t: string; v: number }[] = [];
  for (const t of sorted) { run += +t.net_profit || 0; equity.push({ t: t.close_time, v: run }); if (run > peak) peak = run; const dd = peak - run; if (dd > maxDD) maxDD = dd; }

  // rachas
  let maxWin = 0, maxLoss = 0, cw = 0, cl = 0, curStreak = 0;
  for (const t of sorted) { const p = +t.net_profit || 0; if (p >= 0) { cw++; cl = 0; if (cw > maxWin) maxWin = cw; } else { cl++; cw = 0; if (cl > maxLoss) maxLoss = cl; } }
  if (sorted.length) { const last = +sorted[sorted.length - 1].net_profit || 0; curStreak = last >= 0 ? cw : -cl; }

  // --- Mapa de calor hora × día de la semana (7 filas × 24 columnas) ---
  // Cada celda = neto acumulado de las operaciones abiertas en ese día/hora.
  const heat: Bucket[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ net: 0, count: 0, wins: 0 })));
  for (const t of trades) {
    const d = new Date(entryTime(t)); const wd = d.getUTCDay(), h = d.getUTCHours();
    const p = +t.net_profit || 0; const cell = heat[wd][h];
    cell.net += p; cell.count++; if (p >= 0) cell.wins++;
  }

  // --- Distribución de tiempo en operación (holding) ---
  // Bins en minutos: <1, 1-5, 5-15, 15-60, 1-4h, 4-24h, >1d.
  const hold = HOLD_BINS_LABELS.map(() => ({ count: 0, net: 0 }));
  let holdN = 0;
  for (const t of trades) {
    if (!t.open_time) continue;
    const m = (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000;
    if (m < 0) continue;
    let idx = HOLD_BINS.findIndex((edge) => m < edge); if (idx < 0) idx = HOLD_BINS.length;
    hold[idx].count++; hold[idx].net += +t.net_profit || 0; holdN++;
  }

  // --- Distribución en R (aproximada) ---
  // Sin un riesgo declarado por operación tomamos la PÉRDIDA MEDIA como 1R.
  // Es una aproximación honesta: da la forma de la distribución (¿pocas grandes
  // o muchas chicas?) y la expectativa en R sin necesitar datos extra del EA.
  const rDist = R_BINS_LABELS.map(() => 0);
  let rValid = avgLoss > 0 && n >= 5;
  if (rValid) {
    for (const t of trades) {
      const r = (+t.net_profit || 0) / avgLoss;
      let idx = R_EDGES.findIndex((edge) => r < edge); if (idx < 0) idx = R_EDGES.length;
      rDist[idx]++;
    }
  }
  const rExpectancy = avgLoss > 0 ? expectancy / avgLoss : 0;

  // --- Diagnóstico cuantitativo del "edge" (esperanza, dispersión, significancia) ---
  // Serie de resultados por operación en R (1R = pérdida media). Con eso medimos:
  //  · rMean  = esperanza en R (igual a rExpectancy)
  //  · rStd   = desviación estándar de los resultados (volatilidad del edge)
  //  · tStat  = significancia estadística de la esperanza vs 0 (¿se distingue del azar/ruido?)
  //  · sqn    = System Quality Number (Van Tharp) = (media/desv)·√n → calidad global
  let rMean = 0, rStd = 0, tStat = 0, sqn = 0;
  if (rValid) {
    const rs = trades.map((t) => (+t.net_profit || 0) / avgLoss);
    rMean = rs.reduce((a, b) => a + b, 0) / n;
    const varR = rs.reduce((a, b) => a + (b - rMean) * (b - rMean), 0) / (n > 1 ? n - 1 : 1);
    rStd = Math.sqrt(varR);
    if (rStd > 0) { tStat = rMean / (rStd / Math.sqrt(n)); sqn = (rMean / rStd) * Math.sqrt(n); }
  }

  // --- Consistencia (regla típica de prop firm: mayor día vs total) ---
  let bestDayNet = 0, worstDayNet = 0;
  for (const key in daily) { const v = daily[key].net; if (v > bestDayNet) bestDayNet = v; if (v < worstDayNet) worstDayNet = v; }
  const daysTraded = Object.keys(daily).length;
  const consistency = net > 0 ? bestDayNet / net : 0;   // 0..1 (menor = más parejo)

  return {
    n, net, wins, losses, winRate, profitFactor, avgWin, avgLoss, payoff, expectancy,
    maxDD, best: n ? best : 0, worst: n ? worst : 0, curStreak, maxWin, maxLoss,
    catWin, catLoss, catBE, avgDurMin,
    byWeekday, byHour, byMonth, byWeek, bySymbol, bySide, bySession, daily, equity, hist,
    // Ganancias parciales / motivo de salida (una op = una posición).
    fullTP: partial.fullTP, partialTrades: partial.partialTrades,
    partialProfit: partial.partialProfit, runnerProfit: partial.runnerProfit,
    exitReasons: partial.exitReasons, hasReasons: partial.hasReasons, reasonN: partial.reasonN,
    rawCount: rawTrades.length,   // nº de cierres crudos (deals), antes de agrupar
    // Estadística ampliada (Rendimiento pro).
    heat, hold, holdN, rDist, rValid, rExpectancy,
    bestDayNet, worstDayNet, daysTraded, consistency,
    // Diagnóstico cuantitativo del edge.
    rMean, rStd, tStat, sqn,
  };
}

// Bins de tiempo en operación (minutos) y sus etiquetas (7 tramos).
export const HOLD_BINS = [1, 5, 15, 60, 240, 1440];
export const HOLD_BINS_LABELS = ['<1m', '1–5m', '5–15m', '15–60m', '1–4h', '4–24h', '>1d'];
// Bins de R (aproximada). 8 tramos con la pérdida media como 1R.
export const R_EDGES = [-3, -2, -1, 0, 1, 2, 3];
export const R_BINS_LABELS = ['<-3R', '-3R', '-2R', '-1R', '+1R', '+2R', '+3R', '>3R'];

// --- Desglose por activo (símbolo) con drill-down por robot (magic) ---
// Cada operación cierra en un símbolo y la abrió un robot (magic). Esto permite
// ver KPIs por activo y, dentro de cada uno, separados por cada robot cuando hay
// varios operando la misma cuenta.
export type KRow = {
  key: string; label: string; net: number; ops: number; wins: number;
  winRate: number; pf: number; expectancy: number; avgVol: number; best: number; worst: number;
};
function kpisOf(items: T[]): Omit<KRow, 'key' | 'label'> {
  let net = 0, wins = 0, gp = 0, gl = 0, best = -Infinity, worst = Infinity, vol = 0;
  for (const t of items) {
    const p = +t.net_profit || 0; net += p; vol += Math.abs(+t.volume || 0);
    if (p >= 0) { wins++; gp += p; } else { gl += -p; }
    if (p > best) best = p; if (p < worst) worst = p;
  }
  const ops = items.length;
  return {
    net, ops, wins, winRate: ops ? 100 * wins / ops : 0,
    pf: gl > 0 ? gp / gl : (gp > 0 ? 999 : 0), expectancy: ops ? net / ops : 0,
    avgVol: ops ? vol / ops : 0, best: ops ? best : 0, worst: ops ? worst : 0,
  };
}
export type AssetRow = KRow & { robots: KRow[]; multiBot: boolean };
// Una operación es "manual" (sin robot) cuando no trae magic o su magic es 0.
export const isManual = (t: T) => t.magic == null || Number(t.magic) === 0;
export function perfBreakdown(rawTrades: T[]) {
  const logical = groupByPosition(rawTrades);
  const botLabel = (t: T, mg: string) => (t.ea_comment && String(t.ea_comment).trim()) || `#${mg}`;
  const bySym = new Map<string, T[]>();
  for (const t of logical) { const s = t.symbol || '—'; if (!bySym.has(s)) bySym.set(s, []); bySym.get(s)!.push(t); }
  const assets: AssetRow[] = Array.from(bySym.entries()).map(([sym, items]) => {
    const byBot = new Map<string, T[]>();
    for (const t of items) { const key = isManual(t) ? '__manual' : String(t.magic); if (!byBot.has(key)) byBot.set(key, []); byBot.get(key)!.push(t); }
    const robots: KRow[] = Array.from(byBot.entries()).map(([mg, its]) => ({
      key: mg === '__manual' ? '__manual' : mg, label: mg === '__manual' ? 'Manual' : botLabel(its[0], mg), ...kpisOf(its),
    })).sort((a, b) => b.net - a.net);
    return { key: sym, label: sym, ...kpisOf(items), robots, multiBot: robots.filter((r) => r.key && r.key !== '__manual').length > 1 };
  }).sort((a, b) => b.net - a.net);

  // Robots reales (con magic ≠ 0) para los chips de filtro.
  const botMap = new Map<string, { label: string; net: number; ops: number }>();
  // Resumen de lo operado a mano (magic 0 / sin magic).
  let manual = { net: 0, ops: 0, present: false };
  for (const t of logical) {
    if (isManual(t)) { manual.net += +t.net_profit || 0; manual.ops++; manual.present = true; continue; }
    const key = String(t.magic);
    const e = botMap.get(key) || { label: botLabel(t, key), net: 0, ops: 0 };
    e.net += +t.net_profit || 0; e.ops++; botMap.set(key, e);
  }
  const robots = Array.from(botMap.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.net - a.net);
  const symbols = assets.map((a) => ({ key: a.key, net: a.net, ops: a.ops }));
  return { assets, robots, symbols, manual };
}

export function bestOf(m: Record<string, Bucket>): [string, Bucket] | null {
  let bk: string | null = null, bv = -Infinity;
  for (const key in m) if (m[key].net > bv) { bv = m[key].net; bk = key; }
  return bk ? [bk, m[bk]] : null;
}
export function worstOf(m: Record<string, Bucket>): [string, Bucket] | null {
  let bk: string | null = null, bv = Infinity;
  for (const key in m) if (m[key].net < bv) { bv = m[key].net; bk = key; }
  return bk ? [bk, m[bk]] : null;
}
export function topPairs(m: Record<string, Bucket>, count = 5, worst = false) {
  return Object.entries(m).sort((a, b) => worst ? a[1].net - b[1].net : b[1].net - a[1].net).slice(0, count);
}
export function fmtDur(min: number) {
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${(min / 60).toFixed(1)} h`;
  return `${(min / 1440).toFixed(1)} d`;
}
