import { ONYX_BRIEF } from '@/lib/supportAI';
import { segmentLabel } from '@/lib/segments';

// ============================================================
// Borrador de campaña con IA. Genera asunto + cuerpo (ES y EN) a partir de un
// tema/instrucción del owner, usando el "cerebro" de Onyx para que suene a la
// marca y no invente funciones. Devuelve texto editable — nada se envía aquí.
// ============================================================

export type Draft = { subject_es: string; body_es: string; subject_en: string; body_en: string };

function stripFences(s: string) { return s.replace(/```json/gi, '').replace(/```/g, '').trim(); }

export async function draftCampaign(opts: { topic: string; segment: string }): Promise<{ ok: boolean; draft?: Draft; reason?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no_key' };

  const audience = `${segmentLabel(opts.segment, 'es')} / ${segmentLabel(opts.segment, 'en')}`;
  const system = `Eres el redactor de marketing de Onyx Trading Live. Escribes correos de seguimiento cercanos, claros y honestos, que suenan a la marca. NUNCA inventes funciones ni des consejo financiero, ni prometas rentabilidad. Usa el CONOCIMIENTO DE ONYX de abajo como única fuente de verdad del producto. Puedes usar {{nombre}} donde vaya el nombre del trader. Incluye 1-2 emojis con criterio y una llamada a la acción con un enlace del sitio (usa {{sitio}}/... para rutas, por ejemplo {{sitio}}/dashboard o {{sitio}}/pricing). Sé breve (máx ~120 palabras por idioma).

Devuelve SOLO un objeto JSON válido, sin texto extra, con EXACTAMENTE estas claves:
{"subject_es": "...", "body_es": "...", "subject_en": "...", "body_en": "..."}

=== CONOCIMIENTO DE ONYX ===
${ONYX_BRIEF.es}`;

  const user = `Escribe un correo de campaña.\nAudiencia: ${audience}.\nTema/instrucción del owner: "${opts.topic}".\nGenera asunto y cuerpo en español y en inglés (traducción natural, no literal).`;

  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1200, system, messages: [{ role: 'user', content: user.slice(0, 2000) }] }),
    });
    if (!r.ok) return { ok: false, reason: 'error' };
    const data = await r.json();
    const raw = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    let parsed: any;
    try { parsed = JSON.parse(stripFences(raw)); } catch { return { ok: false, reason: 'parse' }; }
    const draft: Draft = {
      subject_es: String(parsed.subject_es || '').slice(0, 200),
      body_es: String(parsed.body_es || '').slice(0, 4000),
      subject_en: String(parsed.subject_en || '').slice(0, 200),
      body_en: String(parsed.body_en || '').slice(0, 4000),
    };
    if (!draft.subject_es && !draft.subject_en) return { ok: false, reason: 'empty' };
    return { ok: true, draft };
  } catch { return { ok: false, reason: 'error' }; }
}
