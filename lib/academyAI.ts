// ============================================================
// Copiloto AI del mentor (Onyx Academy). Genera títulos, "about", descripciones
// de cursos/lecciones, texto de ventas y posts para la comunidad.
// LÍNEA ROJA: nunca promete ganancias garantizadas, ni da señales/predicciones del
// mercado. Copy honesto, claro y motivador — sin hype engañoso.
// ============================================================

type Lang = 'es' | 'en';

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
  es: 'Reglas: es una academia de trading. NUNCA prometas ganancias garantizadas, ni des señales o predicciones del mercado, ni cifras de rentabilidad inventadas. Nada de hype engañoso. Enfócate en educación, comunidad, disciplina y valor real. Español neutro.',
  en: 'Rules: it is a trading academy. NEVER promise guaranteed profits, market signals/predictions, or made-up returns. No misleading hype. Focus on education, community, discipline and real value. Natural English.',
};

export type CopilotKind = 'tagline' | 'about' | 'pitch' | 'course_desc' | 'lesson_desc' | 'post';

// Genera contenido para el mentor. `input` describe el contexto (nombre de la
// academia, tema del curso/lección, idea del post, etc.).
export async function academyCopilot(kind: CopilotKind, input: string, lang: Lang = 'es'): Promise<{ ok: boolean; text?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const g = GUARD[lang];
  const ES = lang === 'es';

  const prompts: Record<CopilotKind, { sys: string; user: string; max: number }> = {
    tagline: {
      sys: `${g} Devuelve UN lema corto (máx 8 palabras), sin comillas.`,
      user: (ES ? 'Academia de trading: ' : 'Trading academy: ') + input,
      max: 60,
    },
    about: {
      sys: `${g} Escribe un "sobre la academia" de 2-3 frases, cálido y claro. Sin títulos ni viñetas.`,
      user: (ES ? 'Contexto: ' : 'Context: ') + input,
      max: 300,
    },
    pitch: {
      sys: `${g} Escribe una página de ventas breve para una comunidad de trading: 1 gancho, un bloque "¿Qué incluye tu acceso?" con 5-7 viñetas (usa ✅), y un cierre con llamado a la acción. Tono seguro pero honesto.`,
      user: (ES ? 'Detalles de la academia: ' : 'Academy details: ') + input,
      max: 700,
    },
    course_desc: {
      sys: `${g} Escribe una descripción de curso de 1-2 frases, clara y concreta. Sin viñetas.`,
      user: (ES ? 'Curso/aula: ' : 'Course/classroom: ') + input,
      max: 200,
    },
    lesson_desc: {
      sys: `${g} Escribe notas/descripción de una lección: 2-4 frases o 3-5 viñetas con lo que el alumno aprenderá.`,
      user: (ES ? 'Lección: ' : 'Lesson: ') + input,
      max: 300,
    },
    post: {
      sys: `${g} Redacta un post para la comunidad (announcement, motivación o lección del día). Directo, con energía, 2-5 frases. Puede llevar 1-2 emojis. Sin promesas de dinero.`,
      user: (ES ? 'Idea del post: ' : 'Post idea: ') + input,
      max: 350,
    },
  };
  const p = prompts[kind];
  if (!p) return { ok: false, reason: 'bad_kind' };
  const text = await ai(p.sys, p.user, p.max);
  return text ? { ok: true, text } : { ok: false, reason: 'ai_error' };
}
