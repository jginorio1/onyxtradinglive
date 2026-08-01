// ============================================================
// Copiloto AI del mentor (Onyx Academy). Genera títulos, "about", descripciones
// de cursos/lecciones, texto de ventas y posts para la comunidad.
// LÍNEA ROJA: nunca promete ganancias garantizadas, ni da señales/predicciones del
// mercado. Copy honesto, claro y motivador — sin hype engañoso.
// ============================================================

import type { Lang } from './navText';
import { aiLangDirective, enBase, LANG_NAME , dictFor } from '@/lib/i18n';

function langNote(lang: Lang): string {
  return lang === 'es' ? '' : `\n\nEscribe TODO en ${LANG_NAME[lang] || 'English'}, con estilo nativo y natural.`;
}

async function ai(system: string, user: string, maxTokens = 700): Promise<string | null> {
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

const GUARD = {
  es: 'Reglas: es una academia de trading. NUNCA prometas ganancias garantizadas, ni des señales o predicciones del mercado, ni cifras de rentabilidad inventadas. Nada de hype engañoso. Enfócate en educación, comunidad, disciplina y valor real. Español neutro. IMPORTANTE DE FORMATO: escribe en TEXTO PLANO. Prohibido usar markdown: nada de #, ##, ###, **, __, ni asteriscos ni almohadillas para dar formato. No pongas títulos con # ni negritas con **.',
  en: 'Rules: it is a trading academy. NEVER promise guaranteed profits, market signals/predictions, or made-up returns. No misleading hype. Focus on education, community, discipline and real value. Natural English. FORMAT: write in PLAIN TEXT. No markdown allowed: no #, ##, ###, **, __, no asterisks or hashes for formatting. No # headings, no ** bold.',
};

// Quita restos de markdown que el modelo pueda colar (#, **, __, viñetas *).
function stripMd(t: string): string {
  return (t || '')
    .replace(/^#{1,6}\s*/gm, '')      // encabezados #
    .replace(/\*\*(.+?)\*\*/g, '$1')  // **negrita**
    .replace(/__(.+?)__/g, '$1')      // __negrita__
    .replace(/(^|\s)\*(?!\s)([^*\n]+?)\*(?=\s|$)/g, '$1$2') // *cursiva*
    .replace(/^\s*[-*]\s+/gm, '• ')   // viñetas - o * → •
    .replace(/`{1,3}/g, '')           // backticks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const NO_EMOJI = { es: ' No uses emojis.', en: ' Do not use emojis.' };
const YES_EMOJI = { es: ' Puedes usar emojis con medida (1-3), donde aporten.', en: ' You may use emojis sparingly (1-3), where they add value.' };

// Moderación de imágenes con visión. Devuelve { safe }. Si no hay API key o falla
// la llamada, deja pasar (fail-open) para no romper la subida; solo BLOQUEA cuando
// el modelo marca claramente contenido sexual/explícito o indebido.
export async function moderateImage(mediaType: string, base64Data: string): Promise<{ safe: boolean; checked: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { safe: true, checked: false };
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 8,
        system: 'You are an image safety filter for a trading community. Reply with a single word: BLOCK if the image contains sexual/pornographic/nudity content, sexualized minors, gore, or graphic violence; otherwise SAFE. Trading charts, screenshots, people dressed normally, memes and logos are SAFE.',
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: 'Classify: SAFE or BLOCK.' },
        ] }],
      }),
    });
    if (!r.ok) return { safe: true, checked: false };
    const d = await r.json();
    const out = (d?.content || []).map((c: any) => c.text || '').join(' ').toUpperCase();
    return { safe: !out.includes('BLOCK'), checked: true };
  } catch { return { safe: true, checked: false }; }
}

// Boletín de auditoría del alumno: repaso honesto de su track record real, para
// que el mentor lo califique. Solo pasado, sin predicciones ni promesas.
export async function auditStudent(name: string, stats: { trades: number; winRate: number; profitFactor: number }, period: string, lang: Lang = 'es'): Promise<string | null> {
  const g = (dictFor(GUARD, lang)) + langNote(lang);
  const sys = `${g} Eres un mentor de trading revisando el rendimiento REAL de un alumno para darle un boletín. Estructura: (1) una nota/valoración general en 1 frase, (2) 2-3 fortalezas, (3) 2-3 puntos a mejorar (disciplina, gestión de riesgo, consistencia), (4) 1 recomendación concreta de hábito. Directo y motivador, sin promesas de dinero ni predicciones.`;
  const user = (lang === 'es' ? `Alumno: ${name}. Últimos ${period}. Operaciones: ${stats.trades}, aciertos: ${stats.winRate}%, profit factor: ${stats.profitFactor}.` : `Student: ${name}. Last ${period}. Trades: ${stats.trades}, win rate: ${stats.winRate}%, profit factor: ${stats.profitFactor}.`);
  return ai(sys, user, 500);
}

// Resumen semanal de la comunidad para el mentor (a partir de métricas reales).
export async function communityDigest(stats: any, lang: Lang = 'es', emojis = true): Promise<string | null> {
  const g = (dictFor(GUARD, lang)) + (emojis ? (dictFor(YES_EMOJI, lang)) : (dictFor(NO_EMOJI, lang))) + langNote(lang);
  const sys = `${g} Eres el copiloto del mentor. Escribe un resumen BREVE de la semana de su comunidad de trading a partir de estas métricas. Estructura: (1) una frase de cómo va la comunidad, (2) 2-3 datos que destaquen (crecimiento, participación, logros), (3) 2-3 acciones concretas recomendadas para la próxima semana (ej: felicitar a X, reactivar inactivos, publicar sobre Y, recordar la clase). Directo y accionable. No inventes datos que no estén en las métricas.`;
  const user = (lang === 'es' ? 'Métricas de la semana: ' : 'This week metrics: ') + JSON.stringify(stats).slice(0, 3000);
  const text = await ai(sys, user, 500);
  return text ? stripMd(text) : null;
}

// Asistente del alumno: responde SOLO con la guía/base del mentor. Si no está
// cubierto, invita a preguntar al mentor. Nunca da señales ni promete ganancias.
export async function assistantAnswer(question: string, kb: string, academy: string, lang: Lang = 'es', emojis = true): Promise<string | null> {
  const g = (dictFor(GUARD, lang)) + (emojis ? (dictFor(YES_EMOJI, lang)) : (dictFor(NO_EMOJI, lang))) + langNote(lang);
  const ES = lang === 'es';
  const sys = `${g} Eres el asistente de la academia "${academy}". Responde la pregunta del alumno USANDO EXCLUSIVAMENTE la BASE DE CONOCIMIENTO de abajo (la guía del mentor). Si la respuesta no está en la base, dilo con honestidad y sugiere que le pregunten directamente a su mentor; NO inventes. No des señales de trading, predicciones ni promesas de ganancias. Responde claro y breve.\n\nBASE DE CONOCIMIENTO:\n${(kb || '').slice(0, 8000)}`;
  const user = (ES ? 'Pregunta del alumno: ' : 'Student question: ') + question.slice(0, 1000);
  const text = await ai(sys, user, 500);
  return text ? stripMd(text) : null;
}

export type CopilotKind = 'tagline' | 'about' | 'pitch' | 'course_desc' | 'lesson_desc' | 'post';

// Genera contenido para el mentor. `input` describe el contexto (nombre de la
// academia, tema del curso/lección, idea del post, etc.).
// opts: emojis (¿usar emojis?), brand (info de marca/voz del mentor), link (enlace
// de la academia para posts promocionales).
export async function academyCopilot(kind: CopilotKind, input: string, lang: Lang = 'es', opts?: { emojis?: boolean; brand?: string; link?: string }): Promise<{ ok: boolean; text?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const emoji = opts?.emojis ? (dictFor(YES_EMOJI, lang)) : (dictFor(NO_EMOJI, lang));
  const g = (dictFor(GUARD, lang)) + emoji + langNote(lang);
  const ES = lang === 'es';
  const brand = opts?.brand ? (ES ? `\nInfo de marca del mentor (úsala para escribir en su voz, sin copiarla literal):\n${opts.brand}` : `\nMentor brand info (use it to write in their voice, don't copy verbatim):\n${opts.brand}`) : '';
  const bullet = opts?.emojis ? '✅' : '•';

  const prompts: Record<CopilotKind, { sys: string; user: string; max: number }> = {
    tagline: {
      sys: `${g} Devuelve UN lema corto (máx 8 palabras), sin comillas.`,
      user: (ES ? 'Academia de trading: ' : 'Trading academy: ') + input + brand,
      max: 60,
    },
    about: {
      sys: `${g} Escribe un "sobre la academia" de 2-3 frases, cálido y claro. Sin títulos ni viñetas.`,
      user: (ES ? 'Contexto: ' : 'Context: ') + input + brand,
      max: 300,
    },
    pitch: {
      sys: `${g} Escribe una página de ventas breve para una comunidad de trading: 1 gancho, un bloque "¿Qué incluye tu acceso?" con 5-7 viñetas (usa "${bullet}" al inicio de cada una), y un cierre con llamado a la acción. Tono seguro pero honesto.`,
      user: (ES ? 'Detalles de la academia: ' : 'Academy details: ') + input + brand,
      max: 700,
    },
    course_desc: {
      sys: `${g} Escribe una descripción de curso de 1-2 frases, clara y concreta. Sin viñetas.`,
      user: (ES ? 'Curso/aula: ' : 'Course/classroom: ') + input + brand,
      max: 200,
    },
    lesson_desc: {
      sys: `${g} Escribe notas/descripción de una lección: 2-4 frases o 3-5 viñetas con "${bullet}" con lo que el alumno aprenderá.`,
      user: (ES ? 'Lección: ' : 'Lesson: ') + input + brand,
      max: 300,
    },
    post: {
      sys: `${g} Redacta un post para la comunidad (announcement, motivación o lección del día). Directo, con energía, 2-5 frases. Sin promesas de dinero.${opts?.link ? (ES ? ` Si el post invita a unirse o es promocional, incluye este enlace al final en su propia línea: ${opts.link}` : ` If the post invites people to join or is promotional, add this link at the end on its own line: ${opts.link}`) : ''}`,
      user: (ES ? 'Idea del post: ' : 'Post idea: ') + input + brand,
      max: 350,
    },
  };
  const p = prompts[kind];
  if (!p) return { ok: false, reason: 'bad_kind' };
  const text = await ai(p.sys, p.user, p.max);
  return text ? { ok: true, text: stripMd(text) } : { ok: false, reason: 'ai_error' };
}
