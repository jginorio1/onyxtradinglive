// ============================================================
// Piloto automático del blog.
//   · planMonth()    → crea N fechas programadas (día sí, día no) que se ven
//                      llenas en el calendario. Cada fecha guarda su TEMA pero el
//                      cuerpo va vacío (se genera después, justo a tiempo).
//   · fillDueSlots() → el cron genera el contenido de las fechas próximas cuyo
//                      cuerpo aún está vacío, y las deja listas para publicarse.
//   Los temas salen, al azar, de la lista pegada por el dueño + las keywords SEO.
// ============================================================
import { blogAutopilotSettings, blogKeywordsSettings, saveSetting, type BlogAutopilot } from '@/lib/settings';
import { generateArticle, lastAiError, type KwGuide, type RelatedPost } from '@/lib/blogAI';
import { listAllPosts, savePost } from '@/lib/blog';

const DAY = 24 * 3600 * 1000;
const empty = (p: any) => !String(p.body_es || '').trim() && !String(p.body_en || '').trim();

// Guía SEO (keyword objetivo = la menos cubierta) para el generador.
async function guideFor(): Promise<KwGuide | undefined> {
  const s = await blogKeywordsSettings();
  if (!s.enabled || (!s.es?.length && !s.en?.length)) return undefined;
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  const cov = (kw: string) => posts.filter((p) => (`${p.title_es || ''} ${p.body_es || ''} ${p.title_en || ''} ${p.body_en || ''}`).toLowerCase().includes(kw.toLowerCase())).length;
  const pick = (list: string[]) => { let best = list[0], bc = Infinity; for (const k of list) { const c = cov(k); if (c < bc) { bc = c; best = k; } } return best; };
  const targetEs = s.es?.length ? pick(s.es) : undefined;
  const targetEn = s.en?.length ? pick(s.en) : undefined;
  return {
    targetEs, targetEn,
    moreEs: (s.es || []).filter((k) => k !== targetEs).slice(0, 3),
    moreEn: (s.en || []).filter((k) => k !== targetEn).slice(0, 3),
    intensity: s.intensity, variants: s.variants, internalLinks: s.internalLinks,
    pillar: (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '') + '/pricing',
  };
}

// Fuente de temas: lista pegada + keywords, mezcladas. Devuelve {t: tema, kw: keyword}.
async function buildPool(cfg: BlogAutopilot): Promise<{ t: string; kw?: string }[]> {
  const pool: { t: string; kw?: string }[] = [];
  for (const t of (cfg.topics || [])) { const v = String(t).trim(); if (v) pool.push({ t: v }); }
  if (cfg.useKeywords) { const s = await blogKeywordsSettings(); for (const k of (s.es || [])) pool.push({ t: k, kw: k }); }
  return pool;
}
function pickRandom(pool: { t: string; kw?: string }[], used: string[]): { t: string; kw?: string } | null {
  let avail = pool.filter((x) => !used.includes(x.t));
  if (!avail.length) avail = pool;                // agotados → reiniciar rotación
  if (!avail.length) return null;
  return avail[Math.floor(Math.random() * avail.length)];
}

// Próximas fechas (para la vista previa del calendario), sin crear nada.
export async function nextDates(count: number): Promise<string[]> {
  const cfg = await blogAutopilotSettings();
  const start = await startAfterLast(cfg);
  const out: string[] = [];
  for (let i = 0; i < count; i++) { const d = new Date(start.getTime() + i * cfg.everyNDays * DAY); out.push(d.toISOString()); }
  return out;
}

// La primera fecha nueva: tras la última programada (+cadencia), o mañana.
async function startAfterLast(cfg: BlogAutopilot): Promise<Date> {
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  const future = posts.filter((p) => p.status === 'scheduled' && p.publish_at).map((p) => new Date(p.publish_at).getTime());
  let start: Date;
  if (future.length) { start = new Date(Math.max(...future) + cfg.everyNDays * DAY); }
  else { start = new Date(Date.now() + DAY); }
  start.setHours(cfg.hour || 9, 0, 0, 0);
  return start;
}

// Planifica un lote: crea `count` fechas programadas con su tema (cuerpo vacío).
export async function planMonth(count?: number): Promise<{ created: { date: string; topic: string }[] }> {
  const cfg = await blogAutopilotSettings();
  const n = Math.max(1, Math.min(count || cfg.perMonth || 15, 40));
  const pool = await buildPool(cfg);
  if (!pool.length) return { created: [] };
  const start = await startAfterLast(cfg);
  let used = [...(cfg.usedTopics || [])];
  const created: { date: string; topic: string }[] = [];
  for (let i = 0; i < n; i++) {
    const pick = pickRandom(pool, used);
    if (!pick) break;
    if (used.length >= pool.length) used = [];      // reinicia rotación si ya usó todo
    used.push(pick.t);
    const d = new Date(start.getTime() + i * cfg.everyNDays * DAY); d.setHours(cfg.hour || 9, 0, 0, 0);
    try {
      // title_en vacío a propósito: es solo un marcador del TEMA (en español). El
      // cron lo reemplaza por el título real ES/EN al generar el artículo.
      await savePost({ title_es: pick.t, title_en: '', body_es: '', body_en: '', excerpt_es: '', excerpt_en: '', tags: pick.kw || '', status: 'scheduled', publish_at: d.toISOString() });
      created.push({ date: d.toISOString(), topic: pick.t });
    } catch {}
  }
  await saveSetting('blog_autopilot', { ...cfg, usedTopics: used.slice(-300) });
  return { created };
}

// Genera el contenido de las fechas programadas cuyo cuerpo sigue vacío.
//   · normal → solo las próximas (<=30h), para el cron.
//   · opts.all → cualquier fecha programada vacía (para "generar todas ahora").
// Devuelve también `remaining` = fechas vacías que aún quedan (para el bucle de la UI).
export async function fillDueSlots(max = 1, opts?: { all?: boolean }): Promise<{ filled: number; tried: number; remaining: number; errors: string[] }> {
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  const pending = posts
    .filter((p) => p.status === 'scheduled' && p.publish_at && empty(p) && (opts?.all || new Date(p.publish_at).getTime() <= Date.now() + 30 * 3600 * 1000))
    .sort((a, b) => new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime());
  const due = pending.slice(0, Math.max(1, max));
  if (!due.length) return { filled: 0, tried: 0, remaining: 0, errors: [] };
  const guide = await guideFor();
  const related: RelatedPost[] = posts.filter((p) => p.status === 'published').slice(0, 12)
    .map((p) => ({ slug: p.slug, title_es: p.title_es, title_en: p.title_en, tags: p.tags }));
  let filled = 0; const errors: string[] = [];
  for (const slot of due) {
    const topic = slot.title_es || slot.title_en || slot.tags || '';
    if (!topic) continue;
    const r = await generateArticle(topic, guide, { related });
    if (r.ok && r.article) {
      try { await savePost({ id: slot.id, ...r.article, status: 'scheduled', publish_at: slot.publish_at }); filled++; }
      catch (e: any) { errors.push(String(e?.message || e)); }
    } else { errors.push(lastAiError() || r.reason || 'ai_failed'); }
  }
  return { filled, tried: due.length, remaining: Math.max(0, pending.length - filled), errors };
}

// Cuántas fechas futuras (programadas) quedan — para reponer solo.
export async function futureScheduledCount(): Promise<number> {
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  return posts.filter((p) => p.status === 'scheduled' && p.publish_at && new Date(p.publish_at).getTime() > Date.now()).length;
}

// Una pasada del cron: genera lo que toca y, si quedan pocas fechas, repone el lote.
export async function runAutopilot(): Promise<{ filled: number; tried: number; replenished: number; errors: string[] }> {
  const cfg = await blogAutopilotSettings();
  if (!cfg.enabled) return { filled: 0, tried: 0, replenished: 0, errors: ['disabled'] };
  const fill = await fillDueSlots(1);
  let replenished = 0;
  if (cfg.autoReplenish) {
    const left = await futureScheduledCount();
    if (left < 3) { const r = await planMonth(); replenished = r.created.length; }
  }
  return { ...fill, replenished };
}
