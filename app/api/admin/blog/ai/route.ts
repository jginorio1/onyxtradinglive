import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { suggestTitles, generateArticle, enhanceArticle, completeLanguages, socialCopy, generateAlt, lastAiError, type KwGuide, type BlogKind, type RelatedPost } from '@/lib/blogAI';
import { blogKeywordsSettings } from '@/lib/settings';
import { listAllPosts, shortSlug, slugFor } from '@/lib/blog';
import { articleUrl } from '@/lib/social';
import { gscOpportunities, type GscOpportunity } from '@/lib/seoSearchConsole';

const KIND_HINT: Record<string, string> = {
  comparison: ' (formato comparativa "X vs Y")',
  list: ' (formato lista/ranking con número, ej. "5 mejores…")',
  mistakes: ' (formato "errores que…")',
  guide: '',
};
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;   // deja tiempo a la IA (evita 502 por timeout de la función)
const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Elige la keyword objetivo: la MENOS cubierta en artículos existentes (rotación),
// salvo que el editor imponga una (override) que esté en la lista.
function pickTarget(list: string[], posts: any[], override?: string): string | undefined {
  if (!list.length) return undefined;
  if (override && list.some((k) => k.toLowerCase() === override.toLowerCase())) return override;
  const has = (kw: string) => posts.filter((p) => (`${p.title_es || ''} ${p.body_es || ''} ${p.title_en || ''} ${p.body_en || ''}`).toLowerCase().includes(kw.toLowerCase())).length;
  let best = list[0], bestC = Infinity;
  for (const k of list) { const c = has(k); if (c < bestC) { bestC = c; best = k; } }
  return best;
}

// Devuelve la guía de keywords + de dónde salió la objetivo (lista manual o
// Search Console) para poder mostrarlo en el editor.
type GuideResult = { guide: KwGuide; source: { es?: 'manual' | 'gsc'; en?: 'manual' | 'gsc' }; gsc?: GscOpportunity };
async function buildGuide(override?: string): Promise<GuideResult | undefined> {
  const s = await blogKeywordsSettings();

  // Consultas reales de Google (oportunidades) → se mezclan con la lista manual
  // para que la IA cubra lo que la gente de verdad busca. Encendido por defecto.
  let opps: GscOpportunity[] = [];
  if (s.useGsc) { try { opps = await gscOpportunities(90, Math.max(0, s.gscMax || 6)); } catch {} }
  const gscTerms = opps.map((o) => o.query);
  const oppOf = (kw: string) => opps.find((o) => o.query.toLowerCase() === kw.toLowerCase());

  // La lista efectiva combina las keywords manuales del dueño + las de GSC (sin duplicar).
  const dedup = (arr: string[]) => Array.from(new Map(arr.filter(Boolean).map((k) => [k.toLowerCase(), k])).values());
  const esList = dedup([...(s.es || []), ...gscTerms]);
  const enList = dedup([...(s.en || []), ...gscTerms]);   // GSC sirve de apoyo también en EN

  if (!s.enabled || (!esList.length && !enList.length)) return undefined;
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  const targetEs = pickTarget(esList, posts, override);
  const targetEn = pickTarget(enList, posts, override);
  const guide: KwGuide = {
    targetEs, targetEn,
    moreEs: esList.filter((k) => k !== targetEs).slice(0, 3),
    moreEn: enList.filter((k) => k !== targetEn).slice(0, 3),
    intensity: s.intensity, variants: s.variants, internalLinks: s.internalLinks,
    pillar: `${SITE}/pricing`,
  };
  const gscHit = targetEs ? oppOf(targetEs) : undefined;
  return {
    guide,
    source: { es: targetEs && gscTerms.some((g) => g.toLowerCase() === targetEs.toLowerCase()) ? 'gsc' : 'manual',
              en: targetEn && gscTerms.some((g) => g.toLowerCase() === targetEn.toLowerCase()) ? 'gsc' : 'manual' },
    gsc: gscHit,
  };
}

// POST · Onyx AI para el blog.
//   { mode: 'titles',   topic, lang, keyword? } -> { titles }
//   { mode: 'generate', title, keyword? }       -> { article }
export async function POST(req: Request) {
  try {
    const { ok } = await requirePerm('modulos', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const b = await req.json().catch(() => ({} as any));
    const mode = String(b.mode || '');
    const override = b.keyword ? String(b.keyword).slice(0, 80) : undefined;

    const kind: BlogKind = ['guide', 'comparison', 'list', 'mistakes'].includes(b.kind) ? b.kind : 'guide';

    if (mode === 'titles') {
      const topic = String(b.topic || '').slice(0, 300) + (KIND_HINT[kind] || '');
      if (!topic.trim()) return NextResponse.json({ error: 'falta tema' }, { status: 400 });
      const lang = b.lang === 'en' ? 'en' : 'es';
      const g = await buildGuide(override);
      const target = g ? (lang === 'en' ? g.guide.targetEn : g.guide.targetEs) : undefined;
      const r = await suggestTitles(topic, lang, target);
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason, detail: lastAiError() }, { status: 200 });
      return NextResponse.json({ titles: r.titles, target, source: g?.source?.[lang], gsc: g?.gsc || null });
    }

    if (mode === 'generate') {
      const title = String(b.title || '').slice(0, 200);
      if (!title) return NextResponse.json({ error: 'falta título' }, { status: 400 });
      const g = await buildGuide(override);
      // Artículos publicados existentes → enlazado interno automático.
      let related: RelatedPost[] = [];
      try {
        const posts = await listAllPosts();
        related = posts.filter((p: any) => p.status === 'published').slice(0, 12)
          .map((p: any) => ({ slug: p.slug, title_es: p.title_es, title_en: p.title_en, tags: p.tags }));
      } catch {}
      const r = await generateArticle(title, g?.guide, { related, kind });
      if (!r.ok) {
        const detail = lastAiError();
        if (r.reason !== 'no_key') { try { await logError('blog_ai_generate', new Error(detail || r.reason || 'ai_failed')); } catch {} }
        return NextResponse.json({ error: r.reason || 'ai', code: r.reason, detail }, { status: 200 });
      }
      return NextResponse.json({ article: r.article, target: g ? { es: g.guide.targetEs, en: g.guide.targetEn } : null, source: g?.source || null, gsc: g?.gsc || null });
    }

    // Mejora un post EXISTENTE sin reescribirlo: enlaces internos + figure + faq,
    // y sugiere un slug corto (para arreglar los rotos, con redirección al guardar).
    if (mode === 'enhance') {
      const id = String(b.id || '');
      if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
      let posts: any[] = [];
      try { posts = await listAllPosts(); } catch {}
      const post = posts.find((p) => p.id === id);
      if (!post) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });
      const related: RelatedPost[] = posts
        .filter((p) => p.status === 'published' && p.id !== id).slice(0, 12)
        .map((p) => ({ slug: p.slug, title_es: p.title_es, title_en: p.title_en, tags: p.tags }));
      const g = await buildGuide();
      const r = await enhanceArticle(post.title_es || post.title_en || '', post.body_es || '', post.body_en || '', related);
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason, detail: lastAiError() }, { status: 200 });
      const kw = g ? (g.guide.targetEs || g.guide.targetEn) : (String(post.tags || '').split(',')[0] || '');
      const suggestedSlug = shortSlug('', post.title_es || post.title_en || '', kw);
      return NextResponse.json({ body_es: r.body_es, body_en: r.body_en, suggestedSlug, currentSlug: post.slug });
    }

    // Completar el idioma que falte (traducción fiel del que existe).
    if (mode === 'complete') {
      const id = String(b.id || '');
      if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
      let posts: any[] = [];
      try { posts = await listAllPosts(); } catch {}
      const post = posts.find((p) => p.id === id);
      if (!post) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });
      const r = await completeLanguages(post, { force: !!b.force });
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason, detail: lastAiError() }, { status: 200 });
      return NextResponse.json({ patch: r.patch || {} });
    }

    // Copy para redes por idioma (a partir de un post existente).
    if (mode === 'social') {
      const id = String(b.id || '');
      const lang = b.lang === 'en' ? 'en' : 'es';
      if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
      let posts: any[] = [];
      try { posts = await listAllPosts(); } catch {}
      const post = posts.find((p) => p.id === id);
      if (!post) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });
      const title = (lang === 'en' ? post.title_en : post.title_es) || post.title_es || post.title_en || '';
      const excerpt = (lang === 'en' ? post.excerpt_en : post.excerpt_es) || post.excerpt_es || post.excerpt_en || '';
      const url = articleUrl(SITE, slugFor(post, lang), lang);
      const only = b.only ? String(b.only) : undefined;
      const r = await socialCopy(title, excerpt, url, lang, only);
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason, detail: lastAiError() }, { status: 200 });
      return NextResponse.json({ copy: r.copy, url, slug: post.slug });
    }

    if (mode === 'alt') {
      const context = String(b.context || '').slice(0, 300);
      const hint = b.hint ? String(b.hint).slice(0, 200) : undefined;
      if (!context && !hint) return NextResponse.json({ error: 'falta contexto' }, { status: 400 });
      const g = await buildGuide(override);
      const kw = g ? (g.guide.targetEs || g.guide.targetEn) : override;
      const r = await generateAlt(context || (hint as string), hint, kw);
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason, detail: lastAiError() }, { status: 200 });
      return NextResponse.json({ alt_es: r.alt_es, alt_en: r.alt_en });
    }

    return NextResponse.json({ error: 'modo inválido' }, { status: 400 });
  } catch (e: any) {
    await logError('blog_ai', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
