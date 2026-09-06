// ============================================================
// Onyx Bot Factory · Fase 5 — Motor de backtest en la nube (PURO, corre en el
// navegador). Simula cada estrategia generada sobre barras OHLC con costes
// realistas (spread, slippage, comisión), gestiona TP/SL/break-even/trailing,
// sesiones/horarios, y devuelve las operaciones + métricas. Los resultados
// alimentan el laboratorio de robustez y el pipeline que ya existen.
// LÍNEA ROJA: es una simulación histórica, no predice el mercado.
// ============================================================

export type Bar = { t: number; o: number; h: number; l: number; c: number };
// Regla personalizada (creada por Claude): condiciones sobre indicadores.
export type CustomCond = { ind: string; field: 'osc' | 'trend'; op: 'gt' | 'lt' | 'cross_up' | 'cross_dn'; level: number };
export type CustomRule = { conds: CustomCond[]; dir: 'long' | 'short' };
export type Spec = {
  ind1: string; ind2?: string; entry: string; exit: string; sessions: string;
  tp: string; sl: string; be: string; trailing: string; p1?: number; p2?: number; dir?: 'both' | 'long' | 'short';
  filter?: string; customEntry?: CustomRule;
};
export type Costs = {
  spreadPips: number; slippagePips: number; commission: number; moneyPerPip: number; lot: number; pip?: number;
  // Gestión monetaria (estilo StrategyQuant): capital inicial + modelo de tamaño.
  capital?: number;                          // balance inicial de la cuenta
  mm?: 'fixed' | 'risk_pct' | 'risk_money' | 'risk_atr'; // lote fijo | % sobre equity | riesgo fijo $ | % con stop por volatilidad (ATR)
  riskPct?: number;                          // % del equity por operación (risk_pct / risk_atr)
  riskMoney?: number;                        // $ arriesgados por operación (mm='risk_money')
  atrMult?: number;                          // multiplicador de ATR para el stop (mm='risk_atr')
  pyramid?: number;                          // nº máximo de añadidos a favor (pirámide); 0 = sin pirámide
  ddType?: 'none' | 'static' | 'trailing';   // límite de drawdown: estático (desde balance inicial) o trailing (desde el pico)
  maxDDpct?: number;                         // % máximo de drawdown antes de "reventar" la cuenta
  // Reglas de reto prop firm (opcional): objetivo, pérdida diaria máx, días mínimos.
  chTarget?: number;                         // objetivo de beneficio en % del balance
  chDailyLoss?: number;                      // pérdida diaria máxima en % del balance (0 = sin límite)
  chMinDays?: number;                        // días de trading mínimos
  // Opciones de trading finas (estilo SQ): control de horario, viernes, tope diario y límites de SL/PT.
  maxTradesDay?: number;                     // máximo de operaciones nuevas por día (0 = sin límite)
  hourFrom?: number;                         // limitar entradas a partir de esta hora UTC (-1 = off)
  hourTo?: number;                           // ...hasta esta hora UTC (-1 = off)
  exitFri?: boolean;                         // cerrar todo el viernes a cierta hora
  friHour?: number;                          // hora UTC del cierre de viernes (si exitFri)
  slMin?: number; slMax?: number;            // acota el stop en pips (0 = sin límite)
  tpMin?: number; tpMax?: number;            // acota el take profit en pips (0 = sin límite)
};
export type Challenge = { target: number; dailyLoss: number; minDays: number; profitPct: number; daysTraded: number; hitTarget: boolean; dailyBreach: boolean; pass: boolean };
export type BtResult = { trades: { t: number; profit: number; dir?: 1 | -1 }[]; n: number; net: number; pf: number; winRate: number; maxddPct: number; expectancy: number; blown?: boolean; finalEquity?: number; challenge?: Challenge };

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
function wma(v: number[], p: number): number[] { const o = new Array(v.length).fill(NaN); const den = (p * (p + 1)) / 2; for (let i = p - 1; i < v.length; i++) { let s = 0; for (let j = 0; j < p; j++) s += v[i - j] * (p - j); o[i] = s / den; } return o; }
function hma(v: number[], p: number): number[] { const half = Math.max(1, Math.round(p / 2)); const sq = Math.max(1, Math.round(Math.sqrt(p))); const w1 = wma(v, half), w2 = wma(v, p); const raw = v.map((_, i) => 2 * w1[i] - w2[i]); return wma(raw, sq); }
function roc(v: number[], p: number): number[] { const o = new Array(v.length).fill(NaN); for (let i = p; i < v.length; i++) o[i] = v[i - p] ? ((v[i] - v[i - p]) / v[i - p]) * 100 : 0; return o; }
function median(v: number[]): number { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

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
    case 'adx': case 'dmi': { const e = ema(c, period); setTrendFromMA(e); const a = atr(bars, period); for (let i = 0; i < n; i++) osc[i] = a[i] ? Math.min(100, (a[i] / (c[i] || 1)) * 10000) : 50; break; }
    case 'wma': setTrendFromMA(wma(c, period)); break;
    case 'hma': setTrendFromMA(hma(c, period)); break;
    case 'dema': { const e1 = ema(c, period), e2 = ema(e1, period); setTrendFromMA(e1.map((_, i) => 2 * e1[i] - e2[i])); break; }
    case 'tema': { const e1 = ema(c, period), e2 = ema(e1, period), e3 = ema(e2, period); setTrendFromMA(e1.map((_, i) => 3 * e1[i] - 3 * e2[i] + e3[i])); break; }
    case 'roc': { const r = roc(c, period); for (let i = 0; i < n; i++) if (!isNaN(r[i])) { trend[i] = Math.sign(r[i]); osc[i] = Math.max(0, Math.min(100, 50 + r[i] * 5)); } break; }
    case 'supertrend': { const a = atr(bars, period); let dir = 1, up = 0, dn = 0; for (let i = 1; i < n; i++) { const hl2 = (bars[i].h + bars[i].l) / 2; const bu = hl2 + 3 * (a[i] || 0), bd = hl2 - 3 * (a[i] || 0); if (c[i] > up) dir = 1; else if (c[i] < dn) dir = -1; up = bu; dn = bd; trend[i] = dir; osc[i] = 50 + dir * 25; } break; }
    case 'keltner': case 'envelopes': { const m = ema(c, period); const a = atr(bars, period); for (let i = 0; i < n; i++) if (!isNaN(m[i])) { trend[i] = Math.sign(c[i] - m[i]); const up = m[i] + 2 * (a[i] || 0), lo = m[i] - 2 * (a[i] || 0); osc[i] = up > lo ? ((c[i] - lo) / (up - lo)) * 100 : 50; } break; }
    case 'donchian': { for (let i = period; i < n; i++) { let hh = -1e9, ll = 1e9; for (let j = i - period; j < i; j++) { hh = Math.max(hh, bars[j].h); ll = Math.min(ll, bars[j].l); } const mid = (hh + ll) / 2; trend[i] = Math.sign(c[i] - mid); osc[i] = hh > ll ? ((c[i] - ll) / (hh - ll)) * 100 : 50; } break; }
    case 'mfi': { const tp = bars.map((b) => (b.h + b.l + b.c) / 3); for (let i = period; i < n; i++) { let pos = 0, neg = 0; for (let j = i - period + 1; j <= i; j++) { const rmf = tp[j] * (bars[j].h - bars[j].l + 1e-9); if (tp[j] > tp[j - 1]) pos += rmf; else neg += rmf; } const mr = neg ? pos / neg : 99; osc[i] = 100 - 100 / (1 + mr); trend[i] = Math.sign(osc[i] - 50); } break; }
    case 'aroon': { for (let i = period; i < n; i++) { let hi = 0, lo = 0, hv = -1e9, lv = 1e9; for (let j = 0; j <= period; j++) { const b2 = bars[i - j]; if (b2.h > hv) { hv = b2.h; hi = j; } if (b2.l < lv) { lv = b2.l; lo = j; } } const au = ((period - hi) / period) * 100, ad = ((period - lo) / period) * 100; osc[i] = au; trend[i] = Math.sign(au - ad); } break; }
    case 'obv': { let ob = 0; const arr = new Array(n).fill(0); for (let i = 1; i < n; i++) { ob += Math.sign(c[i] - c[i - 1]) * (bars[i].h - bars[i].l); arr[i] = ob; } const e = ema(arr, period); for (let i = 0; i < n; i++) if (!isNaN(e[i])) trend[i] = Math.sign(arr[i] - e[i]); break; }
    case 'cmf': { for (let i = period; i < n; i++) { let mfv = 0, vol = 0; for (let j = i - period + 1; j <= i; j++) { const rng = bars[j].h - bars[j].l || 1e-9; const m2 = ((bars[j].c - bars[j].l) - (bars[j].h - bars[j].c)) / rng; const v2 = rng; mfv += m2 * v2; vol += v2; } const cm = vol ? mfv / vol : 0; osc[i] = Math.max(0, Math.min(100, 50 + cm * 50)); trend[i] = Math.sign(cm); } break; }
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

  // Filtro opcional (tendencia/volatilidad).
  const closes = bars.map((b) => b.c);
  const ema200 = spec.filter === 'trend' ? ema(closes, 200) : null;
  // Precálculo para squeeze_break (evita O(n²)).
  const needSqueeze = spec.entry === 'squeeze_break';
  const sdev20 = needSqueeze ? stdev(closes, 20) : null;
  const sdevMed = needSqueeze && sdev20 ? median(sdev20.filter((x) => !isNaN(x))) : 0;
  const atrMed = spec.filter === 'volhigh' || spec.filter === 'vollow' ? median(atrArr.filter((x) => !isNaN(x))) : 0;
  function filterOk(i: number, dir: 1 | -1): boolean {
    if (!spec.filter || spec.filter === 'none') return true;
    if (spec.filter === 'trend' && ema200) { if (isNaN(ema200[i])) return true; return dir === 1 ? closes[i] > ema200[i] : closes[i] < ema200[i]; }
    if (spec.filter === 'volhigh') return (atrArr[i] || 0) >= atrMed;
    if (spec.filter === 'vollow') return (atrArr[i] || 0) <= atrMed;
    return true;
  }

  // Series para reglas personalizadas de Claude (indicadores extra bajo demanda).
  const custMap: Record<string, { trend: number[]; osc: number[] }> = {};
  if (spec.customEntry && spec.customEntry.conds) { for (const c of spec.customEntry.conds) { if (!custMap[c.ind]) custMap[c.ind] = c.ind === spec.ind1 ? s1 : series(c.ind, bars, defPeriod(c.ind)); } }
  function evalCustom(i: number): 'long' | 'short' | 'none' {
    const r = spec.customEntry!; if (i < 2) return 'none';
    for (const c of r.conds) {
      const ser = custMap[c.ind]; if (!ser) return 'none';
      const v = c.field === 'trend' ? ser.trend[i] : ser.osc[i];
      const vp = c.field === 'trend' ? ser.trend[i - 1] : ser.osc[i - 1];
      let ok = false;
      if (c.op === 'gt') ok = v > c.level; else if (c.op === 'lt') ok = v < c.level;
      else if (c.op === 'cross_up') ok = v > c.level && vp <= c.level; else if (c.op === 'cross_dn') ok = v < c.level && vp >= c.level;
      if (!ok) return 'none';
    }
    return r.dir;
  }

  function entryAt(i: number): 'long' | 'short' | 'none' {
    const t = s1.trend, o = s1.osc; if (i < 30) return 'none';
    let sig: 'long' | 'short' | 'none' = 'none';
    if (spec.customEntry && spec.customEntry.conds?.length) { sig = evalCustom(i); }
    else switch (spec.entry) {
      case 'cross_up': sig = t[i] === 1 && t[i - 1] <= 0 ? 'long' : 'none'; break;
      case 'cross_dn': sig = t[i] === -1 && t[i - 1] >= 0 ? 'short' : 'none'; break;
      case 'above': sig = t[i] === 1 ? 'long' : 'none'; break;
      case 'below': sig = t[i] === -1 ? 'short' : 'none'; break;
      case 'oversold': sig = o[i] < 30 ? 'long' : 'none'; break;
      case 'overbought': sig = o[i] > 70 ? 'short' : 'none'; break;
      case 'breakout': { let hh = -1e9, ll = 1e9; for (let j = i - 20; j < i; j++) { hh = Math.max(hh, bars[j].h); ll = Math.min(ll, bars[j].l); } sig = bars[i].c > hh ? 'long' : bars[i].c < ll ? 'short' : 'none'; break; }
      case 'pullback': sig = t[i] === 1 && o[i] < 45 ? 'long' : t[i] === -1 && o[i] > 55 ? 'short' : 'none'; break;
      case 'divergence': sig = o[i] > 50 && o[i - 1] <= 50 ? 'long' : o[i] < 50 && o[i - 1] >= 50 ? 'short' : 'none'; break;
      case 'strong_up': sig = t[i] === 1 && o[i] > 55 ? 'long' : 'none'; break;
      case 'strong_dn': sig = t[i] === -1 && o[i] < 45 ? 'short' : 'none'; break;
      case 'hh': { let hh = -1e9; for (let j = i - 10; j < i; j++) hh = Math.max(hh, bars[j].h); sig = bars[i].c > hh ? 'long' : 'none'; break; }
      case 'll': { let ll = 1e9; for (let j = i - 10; j < i; j++) ll = Math.min(ll, bars[j].l); sig = bars[i].c < ll ? 'short' : 'none'; break; }
      case 'ma_slope_up': sig = t[i] === 1 && t[i - 1] === 1 && s1.osc[i] >= s1.osc[i - 1] ? 'long' : 'none'; break;
      case 'ma_slope_dn': sig = t[i] === -1 && t[i - 1] === -1 && s1.osc[i] <= s1.osc[i - 1] ? 'short' : 'none'; break;
      case 'mid_cross_up': sig = o[i] > 50 && o[i - 1] <= 50 ? 'long' : 'none'; break;
      case 'mid_cross_dn': sig = o[i] < 50 && o[i - 1] >= 50 ? 'short' : 'none'; break;
      case 'revert_band': sig = o[i] < 15 ? 'long' : o[i] > 85 ? 'short' : 'none'; break;
      case 'squeeze_break': { if (sdev20 && i > 1 && sdev20[i - 1] < sdevMed * 0.7) { let hh = -1e9, ll = 1e9; for (let j = i - 10; j < i; j++) { hh = Math.max(hh, bars[j].h); ll = Math.min(ll, bars[j].l); } sig = bars[i].c > hh ? 'long' : bars[i].c < ll ? 'short' : 'none'; } break; }
    }
    if (sig === 'none') return 'none';
    if (spec.dir === 'long' && sig === 'short') return 'none';
    if (spec.dir === 'short' && sig === 'long') return 'none';
    if (s2) { const tb = s2.trend[i]; if (sig === 'long' && tb < 0) return 'none'; if (sig === 'short' && tb > 0) return 'none'; }
    return sig;
  }

  const trades: { t: number; profit: number }[] = [];
  // La posición sostiene 1..N "patas" (legs) para permitir PIRÁMIDE (añadir a favor).
  type Leg = { entry: number; lot: number };
  let pos: null | { dir: 1 | -1; sl: number; tp: number; bars: number; atrPips: number; be: boolean; legs: Leg[]; lastAdd: number } = null;
  const costPips = costs.spreadPips + 2 * costs.slippagePips;
  // Gestión monetaria: capital inicial y equity para el % de riesgo compuesto.
  const capital = costs.capital && costs.capital > 0 ? costs.capital : 10000;
  let equity = capital, peakEq = capital, blown = false;
  const ddType = costs.ddType || 'none';
  const maxDDpct = costs.maxDDpct || 0;
  const mm = costs.mm || 'fixed';
  const pyramidMax = Math.max(0, Math.floor(costs.pyramid || 0));   // añadidos a favor permitidos
  // ATR de sizing: para 'risk_atr' el stop se deriva de la volatilidad.
  const atrMult = costs.atrMult && costs.atrMult > 0 ? costs.atrMult : 1.5;
  function lotFor(slPipsAtEntry: number): number {
    if (mm === 'fixed' || slPipsAtEntry <= 0 || costs.moneyPerPip <= 0) return costs.lot || 1;
    // % sobre equity (risk_pct y risk_atr componen sobre el equity vivo; anti-martingala: sube tras ganar, baja tras perder).
    const risk = mm === 'risk_money' ? (costs.riskMoney || 100) : equity * ((costs.riskPct || 1) / 100);
    const lot = risk / (slPipsAtEntry * costs.moneyPerPip);
    return Math.max(0.01, Math.min(lot, 1000));
  }
  // Reglas de reto prop firm (opcional).
  const chTarget = costs.chTarget || 0, chDailyLoss = costs.chDailyLoss || 0, chMinDays = costs.chMinDays || 0;
  const chOn = chTarget > 0 || chDailyLoss > 0 || chMinDays > 0;
  const dayKey = (t: number) => Math.floor(t / 86400000);
  const dayPnl: Record<number, number> = {}; const daySet = new Set<number>();
  let hitTarget = false, dailyBreach = false;
  // Opciones de trading finas.
  const maxTradesDay = Math.max(0, Math.floor(costs.maxTradesDay || 0));
  const hourFrom = costs.hourFrom ?? -1, hourTo = costs.hourTo ?? -1;
  const hourLimited = hourFrom >= 0 && hourTo >= 0;
  const exitFri = !!costs.exitFri, friHour = costs.friHour ?? 21;
  const slMin = costs.slMin || 0, slMax = costs.slMax || 0, tpMin = costs.tpMin || 0, tpMax = costs.tpMax || 0;
  const opensToday: Record<number, number> = {};      // nº de aperturas por día
  const inHours = (h: number) => !hourLimited || (hourFrom <= hourTo ? h >= hourFrom && h < hourTo : h >= hourFrom || h < hourTo);
  const clampPips = (v: number, lo: number, hi: number) => { let r = v; if (lo > 0) r = Math.max(r, lo); if (hi > 0) r = Math.min(r, hi); return r; };

  const avgEntry = (p: { legs: Leg[] }) => { let w = 0, s = 0; for (const l of p.legs) { w += l.lot; s += l.entry * l.lot; } return w ? s / w : p.legs[0].entry; };
  const totLot = (p: { legs: Leg[] }) => p.legs.reduce((a, l) => a + l.lot, 0);
  for (let i = 31; i < n; i++) {
    const b = bars[i];
    if (pos) {
      // Gestión intrabar (conservador: primero SL).
      let exitPrice = NaN;
      if (pos.dir === 1) { if (b.l <= pos.sl) exitPrice = pos.sl; else if (b.h >= pos.tp) exitPrice = pos.tp; }
      else { if (b.h >= pos.sl) exitPrice = pos.sl; else if (b.l <= pos.tp) exitPrice = pos.tp; }
      const ae = avgEntry(pos);
      // Break-even (respecto al precio medio de entrada).
      if (isNaN(exitPrice) && spec.be !== 'off' && !pos.be) {
        const bePips = pips(spec.be === 'be_atr' ? 'atr1' : spec.be.replace('be', ''), pos.atrPips);
        const prog = pos.dir === 1 ? (b.h - ae) / pip : (ae - b.l) / pip;
        if (prog >= bePips) { pos.sl = pos.dir === 1 ? ae + pip : ae - pip; pos.be = true; }
      }
      // Trailing.
      if (isNaN(exitPrice) && spec.trailing !== 'off') {
        const trPips = pips(spec.trailing === 't_atr' ? 'atr1' : spec.trailing.replace('t', ''), pos.atrPips);
        if (pos.dir === 1) { const ns = b.h - trPips * pip; if (ns > pos.sl) pos.sl = ns; } else { const ns = b.l + trPips * pip; if (ns < pos.sl) pos.sl = ns; }
      }
      // Salidas por señal / indicador / tiempo.
      let flip: 'long' | 'short' | 'none' = 'none';
      if (isNaN(exitPrice)) {
        pos.bars++;
        flip = entryAt(i);
        if (spec.exit === 'opp_signal' && ((pos.dir === 1 && flip === 'short') || (pos.dir === -1 && flip === 'long'))) exitPrice = b.c;
        else if (spec.exit === 'indicator' && s1.trend[i] === -pos.dir) exitPrice = b.c;
        else if (spec.exit === 'time' && pos.bars >= 24) exitPrice = b.c;
        // Cerrar el viernes a la hora indicada (evita riesgo de fin de semana).
        if (isNaN(exitPrice) && exitFri) { const dd = new Date(b.t); if (dd.getUTCDay() === 5 && dd.getUTCHours() >= friHour) exitPrice = b.c; }
      }
      // PIRÁMIDE: si sigue abierta y hay señal a favor y el precio avanzó ≥0.5·ATR desde el último añadido.
      if (isNaN(exitPrice) && pyramidMax > 0 && pos.legs.length <= pyramidMax) {
        const same = (pos.dir === 1 && flip === 'long') || (pos.dir === -1 && flip === 'short');
        const advPips = pos.dir === 1 ? (b.c - pos.lastAdd) / pip : (pos.lastAdd - b.c) / pip;
        if (same && filterOk(i, pos.dir) && advPips >= pos.atrPips * 0.5) {
          const slP = mm === 'risk_atr' ? atrMult * pos.atrPips : (pips(spec.sl, pos.atrPips) || 30);
          const addEntry = b.c + pos.dir * costs.slippagePips * pip;
          pos.legs.push({ entry: addEntry, lot: lotFor(slP) });
          pos.lastAdd = b.c;
        }
      }
      if (!isNaN(exitPrice)) {
        const lot = totLot(pos);
        const rawPips = ((exitPrice - ae) / pip) * pos.dir;
        const money = (rawPips - costPips) * costs.moneyPerPip * lot - costs.commission * lot * 2;
        equity += money;
        if (equity > peakEq) peakEq = equity;
        trades.push({ t: b.t, profit: Math.round(money * 100) / 100, dir: pos.dir });
        if (chOn) { dayPnl[dayKey(b.t)] = (dayPnl[dayKey(b.t)] || 0) + money; daySet.add(dayKey(b.t)); }
        pos = null;
        // Reto prop firm: objetivo alcanzado / pérdida diaria excedida.
        if (chOn) {
          if (chTarget > 0 && equity - capital >= capital * (chTarget / 100)) hitTarget = true;
          if (chDailyLoss > 0 && (dayPnl[dayKey(b.t)] || 0) <= -capital * (chDailyLoss / 100)) dailyBreach = true;
        }
        // Límite de drawdown (estático desde el balance inicial / trailing desde el pico): revienta la cuenta.
        if (ddType !== 'none' && maxDDpct > 0) {
          const floor = ddType === 'trailing' ? peakEq * (1 - maxDDpct / 100) : capital * (1 - maxDDpct / 100);
          if (equity <= floor) { blown = true; break; }
        }
      }
    }
    if (!pos) {
      const h = new Date(b.t).getUTCHours();
      if (!sessOk(h)) continue;
      if (!inHours(h)) continue;                          // límite horario opcional
      const dk = dayKey(b.t);
      if (maxTradesDay > 0 && (opensToday[dk] || 0) >= maxTradesDay) continue; // tope de operaciones por día
      const sig = entryAt(i);
      if (sig === 'none') continue;
      const dir = sig === 'long' ? 1 : -1;
      if (!filterOk(i, dir)) continue;
      const atrPips = atrArr[i] ? atrArr[i] / pip : 20;
      // Para risk_atr el stop se deriva de la volatilidad (atrMult·ATR); si no, del spec. Se acota a mín/máx.
      let slP = mm === 'risk_atr' ? atrMult * atrPips : (pips(spec.sl, atrPips) || 30);
      let tpP = pips(spec.tp, atrPips) || 40;
      slP = clampPips(slP, slMin, slMax); tpP = clampPips(tpP, tpMin, tpMax);
      opensToday[dk] = (opensToday[dk] || 0) + 1;
      const entry = b.c + dir * costs.slippagePips * pip;
      pos = { dir, tp: entry + dir * tpP * pip, sl: entry - dir * slP * pip, bars: 0, atrPips, be: false, legs: [{ entry, lot: lotFor(slP) }], lastAdd: b.c };
    }
  }

  // Métricas (equity parte del balance inicial; DD% respecto al pico de equity).
  let gp = 0, gl = 0, wins = 0, net = 0, cum = capital, peak2 = capital, dd = 0;
  for (const t of trades) { net += t.profit; if (t.profit >= 0) { gp += t.profit; if (t.profit > 0) wins++; } else gl += -t.profit; cum += t.profit; if (cum > peak2) peak2 = cum; dd = Math.max(dd, peak2 - cum); }
  const N = trades.length;
  // Veredicto del reto prop firm (si hay reglas activas).
  let challenge: Challenge | undefined;
  if (chOn) {
    const profitPct = Math.round(((equity - capital) / capital) * 1000) / 10;
    const daysTraded = daySet.size;
    const pass = !blown && !dailyBreach && (chTarget <= 0 || hitTarget) && (chMinDays <= 0 || daysTraded >= chMinDays);
    challenge = { target: chTarget, dailyLoss: chDailyLoss, minDays: chMinDays, profitPct, daysTraded, hitTarget, dailyBreach, pass };
  }
  return {
    trades, n: N, net: Math.round(net),
    pf: gl > 0 ? Math.round((gp / gl) * 100) / 100 : (gp > 0 ? 99 : 0),
    winRate: N ? Math.round((wins / N) * 100) : 0,
    maxddPct: peak2 > 0 ? Math.round((dd / peak2) * 1000) / 10 : 0,
    expectancy: N ? Math.round((net / N) * 100) / 100 : 0,
    blown, finalEquity: Math.round(equity), challenge,
  };
}

export function defPeriod(id: string): number {
  const m: Record<string, number> = {
    ema: 20, sma: 20, rsi: 14, macd: 12, stoch: 14, bb: 20, atr: 14, adx: 14, cci: 20, mom: 10, ichimoku: 26, psar: 14, wpr: 14, vwap: 20,
    wma: 20, hma: 21, dema: 20, tema: 20, roc: 12, supertrend: 10, keltner: 20, envelopes: 20, donchian: 20, mfi: 14, aroon: 25, obv: 20, cmf: 20, dmi: 14,
  };
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
