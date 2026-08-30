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

// Perfiles (nombre + país) — el nombre lo ponemos NOSOTROS para que no se repita
// entre reseñas (la IA solo redacta el texto). Variados por idioma/región.
type Profile = { name: string; country: string };
const ES_PROFILES: Profile[] = [
  { name: 'Andrés M.', country: 'MX' }, { name: 'Valeria R.', country: 'AR' }, { name: 'Diego S.', country: 'ES' },
  { name: 'María José P.', country: 'CO' }, { name: 'Jonathan V.', country: 'PE' }, { name: 'Sofía L.', country: 'CL' },
  { name: 'Ricardo A.', country: 'MX' }, { name: 'Camila T.', country: 'CO' }, { name: 'Luis F.', country: 'ES' },
  { name: 'Paola G.', country: 'AR' }, { name: 'Sebastián R.', country: 'CL' }, { name: 'Daniela C.', country: 'MX' },
  { name: 'Miguel Á.', country: 'ES' }, { name: 'Gabriela N.', country: 'PE' }, { name: 'Fernando O.', country: 'CO' },
];
const EN_PROFILES: Profile[] = [
  { name: 'Ryan A.', country: 'US' }, { name: 'James P.', country: 'GB' }, { name: 'Marcus T.', country: 'CA' },
  { name: 'Liam O.', country: 'AU' }, { name: 'Sarah K.', country: 'ZA' }, { name: 'David R.', country: 'US' },
  { name: 'Emma W.', country: 'GB' }, { name: 'Noah B.', country: 'US' }, { name: 'Olivia H.', country: 'CA' },
  { name: 'Ethan C.', country: 'AU' }, { name: 'Chloe M.', country: 'GB' }, { name: 'Jack S.', country: 'IE' },
  { name: 'Mia D.', country: 'US' }, { name: 'Lucas B.', country: 'CA' }, { name: 'Grace F.', country: 'NZ' },
];
function shuffle<T>(a: T[]): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export type ReviewDraft = { name: string; result: string; text: string; stars: number; date: string; country: string; lang: 'es' | 'en' };

// Genera 1 reseña. El nombre/país vienen de un perfil dado (o aleatorio), así no se
// repiten; la IA solo escribe el texto acorde a las estrellas.
export async function draftReview(lang: 'es' | 'en', stars: number = (Math.random() < 0.8 ? 5 : 4), profile?: Profile): Promise<ReviewDraft | null> {
  const firm = FIRMS[Math.floor(Math.random() * FIRMS.length)];
  const st = Math.max(1, Math.min(5, Math.round(stars)));
  const p = profile || (lang === 'es' ? ES_PROFILES : EN_PROFILES)[Math.floor(Math.random() * (lang === 'es' ? ES_PROFILES : EN_PROFILES).length)];
  const toneEs = st >= 5
    ? 'Tono muy positivo y entusiasta, recomienda sin reservas.'
    : 'Tono positivo pero con UN pequeño matiz o crítica menor (ej. curva de aprendizaje, algo que mejorar), sin ser negativa.';
  const toneEn = st >= 5
    ? 'Very positive, enthusiastic tone, recommends without reservations.'
    : 'Positive but with ONE small caveat or minor critique (e.g. learning curve, something to improve), not negative.';
  const system = lang === 'es'
    ? `Eres un generador de reseñas realistas para una herramienta que crea bots de trading (sin programar) para cuentas de fondeo (prop firms), compatible con MT4, MT5 y cTrader. El bot lleva dentro las reglas de riesgo, filtro de noticias y de sesión, y registra las operaciones en un panel. Escribe UNA reseña creíble, en primera persona, tono natural de trader latino/español, SIN emojis, SIN promesas de ganancias garantizadas, de 1 a 2 frases, variada (no empieces siempre igual). ${toneEs} Devuelve SOLO un JSON válido: {"text":"la reseña"}. Nada más.`
    : `You generate realistic reviews for a no-code tool that builds trading bots for funded accounts (prop firms), for MT4, MT5 and cTrader. The bot carries risk rules, news and session filters inside, and logs trades to a dashboard. Write ONE believable first-person review, natural trader tone, NO emojis, NO guaranteed-profit claims, 1 to 2 sentences, varied (do not always start the same way). ${toneEn} Return ONLY valid JSON: {"text":"the review"}. Nothing else.`;
  const user = lang === 'es'
    ? `Reseña de ${st} estrellas para un usuario cuyo contexto/resultado es: "${firm}". Que no empiece con "Llevo".`
    : `A ${st}-star review for a user whose context/result is: "${firm}".`;
  const raw = await anthropic(system, user, 260);
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : raw);
    const text = String(j.text || '').slice(0, 280);
    if (!text) return null;
    const today = new Date();
    const date = lang === 'es'
      ? today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
      : today.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return { name: p.name, result: firm, text, stars: st, date, country: p.country, lang };
  } catch { return null; }
}

// Genera un LOTE de 5 reseñas: 4 de 5★ y 1 de 4★, idiomas ES/EN aleatorios,
// con nombres DISTINTOS (perfiles barajados) y tono acorde a las estrellas.
export async function draftReviewBatch(): Promise<ReviewDraft[]> {
  const plan = [5, 5, 5, 5, 4];
  const langsPlan: ('es' | 'en')[] = plan.map(() => (Math.random() < 0.5 ? 'es' : 'en'));
  const esPool = shuffle(ES_PROFILES); const enPool = shuffle(EN_PROFILES);
  let ei = 0, ni = 0;
  const jobs = plan.map((s, i) => {
    const lang = langsPlan[i];
    const profile = lang === 'es' ? esPool[ei++ % esPool.length] : enPool[ni++ % enPool.length];
    return draftReview(lang, s, profile);
  });
  const results = await Promise.all(jobs);
  return results.filter((r): r is ReviewDraft => !!r);
}
