// Onyx AI para las guías: genera una guía bilingüe completa (título, resumen,
// cuerpo por bloques y SEO) o mejora un texto. Reutiliza ANTHROPIC_API_KEY.
// El cuerpo usa SOLO los tipos de bloque que el editor entiende:
//   { p } { h } { tip } { note } { warn } { list:[] } { steps:[] }

const MODEL = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';

async function ai(system: string, user: string, maxTokens = 2200): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error('ai http ' + r.status);
  const data = await r.json();
  import('@/lib/aiCost').then((m) => m.logAiUsage('guide', data)).catch(() => {});
  return (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
}

function parseJson(raw: string): any {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}');
  return JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned);
}

const SYS = `Eres redactor de la guía de ayuda de Onyx Trading Live. Escribes guías claras, cálidas y para principiantes, sin jerga. Bilingüe: español (es) e inglés (en).

Devuelve SOLO un objeto JSON válido, sin texto alrededor, con esta forma exacta:
{
 "title": {"es":"", "en":""},
 "summary": {"es":"", "en":""},
 "body": {"es":[bloques], "en":[bloques]},
 "seo": {"title":{"es":"","en":""}, "desc":{"es":"","en":""}, "keywords":{"es":["",""], "en":["",""]}}
}

Cada "bloque" es uno de estos objetos (usa SOLO estos tipos):
 {"h":"subtítulo H2"}
 {"p":"párrafo"}
 {"tip":"consejo","title":"opcional"}
 {"note":"nota","title":"opcional"}
 {"warn":"advertencia honesta"}
 {"list":["punto","punto"]}
 {"steps":["paso 1","paso 2"]}

Reglas de contenido:
- El cuerpo debe tener 5–9 bloques, empezando por un párrafo, con al menos 2 subtítulos H2.
- Coloca la keyword objetivo de forma natural en el título (H1), en el primer párrafo y en un H2.
- Nada de markdown dentro de los textos (ni *, #, -, ni comillas raras).
- SEO: "title" ≤ 60 caracteres con la keyword; "desc" ≤ 155 caracteres; 3–6 keywords por idioma.
- No prometas ganancias ni des señales de mercado.`;

export async function generateGuide(topic: string, keyword?: string): Promise<{ ok: boolean; article?: any; reason?: string }> {
  try {
    const user = `Tema de la guía: ${topic}\nKeyword objetivo: ${keyword || topic}\nEscribe la guía completa en JSON.`;
    const raw = await ai(SYS, user, 2600);
    const j = parseJson(raw);
    if (!j || !j.title) return { ok: false, reason: 'sin resultado' };
    return { ok: true, article: j };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'error' };
  }
}

// Mejora/pule un texto suelto (un párrafo o varios) manteniendo el significado.
export async function improveText(text: string, lang: 'es' | 'en'): Promise<{ ok: boolean; text?: string; reason?: string }> {
  try {
    const sys = lang === 'en'
      ? 'You polish help-guide text for beginners: clearer, warmer, no jargon, no markdown. Reply with ONLY the improved text, same language, nothing else.'
      : 'Pules texto de una guía de ayuda para principiantes: más claro, cálido, sin jerga, sin markdown. Responde SOLO con el texto mejorado, mismo idioma, nada más.';
    const out = await ai(sys, text.slice(0, 4000), 900);
    return { ok: true, text: out.replace(/```/g, '').trim() };
  } catch (e: any) { return { ok: false, reason: e?.message || 'error' }; }
}

// Texto alternativo (alt) bilingüe para una imagen, a partir del contexto.
export async function altText(context: string): Promise<{ ok: boolean; es?: string; en?: string; reason?: string }> {
  try {
    const raw = await ai(
      'Escribe texto alternativo (alt) breve y descriptivo para una imagen de una guía. Devuelve SOLO JSON {"es":"","en":""}. Máx 120 caracteres cada uno, sin comillas raras.',
      'Contexto de la imagen: ' + context.slice(0, 500), 300);
    const j = parseJson(raw);
    return { ok: true, es: String(j.es || ''), en: String(j.en || '') };
  } catch (e: any) { return { ok: false, reason: e?.message || 'error' }; }
}
