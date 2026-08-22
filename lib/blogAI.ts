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

// Guardamos el ÚLTIMO error de la IA (HTTP, timeout, etc.) para poder mostrarlo
// en el popup del editor y en Diagnóstico. Sin esto, un fallo de la API se veía
// como un genérico "la IA no pudo generar" sin causa.
let _lastAiErr = '';
export function lastAiError() { return _lastAiErr; }

async function aiRaw(system: string, user: string, maxTokens: number): Promise<string | null> {
  _lastAiErr = '';
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { _lastAiErr = 'Falta ANTHROPIC_API_KEY'; return null; }
  const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
  // Cortamos la llamada a los 50s para no agotar la función serverless (que
  // devolvería 502). Si tarda más, devolvemos null y la ruta responde limpio.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
  try {
    // Reintenta en límites de tasa (429) o sobrecarga (529): espera el retry-after
    // que indica la API (o un backoff corto) para no rendirse a la primera y así
    // el generador en lote no se detiene tras 1 artículo.
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 6000) }] }),
      });
      if (r.ok) {
        const d = await r.json();
        import('@/lib/aiCost').then((m) => m.logAiUsage('blog', d)).catch(() => {});
        const txt = (d?.content || []).map((c: any) => c.text || '').join('\n').trim();
        if (!txt) _lastAiErr = 'La IA respondió vacío';
        return txt || null;
      }
      let body = ''; try { body = await r.text(); } catch {}
      let msg = ''; try { msg = JSON.parse(body)?.error?.message || ''; } catch {}
      _lastAiErr = `HTTP ${r.status} · ${model} · ${(msg || body || '').slice(0, 240)}`.trim();
      // Solo reintenta en límite/sobrecarga; los demás errores (401, 400, sin crédito) son definitivos.
      if ((r.status === 429 || r.status === 529) && attempt < 3) {
        const ra = Number(r.headers.get('retry-after'));
        const waitMs = Math.min(20000, (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 3000 * (attempt + 1)));
        await sleep(waitMs);
        continue;
      }
      return null;
    }
    return null;
  } catch (e: any) {
    _lastAiErr = e?.name === 'AbortError' ? 'La IA tardó demasiado (timeout 50s)' : `Fallo de red: ${String(e?.message || e).slice(0, 200)}`;
    return null;
  }
  finally { clearTimeout(timer); }
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

// ---- Ideas de TEMAS para el piloto automático (llenar el pool de meses/años) ----
// Devuelve una lista de temas concretos (en español) para artículos, evitando los
// que ya existen. Cada tema es una idea de artículo, no un título final.
export async function suggestTopics(count: number, existing: string[] = [], keywords: string[] = []): Promise<{ ok: boolean; topics?: string[]; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const n = Math.max(10, Math.min(count || 60, 120));
  const avoid = existing.slice(0, 400).map((t) => `- ${t}`).join('\n');
  const kw = keywords.slice(0, 30).join(', ');
  // Ejes para explotar el long-tail: en cada llamada rotamos el foco y damos
  // dimensiones concretas para combinar → cientos de temas distintos posibles.
  const ANGLES = [
    'por prop firm concreta (FTMO, FundedNext, The5ers, FundingPips, etc.) y sus reglas',
    'por regla de reto (drawdown diario/total, objetivo, consistencia, días mínimos, noticias, fin de semana)',
    'por plataforma (MetaTrader 4, MetaTrader 5, cTrader, TradingView) y cómo configurarla',
    'por instrumento (oro/XAUUSD, índices US30/NAS100, pares mayores, cripto) y su gestión de riesgo',
    'errores y mitos que arruinan cuentas de fondeo',
    'psicología y disciplina (miedo, revenge trading, overtrading, paciencia, diario)',
    'gestión de riesgo y tamaño de posición (lotaje, R:R, riesgo por operación, correlación)',
    'copy trading y robots/EAs (cómo elegir, validar, monitorear, riesgos)',
    'preguntas de principiantes en formato "qué es / cómo / cuánto / por qué"',
    'comparativas "X vs Y" y listas "N mejores / N errores / N señales de"',
  ];
  const focus = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  const focus2 = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  const system = `Eres el estratega de contenido SEO de Onyx Trading Live (plataforma para traders: prop firms, gestión de riesgo, copy trading, robots/EAs, psicología del trading, retos de fondeo, herramientas Onyx). ${GUARDRAIL}\n\nCONTEXTO DE MARCA:\n${await brandBrief('es')}\n\nGenera ${n} TEMAS de artículo de blog en ESPAÑOL, MUY específicos y de cola larga (long-tail), variados en formato (guías, comparativas "X vs Y", listas "N…", errores, preguntas). Cada tema evergreen y con intención de búsqueda real. NADA de predicciones de mercado, señales ni promesas.\n\nENFOQUE DE ESTA TANDA (prioriza estos ejes, combinándolos entre sí para maximizar variedad): «${focus}» y «${focus2}». Sé concreto: nombra prop firms, reglas, plataformas o instrumentos reales cuando aplique. Evita temas genéricos y repetidos.${kw ? `\n\nCuando encajen de forma natural, cubre también estas keywords: ${kw}.` : ''}${avoid ? `\n\nPROHIBIDO repetir o parafrasear estos temas ya existentes (usa ángulos NUEVOS):\n${avoid}` : ''}\n\nDevuelve SOLO un JSON: {"topics": ["tema 1", "tema 2", ...]} — frases cortas (5-12 palabras), sin numerar, sin comillas internas.`;
  const out = parseJson(await aiRaw(system, `Dame ${n} temas nuevos, específicos y distintos, sobre todo del enfoque indicado.`, 3500));
  let topics = Array.isArray(out?.topics) ? out.topics.map((t: any) => String(t).trim()).filter(Boolean) : null;
  if (!topics || !topics.length) return { ok: false, reason: 'ai_failed' };
  // Quitar duplicados y los que ya existían (case-insensitive).
  const seen = new Set(existing.map((t) => t.toLowerCase().trim()));
  topics = topics.filter((t: string) => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, n);
  return { ok: true, topics };
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
// Bloque anti-repetición: le pasamos SOLO los vecinos (artículos de tema cercano)
// para que el redactor tome un ángulo distinto sin gastar tokens en todo el blog.
function avoidBlock(avoid?: string[]): string {
  const a = (avoid || []).filter(Boolean).slice(0, 8);
  if (!a.length) return '';
  return `\n\n🚫 ANTI-REPETICIÓN (OBLIGATORIO): ya existen estos artículos sobre temas cercanos. NO repitas su enfoque, su estructura ni sus ejemplos. Toma un ÁNGULO CLARAMENTE DISTINTO (otro sub-tema, otro caso concreto, otra pregunta que resolver) y evita solapar su keyword principal. Si dos ideas chocan, elige la que ellos NO cubren:\n${a.map((x) => '- ' + x).join('\n')}`;
}

export async function generateArticle(title: string, kw?: KwGuide, opts?: { related?: RelatedPost[]; kind?: BlogKind; avoid?: string[] }): Promise<{ ok: boolean; article?: any; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const kind = opts?.kind && KIND_BLOCK[opts.kind] ? opts.kind : 'guide';
  const system = `Eres redactor de contenido SEO de Onyx Trading Live. ${GUARDRAIL}\n\nCONTEXTO DE MARCA (úsalo con naturalidad, sin sonar a anuncio):\n${await brandBrief('es')}${kwBlock(kw)}\n\nEscribe un artículo de blog COMPLETO sobre el título dado, en ESPAÑOL e INGLÉS.\n\n🌐 BILINGÜE OBLIGATORIO: los campos que terminan en _es (title_es, excerpt_es, slug, body_es, cover_alt_es) van 100% EN ESPAÑOL; los que terminan en _en (title_en, excerpt_en, slug_en, body_en, cover_alt_en) van 100% EN INGLÉS, como TRADUCCIÓN natural y nativa (NO copies el español, NO mezcles idiomas). title_en debe ser un título en inglés y slug_en un slug en inglés. Si el tema de entrada viene en español, tradúcelo al inglés para los campos _en.\n\nFormato markdown: usa subtítulos "## ", listas con "- " y **negritas** con moderación. 650-900 palabras por idioma, tono cercano y profesional para traders. Cierra invitando suavemente a usar Onyx (sin promesas).\n\n${KIND_BLOCK[kind]}${avoidBlock(opts?.avoid)}${relatedBlock(opts?.related)}${FIGURE_BLOCK}${FAQ_BLOCK}\n\nGRÁFICAS (opcional, solo si de verdad aportan): puedes incluir UNA gráfica ilustrativa dentro del cuerpo con este bloque exacto (mismo contenido en ambos idiomas, traduciendo title/alt/source):\n:::chart\ntype: line\ntitle: Título corto de la gráfica\nalt: Descripción de lo que muestra la gráfica (para accesibilidad y SEO)\nsource: Datos de ejemplo · Onyx Trading Live\nx: [Etiqueta1, Etiqueta2, Etiqueta3]\ny: [10, 8, 5]\n:::\nReglas de la gráfica: type puede ser line, bar o doughnut. SIEMPRE datos de EJEMPLO/ilustrativos (nunca rendimientos reales, señales ni promesas) y por eso source siempre incluye "Datos de ejemplo". Máx 12 puntos.\n\nNO inventes imágenes con URL (![...](...)); usa el bloque :::figure para la imagen de contenido. Describe la portada en cover_alt.\n\nDevuelve SOLO este JSON (sin texto fuera):\n{"title_es":"...","title_en":"...","slug":"slug-corto-en-espanol-3-a-6-palabras-con-la-keyword","slug_en":"short-english-slug-3-to-6-words-with-the-keyword","excerpt_es":"resumen 1-2 frases","excerpt_en":"1-2 sentence summary","body_es":"markdown en español (con enlaces internos, :::figure y :::faq)","body_en":"markdown in English (with internal links, :::figure and :::faq)","cover_alt_es":"alt de la portada en español ~12 palabras","cover_alt_en":"cover alt in English ~12 words","tags":"3-6 palabras clave EN ESPAÑOL separadas por coma (solo español)"}`;
  // 8000 tokens: un artículo bilingüe completo (ES+EN + FAQ + imagen) no cabe en
  // 5000 y el JSON se truncaba → 'ai_failed'. Con margen amplio ya no se corta.
  const out = parseJson(await aiRaw(system, `Título: ${title}`, 8000));
  if (!out || !out.body_es || !out.body_en) return { ok: false, reason: 'ai_failed' };
  return {
    ok: true,
    article: {
      title_es: String(out.title_es || title).slice(0, 200),
      title_en: String(out.title_en || title).slice(0, 200),
      slug: String(out.slug || '').slice(0, 90),
      slug_en: String(out.slug_en || '').slice(0, 90),
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

// ---- Mejorar un artículo YA existente SIN reescribir su contenido ----
// La IA devuelve SOLO lo nuevo (enlaces, imagen, FAQ) en un JSON PEQUEÑO — así no
// se trunca en artículos largos — y aquí lo insertamos en el texto original.
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function applyEnhance(body: string, lang: 'es' | 'en', out: any): string {
  let b = body || '';
  // 1) Enlaces internos: envolver una frase EXACTA existente (1ª aparición, si no está ya enlazada).
  for (const lk of (Array.isArray(out.links) ? out.links : [])) {
    const anchor = lang === 'es' ? lk.anchor_es : lk.anchor_en;
    const slug = String(lk.slug || '').replace(/[^a-z0-9-]/gi, '');
    if (!anchor || !slug || !b.includes(anchor)) continue;
    if (new RegExp('\\[' + escRe(anchor) + '\\]').test(b)) continue;      // ya enlazado
    b = b.replace(anchor, `[${anchor}](/blog/${slug})`);
  }
  // 2) Imagen de contenido (si no hay ninguna): insertar antes del 2º "## " o al final.
  if (!/:::figure/.test(b) && out.figure) {
    const kicker = (lang === 'es' ? out.figure.kicker_es : out.figure.kicker_en) || '';
    const title = (lang === 'es' ? out.figure.title_es : out.figure.title_en) || '';
    const alt = (lang === 'es' ? out.figure.alt_es : out.figure.alt_en) || title;
    if (title) {
      const block = `:::figure\nkicker: ${kicker}\ntitle: ${title}\nalt: ${alt}\n:::`;
      const heads = [...b.matchAll(/^##\s+/gm)];
      if (heads.length >= 2) { const at = heads[1].index!; b = b.slice(0, at) + block + '\n\n' + b.slice(at); }
      else b = b.replace(/\s*$/, '') + '\n\n' + block + '\n';
    }
  }
  // 3) FAQ (si no hay): al final.
  if (!/:::faq/.test(b)) {
    const faq = (lang === 'es' ? out.faq_es : out.faq_en) || [];
    if (Array.isArray(faq) && faq.length) {
      let block = '\n\n:::faq\n';
      for (const f of faq) if (f && f.q && f.a) block += `Q: ${String(f.q).trim()}\nA: ${String(f.a).trim()}\n`;
      block += ':::\n';
      if (/Q:/.test(block)) b = b.replace(/\s*$/, '') + block;
    }
  }
  return b.slice(0, 20000);
}
export async function enhanceArticle(
  title: string, bodyEs: string, bodyEn: string, related?: RelatedPost[],
): Promise<{ ok: boolean; body_es?: string; body_en?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const relList = (related || []).slice(0, 12).map((r) => `- slug: ${r.slug} — ${(r.title_es || r.title_en || '').slice(0, 70)}${r.tags ? ` (${r.tags})` : ''}`).join('\n') || '(no hay otros artículos — deja links vacío)';
  const system = `Eres el editor SEO de Onyx Trading Live. ${GUARDRAIL}\n\nTe doy un artículo en español e inglés. NO reescribas el texto. Solo propón añadidos, y devuelve un JSON PEQUEÑO (sin repetir el artículo):\n- "links": 2-4 objetos {"slug":"...","anchor_es":"frase EXACTA copiada del cuerpo español","anchor_en":"frase EXACTA copiada del cuerpo inglés"} para enlazar a artículos relacionados donde el tema encaje. Las frases deben existir TAL CUAL en el cuerpo. Usa solo estos slugs (no inventes):\n${relList}\n- "figure": {"kicker_es","title_es","alt_es","kicker_en","title_en","alt_en"} una imagen-banner que resuma una idea del artículo.\n- "faq_es" y "faq_en": 3-4 objetos {"q","a"} de preguntas frecuentes basadas en el contenido (respuestas 1-3 frases).\n\nDevuelve SOLO ese JSON.`;
  const user = `TÍTULO: ${title}\n\n=== CUERPO ES ===\n${(bodyEs || '').slice(0, 6000)}\n\n=== CUERPO EN ===\n${(bodyEn || '').slice(0, 6000)}`;
  const out = parseJson(await aiRaw(system, user, 1800));
  if (!out) return { ok: false, reason: 'ai_failed' };
  return { ok: true, body_es: applyEnhance(bodyEs, 'es', out), body_en: applyEnhance(bodyEn, 'en', out) };
}

// ---- Completar el idioma que falte (traducción fiel, conserva estructura) ----
// Dado un artículo, si le falta el cuerpo en un idioma lo genera traduciendo del
// otro, conservando markdown y bloques (:::chart datos, :::faq Q/A, :::figure,
// enlaces internos con la MISMA ruta). Devuelve solo los campos que rellena.
export async function completeLanguages(post: {
  title_es?: string; title_en?: string; excerpt_es?: string; excerpt_en?: string;
  body_es?: string; body_en?: string; cover_alt_es?: string; cover_alt_en?: string;
}, opts?: { force?: boolean }): Promise<{ ok: boolean; patch?: any; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const lenEs = (post.body_es || '').trim().length, lenEn = (post.body_en || '').trim().length;
  const hasEs = lenEs > 0, hasEn = lenEn > 0;
  if (!hasEs && !hasEn) return { ok: false, reason: 'empty' };   // no hay nada que traducir
  if (!opts?.force && hasEs && hasEn) return { ok: true, patch: {} };   // ya están ambos (sin forzar)
  // Con force o con uno vacío: el ORIGEN es el idioma con más texto.
  const src = lenEs >= lenEn ? 'es' : 'en';
  const dstName = src === 'es' ? 'inglés (English)' : 'español (Spanish)';
  const t = (k: 'title' | 'excerpt' | 'body' | 'cover_alt') => (post as any)[`${k}_${src}`] || '';
  // Formato con SEPARADORES (no JSON) → no se rompe aunque el cuerpo tenga muchos
  // saltos de línea, comillas o markdown.
  const system = `Eres traductor profesional del blog de Onyx Trading Live. Traduce el artículo del ${src === 'es' ? 'español' : 'inglés'} al ${dstName} de forma NATURAL y fluida. CONSERVA EXACTAMENTE la estructura markdown: encabezados "## ", listas "- ", **negritas**. En los enlaces internos [texto](/blog/slug) traduce SOLO el texto visible y deja la MISMA ruta. En bloques :::chart mantén los números x/y y traduce title/alt/source. En :::faq traduce las líneas Q: y A:. En :::figure traduce kicker/title/alt. No añadas ni quites contenido.\n\nDevuelve EXACTAMENTE en este formato (sin JSON, sin comentarios):\n===TITLE===\n<título traducido>\n===EXCERPT===\n<resumen traducido>\n===COVER_ALT===\n<alt traducido>\n===BODY===\n<cuerpo markdown traducido completo>`;
  const user = `TÍTULO: ${t('title')}\nEXCERPT: ${t('excerpt')}\nCOVER_ALT: ${t('cover_alt')}\n\nBODY:\n${t('body').slice(0, 9000)}`;
  const raw = await aiRaw(system, user, 7000);
  if (!raw) return { ok: false, reason: 'ai_failed' };
  const sec = (name: string) => { const m = raw.match(new RegExp('===\\s*' + name + '\\s*===\\s*([\\s\\S]*?)(?=\\n===|$)')); return m ? m[1].trim() : ''; };
  const body = sec('BODY');
  if (!body) return { ok: false, reason: 'ai_failed' };
  const dst = src === 'es' ? 'en' : 'es';
  const patch: any = {};
  patch[`title_${dst}`] = (sec('TITLE') || (post as any)[`title_${src}`] || '').slice(0, 200);
  patch[`excerpt_${dst}`] = sec('EXCERPT').slice(0, 400);
  patch[`body_${dst}`] = body.slice(0, 20000);
  patch[`cover_alt_${dst}`] = sec('COVER_ALT').slice(0, 300);
  return { ok: true, patch };
}

// ---- Copy para redes sociales, optimizado por red (social SEO manager) ----
// Genera un texto distinto para cada red a partir del artículo, en el idioma pedido.
// `only` regenera una sola red (más barato y no pisa lo editado en las demás).
const SOCIAL_KEYS = ['facebook', 'instagram', 'youtube', 'whatsapp', 'x', 'linkedin', 'telegram', 'tiktok', 'reddit', 'threads'];
// Reglas SIN hashtags de ejemplo con idioma fijo (para no mezclar idiomas).
const SOCIAL_RULES = `Reglas por red (gancho en la 1ª línea, valor, CTA claro, hashtags DONDE aportan; nada de clickbait falso ni promesas de ganancia):
- facebook: 2-4 frases cercanas que aporten valor + 1 pregunta que invite a comentar + CTA para leer la guía completa + SIEMPRE 3-5 hashtags al final (obligatorio). No incluyas la URL.
- instagram: caption con GANCHO potente en la 1ª línea + 2-3 frases con emojis con criterio + CTA que diga "enlace en bio" + 8-12 hashtags mezclando amplios y de nicho del trading. No incluyas la URL.
- youtube: para publicación de Comunidad / descripción. Gancho + 2-3 frases de valor + CTA "enlace en el primer comentario / descripción" + 4-6 hashtags. No incluyas la URL.
- whatsapp: 1-2 frases muy directas con 1 emoji, ideal para Estado o difusión. Sin hashtags. No incluyas la URL.
- x: máx 240 caracteres (deja hueco para el enlace), gancho fuerte + 2-3 hashtags. No incluyas la URL.
- linkedin: 3-5 frases profesionales que enseñen algo accionable + 3 hashtags al final. No incluyas la URL.
- telegram: 1-2 frases directas de canal con 1 emoji. No incluyas la URL.
- tiktok: caption corto con gancho + 3-5 hashtags virales del nicho. No incluyas la URL.
- reddit: un título honesto y descriptivo estilo Reddit (sin hashtags ni emojis).
- threads: 1-2 frases conversacionales + 0-2 hashtags. No incluyas la URL.`;
export async function socialCopy(title: string, excerpt: string, url: string, lang: Lang = 'es', only?: string): Promise<{ ok: boolean; copy?: Record<string, string>; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const es = lang !== 'en';
  // Consistencia de idioma: el texto Y LOS HASHTAGS deben ir en el idioma elegido.
  const L = es
    ? 'Escribe TODO en ESPAÑOL, incluidos los hashtags (p. ej. #GestiónDeRiesgo, #Fondeo). PROHIBIDO mezclar inglés.'
    : 'Write EVERYTHING in ENGLISH, including the hashtags (e.g. #RiskManagement, #FundedTrader). Do NOT mix any Spanish. Every hashtag must be an English word.';
  const keys = only && SOCIAL_KEYS.includes(only) ? [only] : SOCIAL_KEYS;
  const rules = only ? SOCIAL_RULES.split('\n').filter((l) => l.includes(`- ${only}:`)).join('\n') : SOCIAL_RULES;
  const jsonShape = '{' + keys.map((k) => `"${k}":"..."`).join(',') + '}';
  const system = `Eres un SOCIAL SEO MANAGER experto de Onyx Trading Live: escribes copies que hacen crecer las cuentas (gancho + valor + CTA + hashtags precisos), sin sonar a anuncio. ${GUARDRAIL}\n\n${L} A partir del artículo escribe el texto para ${only ? `la red "${only}"` : 'CADA red'}, optimizado a su estilo, longitud y algoritmo. El copy y los hashtags SIEMPRE en el mismo idioma (${es ? 'español' : 'inglés'}); no traduzcas a medias ni dejes hashtags en el otro idioma.\n${rules}\n\nDevuelve SOLO este JSON: ${jsonShape}`;
  const user = `Título: ${title}\nResumen: ${excerpt}\nURL (solo de referencia, NO la incluyas en el texto salvo que la red lo pida): ${url}`;
  const out = parseJson(await aiRaw(system, user, only ? 500 : 1600));
  if (!out) return { ok: false, reason: 'ai_failed' };
  const copy: Record<string, string> = {};
  for (const k of keys) if (out[k]) copy[k] = String(out[k]).slice(0, 3000);
  if (!Object.keys(copy).length) return { ok: false, reason: 'ai_failed' };
  return { ok: true, copy };
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
