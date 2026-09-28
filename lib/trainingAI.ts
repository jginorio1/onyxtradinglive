import { supabaseAdmin } from '@/lib/supabaseAdmin';

// IA de FORMACIÓN: genera preguntas de opción múltiple a partir del contenido
// real de una ruta (sus lecciones). Reusa el cliente HTTP de Anthropic.

async function anthropic(system: string, user: string, maxTokens = 2500): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 12000) }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('training', d)).catch(() => {});
    return (d?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function parseArray(raw: string | null): any[] {
  if (!raw) return [];
  try { const s = raw.indexOf('['), e = raw.lastIndexOf(']'); return JSON.parse(raw.slice(s, e + 1)); } catch { return []; }
}

// Genera N preguntas nuevas para una ruta y las inserta (bilingüe).
export async function generateQuestions(trackId: string, n = 8): Promise<{ ok: boolean; added: number; error?: string }> {
  const { data: t } = await supabaseAdmin.from('training_tracks').select('title_es,title_en').eq('id', trackId).maybeSingle();
  if (!t) return { ok: false, added: 0, error: 'ruta no encontrada' };
  const { data: lessons } = await supabaseAdmin.from('training_lessons').select('title_es,body_es').eq('track_id', trackId).order('sort', { ascending: true });
  const corpus = (lessons || []).map((l: any) => `## ${l.title_es}\n${l.body_es || ''}`).join('\n\n').slice(0, 10000);
  if (!corpus.trim()) return { ok: false, added: 0, error: 'La ruta no tiene lecciones con contenido.' };
  const { count } = await supabaseAdmin.from('training_questions').select('*', { count: 'exact', head: true }).eq('track_id', trackId);
  const startSort = count || 0;

  const system = 'Eres un diseñador experto de exámenes de formación para vendedores y equipos. Creas preguntas de opción múltiple claras, sin ambigüedad, basadas SOLO en el material dado. Cada pregunta: 4 opciones, una sola correcta, distractores plausibles pero incorrectos. Devuelve SOLO un arreglo JSON, sin texto extra.';
  const user = `Material de la ruta "${(t as any).title_es}":\n\n${corpus}\n\nGenera ${n} preguntas nuevas de opción múltiple (4 opciones cada una) que evalúen la comprensión real del material. Formato EXACTO (JSON): [{"prompt_es":"...","prompt_en":"...","options_es":["a","b","c","d"],"options_en":["a","b","c","d"],"correct":0,"explain_es":"...","explain_en":"..."}]. correct es el índice (0-3) de la opción correcta. Traduce al inglés en los campos _en.`;

  const raw = await anthropic(system, user);
  const arr = parseArray(raw);
  if (!arr.length) return { ok: false, added: 0, error: 'La IA no devolvió preguntas válidas. Reintenta.' };

  let added = 0;
  for (let i = 0; i < arr.length; i++) {
    const q = arr[i];
    const opEs = Array.isArray(q.options_es) ? q.options_es.slice(0, 6).map((x: any) => String(x).slice(0, 300)) : null;
    if (!q.prompt_es || !opEs || opEs.length < 2) continue;
    const opEn = Array.isArray(q.options_en) && q.options_en.length === opEs.length ? q.options_en.map((x: any) => String(x).slice(0, 300)) : opEs;
    const correct = Math.min(opEs.length - 1, Math.max(0, Number(q.correct) || 0));
    await supabaseAdmin.from('training_questions').insert({
      track_id: trackId,
      prompt_es: String(q.prompt_es).slice(0, 600), prompt_en: String(q.prompt_en || q.prompt_es).slice(0, 600),
      options_es: opEs, options_en: opEn, correct,
      explain_es: String(q.explain_es || '').slice(0, 600), explain_en: String(q.explain_en || q.explain_es || '').slice(0, 600),
      sort: startSort + i + 1,
    });
    added++;
  }
  return { ok: true, added };
}
