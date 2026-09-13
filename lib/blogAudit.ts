// ============================================================
// Onyx Content Auditor — motor local (sin IA) que escanea TODOS los artículos
// (publicados + programados) y puntúa cada uno en 4 pilares:
//   1) Unicidad     → similitud de texto contra los demás (anti-repetición / canibalización)
//   2) SEO on-page  → título, meta, H2, keyword, palabras, alt, enlaces
//   3) Enlaces      → grafo interno (entrantes/salientes, huérfanos) + sugerencias
//   4) Frescura     → antigüedad + rendimiento real de Google Search Console
// Devuelve además un mapa de keywords (cobertura + canibalización) y la salud global.
// La IA solo entra cuando el dueño pulsa un arreglo (híbrido = local marca, IA corrige).
// ============================================================
import { listAllPosts, savePost } from './blog';
import { blogKeywordsSettings, getSetting } from './settings';
import { gscConfigured, gscOverview } from './seoSearchConsole';
import { enhanceArticle, type RelatedPost } from './blogAI';

const STOP = new Set('the and for that with your you are our their has have will from this into como para que con los las una del una por más muy sin son sus est esta este estos estas cuando donde porque también según entre sobre cada todo toda todos todas hace hacer tras trader trading onyx blog'.split(/\s+/));

function noAccents(s: string) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// Texto plano del cuerpo markdown: quita bloques :::…, deja el texto de los enlaces,
// quita marcas (##, **, -), y normaliza a minúsculas sin acentos.
function stripMd(s: string): string {
  return noAccents(String(s || '')
    .replace(/:::[a-z]+[\s\S]*?:::/gi, ' ')        // bloques chart/faq/figure
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // enlaces → texto
    .replace(/[#*_>`]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()).replace(/\s+/g, ' ').trim();
}

function words(s: string): string[] { return stripMd(s).split(' ').filter((w) => w.length >= 4 && !STOP.has(w)); }

// Conjunto de "shingles" (trigramas de palabras) para medir similitud robusta.
function shingles(text: string, k = 3): Set<string> {
  const w = words(text); const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' '));
  return out;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; const [small, big] = a.size < b.size ? [a, b] : [b, a];
  small.forEach((x) => { if (big.has(x)) inter++; });
  return inter / (a.size + b.size - inter);
}

// keyword objetivo del artículo: la keyword configurada que aparezca en el título,
// o el primer tag, o las 3 primeras palabras del título. Sirve para canibalización.
function targetKw(p: any, kws: string[]): string {
  const t = noAccents(String(p.title_es || p.title_en || '').toLowerCase());
  const hit = kws.find((k) => k && t.includes(noAccents(k.toLowerCase())));
  if (hit) return hit.toLowerCase();
  const tag = String(p.tags || '').split(',')[0]?.trim();
  if (tag) return tag.toLowerCase();
  return words(p.title_es || p.title_en || '').slice(0, 3).join(' ');
}

type Issue = { pillar: 'unique' | 'seo' | 'links' | 'fresh'; text_es: string; text_en: string };

// Checks SEO on-page sobre el idioma principal (ES). Devuelve issues y un 0-100.
function seoScore(p: any, kw: string): { score: number; issues: Issue[] } {
  const issues: Issue[] = [];
  const title = String(p.title_es || '');
  const body = stripMd(p.body_es || '');
  const wc = body.split(' ').filter(Boolean).length;
  const excerpt = String(p.excerpt_es || '');
  const h2 = (String(p.body_es || '').match(/^##\s/gm) || []).length;
  const links = (String(p.body_es || '') + String(p.body_en || '')).match(/\]\(\/blog\//g)?.length || 0;
  const kwN = noAccents(kw.toLowerCase());
  const first = body.split(' ').slice(0, 120).join(' ');
  let s = 100;
  const bad = (pts: number, es: string, en: string) => { s -= pts; issues.push({ pillar: 'seo', text_es: es, text_en: en }); };
  if (title.length < 30 || title.length > 65) bad(12, `Título de ${title.length} car. (ideal 40-60).`, `Title is ${title.length} chars (ideal 40-60).`);
  if (excerpt.length < 110 || excerpt.length > 165) bad(14, `Meta/resumen de ${excerpt.length} car. (ideal 120-160).`, `Meta/excerpt is ${excerpt.length} chars (ideal 120-160).`);
  if (wc < 600) bad(16, `Solo ${wc} palabras (apunta a 700+).`, `Only ${wc} words (aim for 700+).`);
  if (h2 < 2) bad(10, `Pocos subtítulos H2 (${h2}).`, `Few H2 subheadings (${h2}).`);
  if (!noAccents(title.toLowerCase()).includes(kwN)) bad(14, `La keyword «${kw}» no está en el título.`, `Keyword “${kw}” is not in the title.`);
  if (!first.includes(kwN)) bad(12, `La keyword no aparece en el primer párrafo.`, `Keyword is not in the first paragraph.`);
  if (links === 0) bad(12, `Sin enlaces internos en el cuerpo.`, `No internal links in the body.`);
  if (!String(p.cover_alt_es || '').trim() && p.cover_url) bad(6, `Falta el texto ALT de la portada.`, `Missing cover ALT text.`);
  return { score: Math.max(0, Math.round(s)), issues };
}

function ramp(x: number, lo: number, hi: number) { return Math.max(0, Math.min(100, Math.round(((x - lo) / (hi - lo)) * 100))); }

export type AuditPost = {
  id: string; slug: string; title: string; status: string; kw: string;
  score: number; pillars: { unique: number; seo: number; links: number; fresh: number };
  issues: Issue[];
  sim: { slug: string; title: string; pct: number } | null;   // par más parecido
  inbound: number; outbound: number; orphan: boolean;
  suggestLinks: { slug: string; title: string }[];             // enlaces entrantes sugeridos
  ageDays: number; updatedDays: number;
  gsc: { clicks: number; impressions: number; position: number } | null;
  indexed: boolean | null;
};
export type AuditResult = {
  ok: boolean; scannedAt: string; gsc: boolean;
  health: number;
  counts: { total: number; published: number; scheduled: number; unique: number; dupes: number; orphans: number; notIndexed: number; thin: number; stale: number };
  posts: AuditPost[];
  keywordMap: { kw: string; count: number; slugs: string[] }[];  // cobertura + canibalización (count>1)
};

export async function runAudit(): Promise<AuditResult> {
  const all = (await listAllPosts()).filter((p: any) => p.status === 'published' || p.status === 'scheduled');
  const kwCfg = await blogKeywordsSettings().catch(() => ({ es: [], en: [] } as any));
  const kws = [...(kwCfg.es || []), ...(kwCfg.en || [])].map(String);
  const now = Date.now(); const DAY = 86400000;

  // GSC: rendimiento por página (impresiones/clics/posición). Falla seguro si no está.
  const gscMap = new Map<string, { clicks: number; impressions: number; position: number }>();
  let gscOk = false;
  if (gscConfigured()) {
    try { const ov = await gscOverview(28); if (ov?.ok) { gscOk = true; (ov.pages || []).forEach((r: any) => { const m = String(r.keys?.[0] || '').match(/\/blog\/([^/?#]+)/); if (m) gscMap.set(m[1], { clicks: r.clicks || 0, impressions: r.impressions || 0, position: r.position || 0 }); }); } } catch {}
  }

  // Pre-cálculo: shingles + keyword + enlaces salientes por post.
  const sh = all.map((p: any) => shingles((p.body_es || '') + ' ' + (p.title_es || '')));
  const kwOf = all.map((p: any) => targetKw(p, kws));
  const out = all.map((p: any) => new Set(Array.from((String(p.body_es || '') + String(p.body_en || '')).matchAll(/\]\(\/blog\/([^)]+)\)/g)).map((m) => String(m[1]).split(/[#?]/)[0])));
  const inbound = new Map<string, number>();
  out.forEach((set) => set.forEach((slug) => inbound.set(slug, (inbound.get(slug) || 0) + 1)));
  // Cuántos artículos comparten cada keyword objetivo. Si son MUCHOS (>8) es un
  // TEMA PILAR, no canibalización; solo un grupo pequeño (2-8) es canibalización real.
  const kwCount = new Map<string, number>();
  kwOf.forEach((k) => kwCount.set(k, (kwCount.get(k) || 0) + 1));

  const posts: AuditPost[] = all.map((p: any, i: number) => {
    // Unicidad: máxima similitud contra cualquier otro.
    let best = { j: -1, pct: 0 };
    for (let k = 0; k < all.length; k++) { if (k === i) continue; const s = jaccard(sh[i], sh[k]); if (s > best.pct) best = { j: k, pct: s }; }
    const dupePct = Math.round(best.pct * 100);
    // Canibalización REAL: 2-8 artículos con la misma keyword. Más de 8 = tema pilar (no penaliza).
    const grp = kwCount.get(kwOf[i]) || 1;
    const cannib = grp >= 2 && grp <= 8;
    let uniq = Math.max(0, 100 - dupePct * 1.6);
    const issues: Issue[] = [];
    if (dupePct >= 30 && best.j >= 0) { issues.push({ pillar: 'unique', text_es: `Se parece ${dupePct}% a «${all[best.j].title_es || all[best.j].title_en}». Diferencia el ángulo.`, text_en: `${dupePct}% similar to “${all[best.j].title_en || all[best.j].title_es}”. Differentiate the angle.` }); }
    if (cannib) { uniq = Math.min(uniq, 65); issues.push({ pillar: 'unique', text_es: `${grp} artículos apuntan a la misma keyword «${kwOf[i]}» (canibalización).`, text_en: `${grp} articles target the same keyword “${kwOf[i]}” (cannibalization).` }); }

    const seo = seoScore(p, kwOf[i]);
    issues.push(...seo.issues);

    // Enlaces: entrantes/salientes + huérfano + sugerencias por tags/keyword compartido.
    const inb = inbound.get(p.slug) || 0; const outc = out[i].size;
    const orphan = p.status === 'published' && inb === 0;
    let linkScore = Math.min(100, ramp(outc, 0, 3) * 0.5 + ramp(inb, 0, 3) * 0.5);
    if (orphan) issues.push({ pillar: 'links', text_es: `Ningún otro artículo enlaza a este (huérfano).`, text_en: `No other article links here (orphan).` });
    if (outc === 0) issues.push({ pillar: 'links', text_es: `No enlaza a ningún otro artículo.`, text_en: `Links out to no other article.` });
    const tagsI = new Set(String(p.tags || '').toLowerCase().split(',').map((x: string) => x.trim()).filter(Boolean));
    const suggestLinks = all.filter((q: any, k: number) => k !== i && !out[k].has(p.slug))
      .map((q: any, k2: number) => ({ q, kk: all.indexOf(q) }))
      .filter(({ q }: any) => kwOf[all.indexOf(q)] === kwOf[i] || String(q.tags || '').toLowerCase().split(',').some((t: string) => tagsI.has(t.trim())))
      .slice(0, 3).map(({ q }: any) => ({ slug: q.slug, title: q.title_es || q.title_en || q.slug }));

    // Frescura + rendimiento (GSC).
    const pub = p.published_at || p.publish_at || p.created_at;
    const ageDays = pub ? Math.round((now - new Date(pub).getTime()) / DAY) : 0;
    const updatedDays = p.updated_at ? Math.round((now - new Date(p.updated_at).getTime()) / DAY) : ageDays;
    const g = gscMap.get(p.slug) || null;
    // Solo tiene sentido "indexado" en artículos YA publicados (los programados aún no existen en Google).
    const indexed = (gscOk && p.status === 'published') ? (g ? g.impressions > 0 : false) : null;
    let fresh = 100;
    if (p.status === 'published') {
      if (ageDays > 270 && updatedDays > 180) { fresh -= 30; issues.push({ pillar: 'fresh', text_es: `Sin actualizar en ${updatedDays} días. Refréscalo.`, text_en: `Not updated in ${updatedDays} days. Refresh it.` }); }
      if (indexed === false) { fresh -= 25; issues.push({ pillar: 'fresh', text_es: `Sin impresiones en Google (posible no indexado).`, text_en: `No Google impressions (possibly not indexed).` }); }
      if (g && g.position > 20 && g.impressions > 5) issues.push({ pillar: 'fresh', text_es: `Posición media ${Math.round(g.position)} — a un empujón de la 1ª página.`, text_en: `Avg position ${Math.round(g.position)} — a push from page 1.` });
    }
    fresh = Math.max(0, fresh);

    const pillars = { unique: Math.round(uniq), seo: seo.score, links: Math.round(linkScore), fresh: Math.round(fresh) };
    const score = Math.round(pillars.unique * 0.3 + pillars.seo * 0.3 + pillars.links * 0.2 + pillars.fresh * 0.2);
    return {
      id: p.id, slug: p.slug, title: p.title_es || p.title_en || '(sin título)', status: p.status, kw: kwOf[i],
      score, pillars, issues,
      sim: best.j >= 0 && dupePct >= 20 ? { slug: all[best.j].slug, title: all[best.j].title_es || all[best.j].title_en || all[best.j].slug, pct: dupePct } : null,
      inbound: inb, outbound: outc, orphan, suggestLinks,
      ageDays, updatedDays, gsc: g, indexed,
    };
  });

  // Mapa de keywords (cobertura; count>1 = canibalización).
  const kwGroups = new Map<string, string[]>();
  posts.forEach((p) => { const a = kwGroups.get(p.kw) || []; a.push(p.slug); kwGroups.set(p.kw, a); });
  const keywordMap = Array.from(kwGroups.entries()).map(([kw, slugs]) => ({ kw, count: slugs.length, slugs })).sort((a, b) => b.count - a.count);

  const published = posts.filter((p) => p.status === 'published').length;
  const scheduled = posts.filter((p) => p.status === 'scheduled').length;
  const dupes = posts.filter((p) => p.sim && p.sim.pct >= 30).length;
  const orphans = posts.filter((p) => p.orphan).length;
  const notIndexed = posts.filter((p) => p.indexed === false).length;
  const thin = posts.filter((p) => p.pillars.seo < 60).length;
  const stale = posts.filter((p) => p.status === 'published' && p.updatedDays > 270).length;
  const health = posts.length ? Math.round(posts.reduce((s, p) => s + p.score, 0) / posts.length) : 0;

  return {
    ok: true, scannedAt: new Date().toISOString(), gsc: gscOk, health,
    counts: { total: posts.length, published, scheduled, unique: posts.length - dupes, dupes, orphans, notIndexed, thin, stale },
    posts: posts.sort((a, b) => a.score - b.score),   // peores primero (para arreglar)
    keywordMap,
  };
}

// ── Auto-mejora en segundo plano (cron, sin depender del navegador) ─────────
export type AutoFixCfg = { enabled: boolean; threshold: number };
export const AUTOFIX_DEFAULT: AutoFixCfg = { enabled: false, threshold: 70 };
export const autoFixCfg = () => getSetting<AutoFixCfg>('blog_autofix', AUTOFIX_DEFAULT);

// Mejora UN artículo: el de peor SEO on-page por debajo del umbral que NO se haya
// tocado en los últimos 3 días (para no re-arreglar en bucle). Barato: no hace el
// escaneo completo ni GSC; solo el chequeo SEO local. Devuelve si arregló + cuántos quedan.
export async function autoFixOne(threshold = 70): Promise<{ ok: boolean; fixed: boolean; slug?: string; remaining: number; reason?: string }> {
  const all = (await listAllPosts()).filter((p: any) => p.status === 'published' || p.status === 'scheduled');
  const kwCfg = await blogKeywordsSettings().catch(() => ({ es: [], en: [] } as any));
  const kws = [...(kwCfg.es || []), ...(kwCfg.en || [])].map(String);
  const DAY = 86400000; const now = Date.now();
  const cand = all.map((p: any) => {
    const kw = targetKw(p, kws); const sc = seoScore(p, kw).score;
    const recent = p.updated_at && (now - new Date(p.updated_at).getTime()) < 3 * DAY;
    return { p, kw, sc, recent };
  }).filter((c) => c.sc < threshold && !c.recent).sort((a, b) => a.sc - b.sc);
  const remaining = cand.length;
  if (!remaining) return { ok: true, fixed: false, remaining: 0 };
  const { p, kw } = cand[0];
  const related: RelatedPost[] = all.filter((x: any) => x.id !== p.id && x.status === 'published').slice(0, 12)
    .map((x: any) => ({ slug: x.slug, title_es: x.title_es, title_en: x.title_en, tags: x.tags }));
  const r = await enhanceArticle(p.title_es || p.title_en || '', p.body_es || '', p.body_en || '', related, kw);
  if (!r.ok) return { ok: false, fixed: false, remaining, reason: r.reason };
  const patch: any = { ...p, body_es: r.body_es ?? p.body_es, body_en: r.body_en ?? p.body_en, updated_at: new Date().toISOString() };
  if (r.excerpt_es) patch.excerpt_es = r.excerpt_es;
  if (r.excerpt_en) patch.excerpt_en = r.excerpt_en;
  if (r.title_es) patch.title_es = r.title_es;
  if (r.title_en) patch.title_en = r.title_en;
  if (!String(p.cover_alt_es || '').trim() && r.cover_alt_es) patch.cover_alt_es = r.cover_alt_es;
  if (!String(p.cover_alt_en || '').trim() && r.cover_alt_en) patch.cover_alt_en = r.cover_alt_en;
  await savePost(patch);
  return { ok: true, fixed: true, slug: p.slug, remaining: remaining - 1 };
}
