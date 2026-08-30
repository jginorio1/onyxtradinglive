// ============================================================
// IA para generar reseñas de ejemplo del landing de bots (Crea tu bot).
// Devuelve una reseña creíble y variada en el idioma pedido, lista para editar.
// Reusa el mismo cliente HTTP de Anthropic que el resto del panel.
// ============================================================

async function anthropic(system: string, user: string, maxTokens = 400): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 1500) }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('resenas', data)).catch(() => {});
    return (data?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; }
}

const FIRMS = ['FTMO 25K', 'FTMO 100K', 'FTMO 200K', 'FundedNext 50K', 'FundedNext 100K', 'The5ers', 'FundingPips 25K', 'Multi-broker', '2 cuentas', 'Demo → real'];

export type ReviewDraft = { name: string; result: string; text: string; stars: number; date: string; country: string; lang: 'es' | 'en' };

// Genera 1 reseña. lang: 'es' | 'en'. stars fijo (para que el tono concuerde).
// Fecha = hoy. País (ISO2) inferido del nombre.
export async function draftReview(lang: 'es' | 'en', stars: number = (Math.random() < 0.8 ? 5 : 4)): Promise<ReviewDraft | null> {
  const firm = FIRMS[Math.floor(Math.random() * FIRMS.length)];
  const st = Math.max(1, Math.min(5, Math.round(stars)));
  // Guía de tono para que la opinión concuerde con las estrellas.
  const toneEs = st >= 5
    ? 'Tono muy positivo y entusiasta, recomienda sin reservas.'
    : 'Tono positivo pero con UN pequeño matiz o crítica menor (ej. curva de aprendizaje, algo que mejorar), sin ser negativa.';
  const toneEn = st >= 5
    ? 'Very positive, enthusiastic tone, recommends without reservations.'
    : 'Positive but with ONE small caveat or minor critique (e.g. learning curve, something to improve), not negative.';
  const system = lang === 'es'
    ? `Eres un generador de reseñas realistas para una herramienta que crea bots de trading (sin programar) para cuentas de fondeo (prop firms), compatible con MT4, MT5 y cTrader. El bot lleva dentro las reglas de riesgo, filtro de noticias y de sesión, y registra las operaciones en un panel. Escribe reseñas creíbles, en primera persona, tono natural de trader latino/español, SIN emojis, SIN promesas de ganancias garantizadas, de 1 a 2 frases. ${toneEs} Elige un país plausible para el nombre y devuelve su código ISO-3166 alpha-2. Devuelve SOLO un JSON válido: {"name":"Nombre Apellido inicial.","text":"la reseña","country":"MX"}. Nada más.`
    : `You generate realistic reviews for a no-code tool that builds trading bots for funded accounts (prop firms), for MT4, MT5 and cTrader. The bot carries risk rules, news and session filters inside, and logs trades to a dashboard. Write believable first-person reviews, natural trader tone, NO emojis, NO guaranteed-profit claims, 1 to 2 sentences. ${toneEn} Pick a plausible country for the name and return its ISO-3166 alpha-2 code. Return ONLY valid JSON: {"name":"First L.","text":"the review","country":"US"}. Nothing else.`;
  const user = lang === 'es'
    ? `Genera una reseña de ${st} estrellas para un usuario cuyo resultado/contexto es: "${firm}".`
    : `Generate a ${st}-star review for a user whose result/context is: "${firm}".`;
  const raw = await anthropic(system, user, 300);
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : raw);
    const today = new Date();
    const date = lang === 'es'
      ? today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
      : today.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      name: String(j.name || '').slice(0, 60),
      result: firm,
      text: String(j.text || '').slice(0, 280),
      stars: st,
      date,
      country: String(j.country || '').slice(0, 2).toUpperCase(),
      lang,
    };
  } catch { return null; }
}

// Genera un LOTE de 5 reseñas a la vez: 4 de 5★ y 1 de 4★, idiomas ES/EN aleatorios,
// con el tono acorde a las estrellas. Devuelve las que la IA logró generar.
export async function draftReviewBatch(): Promise<ReviewDraft[]> {
  const plan = [5, 5, 5, 5, 4];   // 4 de cinco estrellas + 1 de cuatro
  const langs: ('es' | 'en')[] = ['es', 'en'];
  const results = await Promise.all(plan.map((s) => draftReview(langs[Math.floor(Math.random() * 2)], s)));
  return results.filter((r): r is ReviewDraft => !!r);
}
