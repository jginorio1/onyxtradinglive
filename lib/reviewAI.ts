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
// Mezcla de estilos: nombre+inicial, solo nombre, y ALIAS/handle de trader (para no
// revelar identidad). Así los nombres se ven variados y reales.
const ES_PROFILES: Profile[] = [
  { name: 'Andrés M.', country: 'MX' },      // nombre + inicial
  { name: 'Valeria', country: 'AR' },        // solo nombre
  { name: 'PipsConDani', country: 'MX' },    // alias
  { name: 'Diego S.', country: 'ES' },
  { name: 'fx_camila', country: 'CO' },      // alias
  { name: 'Jonathan V.', country: 'PE' },
  { name: 'ScalperCL_07', country: 'CL' },   // alias
  { name: 'Sofía', country: 'CL' },
  { name: 'elTrader_RC', country: 'MX' },    // alias
  { name: 'Luis F.', country: 'ES' },
  { name: 'NocturnoFX', country: 'AR' },     // alias
  { name: 'Gabriela N.', country: 'PE' },
  { name: 'RiesgoCero_88', country: 'CO' },  // alias
  { name: 'Martín', country: 'ES' },
  { name: 'ondaLarga', country: 'MX' },      // alias
];
const EN_PROFILES: Profile[] = [
  { name: 'Ryan A.', country: 'US' },
  { name: 'James', country: 'GB' },          // solo nombre
  { name: 'PipHunterUK', country: 'GB' },    // alias
  { name: 'Marcus T.', country: 'CA' },
  { name: 'swing_sarah', country: 'ZA' },    // alias
  { name: 'Liam', country: 'AU' },
  { name: 'NoStopLoss_', country: 'US' },    // alias
  { name: 'Emma W.', country: 'GB' },
  { name: 'LondonScalper', country: 'GB' },  // alias
  { name: 'Noah', country: 'US' },
  { name: 'TheQuietFund', country: 'CA' },   // alias
  { name: 'Olivia H.', country: 'CA' },
  { name: 'fx_ethan', country: 'AU' },       // alias
  { name: 'Grace', country: 'NZ' },
  { name: 'RiskFirst_21', country: 'US' },   // alias
];
function shuffle<T>(a: T[]): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// Fecha reciente aleatoria (entre 3 y ~130 días atrás), formateada por idioma.
// Así las reseñas no llevan todas la misma fecha (ni todas "hoy").
function recentDate(lang: 'es' | 'en', daysAgo = 3 + Math.floor(Math.random() * 128)): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return lang === 'es'
    ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Recorta el texto SIN cortar a mitad de palabra: si excede max, corta en el último
// punto o espacio anterior. Evita reseñas que terminan en "…automatizar mi".
function trimText(t: string, max = 300): string {
  let s = String(t || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastDot > 80) return cut.slice(0, lastDot + 1).trim();
  const lastSp = cut.lastIndexOf(' ');
  return (lastSp > 80 ? cut.slice(0, lastSp) : cut).trim().replace(/[,;:\-]$/, '') + '.';
}

export type ReviewDraft = { name: string; result: string; text: string; stars: number; date: string; country: string; lang: 'es' | 'en' };

// Genera 1 reseña. El nombre/país vienen de un perfil dado (o aleatorio) → no se
// repiten. La IA solo escribe el texto (corto y completo) acorde a las estrellas.
// La fecha es reciente y aleatoria (o la que se pase).
export async function draftReview(lang: 'es' | 'en', stars: number = (Math.random() < 0.8 ? 5 : 4), profile?: Profile, date?: string): Promise<ReviewDraft | null> {
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
    ? `Eres un generador de reseñas realistas para una herramienta que crea bots de trading (sin programar) para cuentas de fondeo (prop firms), compatible con MT4, MT5 y cTrader. El bot lleva dentro las reglas de riesgo, filtro de noticias y de sesión, y registra las operaciones en un panel. Escribe UNA reseña creíble, en primera persona, tono natural de trader latino/español, SIN emojis, SIN promesas de ganancias garantizadas. IMPORTANTE: BREVE y COMPLETA — 1 o 2 frases, máximo 30 palabras, que termine bien (no la dejes a medias). Variada (no empieces siempre igual). ${toneEs} Devuelve SOLO un JSON válido: {"text":"la reseña"}. Nada más.`
    : `You generate realistic reviews for a no-code tool that builds trading bots for funded accounts (prop firms), for MT4, MT5 and cTrader. The bot carries risk rules, news and session filters inside, and logs trades to a dashboard. Write ONE believable first-person review, natural trader tone, NO emojis, NO guaranteed-profit claims. IMPORTANT: SHORT and COMPLETE — 1 or 2 sentences, max 30 words, ending properly (do not leave it unfinished). Varied (do not always start the same way). ${toneEn} Return ONLY valid JSON: {"text":"the review"}. Nothing else.`;
  const user = lang === 'es'
    ? `Reseña de ${st} estrellas para un usuario cuyo contexto/resultado es: "${firm}". Máximo 30 palabras. Que no empiece con "Llevo".`
    : `A ${st}-star review for a user whose context/result is: "${firm}". Max 30 words.`;
  const raw = await anthropic(system, user, 400);
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : raw);
    const text = trimText(String(j.text || ''), 300);
    if (!text) return null;
    return { name: p.name, result: firm, text, stars: st, date: date || recentDate(lang), country: p.country, lang };
  } catch { return null; }
}

// Genera un LOTE de 5 reseñas: 4 de 5★ y 1 de 4★, idiomas ES/EN aleatorios,
// con nombres DISTINTOS (perfiles barajados), FECHAS distintas y tono acorde.
export async function draftReviewBatch(): Promise<ReviewDraft[]> {
  const plan = [5, 5, 5, 5, 4];
  const langsPlan: ('es' | 'en')[] = plan.map(() => (Math.random() < 0.5 ? 'es' : 'en'));
  const esPool = shuffle(ES_PROFILES); const enPool = shuffle(EN_PROFILES);
  const days = shuffle([7, 19, 34, 58, 91, 12, 26, 47, 73, 105]);   // días atrás distintos
  let ei = 0, ni = 0;
  const jobs = plan.map((s, i) => {
    const lang = langsPlan[i];
    const profile = lang === 'es' ? esPool[ei++ % esPool.length] : enPool[ni++ % enPool.length];
    return draftReview(lang, s, profile, recentDate(lang, days[i]));
  });
  const results = await Promise.all(jobs);
  return results.filter((r): r is ReviewDraft => !!r);
}
