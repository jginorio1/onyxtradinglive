// IA de CARRERAS: traduce una plaza en ambos sentidos (ES↔EN) y la audita con un
// puntaje y sugerencias específicas del rol. Reusa el cliente HTTP de Anthropic.

async function anthropic(system: string, user: string, maxTokens = 1200): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000); // nunca colgar el servidor
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 8000) }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('carreras', d)).catch(() => {});
    return (d?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function parseJson(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { return null; }
}

// Contexto para plazas del EQUIPO DE VENTAS por comisión (Director/Lead/Advisor).
// Cambia el enfoque a ventas y evita salario fijo. Vacío si no es plaza de ventas.
function salesLine(level: any, es: boolean): string {
  const l = ['director', 'lead', 'advisor'].includes(level) ? level : '';
  if (!l) return '';
  const roleEs: Record<string, string> = {
    director: 'Director de ventas: lidera todo el equipo, define estrategia y metas, recluta y forma Leads/Advisors; gana comisión + override sobre el equipo.',
    lead: 'Lead de ventas: supervisa y entrena a un grupo de vendedores, asegura metas; gana comisión + override de su grupo.',
    advisor: 'Advisor (vendedor): prospecta, cierra y atiende clientes de los productos de Onyx; gana comisión por lo que vende.',
  };
  const roleEn: Record<string, string> = {
    director: 'Sales Director: leads the whole team, sets strategy and targets, recruits and coaches Leads/Advisors; earns commission + override on the team.',
    lead: 'Sales Lead: supervises and trains a group of sellers, ensures targets; earns commission + override on the group.',
    advisor: 'Advisor (seller): prospects, closes and serves customers of Onyx products; earns commission on what they sell.',
  };
  return es
    ? `\n\nIMPORTANTE — Es una plaza del EQUIPO DE VENTAS por COMISIÓN (NO nómina). ${roleEs[l]} Enfócate en VENTAS: prospección, cierre, atención al cliente, red/audiencia, metas y estructura de comisión. NO en marketing ni desarrollo. NO menciones ni pidas salario fijo: el pago es comisión recurrente (y override para Director/Lead).`
    : `\n\nIMPORTANT — This is a COMMISSION-based SALES TEAM role (NOT payroll). ${roleEn[l]} Focus on SALES: prospecting, closing, customer service, network/audience, targets and commission structure. NOT marketing or development. Do NOT mention or ask for a fixed salary: pay is recurring commission (plus override for Director/Lead).`;
}

// Compara un CV (PDF o imagen) contra la vacante. Envía el archivo a Claude como
// documento/imagen y pide un puntaje de encaje + resumen. Sin clave → null.
export async function matchCv(
  job: { title?: string; description?: string; tags?: string[] },
  file: { base64: string; mediaType: string },
  lang: 'es' | 'en' = 'es',
): Promise<{ score: number; summary: string; strengths: string[]; gaps: string[] } | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !file?.base64) return null;
  const es = lang === 'es';
  const isPdf = /pdf/i.test(file.mediaType);
  const system = es
    ? 'Eres reclutador senior. Compara el CV adjunto con la vacante y evalúa el ENCAJE. Responde SOLO con JSON: {"score":0-100,"summary":"1-2 frases","strengths":["",""],"gaps":["",""]}. Sé objetivo: score alto solo si cumple requisitos clave. strengths y gaps: 2-4 items cortos. No inventes datos que no estén en el CV.'
    : 'You are a senior recruiter. Compare the attached CV with the job and rate the FIT. Reply ONLY with JSON: {"score":0-100,"summary":"1-2 sentences","strengths":["",""],"gaps":["",""]}. Be objective: high score only if key requirements are met. strengths and gaps: 2-4 short items. Do not invent data not in the CV.';
  const jobText = `${es ? 'VACANTE' : 'JOB'}: ${job.title || ''}\n${es ? 'Etiquetas' : 'Tags'}: ${(job.tags || []).join(', ')}\n\n${job.description || ''}`.slice(0, 6000);
  const mt = isPdf ? 'application/pdf' : (file.mediaType || 'image/png');
  const doc = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mt, data: file.base64 } };
  // Modelo con visión/documentos (haiku a veces no lee PDF); permite override.
  const model = process.env.ONYX_AI_CV_MODEL || process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
  // Timeout para que el servidor nunca se quede colgado.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const headers: any = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal, headers,
      body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: 'user', content: [doc, { type: 'text', text: jobText }] }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('carreras', d)).catch(() => {});
    const raw = (d?.content || []).map((c: any) => c.text || '').join('\n').trim();
    const j = parseJson(raw);
    if (!j || typeof j.score !== 'number') return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(j.score))),
      summary: String(j.summary || ''),
      strengths: Array.isArray(j.strengths) ? j.strengths.map((x: any) => String(x)).slice(0, 5) : [],
      gaps: Array.isArray(j.gaps) ? j.gaps.map((x: any) => String(x)).slice(0, 5) : [],
    };
  } catch { return null; } finally { clearTimeout(timer); }
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

// Genera un BORRADOR completo de la plaza a partir del título (y contexto que ya
// haya). Rellena resumen, descripción y etiquetas. No inventa salario ni ubicación.
export async function draftJob(
  ctx: { title?: string; department?: string; type?: string; location?: string; salary_range?: string; summary?: string; description?: string; tags?: string[]; sales_level?: string },
  lang: 'es' | 'en' = 'es',
  company = '',
): Promise<{ title: string; summary: string; description: string; tags: string[] } | null> {
  const es = lang === 'es';
  const ctxLine = (company ? `\n\nSOBRE LA EMPRESA (úsalo: menciona las herramientas/sistemas reales y alinea con su dirección):\n${company}` : '') + salesLine(ctx.sales_level, es);
  const system = (es
    ? `Eres reclutador senior. A partir del contexto, redacta una vacante ATRACTIVA y profesional en español. Responde SOLO con JSON: {"title":"","summary":"","description":"","tags":["",""]}.
- title: mejóralo si es genérico (añade nivel/seniority si aplica), respetando la intención.
- summary: 1-2 frases para la tarjeta.
- description: usa saltos de línea reales. Incluye secciones: qué harás (responsabilidades), lo que buscamos (requisitos/skills), y qué ofrecemos. Realista, inclusivo, sin exagerar.
- tags: 4-8 skills/tecnologías del puesto. Mantén nombres técnicos como están (React, Node, SQL).
No inventes salario ni ubicación; usa los del contexto si vienen.`
    : `You are a senior recruiter. From the context, write an ATTRACTIVE, professional job posting in English. Reply ONLY with JSON: {"title":"","summary":"","description":"","tags":["",""]}.
- title: improve it if generic (add level/seniority if it fits), keeping the intent.
- summary: 1-2 sentences for the card.
- description: use real line breaks. Include sections: what you'll do (responsibilities), what we're looking for (requirements/skills), and what we offer. Realistic, inclusive, no hype.
- tags: 4-8 role skills/technologies. Keep tech names as-is (React, Node, SQL).
Do not invent salary or location; use the ones in the context if present.`) + ctxLine;
  const user = JSON.stringify({
    title: ctx.title || '', department: ctx.department || '', type: ctx.type || '', location: ctx.location || '',
    salary_range: ctx.salary_range || '', summary: ctx.summary || '', description: ctx.description || '', tags: ctx.tags || [],
  });
  const j = parseJson(await anthropic(system, user, 1800));
  if (!j) return null;
  return {
    title: String(j.title || ctx.title || ''), summary: String(j.summary || ''),
    description: String(j.description || ''), tags: Array.isArray(j.tags) ? j.tags.map((t: any) => String(t)).slice(0, 12) : (ctx.tags || []),
  };
}

// Sugiere SOLO las etiquetas/skills del puesto (sin tocar el resto). Devuelve
// una lista corta para que el admin las acepte con un clic.
export async function suggestSkills(
  ctx: { title?: string; department?: string; description?: string; sales_level?: string },
  lang: 'es' | 'en' = 'es',
  company = '',
): Promise<string[] | null> {
  const es = lang === 'es';
  const ctxLine = (company ? `\nEmpresa (prioriza skills acordes a su stack real): ${company}` : '') + salesLine(ctx.sales_level, es);
  const system = (es
    ? 'Eres reclutador técnico. Devuelve SOLO las habilidades/tecnologías clave del puesto. Responde SOLO con JSON: {"tags":["",""]}. 4-10 etiquetas cortas (1-2 palabras), sin frases. Mantén nombres técnicos como están (React, Node, SQL, Figma). Incluye 1-2 blandas si aplican (ej. Comunicación).'
    : 'You are a technical recruiter. Return ONLY the key skills/technologies for the role. Reply ONLY with JSON: {"tags":["",""]}. 4-10 short tags (1-2 words), no phrases. Keep tech names as-is (React, Node, SQL, Figma). Include 1-2 soft skills if relevant (e.g. Communication).') + ctxLine;
  const user = JSON.stringify({ title: ctx.title || '', department: ctx.department || '', description: (ctx.description || '').slice(0, 2000) });
  const j = parseJson(await anthropic(system, user, 400));
  if (!j || !Array.isArray(j.tags)) return null;
  return j.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 12);
}

export type AuditItem = { level: 'good' | 'warn' | 'info'; text: string };

// Reescribe la plaza APLICANDO las sugerencias de la auditoría. No inventa datos
// (salario exacto, métricas, fechas): para eso deja un marcador claro entre
// corchetes para que el dueño lo complete. Mejora estructura, claridad, cómo
// postularse, y nombra herramientas reales del stack.
export async function applyAudit(
  job: { title?: string; summary?: string; description?: string; tags?: string[]; salary_range?: string; location?: string; type?: string; department?: string; sales_level?: string },
  items: AuditItem[],
  lang: 'es' | 'en' = 'es',
  company = '',
): Promise<{ title: string; summary: string; description: string; tags: string[] } | null> {
  const es = lang === 'es';
  const sugg = (items || []).map((it) => `- ${it.text}`).join('\n').slice(0, 3000);
  const ctxLine = (company ? `\n\nEmpresa (nombra sus herramientas/stack reales cuando aplique):\n${company}` : '') + salesLine(job.sales_level, es);
  const system = (es
    ? `Eres reclutador senior. Reescribe la vacante APLICANDO las sugerencias de auditoría. Responde SOLO con JSON: {"title":"","summary":"","description":"","tags":["",""]}.
REGLAS:
- Aplica cada sugerencia que se pueda con el texto (estructura, claridad, responsabilidades, requisitos, cómo postularse, lenguaje inclusivo, skills del stack).
- NO inventes datos que no tengas: salario exacto, métricas, fechas o hechos. Para esos, escribe un marcador entre corchetes que el dueño rellenará, p. ej. "[definir rango]", "[meta: reducir CAC en X%]".
- Conserva lo que ya está bien. description con saltos de línea reales y secciones. tags 4-10, nombres técnicos como están.`
    : `You are a senior recruiter. Rewrite the job posting APPLYING the audit suggestions. Reply ONLY with JSON: {"title":"","summary":"","description":"","tags":["",""]}.
RULES:
- Apply every suggestion you can with text (structure, clarity, responsibilities, requirements, how to apply, inclusive language, stack skills).
- Do NOT invent data you don't have: exact salary, metrics, dates or facts. For those, write a bracketed placeholder for the owner to fill, e.g. "[set range]", "[goal: cut CAC by X%]".
- Keep what's already good. description with real line breaks and sections. tags 4-10, keep tech names as-is.`) + ctxLine;
  const user = JSON.stringify({
    current: { title: job.title || '', summary: job.summary || '', description: job.description || '', tags: job.tags || [], salary_range: job.salary_range || '', location: job.location || '', type: job.type || '', department: job.department || '' },
    suggestions: sugg,
  });
  const j = parseJson(await anthropic(system, user, 2000));
  if (!j) return null;
  return {
    title: String(j.title || job.title || ''), summary: String(j.summary || ''),
    description: String(j.description || ''), tags: Array.isArray(j.tags) ? j.tags.map((t: any) => String(t)).slice(0, 12) : (job.tags || []),
  };
}

// Audita la plaza: puntaje 0-100 + sugerencias según el rol.
export async function auditJob(job: any, lang: 'es' | 'en' = 'es', company = ''): Promise<{ score: number; items: AuditItem[]; ai: boolean }> {
  const es = lang === 'es';
  const facts = JSON.stringify({
    title: job.title, department: job.department, type: job.type, location: job.location,
    salary_range: job.salary_range, summary: job.summary, description: job.description, tags: job.tags,
  });
  const sl = salesLine(job.sales_level, es);
  const salesAudit = sl ? (es
    ? ' NO penalices la falta de salario fijo (es comisión); en su lugar evalúa si explica la estructura de comisión/override, metas, y qué red/audiencia y experiencia de ventas se busca.'
    : ' Do NOT penalize the lack of a fixed salary (it is commission); instead check whether it explains the commission/override structure, targets, and what sales network/audience and experience are sought.') : '';
  const ctxLine = (company ? `\nContexto de la empresa (revisa que la vacante encaje con su stack y rumbo, y sugiere nombrar las herramientas reales): ${company}` : '') + sl + salesAudit;
  const system = (es
    ? 'Eres reclutador senior. Audita esta vacante y responde SOLO con JSON: {"score": 0-100, "items": [{"level":"good|warn|info","text":"sugerencia corta y accionable"}]}. Juzga según el ROL: claridad del título, resumen (ni vago ni larguísimo), descripción con responsabilidades y requisitos, salario visible, ubicación/zona horaria si es remoto, cómo postularse, etiquetas/skills acordes al puesto, lenguaje inclusivo y requisitos realistas. Da 3-6 items, en español.'
    : 'You are a senior recruiter. Audit this job posting and reply ONLY with JSON: {"score": 0-100, "items": [{"level":"good|warn|info","text":"short actionable tip"}]}. Judge by ROLE: title clarity, summary (not vague nor too long), description with responsibilities and requirements, visible salary, location/timezone if remote, how to apply, tags/skills fitting the role, inclusive language and realistic requirements. Give 3-6 items.') + ctxLine;
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
