// IA de CARRERAS: traduce una plaza en ambos sentidos (ES↔EN) y la audita con un
// puntaje y sugerencias específicas del rol. Reusa el cliente HTTP de Anthropic.

async function anthropic(system: string, user: string, maxTokens = 1200): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 8000) }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('carreras', d)).catch(() => {});
    return (d?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; }
}

function parseJson(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { return null; }
}

// Traduce los campos de la plaza al idioma destino ('en' o 'es').
export async function translateJob(src: { title?: string; summary?: string; description?: string; tags?: string[] }, to: 'en' | 'es'): Promise<{ title: string; summary: string; description: string; tags: string[] } | null> {
  const target = to === 'en' ? 'English' : 'Spanish';
  const system = `You translate job postings to ${target}. Keep the tone professional and natural (not literal). Preserve line breaks and structure. Reply ONLY with JSON: {"title":"","summary":"","description":"","tags":["",""]}. Translate tag words too but keep tech names as-is (React, Node, SQL).`;
  const user = JSON.stringify({ title: src.title || '', summary: src.summary || '', description: src.description || '', tags: src.tags || [] });
  const j = parseJson(await anthropic(system, user, 1600));
  if (!j) return null;
  return {
    title: String(j.title || src.title || ''), summary: String(j.summary || ''),
    description: String(j.description || ''), tags: Array.isArray(j.tags) ? j.tags.map((t: any) => String(t)).slice(0, 12) : (src.tags || []),
  };
}

export type AuditItem = { level: 'good' | 'warn' | 'info'; text: string };

// Audita la plaza: puntaje 0-100 + sugerencias según el rol.
export async function auditJob(job: any, lang: 'es' | 'en' = 'es'): Promise<{ score: number; items: AuditItem[]; ai: boolean }> {
  const es = lang === 'es';
  const facts = JSON.stringify({
    title: job.title, department: job.department, type: job.type, location: job.location,
    salary_range: job.salary_range, summary: job.summary, description: job.description, tags: job.tags,
  });
  const system = es
    ? 'Eres reclutador senior. Audita esta vacante y responde SOLO con JSON: {"score": 0-100, "items": [{"level":"good|warn|info","text":"sugerencia corta y accionable"}]}. Juzga según el ROL: claridad del título, resumen (ni vago ni larguísimo), descripción con responsabilidades y requisitos, salario visible, ubicación/zona horaria si es remoto, cómo postularse, etiquetas/skills acordes al puesto, lenguaje inclusivo y requisitos realistas. Da 3-6 items, en español.'
    : 'You are a senior recruiter. Audit this job posting and reply ONLY with JSON: {"score": 0-100, "items": [{"level":"good|warn|info","text":"short actionable tip"}]}. Judge by ROLE: title clarity, summary (not vague nor too long), description with responsibilities and requirements, visible salary, location/timezone if remote, how to apply, tags/skills fitting the role, inclusive language and realistic requirements. Give 3-6 items.';
  const j = parseJson(await anthropic(system, facts, 900));
  if (j && typeof j.score === 'number' && Array.isArray(j.items)) {
    const items = j.items.map((it: any) => ({ level: ['good', 'warn', 'info'].includes(it.level) ? it.level : 'info', text: String(it.text || '') })).filter((x: AuditItem) => x.text).slice(0, 6);
    return { score: Math.max(0, Math.min(100, Math.round(j.score))), items, ai: true };
  }
  // Respaldo por reglas si la IA no está disponible.
  const items: AuditItem[] = [];
  let score = 60;
  if (job.salary_range) { items.push({ level: 'good', text: es ? 'Rango salarial visible: aumenta las postulaciones.' : 'Salary range visible: boosts applications.' }); score += 12; } else items.push({ level: 'warn', text: es ? 'Añade un rango salarial.' : 'Add a salary range.' });
  if (!job.description || job.description.length < 120) { items.push({ level: 'warn', text: es ? 'Descripción muy corta: añade responsabilidades y requisitos.' : 'Description too short: add responsibilities and requirements.' }); } else score += 12;
  if (!(job.tags || []).length) items.push({ level: 'info', text: es ? 'Añade etiquetas/skills del puesto.' : 'Add role skills as tags.' }); else score += 8;
  if (!/aplica|postul|cv|apply|resume/i.test(job.description || '')) items.push({ level: 'info', text: es ? 'Indica cómo postularse (CV, portafolio).' : 'Say how to apply (CV, portfolio).' });
  return { score: Math.min(100, score), items, ai: false };
}
