import { ONYX_BRIEF, brandBrief } from '@/lib/supportAI';
import { segmentLabel } from '@/lib/segments';

// ============================================================
// Borrador de campaña con IA. Genera asunto + cuerpo (ES y EN) a partir de un
// tema/instrucción del owner, usando el "cerebro" de Onyx para que suene a la
// marca y no invente funciones. Devuelve texto editable — nada se envía aquí.
// ============================================================

export type Draft = { subject_es: string; body_es: string; subject_en: string; body_en: string };
export type TitlePair = { es: string; en: string };

function stripFences(s: string) { return s.replace(/```json/gi, '').replace(/```/g, '').trim(); }

// Tonos disponibles para que el owner controle la voz del correo.
const TONE: Record<string, string> = {
  friendly: 'Tono cercano y cálido, como un mensaje de un amigo que sabe de trading.',
  urgent: 'Tono con urgencia sana (tiempo limitado, no te lo pierdas), sin ser agresivo ni alarmista.',
  promo: 'Tono comercial y directo, enfocado en el beneficio y la oferta, con una CTA clara.',
  informative: 'Tono informativo y sobrio, para novedades o avisos, sin exagerar.',
};

// Instrucción común de VARIABLES: la IA debe integrarlas de forma natural.
const VARS_RULE = `VARIABLES OBLIGATORIAS: integra de forma natural {{nombre}} (nombre del trader), {{plan}} (su plan actual) y {{sitio}} (dominio del sitio) donde tengan sentido. Usa {{nombre}} en el asunto Y en el saludo del cuerpo. Usa {{sitio}}/ruta en las llamadas a la acción (ej. {{sitio}}/pricing, {{sitio}}/dashboard). Menciona {{plan}} cuando el mensaje hable del plan del usuario. Escribe las variables EXACTAMENTE así, con dobles llaves.`;

async function callAI(system: string, user: string, maxTokens = 1200): Promise<any | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 2200) }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('campanas', data)).catch(() => {});
    const raw = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    try { return JSON.parse(stripFences(raw)); } catch { const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (m) { try { return JSON.parse(m[0]); } catch {} } return null; }
  } catch { return null; }
}

// ---- Sugerencias de ASUNTO (como el blog): 5 opciones ES/EN para elegir ----
export async function suggestSubjects(opts: { topic: string; segment: string; tone?: string }): Promise<{ ok: boolean; titles?: TitlePair[]; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const audience = `${segmentLabel(opts.segment, 'es')} / ${segmentLabel(opts.segment, 'en')}`;
  const system = `Eres el redactor de marketing de Onyx Trading Live. Propón asuntos de correo atractivos, honestos y con la voz de la marca. NUNCA prometas rentabilidad ni des consejo financiero. ${TONE[opts.tone || 'friendly'] || TONE.friendly}
${VARS_RULE}
Devuelve SOLO un array JSON de 5 objetos, sin texto extra: [{"es":"...","en":"..."}, ...]. Cada asunto: máx ~9 palabras, 0-1 emoji.

=== CONOCIMIENTO DE ONYX ===
${await brandBrief('es')}`;
  const user = `Propón 5 asuntos de correo.\nAudiencia: ${audience}.\nTema/instrucción: "${opts.topic}".\nDa cada asunto en español y su versión natural en inglés.`;
  const parsed = await callAI(system, user, 700);
  if (!parsed || !Array.isArray(parsed)) return { ok: false, reason: 'parse' };
  const titles = parsed.slice(0, 6).map((t: any) => ({ es: String(t.es || '').slice(0, 200), en: String(t.en || t.es || '').slice(0, 200) })).filter((t: TitlePair) => t.es || t.en);
  if (!titles.length) return { ok: false, reason: 'empty' };
  return { ok: true, titles };
}

export async function draftCampaign(opts: { topic: string; segment: string; tone?: string; subject_es?: string; subject_en?: string }): Promise<{ ok: boolean; draft?: Draft; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };

  const audience = `${segmentLabel(opts.segment, 'es')} / ${segmentLabel(opts.segment, 'en')}`;
  const fixedSubject = (opts.subject_es || opts.subject_en)
    ? `\nEl owner YA eligió el asunto (respétalo tal cual): ES="${opts.subject_es || ''}" / EN="${opts.subject_en || ''}". Devuélvelo igual en subject_es/subject_en y escribe el cuerpo acorde.` : '';
  const system = `Eres el redactor de marketing de Onyx Trading Live. Escribes correos de seguimiento cercanos, claros y honestos, que suenan a la marca. NUNCA inventes funciones ni des consejo financiero, ni prometas rentabilidad. Usa el CONOCIMIENTO DE ONYX de abajo como única fuente de verdad del producto. ${TONE[opts.tone || 'friendly'] || TONE.friendly}
${VARS_RULE}
Incluye 1-2 emojis con criterio y una CTA con {{sitio}}/ruta. Sé breve (máx ~120 palabras por idioma).

Devuelve SOLO un objeto JSON válido, sin texto extra, con EXACTAMENTE estas claves:
{"subject_es": "...", "body_es": "...", "subject_en": "...", "body_en": "..."}

=== CONOCIMIENTO DE ONYX ===
${await brandBrief('es')}`;

  const user = `Escribe un correo de campaña.\nAudiencia: ${audience}.\nTema/instrucción del owner: "${opts.topic}".${fixedSubject}\nGenera asunto y cuerpo en español y en inglés (traducción natural, no literal), integrando las variables.`;

  const parsed = await callAI(system, user, 1300);
  if (!parsed) return { ok: false, reason: 'parse' };
  const draft: Draft = {
    subject_es: String(opts.subject_es || parsed.subject_es || '').slice(0, 200),
    body_es: String(parsed.body_es || '').slice(0, 4000),
    subject_en: String(opts.subject_en || parsed.subject_en || '').slice(0, 200),
    body_en: String(parsed.body_en || '').slice(0, 4000),
  };
  if (!draft.body_es && !draft.body_en) return { ok: false, reason: 'empty' };
  return { ok: true, draft };
}
