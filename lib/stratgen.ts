// ============================================================
// Onyx Bot Factory · Fase 4B — Generador de estrategias (StrategyQuant-style)
// Módulo PURO (sin Supabase) para poder usarlo en cliente y servidor.
// Define el espacio de estrategias (indicadores, reglas, sesiones/horarios,
// entrada/salida, TP, break-even, SL, trailing), calcula cuántas combinaciones
// hay y muestrea candidatos. La evaluación real se hace con backtest en MT y
// luego pasa por el embudo de robustez del laboratorio.
// ============================================================

export type Opt = { id: string; es: string; en: string };
export type Block = { key: string; es: string; en: string; multi: boolean; opts: Opt[]; note?: string };

const O = (id: string, es: string, en?: string): Opt => ({ id, es, en: en || es });

export const BLOCKS: Block[] = [
  { key: 'indicators', es: 'Indicadores', en: 'Indicators', multi: true, note: 'El generador combina hasta 2–3 por estrategia.', opts: [
    O('ema', 'EMA'), O('sma', 'SMA'), O('wma', 'WMA'), O('hma', 'Hull MA', 'Hull MA'), O('dema', 'DEMA'), O('tema', 'TEMA'),
    O('rsi', 'RSI'), O('macd', 'MACD'), O('stoch', 'Estocástico', 'Stochastic'), O('cci', 'CCI'), O('wpr', 'Williams %R'), O('mfi', 'MFI'), O('mom', 'Momentum'), O('roc', 'ROC'),
    O('bb', 'Bollinger'), O('keltner', 'Keltner'), O('donchian', 'Donchian'), O('envelopes', 'Envelopes'), O('atr', 'ATR'),
    O('adx', 'ADX'), O('dmi', 'DMI'), O('aroon', 'Aroon'), O('supertrend', 'SuperTrend'), O('psar', 'Parabolic SAR'), O('ichimoku', 'Ichimoku'),
    O('obv', 'OBV'), O('cmf', 'CMF'), O('vwap', 'VWAP'),
  ] },
  { key: 'entry', es: 'Reglas de entrada', en: 'Entry rules', multi: true, opts: [
    O('cross_up', 'Cruce al alza', 'Cross up'), O('cross_dn', 'Cruce a la baja', 'Cross down'),
    O('above', 'Precio por encima', 'Price above'), O('below', 'Precio por debajo', 'Price below'),
    O('oversold', 'Sobreventa', 'Oversold'), O('overbought', 'Sobrecompra', 'Overbought'),
    O('breakout', 'Ruptura', 'Breakout'), O('pullback', 'Pullback'), O('divergence', 'Divergencia', 'Divergence'),
    O('strong_up', 'Tendencia fuerte ↑', 'Strong trend up'), O('strong_dn', 'Tendencia fuerte ↓', 'Strong trend down'),
    O('hh', 'Máximo más alto', 'Higher high'), O('ll', 'Mínimo más bajo', 'Lower low'),
    O('ma_slope_up', 'Pendiente MA ↑', 'MA slope up'), O('ma_slope_dn', 'Pendiente MA ↓', 'MA slope down'),
    O('mid_cross_up', 'Cruce del 50 ↑', 'Mid cross up'), O('mid_cross_dn', 'Cruce del 50 ↓', 'Mid cross down'),
    O('revert_band', 'Reversión extrema', 'Extreme reversion'), O('squeeze_break', 'Ruptura de compresión', 'Squeeze breakout'),
  ] },
  { key: 'exit', es: 'Salidas', en: 'Exits', multi: true, opts: [
    O('opp_signal', 'Señal opuesta', 'Opposite signal'), O('fixed', 'TP/SL fijo', 'Fixed TP/SL'),
    O('time', 'Por tiempo', 'Time-based'), O('indicator', 'Por indicador', 'Indicator exit'),
  ] },
  { key: 'filter', es: 'Filtro', en: 'Filter', multi: true, note: 'Condición extra que debe cumplirse para operar.', opts: [
    O('none', 'Sin filtro', 'No filter'), O('trend', 'Solo con la tendencia (EMA200)', 'Only with trend (EMA200)'),
    O('volhigh', 'Solo alta volatilidad', 'Only high volatility'), O('vollow', 'Solo baja volatilidad', 'Only low volatility'),
  ] },
  { key: 'sessions', es: 'Sesiones', en: 'Sessions', multi: true, opts: [
    O('sydney', 'Sídney', 'Sydney'), O('tokyo', 'Tokio', 'Tokyo'), O('london', 'Londres', 'London'),
    O('ny', 'Nueva York', 'New York'), O('overlap', 'Solape Londres-NY', 'London-NY overlap'), O('all', 'Todo el día', 'All day'),
  ] },
  { key: 'tp', es: 'Take Profit', en: 'Take Profit', multi: true, opts: [
    O('20', '20 pips'), O('30', '30 pips'), O('40', '40 pips'), O('60', '60 pips'), O('80', '80 pips'), O('100', '100 pips'), O('150', '150 pips'), O('200', '200 pips'),
    O('atr1', '1× ATR'), O('atr15', '1.5× ATR'), O('atr2', '2× ATR'), O('atr3', '3× ATR'),
  ] },
  { key: 'sl', es: 'Stop Loss', en: 'Stop Loss', multi: true, opts: [
    O('15', '15 pips'), O('20', '20 pips'), O('30', '30 pips'), O('50', '50 pips'), O('80', '80 pips'), O('100', '100 pips'),
    O('atr1', '1× ATR'), O('atr15', '1.5× ATR'), O('atr2', '2× ATR'),
  ] },
  { key: 'be', es: 'Break-even', en: 'Break-even', multi: true, opts: [
    O('off', 'Sin BE', 'No BE'), O('be10', 'BE a +10 pips'), O('be20', 'BE a +20 pips'), O('be30', 'BE a +30 pips'), O('be_atr', 'BE a 1× ATR'),
  ] },
  { key: 'trailing', es: 'Trailing stop', en: 'Trailing stop', multi: true, opts: [
    O('off', 'Sin trailing', 'No trailing'), O('t15', 'Trailing 15 pips'), O('t20', 'Trailing 20 pips'), O('t30', 'Trailing 30 pips'), O('t50', 'Trailing 50 pips'), O('t_atr', 'Trailing 1× ATR'),
  ] },
];

export type GenConfig = Record<string, string[]>; // key → ids elegidos

// Adjunta la regla DSL a una spec si su entrada es un bloque personalizado (Claude).
// `blockMap` mapea block_id → { conds, dir } (regla ejecutable por el motor).
export function enrichSpec(spec: any, blockMap: Record<string, any>): any {
  if (spec && spec.entry && blockMap && blockMap[spec.entry]) return { ...spec, customEntry: blockMap[spec.entry] };
  return spec;
}

// Cuántas combinaciones distintas produce la configuración (producto de opciones).
// Para indicadores cuenta pares (2 indicadores) para acercarse a lo real.
export function computeSpace(cfg: GenConfig): number {
  let total = 1;
  for (const b of BLOCKS) {
    const chosen = (cfg[b.key] || []).length;
    if (!chosen) continue;
    if (b.key === 'indicators') {
      // pares de indicadores (combinaciones de 2) + individuales
      const pairs = chosen >= 2 ? (chosen * (chosen - 1)) / 2 : chosen;
      total *= Math.max(1, pairs);
    } else total *= chosen;
  }
  return total;
}

function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Muestrea n candidatos únicos del espacio. Cada candidato es un objeto con una
// opción por bloque (dos indicadores). Determinista con semilla.
export function sampleCandidates(cfg: GenConfig, n: number, seed = 12345): Record<string, any>[] {
  const rng = mulberry32(seed);
  const pick = (arr: string[]) => arr[Math.floor(rng() * arr.length)];
  const inds = cfg.indicators || [];
  const out: Record<string, any>[] = [];
  const seen = new Set<string>();
  const cap = Math.min(n, 20000);
  let guard = 0;
  while (out.length < cap && guard < cap * 20) {
    guard++;
    const c: Record<string, any> = {};
    if (inds.length >= 2) { let a = pick(inds), b = pick(inds); if (a === b) continue; c.ind1 = a; c.ind2 = b; }
    else if (inds.length === 1) c.ind1 = inds[0];
    for (const bl of BLOCKS) { if (bl.key === 'indicators') continue; const arr = cfg[bl.key] || []; if (arr.length) c[bl.key] = pick(arr); }
    const key = JSON.stringify(c);
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
  }
  return out;
}

// Convierte los candidatos a CSV (una fila por estrategia) para MetaTrader / Excel.
export function candidatesToCsv(cands: Record<string, any>[]): string {
  const cols = ['id', 'ind1', 'ind2', 'entry', 'exit', 'sessions', 'tp', 'sl', 'be', 'trailing'];
  const head = cols.join(',');
  const rows = cands.map((c, i) => cols.map((k) => (k === 'id' ? `S${String(i + 1).padStart(5, '0')}` : (c[k] ?? ''))).join(','));
  return [head, ...rows].join('\n');
}
