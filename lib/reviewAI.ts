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

// Genera 1 reseña. lang: 'es' | 'en'. Fecha = hoy. País (ISO2) inferido del nombre.
export async function draftReview(lang: 'es' | 'en'): Promise<ReviewDraft | null> {
  const firm = FIRMS[Math.floor(Math.random() * FIRMS.length)];
  const stars = Math.random() < 0.8 ? 5 : 4;
  const system = lang === 'es'
    ? 'Eres un generador de reseñas realistas para una herramienta que crea bots de trading (sin programar) para cuentas de fondeo (prop firms), compatible con MT4, MT5 y cTrader. El bot lleva dentro las reglas de riesgo, filtro de noticias y de sesión, y registra las operaciones en un panel. Escribe reseñas creíbles, en primera persona, tono natural de trader latino/español, SIN emojis, SIN promesas de ganancias garantizadas, de 1 a 2 frases. Elige un país plausible para el nombre y devuelve su código ISO-3166 alpha-2. Devuelve SOLO un JSON válido: {"name":"Nombre Apellido inicial.","text":"la reseña","country":"MX"}. Nada más.'
    : 'You generate realistic reviews for a no-code tool that builds trading bots for funded accounts (prop firms), for MT4, MT5 and cTrader. The bot carries risk rules, news and session filters inside, and logs trades to a dashboard. Write believable first-person reviews, natural trader tone, NO emojis, NO guaranteed-profit claims, 1 to 2 sentences. Pick a plausible country for the name and return its ISO-3166 alpha-2 code. Return ONLY valid JSON: {"name":"First L.","text":"the review","country":"US"}. Nothing else.';
  const user = lang === 'es'
    ? `Genera una reseña para un usuario cuyo resultado/contexto es: "${firm}". Estrellas: ${stars}.`
    : `Generate a review for a user whose result/context is: "${firm}". Stars: ${stars}.`;
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
      stars,
      date,
      country: String(j.country || '').slice(0, 2).toUpperCase(),
      lang,
    };
  } catch { return null; }
}
