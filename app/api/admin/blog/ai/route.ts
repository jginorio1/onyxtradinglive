import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { suggestTitles, generateArticle, enhanceArticle, generateAlt, type KwGuide, type BlogKind, type RelatedPost } from '@/lib/blogAI';
import { blogKeywordsSettings } from '@/lib/settings';
import { listAllPosts, shortSlug } from '@/lib/blog';

const KIND_HINT: Record<string, string> = {
  comparison: ' (formato comparativa "X vs Y")',
  list: ' (formato lista/ranking con número, ej. "5 mejores…")',
  mistakes: ' (formato "errores que…")',
  guide: '',
};
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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

async function buildGuide(override?: string): Promise<KwGuide | undefined> {
  const s = await blogKeywordsSettings();
  if (!s.enabled || (!s.es?.length && !s.en?.length)) return undefined;
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  const targetEs = pickTarget(s.es || [], posts, override);
  const targetEn = pickTarget(s.en || [], posts, override);
  return {
    targetEs, targetEn,
    moreEs: (s.es || []).filter((k) => k !== targetEs).slice(0, 3),
    moreEn: (s.en || []).filter((k) => k !== targetEn).slice(0, 3),
    intensity: s.intensity, variants: s.variants, internalLinks: s.internalLinks,
    pillar: `${SITE}/pricing`,
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
      const target = g ? (lang === 'en' ? g.targetEn : g.targetEs) : undefined;
      const r = await suggestTitles(topic, lang, target);
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason }, { status: 502 });
      return NextResponse.json({ titles: r.titles, target });
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
      const r = await generateArticle(title, g, { related, kind });
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason }, { status: 502 });
      return NextResponse.json({ article: r.article, target: g ? { es: g.targetEs, en: g.targetEn } : null });
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
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason }, { status: 502 });
      const kw = g ? (g.targetEs || g.targetEn) : (String(post.tags || '').split(',')[0] || '');
      const suggestedSlug = shortSlug('', post.title_es || post.title_en || '', kw);
      return NextResponse.json({ body_es: r.body_es, body_en: r.body_en, suggestedSlug, currentSlug: post.slug });
    }

    if (mode === 'alt') {
      const context = String(b.context || '').slice(0, 300);
      const hint = b.hint ? String(b.hint).slice(0, 200) : undefined;
      if (!context && !hint) return NextResponse.json({ error: 'falta contexto' }, { status: 400 });
      const g = await buildGuide(override);
      const kw = g ? (g.targetEs || g.targetEn) : override;
      const r = await generateAlt(context || (hint as string), hint, kw);
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason }, { status: 502 });
      return NextResponse.json({ alt_es: r.alt_es, alt_en: r.alt_en });
    }

    return NextResponse.json({ error: 'modo inválido' }, { status: 400 });
  } catch (e: any) {
    await logError('blog_ai', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
