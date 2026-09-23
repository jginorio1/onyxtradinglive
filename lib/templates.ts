import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BLOCKS, computeSpace, type GenConfig } from '@/lib/stratgen';

// ============================================================
// Onyx Bot Factory · Biblioteca de plantillas (estilo StrategyQuant, mejorado)
//  · Una plantilla = preset con nombre · instrumento · temporalidad · bloques
//    (GenConfig) · costos · filtros. Reutilizable en el generador.
//  · Trae unas preconfiguradas de fábrica + las que crees (a mano o con Claude).
// ============================================================

export type Template = {
  id: string; name: string; symbol: string; timeframe: string; family?: string;
  config: GenConfig; costs?: any; filters?: any; notes?: string;
  origin?: 'preset' | 'custom' | 'ai'; ai_rationale?: string;
};

const DEF_COSTS = { spreadPips: 1.2, slippagePips: 0.3, commission: 3.5, moneyPerPip: 10, lot: 1 };
const DEF_FILTERS = { minPf: 1.2, maxDd: 25, minTr: 30 };

// Plantillas preconfiguradas de fábrica (read-only, siempre presentes).
export const PRESETS: Template[] = [
  {
    id: 'preset-xauusd-london', name: 'Oro · Ruptura de Londres', symbol: 'XAUUSD', timeframe: 'M15', family: 'ruptura', origin: 'preset',
    config: { indicators: ['ema', 'atr', 'adx'], entry: ['breakout', 'cross_up', 'cross_dn'], exit: ['opp_signal', 'fixed'], sessions: ['london', 'overlap'], tp: ['atr2', 'atr3', '60'], sl: ['atr15', 'atr1', '50'], be: ['off', 'be20'], trailing: ['t_atr', 't30'] },
    costs: { ...DEF_COSTS, spreadPips: 2.5, moneyPerPip: 10 }, filters: DEF_FILTERS,
    notes: 'Ruptura de rango en la apertura de Londres, salida por ATR con trailing.',
  },
  {
    id: 'preset-eurusd-ny-reversion', name: 'EURUSD · Reversión NY', symbol: 'EURUSD', timeframe: 'M5', family: 'reversion', origin: 'preset',
    config: { indicators: ['rsi', 'bb', 'vwap'], entry: ['oversold', 'overbought', 'pullback'], exit: ['opp_signal', 'indicator', 'fixed'], sessions: ['ny', 'overlap'], tp: ['40', '20', 'atr1'], sl: ['30', '15', 'atr1'], be: ['be10', 'off'], trailing: ['off', 't15'] },
    costs: { ...DEF_COSTS, spreadPips: 0.8 }, filters: { ...DEF_FILTERS, minTr: 50 },
    notes: 'Reversión a la media en la sesión de NY con RSI + Bollinger + VWAP.',
  },
  {
    id: 'preset-us30-trend-h1', name: 'US30 · Tendencia H1', symbol: 'US30', timeframe: 'H1', family: 'tendencia', origin: 'preset',
    config: { indicators: ['ema', 'macd', 'adx'], entry: ['cross_up', 'cross_dn', 'above', 'below'], exit: ['opp_signal', 'indicator'], sessions: ['ny', 'all'], tp: ['atr3', '100'], sl: ['atr2', '80'], be: ['be_atr', 'off'], trailing: ['t_atr', 'off'] },
    costs: { ...DEF_COSTS, spreadPips: 2, moneyPerPip: 1 }, filters: { ...DEF_FILTERS, minTr: 20 },
    notes: 'Seguimiento de tendencia en índices con EMA + MACD filtrado por ADX.',
  },
  {
    id: 'preset-gbpjpy-vol-m30', name: 'GBPJPY · Volatilidad M30', symbol: 'GBPJPY', timeframe: 'M30', family: 'volatilidad', origin: 'preset',
    config: { indicators: ['atr', 'bb', 'psar'], entry: ['breakout', 'pullback', 'above'], exit: ['fixed', 'opp_signal'], sessions: ['london', 'tokyo', 'overlap'], tp: ['atr2', '60', '100'], sl: ['atr15', '50'], be: ['be20', 'off'], trailing: ['t30', 't_atr'] },
    costs: { ...DEF_COSTS, spreadPips: 2.2 }, filters: DEF_FILTERS,
    notes: 'Expansión de volatilidad en cruces yen con ATR + Bollinger + SAR.',
  },
];

function normalizeConfig(cfg: any): GenConfig {
  const out: GenConfig = {};
  const valid = new Map(BLOCKS.map((b) => [b.key, new Set(b.opts.map((o) => o.id))]));
  for (const b of BLOCKS) {
    const arr = Array.isArray(cfg?.[b.key]) ? cfg[b.key] : [];
    const set = valid.get(b.key)!;
    const clean = arr.map((x: any) => String(x)).filter((x: string) => set.has(x));
    if (clean.length) out[b.key] = Array.from(new Set(clean));
  }
  return out;
}

export function templateSpace(t: Template): number { return computeSpace(t.config || {}); }

// Catálogo de bloques (para pasarle a Claude los ids válidos).
export function blockCatalog(): { key: string; ids: string[] }[] {
  return BLOCKS.map((b) => ({ key: b.key, ids: b.opts.map((o) => o.id) }));
}

// Plantilla heurística de respaldo (sin IA): un set razonable por familia.
export function heuristicTemplate(symbol: string, timeframe: string, family: string): { name: string; family: string; config: GenConfig; rationale: string } {
  const F = family || 'tendencia';
  const byFamily: Record<string, GenConfig> = {
    tendencia: { indicators: ['ema', 'macd', 'adx'], entry: ['cross_up', 'cross_dn', 'above', 'below'], exit: ['opp_signal', 'indicator'], sessions: ['london', 'ny', 'overlap'], tp: ['atr3', '100'], sl: ['atr2', '80'], be: ['be_atr', 'off'], trailing: ['t_atr', 'off'] },
    rango: { indicators: ['rsi', 'bb', 'stoch'], entry: ['oversold', 'overbought'], exit: ['opp_signal', 'fixed'], sessions: ['ny', 'all'], tp: ['40', 'atr1'], sl: ['30', 'atr1'], be: ['off', 'be10'], trailing: ['off'] },
    ruptura: { indicators: ['atr', 'ema', 'adx'], entry: ['breakout', 'cross_up', 'cross_dn'], exit: ['opp_signal', 'fixed'], sessions: ['london', 'overlap'], tp: ['atr2', 'atr3', '60'], sl: ['atr15', '50'], be: ['off', 'be20'], trailing: ['t_atr', 't30'] },
    reversion: { indicators: ['rsi', 'bb', 'vwap'], entry: ['oversold', 'overbought', 'pullback'], exit: ['opp_signal', 'indicator', 'fixed'], sessions: ['ny', 'overlap'], tp: ['40', 'atr1'], sl: ['30', 'atr1'], be: ['be10', 'off'], trailing: ['off', 't15'] },
    volatilidad: { indicators: ['atr', 'bb', 'psar'], entry: ['breakout', 'pullback'], exit: ['fixed', 'opp_signal'], sessions: ['london', 'tokyo', 'overlap'], tp: ['atr2', '100'], sl: ['atr15', '50'], be: ['be20', 'off'], trailing: ['t30', 't_atr'] },
    scalping: { indicators: ['ema', 'stoch', 'vwap'], entry: ['cross_up', 'cross_dn', 'pullback'], exit: ['fixed', 'opp_signal'], sessions: ['london', 'ny', 'overlap'], tp: ['20', '40'], sl: ['15', '30'], be: ['be10'], trailing: ['t15'] },
  };
  return {
    name: `${symbol} · ${timeframe} · ${F}`,
    family: F,
    config: byFamily[F] || byFamily.tendencia,
    rationale: 'Plantilla base por familia (sin IA). Conecta ANTHROPIC_API_KEY para que Claude la ajuste a tus datos.',
  };
}

export async function listTemplates(): Promise<Template[]> {
  let rows: any[] = [];
  try { const { data } = await supabaseAdmin.from('factory_templates').select('*').order('created_at', { ascending: false }); rows = data || []; } catch { rows = []; }
  const custom: Template[] = rows.map((r) => ({
    id: r.id, name: r.name, symbol: r.symbol, timeframe: r.timeframe, family: r.family,
    config: r.config || {}, costs: r.costs || DEF_COSTS, filters: r.filters || DEF_FILTERS,
    notes: r.notes, origin: r.origin || 'custom', ai_rationale: r.ai_rationale,
  }));
  // Presets primero, luego lo tuyo.
  return [...PRESETS, ...custom];
}

export async function saveTemplate(o: { userId: string; id?: string; name: string; symbol: string; timeframe: string; family?: string; config: any; costs?: any; filters?: any; notes?: string; origin?: string; aiRationale?: string }) {
  const row: any = {
    name: (o.name || 'Plantilla').slice(0, 80), symbol: (o.symbol || '').slice(0, 30) || null,
    timeframe: (o.timeframe || '').slice(0, 12) || null, family: (o.family || '').slice(0, 30) || null,
    config: normalizeConfig(o.config), costs: o.costs || DEF_COSTS, filters: o.filters || DEF_FILTERS,
    notes: (o.notes || '').slice(0, 400) || null, origin: o.origin === 'ai' ? 'ai' : 'custom',
    ai_rationale: (o.aiRationale || '').slice(0, 1000) || null, updated_at: new Date().toISOString(),
  };
  if (o.id && !o.id.startsWith('preset-')) {
    const { data, error } = await supabaseAdmin.from('factory_templates').update(row).eq('id', o.id).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabaseAdmin.from('factory_templates').insert({ ...row, created_by: o.userId }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTemplate(id: string) {
  if (id.startsWith('preset-')) throw new Error('Las plantillas de fábrica no se pueden borrar.');
  await supabaseAdmin.from('factory_templates').delete().eq('id', id);
  return { ok: true };
}
