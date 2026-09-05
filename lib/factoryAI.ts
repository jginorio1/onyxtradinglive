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
