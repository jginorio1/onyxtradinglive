// ============================================================
// Onyx Bot Factory · Fase 5 — Motor de backtest en la nube (PURO, corre en el
// navegador). Simula cada estrategia generada sobre barras OHLC con costes
// realistas (spread, slippage, comisión), gestiona TP/SL/break-even/trailing,
// sesiones/horarios, y devuelve las operaciones + métricas. Los resultados
// alimentan el laboratorio de robustez y el pipeline que ya existen.
// LÍNEA ROJA: es una simulación histórica, no predice el mercado.
// ============================================================

export type Bar = { t: number; o: number; h: number; l: number; c: number };
export type Spec = {
  ind1: string; ind2?: string; entry: string; exit: string; sessions: string;
  tp: string; sl: string; be: string; trailing: string; p1?: number; p2?: number; dir?: 'both' | 'long' | 'short';
};
export type Costs = { spreadPips: number; slippagePips: number; commission: number; moneyPerPip: number; lot: number; pip?: number };
export type BtResult = { trades: { t: number; profit: number }[]; n: number; net: number; pf: number; winRate: number; maxddPct: number; expectancy: number };

// Adivina el instrumento desde el nombre del archivo (Dukascopy/StrategyQuant).
export function guessSymbolFromName(name: string): string {
  const base = (name || '').replace(/\.[^.]+$/, '');
  const m = base.match(/^[A-Za-z][A-Za-z0-9.]{1,15}/);
  const s = (m ? m[0] : '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const map: Record<string, string> = { USA500IDXUSD: 'US500', USATECHIDXUSD: 'NAS100', USA30IDXUSD: 'US30', DEUIDXEUR: 'GER40', GBRIDXGBP: 'UK100', JPNIDXJPY: 'JP225', FRAIDXEUR: 'FRA40', AUSIDXAUD: 'AUS200', LIGHTCMDUSD: 'USOIL', BRENTCMDUSD: 'UKOIL' };
  return map[s] || s;
}

export function inferPip(price: number): number {
  if (price >= 1000) return 1; if (price >= 100) return 0.1; if (price >= 10) return 0.01; return 0.0001;
}

// ---------- Indicadores ----------
function sma(v: number[], p: number): number[] { const o = new Array(v.length).fill(NaN); let s = 0; for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= p) s -= v[i - p]; if (i >= p - 1) o[i] = s / p; } return o; }
function ema(v: number[], p: number): number[] { const o = new Array(v.length).fill(NaN); const k = 2 / (p + 1); let prev = v[0]; for (let i = 0; i < v.length; i++) { prev = i ? v[i] * k + prev * (1 - k) : v[i]; if (i >= p - 1) o[i] = prev; } return o; }
function rsi(v: number[], p: number): number[] { const o = new Array(v.length).fill(NaN); let g = 0, l = 0; for (let i = 1; i < v.length; i++) { const d = v[i] - v[i - 1]; const up = d > 0 ? d : 0, dn = d < 0 ? -d : 0; if (i <= p) { g += up; l += dn; if (i === p) { g /= p; l /= p; o[i] = 100 - 100 / (1 + g / (l || 1e-9)); } } else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; o[i] = 100 - 100 / (1 + g / (l || 1e-9)); } } return o; }
function atr(bars: Bar[], p: number): number[] { const tr = bars.map((b, i) => i ? Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)) : b.h - b.l); return ema(tr, p); }
function stdev(v: number[], p: number): number[] { const m = sma(v, p); const o = new Array(v.length).fill(NaN); for (let i = p - 1; i < v.length; i++) { let s = 0; for (let j = i - p + 1; j <= i; j++) s += (v[j] - m[i]) ** 2; o[i] = Math.sqrt(s / p); } return o; }

// Devuelve tendencia (-1/0/1) y oscilador (0..100) por indicador.
function series(id: string, bars: Bar[], period: number): { trend: number[]; osc: number[] } {
  const c = bars.map((b) => b.c); const n = bars.length;
  const trend = new Array(n).fill(0); const osc = new Array(n).fill(50);
  const setTrendFromMA = (ma: number[]) => { for (let i = 0; i < n; i++) if (!isNaN(ma[i])) trend[i] = Math.sign(c[i] - ma[i]); };
  switch (id) {
    case 'sma': case 'vwap': setTrendFromMA(sma(c, period)); break;
    case 'ema': case 'ichimoku': case 'psar': setTrendFromMA(ema(c, period)); break;
    case 'macd': { const f = ema(c, 12), s = ema(c, 26); const macd = c.map((_, i) => f[i] - s[i]); const sig = ema(macd, 9); for (let i = 0; i < n; i++) trend[i] = Math.sign(macd[i] - sig[i]); break; }
    case 'rsi': { const r = rsi(c, period); for (let i = 0; i < n; i++) if (!isNaN(r[i])) { osc[i] = r[i]; trend[i] = Math.sign(r[i] - 50); } break; }
    case 'stoch': { for (let i = period; i < n; i++) { let hh = -1e9, ll = 1e9; for (let j = i - period + 1; j <= i; j++) { hh = Math.max(hh, bars[j].h); ll = Math.min(ll, bars[j].l); } const k = hh > ll ? ((c[i] - ll) / (hh - ll)) * 100 : 50; osc[i] = k; trend[i] = Math.sign(k - 50); } break; }
    case 'cci': { const tp = bars.map((b) => (b.h + b.l + b.c) / 3); const m = sma(tp, period); for (let i = period - 1; i < n; i++) { let md = 0; for (let j = i - period + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]); md /= period; const v = md ? (tp[i] - m[i]) / (0.015 * md) : 0; osc[i] = Math.max(0, Math.min(100, (v + 200) / 4)); trend[i] = Math.sign(v); } break; }
    case 'wpr': { for (let i = period; i < n; i++) { let hh = -1e9, ll = 1e9; for (let j = i - period + 1; j <= i; j++) { hh = Math.max(hh, bars[j].h); ll = Math.min(ll, bars[j].l); } const w = hh > ll ? ((hh - c[i]) / (hh - ll)) * -100 : -50; osc[i] = 100 + w; trend[i] = Math.sign(osc[i] - 50); } break; }
    case 'mom': { for (let i = period; i < n; i++) { const mo = c[i] - c[i - period]; trend[i] = Math.sign(mo); osc[i] = Math.max(0, Math.min(100, 50 + (mo / (c[i] || 1)) * 5000)); } break; }
    case 'bb': { const m = sma(c, period), sd = stdev(c, period); for (let i = 0; i < n; i++) if (!isNaN(m[i])) { trend[i] = Math.sign(c[i] - m[i]); const up = m[i] + 2 * sd[i], lo = m[i] - 2 * sd[i]; osc[i] = up > lo ? ((c[i] - lo) / (up - lo)) * 100 : 50; } break; }
    case 'adx': { const e = ema(c, period); setTrendFromMA(e); const a = atr(bars, period); for (let i = 0; i < n; i++) osc[i] = a[i] ? Math.min(100, (a[i] / (c[i] || 1)) * 10000) : 50; break; }
    default: setTrendFromMA(ema(c, period));
  }
  return { trend, osc };
}

const HOURS: Record<string, (h: number) => boolean> = {
  sydney: (h) => h >= 21 || h < 6, tokyo: (h) => h >= 0 && h < 9, london: (h) => h >= 7 && h < 16,
  ny: (h) => h >= 12 && h < 21, overlap: (h) => h >= 12 && h < 16, all: () => true,
};

function pips(id: string, atrPips: number): number {
  if (id.startsWith('atr')) { const m = id === 'atr1' ? 1 : id === 'atr15' ? 1.5 : id === 'atr2' ? 2 : id === 'atr3' ? 3 : 1; return m * atrPips; }
  const n = parseFloat(id); return isNaN(n) ? 0 : n;
}

// ---------- Simulación ----------
export function runBacktest(bars: Bar[], spec: Spec, costs: Costs): BtResult {
  const n = bars.length;
  const empty: BtResult = { trades: [], n: 0, net: 0, pf: 0, winRate: 0, maxddPct: 0, expectancy: 0 };
  if (n < 60) return empty;
  const pip = costs.pip || inferPip(bars[Math.floor(n / 2)].c);
  const p1 = spec.p1 || defPeriod(spec.ind1), p2 = spec.p2 || defPeriod(spec.ind2 || 'ema');
  const s1 = series(spec.ind1, bars, p1);
  const s2 = spec.ind2 ? series(spec.ind2, bars, p2) : null;
  const atrArr = atr(bars, 14);
  const sessOk = HOURS[spec.sessions] || HOURS.all;

  function entryAt(i: number): 'long' | 'short' | 'none' {
    const t = s1.trend, o = s1.osc; if (i < 30) return 'none';
    let sig: 'long' | 'short' | 'none' = 'none';
    switch (spec.entry) {
      case 'cross_up': sig = t[i] === 1 && t[i - 1] <= 0 ? 'long' : 'none'; break;
      case 'cross_dn': sig = t[i] === -1 && t[i - 1] >= 0 ? 'short' : 'none'; break;
      case 'above': sig = t[i] === 1 ? 'long' : 'none'; break;
      case 'below': sig = t[i] === -1 ? 'short' : 'none'; break;
      case 'oversold': sig = o[i] < 30 ? 'long' : 'none'; break;
      case 'overbought': sig = o[i] > 70 ? 'short' : 'none'; break;
      case 'breakout': { let hh = -1e9, ll = 1e9; for (let j = i - 20; j < i; j++) { hh = Math.max(hh, bars[j].h); ll = Math.min(ll, bars[j].l); } sig = bars[i].c > hh ? 'long' : bars[i].c < ll ? 'short' : 'none'; break; }
      case 'pullback': sig = t[i] === 1 && o[i] < 45 ? 'long' : t[i] === -1 && o[i] > 55 ? 'short' : 'none'; break;
      case 'divergence': sig = o[i] > 50 && o[i - 1] <= 50 ? 'long' : o[i] < 50 && o[i - 1] >= 50 ? 'short' : 'none'; break;
    }
    if (sig === 'none') return 'none';
    if (spec.dir === 'long' && sig === 'short') return 'none';
    if (spec.dir === 'short' && sig === 'long') return 'none';
    if (s2) { const tb = s2.trend[i]; if (sig === 'long' && tb < 0) return 'none'; if (sig === 'short' && tb > 0) return 'none'; }
    return sig;
  }

  const trades: { t: number; profit: number }[] = [];
  let pos: null | { dir: 1 | -1; entry: number; sl: number; tp: number; bars: number; atrPips: number; be: boolean } = null;
  const costPips = costs.spreadPips + 2 * costs.slippagePips;
  const commMoney = costs.commission * costs.lot * 2;

  for (let i = 31; i < n; i++) {
    const b = bars[i];
    if (pos) {
      // Gestión intrabar (conservador: primero SL).
      let exitPrice = NaN;
      if (pos.dir === 1) { if (b.l <= pos.sl) exitPrice = pos.sl; else if (b.h >= pos.tp) exitPrice = pos.tp; }
      else { if (b.h >= pos.sl) exitPrice = pos.sl; else if (b.l <= pos.tp) exitPrice = pos.tp; }
      // Break-even.
      if (isNaN(exitPrice) && spec.be !== 'off' && !pos.be) {
        const bePips = pips(spec.be === 'be_atr' ? 'atr1' : spec.be.replace('be', ''), pos.atrPips);
        const prog = pos.dir === 1 ? (b.h - pos.entry) / pip : (pos.entry - b.l) / pip;
        if (prog >= bePips) { pos.sl = pos.dir === 1 ? pos.entry + pip : pos.entry - pip; pos.be = true; }
      }
      // Trailing.
      if (isNaN(exitPrice) && spec.trailing !== 'off') {
        const trPips = pips(spec.trailing === 't_atr' ? 'atr1' : spec.trailing.replace('t', ''), pos.atrPips);
        if (pos.dir === 1) { const ns = b.h - trPips * pip; if (ns > pos.sl) pos.sl = ns; } else { const ns = b.l + trPips * pip; if (ns < pos.sl) pos.sl = ns; }
      }
      // Salidas por señal / indicador / tiempo.
      if (isNaN(exitPrice)) {
        pos.bars++;
        const flip = entryAt(i);
        if (spec.exit === 'opp_signal' && ((pos.dir === 1 && flip === 'short') || (pos.dir === -1 && flip === 'long'))) exitPrice = b.c;
        else if (spec.exit === 'indicator' && s1.trend[i] === -pos.dir) exitPrice = b.c;
        else if (spec.exit === 'time' && pos.bars >= 24) exitPrice = b.c;
      }
      if (!isNaN(exitPrice)) {
        const rawPips = ((exitPrice - pos.entry) / pip) * pos.dir;
        const money = (rawPips - costPips) * costs.moneyPerPip * costs.lot - commMoney;
        trades.push({ t: b.t, profit: Math.round(money * 100) / 100 });
        pos = null;
      }
    }
    if (!pos) {
      const h = new Date(b.t).getUTCHours();
      if (!sessOk(h)) continue;
      const sig = entryAt(i);
      if (sig === 'none') continue;
      const dir = sig === 'long' ? 1 : -1;
      const atrPips = atrArr[i] ? atrArr[i] / pip : 20;
      const tpP = pips(spec.tp, atrPips) || 40, slP = pips(spec.sl, atrPips) || 30;
      const entry = b.c + dir * costs.slippagePips * pip;
      pos = { dir, entry, tp: entry + dir * tpP * pip, sl: entry - dir * slP * pip, bars: 0, atrPips, be: false };
    }
  }

  // Métricas.
  let gp = 0, gl = 0, wins = 0, net = 0, cum = 10000, peak = 10000, dd = 0;
  for (const t of trades) { net += t.profit; if (t.profit >= 0) { gp += t.profit; if (t.profit > 0) wins++; } else gl += -t.profit; cum += t.profit; if (cum > peak) peak = cum; dd = Math.max(dd, peak - cum); }
  const N = trades.length;
  return {
    trades, n: N, net: Math.round(net),
    pf: gl > 0 ? Math.round((gp / gl) * 100) / 100 : (gp > 0 ? 99 : 0),
    winRate: N ? Math.round((wins / N) * 100) : 0,
    maxddPct: peak > 0 ? Math.round((dd / peak) * 1000) / 10 : 0,
    expectancy: N ? Math.round((net / N) * 100) / 100 : 0,
  };
}

export function defPeriod(id: string): number {
  const m: Record<string, number> = { ema: 20, sma: 20, rsi: 14, macd: 12, stoch: 14, bb: 20, atr: 14, adx: 14, cci: 20, mom: 10, ichimoku: 26, psar: 14, wpr: 14, vwap: 20 };
  return m[id] || 20;
}

// ---------- Lectura por STREAMING para archivos ENORMES (GB) ----------
// Lee el archivo por trozos (sin cargarlo entero en memoria) y llama onLine por
// cada línea. Funciona con ticks o barras de varios GB.
export async function readFileByLines(file: File, onLine: (line: string) => void, onProgress?: (p: number) => void, shouldStop?: () => boolean): Promise<void> {
  const decoder = new TextDecoder();
  let carry = '';
  const total = file.size || 1; let read = 0; let sinceYield = 0;
  const stop = () => (shouldStop ? shouldStop() : false);
  // Cede el hilo al navegador (macro-tarea) para que pinte y responda a clics.
  const yieldUI = async () => { if (onProgress) onProgress(Math.min(1, read / total)); await new Promise((r) => setTimeout(r, 0)); };
  const flush = (final: boolean): boolean => {
    let idx: number;
    while ((idx = carry.indexOf('\n')) >= 0) { onLine(carry.slice(0, idx)); carry = carry.slice(idx + 1); if (stop()) return true; }
    if (final && carry.trim()) onLine(carry);
    return false;
  };

  const anyFile = file as any;
  if (anyFile.stream && typeof anyFile.stream === 'function') {
    const reader = anyFile.stream().getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const len = value.byteLength || value.length || 0; read += len; sinceYield += len;
        carry += decoder.decode(value, { stream: true });
        if (flush(false) || stop()) { try { await reader.cancel(); } catch {} return; }
        if (sinceYield >= 4 * 1024 * 1024) { sinceYield = 0; await yieldUI(); }
      }
      carry += decoder.decode();
    } catch { /* lectura interrumpida */ }
  } else {
    const CH = 8 * 1024 * 1024; let off = 0;
    while (off < file.size) {
      const buf = await file.slice(off, off + CH).text(); off += CH; read = off; carry += buf;
      if (flush(false) || stop()) return;
      await yieldUI();
    }
  }
  flush(true);
  if (onProgress) onProgress(1);
}

function tsFrom(dateStr: string, timeStr?: string): number {
  const ds = (dateStr || '').trim().replace(/\./g, '-').replace(/\//g, '-').split('-').map((x) => parseInt(x, 10));
  const y = ds[0] > 1900 ? ds[0] : ds[2], mo = ds[1], d = ds[0] > 1900 ? ds[2] : ds[0];
  let hh = 0, mi = 0, ss = 0;
  if (timeStr) { const t = timeStr.trim().split(':'); hh = parseInt(t[0], 10) || 0; mi = parseInt(t[1], 10) || 0; if (t[2]) ss = parseInt(t[2], 10) || 0; }
  const v = Date.UTC(y, (mo || 1) - 1, d || 1, hh, mi, ss);
  return isNaN(v) ? NaN : v;
}
function detectCols(line: string, delim: string, isHead: boolean) {
  const idx: any = { dt: -1, date: -1, time: -1, o: -1, h: -1, l: -1, c: -1, bid: -1, ask: -1 };
  if (isHead) {
    const h = line.split(delim).map((s) => s.trim().toLowerCase());
    h.forEach((x, k) => {
      if (idx.bid < 0 && /\bbid\b/.test(x)) idx.bid = k; else if (idx.ask < 0 && /\bask\b/.test(x)) idx.ask = k;
      else if (idx.o < 0 && /open/.test(x)) idx.o = k; else if (idx.h < 0 && /high/.test(x)) idx.h = k;
      else if (idx.l < 0 && /low/.test(x)) idx.l = k; else if (idx.c < 0 && /close/.test(x)) idx.c = k;
      if (idx.dt < 0 && /(gmt|datetime|timestamp)/.test(x)) idx.dt = k; else if (idx.date < 0 && /date|fecha/.test(x)) idx.date = k; else if (idx.time < 0 && /time|hora/.test(x)) idx.time = k;
    });
    return idx;
  }
  const t = line.split(delim); const dateHasTime = /\d{2}:\d{2}/.test(t[0]);
  idx.dt = dateHasTime ? 0 : -1; idx.date = dateHasTime ? -1 : 0; idx.time = dateHasTime ? -1 : 1;
  const off = dateHasTime ? 1 : 2; const nums = t.slice(off).filter((x) => x !== '' && !isNaN(parseFloat(x)));
  if (nums.length >= 4) { idx.o = off; idx.h = off + 1; idx.l = off + 2; idx.c = off + 3; }
  else if (nums.length >= 2) { idx.bid = off; idx.ask = off + 1; }
  else idx.c = off;
  return idx;
}

// Convierte un archivo GIGANTE (ticks o barras) en barras OHLC de la temporalidad
// pedida, en streaming. Devuelve un arreglo pequeño de barras.
export async function parseBarsStreaming(file: File, tfMinutes = 15, onProgress?: (p: number) => void): Promise<Bar[]> {
  const tfMs = Math.max(1, tfMinutes) * 60000;
  let cfg: any = null, isHead = false, delim = ',';
  const bars: Bar[] = []; let cur: any = null;
  let processed = 0, capped = false; const MAX = 30000000; // tope de filas por seguridad
  const handle = (line: string) => {
    if (capped || !line || !line.trim()) return;
    if (cfg === null) {
      delim = [',', '\t', ';'].map((d) => ({ d, n: line.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
      isHead = /[a-zA-Z]{3,}/.test(line) && !/^\d{4}[.\-/]\d/.test(line);
      cfg = detectCols(line, delim, isHead);
      if (isHead) return;
    }
    const c = line.split(delim); if (c.length < 2) return;
    let ts: number;
    if (cfg.dt >= 0) { const sp = (c[cfg.dt] || '').trim().split(/\s+/); ts = tsFrom(sp[0], sp[1]); }
    else ts = tsFrom(c[cfg.date], cfg.time >= 0 ? c[cfg.time] : undefined);
    if (isNaN(ts)) return;
    let o: number, h: number, l: number, cl: number;
    if (cfg.o >= 0 && cfg.c >= 0) { o = parseFloat(c[cfg.o]); h = parseFloat(c[cfg.h]); l = parseFloat(c[cfg.l]); cl = parseFloat(c[cfg.c]); }
    else if (cfg.bid >= 0 && cfg.ask >= 0) { const m = (parseFloat(c[cfg.bid]) + parseFloat(c[cfg.ask])) / 2; o = h = l = cl = m; }
    else { const p = parseFloat(c[cfg.c >= 0 ? cfg.c : c.length - 1]); o = h = l = cl = p; }
    if (isNaN(cl)) return;
    const bucket = Math.floor(ts / tfMs) * tfMs;
    if (!cur || cur.t !== bucket) { if (cur) bars.push(cur); cur = { t: bucket, o: isNaN(o) ? cl : o, h: isNaN(h) ? cl : h, l: isNaN(l) ? cl : l, c: cl }; }
    else { if (!isNaN(h)) cur.h = Math.max(cur.h, h); if (!isNaN(l)) cur.l = Math.min(cur.l, l); cur.c = cl; }
    processed++; if (processed >= MAX) capped = true;
  };
  await readFileByLines(file, handle, onProgress, () => capped);
  if (cur) bars.push(cur);
  return bars;
}

// Parseo de barras OHLC desde texto CSV (para el navegador).
export function parseBars(text: string): Bar[] {
  const lines = text.split(/\r?\n/); let i = 0; while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return [];
  const delim = [',', '\t', ';'].map((d) => ({ d, n: lines[i].split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const isHead = /[a-zA-Z]{3,}/.test(lines[i]) && !/^\d{4}[.\-/]\d/.test(lines[i]);
  const head = isHead ? lines[i].split(delim).map((s) => s.trim().toLowerCase()) : [];
  const idx = { dt: -1, date: -1, time: -1, o: -1, h: -1, l: -1, c: -1 };
  if (isHead) head.forEach((x, k) => { if (idx.o < 0 && /open/.test(x)) idx.o = k; else if (idx.h < 0 && /high/.test(x)) idx.h = k; else if (idx.l < 0 && /low/.test(x)) idx.l = k; else if (idx.c < 0 && /close/.test(x)) idx.c = k; if (idx.dt < 0 && /(gmt|datetime|timestamp)/.test(x)) idx.dt = k; else if (idx.date < 0 && /date|fecha/.test(x)) idx.date = k; else if (idx.time < 0 && /time|hora/.test(x)) idx.time = k; });
  const start = isHead ? i + 1 : i;
  // Sin cabecera: layout MT bar = date,time,O,H,L,C[,V]
  const first = lines[start].split(delim); const dateHasTime = /\d{2}:\d{2}/.test(first[0]);
  if (!isHead) { idx.dt = dateHasTime ? 0 : -1; idx.date = dateHasTime ? -1 : 0; idx.time = dateHasTime ? -1 : 1; const off = dateHasTime ? 1 : 2; idx.o = off; idx.h = off + 1; idx.l = off + 2; idx.c = off + 3; }
  const toMs = (d: string, t?: string) => { const ds = (d || '').replace(/\./g, '-').replace(/\//g, '-').split('-').map(Number); let y = ds[0] > 1900 ? ds[0] : ds[2], mo = ds[1], da = ds[0] > 1900 ? ds[2] : ds[0]; let hh = 0, mi = 0; if (t) { const ts = t.split(':'); hh = +ts[0] || 0; mi = +ts[1] || 0; } return Date.UTC(y, (mo || 1) - 1, da || 1, hh, mi); };
  const out: Bar[] = [];
  for (let k = start; k < lines.length; k++) { const c = lines[k].split(delim); if (c.length < 4) continue; let ts: number; if (idx.dt >= 0) { const sp = c[idx.dt].trim().split(/\s+/); ts = toMs(sp[0], sp[1]); } else ts = toMs(c[idx.date], idx.time >= 0 ? c[idx.time] : undefined); const o = parseFloat(c[idx.o]), h = parseFloat(c[idx.h]), l = parseFloat(c[idx.l]), cl = parseFloat(c[idx.c]); if (isNaN(ts) || isNaN(cl)) continue; out.push({ t: ts, o: isNaN(o) ? cl : o, h: isNaN(h) ? cl : h, l: isNaN(l) ? cl : l, c: cl }); }
  return out;
}
