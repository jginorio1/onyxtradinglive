import { brandBrief } from '@/lib/supportAI';

// ============================================================
// IA para redactar y modificar correos del Centro de correos.
//   - 'draft'   : escribe un correo nuevo desde una instrucción/tema.
//   - 'rewrite' : reescribe/mejora el texto actual (más claro, más cálido,
//                 más corto, traducir, etc.) sin inventar funciones.
// Devuelve asunto + cuerpo en ES y EN, conservando las variables {var}.
// Nada se envía aquí: el resultado es texto editable.
// ============================================================

export type EmailDraft = { subject_es: string; body_es: string; subject_en: string; body_en: string };

function stripFences(s: string) { return s.replace(/```json/gi, '').replace(/```/g, '').trim(); }

const TONE: Record<string, string> = {
  friendly: 'Tono cercano y cálido, humano, como un mensaje de un amigo que sabe de trading.',
  pro: 'Tono profesional, claro y sobrio, sin exagerar.',
  urgent: 'Tono con urgencia sana (tiempo limitado), sin ser agresivo ni alarmista.',
  promo: 'Tono comercial y directo, enfocado en el beneficio, con una CTA clara.',
};

async function callAI(system: string, user: string, maxTokens = 1300): Promise<any | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 3000) }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('correos', data)).catch(() => {});
    const raw = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    try { return JSON.parse(stripFences(raw)); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} } return null; }
  } catch { return null; }
}

// vars: lista de variables permitidas (ej. ['plan','nombre','enlace']). La IA
// debe conservarlas con llaves simples {asi} y no inventar otras.
export async function draftEmail(opts: {
  mode?: 'draft' | 'rewrite';
  instruction: string;
  tone?: string;
  vars?: string[];
  currentEs?: { subject?: string; body?: string };
  currentEn?: { subject?: string; body?: string };
}): Promise<{ ok: boolean; draft?: EmailDraft; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };

  const vars = (opts.vars || []).map((v) => '{' + v + '}');
  const varsRule = vars.length
    ? `VARIABLES: conserva exactamente estas variables con llaves simples donde tengan sentido: ${vars.join(', ')}. Usa {nombre} en el saludo si existe; {enlace} en la llamada a la acción si existe. No inventes otras variables.`
    : 'No uses variables entre llaves.';

  const cur = (opts.mode === 'rewrite')
    ? `\n\nTEXTO ACTUAL a mejorar —\nES asunto: "${opts.currentEs?.subject || ''}"\nES cuerpo: "${(opts.currentEs?.body || '').slice(0, 1500)}"\nEN asunto: "${opts.currentEn?.subject || ''}"\nEN cuerpo: "${(opts.currentEn?.body || '').slice(0, 1500)}"`
    : '';

  const system = `Eres el redactor de correos de Onyx Trading Live. Escribes correos transaccionales claros, cálidos y honestos, con la voz de la marca. NUNCA inventes funciones ni prometas rentabilidad ni des consejo financiero. Usa el CONOCIMIENTO DE ONYX de abajo como única fuente de verdad del producto. ${TONE[opts.tone || 'friendly'] || TONE.friendly}
PLATAFORMAS: si mencionas las plataformas compatibles, Onyx es MULTIPLATAFORMA y soporta MetaTrader (MT4 y MT5), cTrader, MatchTrader, TradeLocker y DXtrade. NUNCA listes solo MT4/MT5/cTrader dejando fuera MatchTrader, TradeLocker o DXtrade; o las nombras todas o dices "tu plataforma" en general.
${varsRule}
Sé breve (máx ~120 palabras por idioma). Como mucho 1-2 emojis, con criterio.

Devuelve SOLO un objeto JSON válido, sin texto extra, con EXACTAMENTE estas claves:
{"subject_es":"...","body_es":"...","subject_en":"...","body_en":"..."}

=== CONOCIMIENTO DE ONYX ===
${await brandBrief('es')}`;

  const user = `${opts.mode === 'rewrite' ? 'Reescribe/mejora este correo' : 'Escribe un correo nuevo'} según esta instrucción del dueño: "${opts.instruction}".${cur}\nDevuelve asunto y cuerpo en español y en inglés (traducción natural, no literal).`;

  const parsed = await callAI(system, user, 1400);
  if (!parsed) return { ok: false, reason: 'parse' };
  const draft: EmailDraft = {
    subject_es: String(parsed.subject_es || '').slice(0, 200),
    body_es: String(parsed.body_es || '').slice(0, 4000),
    subject_en: String(parsed.subject_en || '').slice(0, 200),
    body_en: String(parsed.body_en || '').slice(0, 4000),
  };
  if (!draft.body_es && !draft.body_en) return { ok: false, reason: 'empty' };
  return { ok: true, draft };
}
