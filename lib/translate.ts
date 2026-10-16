// ============================================================
// Traducción automática para el chat (Bot Lab + Soporte bilingüe).
//   · detectToEs(text)        → detecta idioma + traduce al español (compat).
//   · fromEs(text,lang)       → traduce del español al idioma del cliente (compat).
//   · detectLang(text)        → solo detecta el idioma (código ISO 639-1).
//   · translateTo(text,to,from?) → traduce a cualquier idioma destino.
//   · detectTo(text,to)       → detecta el idioma del texto y lo traduce a `to`
//                                en UNA sola llamada (devuelve {lang, text}).
// Si no hay ANTHROPIC_API_KEY, devuelve el texto tal cual (sin romper nada).
// ============================================================
async function anthropic(system: string, user: string, maxTokens = 500): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 2000) }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('botlab_chat', data)).catch(() => {});
    return (data?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; }
}

// Detecta el idioma (código ISO 639-1) y traduce al español.
export async function detectToEs(text: string): Promise<{ lang: string; es: string }> {
  const raw = await anthropic(
    'Eres un traductor. Detecta el idioma del mensaje del usuario y tradúcelo al español natural. Responde SOLO un JSON válido: {"lang":"<código ISO 639-1, ej: en, ar, vi, pt, zh>","es":"<traducción al español>"}. No agregues nada más.',
    text,
  );
  if (!raw) return { lang: 'es', es: text };
  try {
    const j = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return { lang: String(j.lang || 'es').slice(0, 5), es: String(j.es || text) };
  } catch { return { lang: 'es', es: text }; }
}

// Traduce un texto en español al idioma destino. Si es español o no hay clave, lo deja igual.
export async function fromEs(text: string, targetLang: string): Promise<string> {
  return translateTo(text, targetLang, 'es');
}

// Normaliza un código de idioma a su raíz ISO 639-1 (en-US -> en, pt-BR -> pt).
export function normLang(code: string): string {
  return String(code || '').toLowerCase().trim().split(/[-_]/)[0].slice(0, 5);
}

// Solo detecta el idioma del texto (código ISO 639-1). 'es' si no hay clave.
export async function detectLang(text: string): Promise<string> {
  const raw = await anthropic(
    'Detecta el idioma del mensaje y responde SOLO con su código ISO 639-1 en minúsculas (ej: en, es, pt, fr, ar, zh, vi). Nada más.',
    text,
    8,
  );
  return normLang(raw || 'es') || 'es';
}

// Traduce `text` al idioma `to`. `from` es opcional (ayuda al modelo). Si el
// origen y destino coinciden, o no hay clave, devuelve el texto tal cual.
export async function translateTo(text: string, to: string, from = ''): Promise<string> {
  const t = normLang(to);
  const f = normLang(from);
  const clean = String(text || '').trim();
  if (!clean || !t || (f && f === t)) return text;
  const fromHint = f ? `del idioma "${f}" ` : '';
  const out = await anthropic(
    `Eres un traductor. Traduce el texto del usuario ${fromHint}al idioma con código ISO "${t}". Responde SOLO con la traducción, sin comillas ni explicaciones, manteniendo un tono cercano y profesional. Si ya está en ese idioma, devuélvelo igual.`,
    clean,
  );
  return out || text;
}

// Detecta el idioma del texto y lo traduce a `to` en una sola llamada.
// Devuelve { lang: idioma detectado del original, text: traducción a `to` }.
export async function detectTo(text: string, to: string): Promise<{ lang: string; text: string }> {
  const t = normLang(to) || 'es';
  const clean = String(text || '').trim();
  if (!clean) return { lang: t, text };
  const raw = await anthropic(
    `Eres un traductor. Detecta el idioma del mensaje del usuario y tradúcelo al idioma con código ISO "${t}" de forma natural. Responde SOLO un JSON válido: {"lang":"<código ISO 639-1 del ORIGINAL>","text":"<traducción al idioma ${t}>"}. No agregues nada más.`,
    clean,
  );
  if (!raw) return { lang: t, text };
  try {
    const j = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return { lang: normLang(j.lang || t) || t, text: String(j.text || text) };
  } catch { return { lang: t, text }; }
}
