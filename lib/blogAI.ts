import { ONYX_BRIEF, brandBrief } from '@/lib/supportAI';
import { dictFor } from '@/lib/i18n';
import type { Lang } from '@/lib/navText';

// ============================================================
// Onyx AI para el BLOG. Dos usos:
//   · suggestTitles → a partir de una idea/título, propone títulos SEO mejores.
//   · generateArticle → escribe el artículo COMPLETO en español e inglés (markdown).
// LÍNEA ROJA: contenido educativo/marketing de la marca. NUNCA predice el
// mercado, da señales ni promete ganancias. Habla de disciplina, gestión de
// riesgo, herramientas de Onyx, prop firms, psicología, etc.
// ============================================================

async function aiRaw(system: string, user: string, maxTokens: number): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 6000) }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('blog', d)).catch(() => {});
    return (d?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; }
}

// Intenta extraer el primer bloque JSON de la respuesta del modelo.
function parseJson(txt: string | null): any | null {
  if (!txt) return null;
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const GUARDRAIL = 'Reglas estrictas: NUNCA predigas el mercado, ni des señales, ni prometas ganancias, ni digas qué operar. Escribe contenido educativo y de marca honesto (disciplina, gestión de riesgo, psicología, prop firms, herramientas de Onyx). Sin relleno. Sin promesas de rentabilidad.';

// Guía SEO de palabras clave prioritarias para el prompt del generador.
export type KwGuide = {
  targetEs?: string; targetEn?: string;   // keyword objetivo por idioma (una, rota)
  moreEs?: string[]; moreEn?: string[];   // secundarias (solo si encajan)
  intensity?: 'soft' | 'normal' | 'strong'; variants?: boolean; internalLinks?: boolean; pillar?: string;
};
function kwBlock(kw?: KwGuide): string {
  if (!kw || (!kw.targetEs && !kw.targetEn)) return '';
  const dens = kw.intensity === 'soft' ? '1-2 veces / 1-2 times' : kw.intensity === 'strong' ? '4-6 veces / 4-6 times' : '2-3 veces / 2-3 times';
  const L: string[] = ['\n\nSEO — PALABRAS CLAVE PRIORITARIAS (intégralas de forma NATURAL; PROHIBIDO el relleno o repetirlas a la fuerza):'];
  if (kw.targetEs) L.push(`- Español: keyword objetivo "${kw.targetEs}". Úsala en el título si encaja, en el primer párrafo, en un subtítulo "## " y en excerpt_es, y ${dens} en body_es. Densidad máx ~1.5%.`);
  if (kw.targetEn) L.push(`- English: target keyword "${kw.targetEn}". Use it in the title if it fits, in the first paragraph, one "## " heading and excerpt_en, and ${dens} in body_en. Max density ~1.5%.`);
  if (kw.moreEs?.length) L.push(`- Secundarias ES (solo si encajan con el tema): ${kw.moreEs.join(', ')}.`);
  if (kw.moreEn?.length) L.push(`- Secondary EN (only if they fit the topic): ${kw.moreEn.join(', ')}.`);
  if (kw.variants) L.push('- Puedes usar variantes/sinónimos naturales para que se lea humano / You may use natural variants.');
  if (kw.internalLinks && kw.pillar) L.push(`- Añade UN enlace interno en markdown a la página pilar donde aparezca la keyword: [texto](${kw.pillar}) / add ONE internal link.`);
  L.push('- Si una keyword no encaja de forma natural, NO la fuerces.');
  return L.join('\n');
}

// ---- Sugerencias de título ----
export async function suggestTitles(topic: string, lang: Lang = 'es', target?: string): Promise<{ ok: boolean; titles?: string[]; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const es = lang !== 'en';
  const kwLine = target ? `\n\nIMPORTANTE: incluye la palabra clave "${target}" cerca del inicio en al menos la mitad de los títulos, de forma natural (sin forzar).` : '';
  const system = `Eres el editor SEO de Onyx Trading Live. ${GUARDRAIL}\n\nCONTEXTO DE MARCA:\n${await brandBrief(lang)}${kwLine}\n\nDevuelve SOLO un JSON: {"titles": ["...", ...]} con 6 títulos ${es ? 'en español' : 'in English'}, atractivos y optimizados para búsqueda (claros, con la palabra clave al inicio, 40-65 caracteres). Sin numerar, sin comillas dentro.`;
  const out = parseJson(await aiRaw(system, `Idea o tema: ${topic}`, 500));
  const titles = Array.isArray(out?.titles) ? out.titles.map((t: any) => String(t)).filter(Boolean).slice(0, 8) : null;
  if (!titles || !titles.length) return { ok: false, reason: 'ai_failed' };
  return { ok: true, titles };
}

// Tipos de post que rankean bien / atraen backlinks. Cada uno pide una estructura.
export type BlogKind = 'guide' | 'comparison' | 'list' | 'mistakes';
export type RelatedPost = { slug: string; title_es?: string; title_en?: string; tags?: string };

const KIND_BLOCK: Record<BlogKind, string> = {
  guide: 'TIPO: Guía práctica. Estructura: introducción con el problema, 3-5 secciones "## " accionables, y un cierre con los puntos clave.',
  comparison: 'TIPO: Comparativa. Estructura: introducción, una sección "## " por cada opción con sus pros y contras (listas), una sección "## ¿Cuál elegir?" con un veredicto honesto por perfil de trader. Sé imparcial y concreto. (No uses tablas markdown, usa listas.)',
  list: 'TIPO: Lista/Ranking (listicle). Estructura: introducción breve, un subtítulo "## 1) …", "## 2) …" por cada elemento (numéralos en el propio subtítulo), con 2-3 frases cada uno. Título con número (ej. "5 …", "10 …").',
  mistakes: 'TIPO: Errores frecuentes. Estructura: introducción, un subtítulo "## " por cada error explicando por qué duele y cómo evitarlo, cierre con un checklist en lista "- ".',
};

// Bloque de enlazado interno: le damos la lista de posts anteriores y pedimos 2-4 enlaces contextuales.
function relatedBlock(related?: RelatedPost[]): string {
  if (!related || !related.length) return '';
  const lines = related.slice(0, 12).map((r) => `- [${(r.title_es || r.title_en || '').slice(0, 80)}](/blog/${r.slug})${r.tags ? ` (temas: ${r.tags})` : ''}`);
  return `\n\nENLAZADO INTERNO (MUY IMPORTANTE para SEO): teje de forma NATURAL entre 2 y 4 enlaces a estos artículos existentes, SOLO donde el tema encaje, usando el texto del enlace descriptivo (no "haz clic aquí"). Usa la MISMA ruta /blog/slug en ambos idiomas. Estos son los artículos disponibles:\n${lines.join('\n')}\nNo inventes rutas que no estén en esta lista. Si ninguno encaja, no fuerces enlaces.`;
}

const FAQ_BLOCK = '\n\nFAQ (recomendado, ayuda a ganar resultados enriquecidos en Google): añade AL FINAL un bloque de 3-4 preguntas frecuentes con este formato EXACTO (traducido en cada idioma):\n:::faq\nQ: Pregunta corta y real que busca la gente\nA: Respuesta clara de 1-3 frases\nQ: Otra pregunta\nA: Otra respuesta\n:::';

const FIGURE_BLOCK = '\n\nIMAGEN DE CONTENIDO (recomendado): inserta UNA vez, a media altura del artículo, un banner on-brand con este formato (traduce kicker/title/alt):\n:::figure\nkicker: ETIQUETA CORTA DEL TEMA\ntitle: Frase potente que resume una idea del artículo\nalt: Descripción para accesibilidad y SEO\n:::';

// ---- Artículo completo bilingüe ----
export async function generateArticle(title: string, kw?: KwGuide, opts?: { related?: RelatedPost[]; kind?: BlogKind }): Promise<{ ok: boolean; article?: any; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const kind = opts?.kind && KIND_BLOCK[opts.kind] ? opts.kind : 'guide';
  const system = `Eres redactor de contenido SEO de Onyx Trading Live. ${GUARDRAIL}\n\nCONTEXTO DE MARCA (úsalo con naturalidad, sin sonar a anuncio):\n${await brandBrief('es')}${kwBlock(kw)}\n\nEscribe un artículo de blog COMPLETO sobre el título dado, en ESPAÑOL e INGLÉS. Formato markdown: usa subtítulos "## ", listas con "- " y **negritas** con moderación. 700-1000 palabras por idioma, tono cercano y profesional para traders. Cierra invitando suavemente a usar Onyx (sin promesas).\n\n${KIND_BLOCK[kind]}${relatedBlock(opts?.related)}${FIGURE_BLOCK}${FAQ_BLOCK}\n\nGRÁFICAS (opcional, solo si de verdad aportan): puedes incluir UNA gráfica ilustrativa dentro del cuerpo con este bloque exacto (mismo contenido en ambos idiomas, traduciendo title/alt/source):\n:::chart\ntype: line\ntitle: Título corto de la gráfica\nalt: Descripción de lo que muestra la gráfica (para accesibilidad y SEO)\nsource: Datos de ejemplo · Onyx Trading Live\nx: [Etiqueta1, Etiqueta2, Etiqueta3]\ny: [10, 8, 5]\n:::\nReglas de la gráfica: type puede ser line, bar o doughnut. SIEMPRE datos de EJEMPLO/ilustrativos (nunca rendimientos reales, señales ni promesas) y por eso source siempre incluye "Datos de ejemplo". Máx 12 puntos.\n\nNO inventes imágenes con URL (![...](...)); usa el bloque :::figure para la imagen de contenido. Describe la portada en cover_alt.\n\nDevuelve SOLO este JSON (sin texto fuera):\n{"title_es":"...","title_en":"...","slug":"slug-corto-en-espanol-3-a-6-palabras-con-la-keyword","excerpt_es":"resumen 1-2 frases","excerpt_en":"1-2 sentence summary","body_es":"markdown en español (con enlaces internos, :::figure y :::faq)","body_en":"markdown in English (with internal links, :::figure and :::faq)","cover_alt_es":"alt de la portada en español ~12 palabras","cover_alt_en":"cover alt in English ~12 words","tags":"3-6 palabras clave EN ESPAÑOL separadas por coma (solo español)"}`;
  const out = parseJson(await aiRaw(system, `Título: ${title}`, 5000));
  if (!out || !out.body_es || !out.body_en) return { ok: false, reason: 'ai_failed' };
  return {
    ok: true,
    article: {
      title_es: String(out.title_es || title).slice(0, 200),
      title_en: String(out.title_en || title).slice(0, 200),
      slug: String(out.slug || '').slice(0, 90),
      excerpt_es: String(out.excerpt_es || '').slice(0, 400),
      excerpt_en: String(out.excerpt_en || '').slice(0, 400),
      body_es: String(out.body_es || '').slice(0, 20000),
      body_en: String(out.body_en || '').slice(0, 20000),
      cover_alt_es: String(out.cover_alt_es || '').slice(0, 300),
      cover_alt_en: String(out.cover_alt_en || '').slice(0, 300),
      tags: String(out.tags || '').slice(0, 300),
    },
  };
}

// ---- Texto alternativo (alt) de una imagen, bilingüe ----
// Describe la imagen para accesibilidad y SEO, integrando la keyword si encaja.
// context = título/tema del artículo; hint = nombre de archivo o pista opcional.
export async function generateAlt(context: string, hint?: string, keyword?: string): Promise<{ ok: boolean; alt_es?: string; alt_en?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const kwLine = keyword ? `\nSi encaja de forma natural, incluye la palabra clave "${keyword}" (o su equivalente en inglés) en el alt, sin forzar.` : '';
  const system = `Eres el editor SEO de Onyx Trading Live. Escribe el TEXTO ALTERNATIVO (atributo alt) de una imagen para un artículo de blog de trading. El alt describe lo que se ve en la imagen de forma concreta y útil para una persona que no puede verla; 8-16 palabras; sin "imagen de" ni "foto de"; sin comillas; sin punto final.${kwLine}\n\nDevuelve SOLO un JSON: {"alt_es":"...","alt_en":"..."}`;
  const user = `Tema del artículo: ${context}${hint ? `\nPista de la imagen (nombre de archivo o descripción): ${hint}` : ''}`;
  const out = parseJson(await aiRaw(system, user, 300));
  const es = out?.alt_es ? String(out.alt_es).slice(0, 300) : '';
  const en = out?.alt_en ? String(out.alt_en).slice(0, 300) : '';
  if (!es && !en) return { ok: false, reason: 'ai_failed' };
  return { ok: true, alt_es: es, alt_en: en };
}
