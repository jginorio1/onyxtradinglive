// ============================================================
// Onyx Bot Factory · Claude en el laboratorio (Fase 2)
// Interpreta las métricas de robustez y sugiere mutaciones anti-overfit.
// Los NÚMEROS los calcula el motor (lib/robustness); Claude solo explica y
// aconseja. Si no hay ANTHROPIC_API_KEY, devuelve null y el laboratorio sigue.
// LÍNEA ROJA: nada de predecir el mercado ni prometer ganancias.
// ============================================================

async function aiJson(system: string, user: string, maxTokens = 800): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 6000) }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('factory', d)).catch(() => {});
    const text = (d?.content || []).map((c: any) => c.text || '').join('\n').trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { audit: text.slice(0, 900), mutations: [] };
    try { return JSON.parse(m[0]); } catch { return { audit: text.slice(0, 900), mutations: [] }; }
  } catch { return null; }
}

// Arquitecto de plantillas: Claude propone una configuración de bloques
// (GenConfig) para un instrumento/temporalidad, mirando las características de
// los datos (volatilidad, spread, sesiones). Si no hay API key, devuelve null y
// el llamador usa una plantilla heurística. Devuelve SOLO ids válidos de bloques.
export async function aiTemplate(input: {
  symbol: string; timeframe: string; family?: string; metrics?: any; blocks: { key: string; ids: string[] }[]; lang?: 'es' | 'en';
}): Promise<{ name: string; family: string; config: Record<string, string[]>; rationale: string } | null> {
  const L = input.lang === 'en' ? 'English' : 'Spanish';
  const allowed = input.blocks.map((b) => `${b.key}: [${b.ids.join(', ')}]`).join('\n');
  const system = `You are Onyx's quant template architect for an internal MT4/MT5 robot factory (StrategyQuant-style). Given an instrument, timeframe and its data characteristics, you design a STRATEGY TEMPLATE: which building blocks the generator should combine. You must choose ONLY from the allowed block ids listed. Pick a coherent set (2-3 indicators, matching entry/exit rules, sensible sessions for the instrument, and TP/SL/BE/trailing ranges). NEVER predict the market or promise profits. Reply ONLY with JSON: {"name":"<short template name in ${L}>","family":"<tendencia|rango|ruptura|reversion|volatilidad|scalping>","config":{"indicators":[...],"entry":[...],"exit":[...],"sessions":[...],"tp":[...],"sl":[...],"be":[...],"trailing":[...]},"rationale":"<2-4 sentences in ${L} explaining the choice>"}. Every id in config MUST be from the allowed lists.`;
  const payload = {
    symbol: input.symbol, timeframe: input.timeframe, requestedFamily: input.family || 'auto',
    dataCharacteristics: {
      years: input.metrics?.years, hasTicks: input.metrics?.hasTicks, avgSpreadPts: input.metrics?.spreadAvgPts,
      rows: input.metrics?.rows, fromYear: input.metrics?.fromMs ? new Date(input.metrics.fromMs).getUTCFullYear() : undefined,
      toYear: input.metrics?.toMs ? new Date(input.metrics.toMs).getUTCFullYear() : undefined,
    },
    allowedBlocks: allowed,
  };
  const res = await aiJson(system, JSON.stringify(payload), 900);
  if (!res || !res.config) return null;
  // Filtra a ids válidos.
  const valid = new Map(input.blocks.map((b) => [b.key, new Set(b.ids)]));
  const cfg: Record<string, string[]> = {};
  for (const b of input.blocks) {
    const arr = Array.isArray(res.config[b.key]) ? res.config[b.key] : [];
    const set = valid.get(b.key)!;
    const clean = arr.map((x: any) => String(x)).filter((x: string) => set.has(x));
    if (clean.length) cfg[b.key] = Array.from(new Set(clean));
  }
  return {
    name: String(res.name || `${input.symbol} ${input.timeframe}`).slice(0, 80),
    family: String(res.family || input.family || 'tendencia').slice(0, 30),
    config: cfg, rationale: String(res.rationale || '').slice(0, 1000),
  };
}

// Generador de bloques: Claude inventa reglas de entrada NUEVAS como condiciones
// sobre indicadores (DSL) que el motor ejecuta. Devuelve ids/etiquetas + DSL.
export async function aiBlocks(input: { intent: string; indicators: string[]; lang?: 'es' | 'en' }): Promise<{ es: string; en: string; dsl: any }[]> {
  const L = input.lang === 'en' ? 'English' : 'Spanish';
  const system = `You are Onyx's quant block designer for an internal MT4/MT5 robot factory (StrategyQuant-style). You invent NEW entry rules as conditions over indicators, that the backtest engine can execute. A rule is JSON: {"es":"<short name Spanish>","en":"<short name English>","dsl":{"conds":[{"ind":"<indicator id>","field":"osc"|"trend","op":"gt"|"lt"|"cross_up"|"cross_dn","level":<number>}],"dir":"long"|"short"}}. field "osc" is a 0..100 oscillator, "trend" is -1/0/1. Use ONLY these indicator ids: ${input.indicators.join(', ')}. 1-3 conditions per rule. NEVER predict the market or promise profits. Reply ONLY with JSON: {"blocks":[<up to 4 rules>]}.`;
  const user = JSON.stringify({ request: (input.intent || '').slice(0, 400), allowedIndicators: input.indicators, replyLanguageForNames: L });
  const res = await aiJson(system, user, 1000);
  if (!res || !Array.isArray(res.blocks)) return [];
  return res.blocks.slice(0, 4).map((b: any) => ({ es: String(b.es || b.en || 'Regla').slice(0, 60), en: String(b.en || b.es || 'Rule').slice(0, 60), dsl: b.dsl })).filter((b: any) => b.dsl && Array.isArray(b.dsl.conds));
}

export async function robustnessAudit(bot: any, r: any, lang: 'es' | 'en' = 'es'): Promise<{ audit: string; mutations: string[] } | null> {
  const L = lang === 'en' ? 'English' : 'Spanish';
  const system = `You are Onyx's quant auditor for an internal MT4/MT5 robot factory. You read robustness statistics of a trading strategy and judge whether it is over-optimized (curve-fit) or genuinely robust. Be blunt and specific. NEVER predict the market, give trade signals or promise profits. Reply ONLY with JSON: {"audit": "<3-5 sentence verdict in ${L}, plain language>", "mutations": ["<up to 4 concrete parameter/rule mutations to try that would reduce overfitting, each in ${L}>"]}. The mutations are ideas to backtest, not guarantees.`;
  const payload = {
    name: bot?.name, symbol: bot?.symbol, timeframe: bot?.timeframe, family: bot?.strategy?.family,
    trades: r.trades, net: r.net, profitFactor: r.pf, winRate: r.winRate, maxDrawdown: r.maxdd,
    inSamplePF: r.isPf, outOfSamplePF: r.oosPf, oosRetention: r.retention, walkForwardConsistency: r.wfoConsistency,
    monteCarloLossProbability: r.mc?.lossProb, monteCarloP95Drawdown: r.mc?.p95DD,
    sensitivityPlateau: r.sensitivity, paramCount: r.paramCount, robustnessScore: r.score, verdict: r.verdict, flags: r.flags,
  };
  const res = await aiJson(system, JSON.stringify(payload));
  if (!res) return null;
  const audit = String(res.audit || '').slice(0, 1200);
  const mutations = Array.isArray(res.mutations) ? res.mutations.map((x: any) => String(x).slice(0, 200)).slice(0, 4) : [];
  return { audit, mutations };
}

// ============================================================
// Resumen de la data para el panel: describe el dataset en lenguaje llano
// (rango, tipo, calidad, spread, aptitud). Si hay ANTHROPIC_API_KEY, Claude
// redacta; si no, se arma un resumen determinista con los mismos números.
// NUNCA predice el mercado ni promete resultados.
// ============================================================
export async function aiDatasetSummary(input: {
  symbol: string; timeframe?: string; source?: string; broker?: string;
  fromYear?: number; toYear?: number; years?: number; rows?: number;
  hasTicks?: boolean; spreadAvgPts?: number; qualityScore?: number; verdict?: string;
  lang?: 'es' | 'en';
}): Promise<{ summary: string; byAi: boolean }> {
  const es = input.lang !== 'en';
  // Resumen determinista (siempre disponible).
  const range = input.fromYear && input.toYear ? `${input.fromYear}–${input.toYear}` : '—';
  const kind = input.hasTicks ? (es ? 'ticks reales' : 'real ticks') : (es ? 'barras' : 'bars');
  const rowsTxt = (input.rows || 0).toLocaleString('en-US');
  const spreadTxt = input.hasTicks && input.spreadAvgPts != null ? `${Math.round(input.spreadAvgPts)} ${es ? 'pts' : 'pts'}` : (es ? 'n/d' : 'n/a');
  const fit = input.verdict === 'apta' ? (es ? 'apta para backtest' : 'fit for backtest') : input.verdict === 'reservas' ? (es ? 'apta con reservas' : 'fit with caveats') : (es ? 'con problemas' : 'has issues');
  const long = (input.years || 0) >= 4;
  const det = es
    ? `${input.symbol}${input.timeframe ? ' · ' + input.timeframe : ''} con ${kind}, cubre ${range} (${(input.years || 0).toFixed(1)} años, ${rowsTxt} filas). Fuente: ${input.source || 'n/d'}${input.broker ? ' · ' + input.broker : ''}. Spread medio ${spreadTxt}. Calidad ${input.qualityScore ?? '—'} — ${fit}. ${long ? 'Historial amplio: cubre varios regímenes de mercado, bueno para walk-forward y validación fuera de muestra.' : 'Historial corto: úsalo con cuidado, cubre pocos regímenes de mercado.'}${input.hasTicks ? ' Con ticks reales puedes validar en M1 tick-accurate.' : ' Sin ticks: la validación fina en M1 será aproximada.'}`
    : `${input.symbol}${input.timeframe ? ' · ' + input.timeframe : ''} with ${kind}, covers ${range} (${(input.years || 0).toFixed(1)} yrs, ${rowsTxt} rows). Source: ${input.source || 'n/a'}${input.broker ? ' · ' + input.broker : ''}. Avg spread ${spreadTxt}. Quality ${input.qualityScore ?? '—'} — ${fit}. ${long ? 'Long history: spans several market regimes, good for walk-forward and out-of-sample.' : 'Short history: use carefully, few market regimes.'}${input.hasTicks ? ' Real ticks allow M1 tick-accurate validation.' : ' No ticks: fine M1 validation will be approximate.'}`;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { summary: det, byAi: false };
  const L = es ? 'Spanish' : 'English';
  const system = `You are Onyx's data analyst for an internal MT4/MT5 robot factory. Describe a market dataset in 2-4 plain sentences in ${L}: what it is, its coverage and quality, its spread realism, and whether it is suitable for backtesting/validation and for which trading styles. NEVER predict the market or promise profits. Reply ONLY with JSON: {"summary":"<text>"}.`;
  const res = await aiJson(system, JSON.stringify(input), 400);
  const s = res && typeof res.summary === 'string' ? res.summary.trim() : '';
  return s ? { summary: s.slice(0, 900), byAi: true } : { summary: det, byAi: false };
}

// ============================================================
// Asistente de configuración del Motor (sección avanzada). El admin escribe su
// objetivo en lenguaje natural ("pasar FTMO 100k en oro, riesgo bajo") y Claude
// devuelve una configuración completa: costes, gestión monetaria, reglas de reto
// (prop firm), OOS, evolución y receta de bloques. Sin IA → config determinista.
// NUNCA predice el mercado ni promete resultados.
// ============================================================
export async function aiEngineAdvisor(input: {
  objective: string; symbol?: string; timeframe?: string; years?: number; lang?: 'es' | 'en';
}): Promise<{ cfg: any; rationale: string; byAi: boolean }> {
  const es = input.lang !== 'en';
  const obj = (input.objective || '').toLowerCase();
  // Detección determinista de reto por palabras clave (fallback y refuerzo).
  const size = (obj.match(/(\d{2,3})\s*k/) || [])[1];
  const isProp = /ftmo|myforex|funded|fondeo|prop|the5ers|e8|challenge|reto/.test(obj);
  const lowRisk = /bajo riesgo|conservador|low risk|seguro|safe/.test(obj);
  const phase2 = /fase\s*2|phase\s*2|verificaci/.test(obj);
  const det = {
    costs: { spreadPips: /xau|gold|oro/.test(obj) ? 2.5 : 1.0, commission: 3.5, riskPct: lowRisk ? 0.5 : isProp ? 1 : 1.5 },
    mm: 'risk_pct',
    challenge: isProp ? { target: phase2 ? 5 : 10, dailyLoss: 5, maxDD: 10, minDays: 4 } : { target: 0, dailyLoss: 0, maxDD: 0, minDays: 0 },
    oosPct: (input.years || 3) >= 4 ? 30 : 40,
    evo: { gens: 20, pop: 120, mut: 0.25 },
    blockPreset: /scalp/.test(obj) ? 'scalping' : /ruptura|breakout/.test(obj) ? 'ruptura' : /revers/.test(obj) ? 'reversion' : 'tendencia',
  };
  const detRat = es
    ? `Config base para "${input.objective}"${isProp ? ` (reto${size ? ' ' + size + 'k' : ''})` : ''}: riesgo ${det.costs.riskPct}%/op, OOS ${det.oosPct}%, receta ${det.blockPreset}. ${isProp ? 'Reglas de reto típicas aplicadas — ajusta a tu prop firm exacta.' : ''}`
    : `Base config for "${input.objective}"${isProp ? ` (challenge${size ? ' ' + size + 'k' : ''})` : ''}: risk ${det.costs.riskPct}%/trade, OOS ${det.oosPct}%, ${det.blockPreset} recipe. ${isProp ? 'Typical challenge rules applied — adjust to your exact prop firm.' : ''}`;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { cfg: det, rationale: detRat, byAi: false };
  const L = es ? 'Spanish' : 'English';
  const system = `You are Onyx's quant configuration assistant for an internal MT4/MT5 robot factory. The admin gives a trading OBJECTIVE (often a prop-firm challenge like FTMO). Return a full engine configuration. NEVER predict the market or promise profits. Reply ONLY with JSON: {"costs":{"spreadPips":<num>,"commission":<num>,"riskPct":<num 0.25-2>},"mm":"risk_pct","challenge":{"target":<pct or 0>,"dailyLoss":<pct or 0>,"maxDD":<pct or 0>,"minDays":<int or 0>},"oosPct":<10-50>,"evo":{"gens":<6-40>,"pop":<40-200>,"mut":<0.1-0.4>},"blockPreset":"tendencia|ruptura|reversion|scalping|todo","rationale":"<2-4 sentences in ${L} explaining the choices>"}. Use realistic prop-firm rules when a firm is named. Keep risk conservative for funded/challenge objectives.`;
  const payload = { objective: input.objective, symbol: input.symbol, timeframe: input.timeframe, dataYears: input.years, deterministicHint: det };
  const res = await aiJson(system, JSON.stringify(payload), 700);
  if (!res || !res.costs) return { cfg: det, rationale: detRat, byAi: false };
  const cfg = {
    costs: { spreadPips: Number(res.costs.spreadPips) || det.costs.spreadPips, commission: Number(res.costs.commission) || det.costs.commission, riskPct: Math.min(2, Math.max(0.25, Number(res.costs.riskPct) || det.costs.riskPct)) },
    mm: 'risk_pct',
    challenge: { target: Number(res.challenge?.target) || 0, dailyLoss: Number(res.challenge?.dailyLoss) || 0, maxDD: Number(res.challenge?.maxDD) || 0, minDays: Number(res.challenge?.minDays) || 0 },
    oosPct: Math.min(50, Math.max(10, Number(res.oosPct) || det.oosPct)),
    evo: { gens: Math.min(40, Math.max(6, Number(res.evo?.gens) || 20)), pop: Math.min(200, Math.max(40, Number(res.evo?.pop) || 120)), mut: Math.min(0.4, Math.max(0.1, Number(res.evo?.mut) || 0.25)) },
    blockPreset: ['tendencia', 'ruptura', 'reversion', 'scalping', 'todo'].includes(res.blockPreset) ? res.blockPreset : det.blockPreset,
  };
  return { cfg, rationale: String(res.rationale || detRat).slice(0, 900), byAi: true };
}
