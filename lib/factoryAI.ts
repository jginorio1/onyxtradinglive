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
