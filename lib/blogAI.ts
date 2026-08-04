import { ONYX_BRIEF } from '@/lib/supportAI';
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

// ---- Sugerencias de título ----
export async function suggestTitles(topic: string, lang: Lang = 'es'): Promise<{ ok: boolean; titles?: string[]; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const es = lang !== 'en';
  const system = `Eres el editor SEO de Onyx Trading Live. ${GUARDRAIL}\n\nCONTEXTO DE MARCA:\n${dictFor(ONYX_BRIEF, lang)}\n\nDevuelve SOLO un JSON: {"titles": ["...", ...]} con 6 títulos ${es ? 'en español' : 'in English'}, atractivos y optimizados para búsqueda (claros, con la palabra clave al inicio, 40-65 caracteres). Sin numerar, sin comillas dentro.`;
  const out = parseJson(await aiRaw(system, `Idea o tema: ${topic}`, 500));
  const titles = Array.isArray(out?.titles) ? out.titles.map((t: any) => String(t)).filter(Boolean).slice(0, 8) : null;
  if (!titles || !titles.length) return { ok: false, reason: 'ai_failed' };
  return { ok: true, titles };
}

// ---- Artículo completo bilingüe ----
export async function generateArticle(title: string): Promise<{ ok: boolean; article?: any; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const system = `Eres redactor de contenido SEO de Onyx Trading Live. ${GUARDRAIL}\n\nCONTEXTO DE MARCA (úsalo con naturalidad, sin sonar a anuncio):\n${dictFor(ONYX_BRIEF, 'es')}\n\nEscribe un artículo de blog COMPLETO sobre el título dado, en ESPAÑOL e INGLÉS. Formato markdown: usa subtítulos "## ", listas con "- " y **negritas** con moderación. 600-900 palabras por idioma, tono cercano y profesional para traders. Cierra invitando suavemente a usar Onyx (sin promesas). \n\nDevuelve SOLO este JSON (sin texto fuera):\n{"title_es":"...","title_en":"...","excerpt_es":"resumen 1-2 frases","excerpt_en":"1-2 sentence summary","body_es":"markdown en español","body_en":"markdown in English","tags":"3-6 palabras clave separadas por coma"}`;
  const out = parseJson(await aiRaw(system, `Título: ${title}`, 4000));
  if (!out || !out.body_es || !out.body_en) return { ok: false, reason: 'ai_failed' };
  return {
    ok: true,
    article: {
      title_es: String(out.title_es || title).slice(0, 200),
      title_en: String(out.title_en || title).slice(0, 200),
      excerpt_es: String(out.excerpt_es || '').slice(0, 400),
      excerpt_en: String(out.excerpt_en || '').slice(0, 400),
      body_es: String(out.body_es || '').slice(0, 20000),
      body_en: String(out.body_en || '').slice(0, 20000),
      tags: String(out.tags || '').slice(0, 300),
    },
  };
}
