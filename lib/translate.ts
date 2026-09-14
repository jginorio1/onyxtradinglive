// ============================================================
// Traducción automática para el chat de Bot Lab.
//   · detectToEs(text)  → detecta idioma + traduce al español (lo que ves TÚ).
//   · fromEs(text,lang) → traduce tu respuesta en español al idioma del cliente.
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
  const lang = (targetLang || 'es').toLowerCase();
  if (!lang || lang.startsWith('es')) return text;
  const out = await anthropic(
    `Eres un traductor. Traduce el texto del usuario del español al idioma con código ISO "${lang}". Responde SOLO con la traducción, sin comillas ni explicaciones, manteniendo un tono cercano y profesional.`,
    text,
  );
  return out || text;
}
