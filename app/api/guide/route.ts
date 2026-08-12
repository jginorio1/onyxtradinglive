import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { CATEGORIES, ARTICLES, type Article } from '@/lib/guide';
import { getAllArticles, getCustomArticles, saveCustomArticles } from '@/lib/guideStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(v: any): string {
  return String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
const CODE_SLUGS = new Set(ARTICLES.map((a) => a.slug));

// GET · público: todos los artículos fusionados + categorías. También indica
// cuáles son del dueño (customSlugs) para el editor.
export async function GET() {
  const [articles, custom] = await Promise.all([getAllArticles(), getCustomArticles().catch(() => [])]);
  return NextResponse.json({
    articles, categories: CATEGORIES,
    customSlugs: (custom as Article[]).map((a) => a.slug),
    codeSlugs: Array.from(CODE_SLUGS),
  });
}

// POST · dueño: crea o actualiza una guía (se guarda como override/nueva).
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const art = b.article || {};
  const slug = slugify(art.slug) || slugify(art.title?.es || art.title?.en);
  if (!slug) return NextResponse.json({ error: 'falta el slug o el título' }, { status: 400 });

  const clean: Article = {
    slug,
    cat: String(art.cat || 'start').slice(0, 30),
    icon: String(art.icon || '📖').slice(0, 8),
    title: { es: String(art.title?.es || '').slice(0, 160), en: String(art.title?.en || art.title?.es || '').slice(0, 160) },
    summary: { es: String(art.summary?.es || '').slice(0, 400), en: String(art.summary?.en || art.summary?.es || '').slice(0, 400) },
    body: {
      es: Array.isArray(art.body?.es) ? art.body.es.slice(0, 120) : [],
      en: Array.isArray(art.body?.en) ? art.body.en.slice(0, 120) : (Array.isArray(art.body?.es) ? art.body.es.slice(0, 120) : []),
    },
    ...(art.cover ? { cover: String(art.cover).slice(0, 300) } : {}),
    ...(art.updated ? { updated: true } : {}),
    ...(art.cta && art.cta.href ? { cta: { href: String(art.cta.href).slice(0, 300), label: { es: String(art.cta.label?.es || '').slice(0, 80), en: String(art.cta.label?.en || art.cta.label?.es || '').slice(0, 80) } } } : {}),
  };

  const list = await getCustomArticles();
  const i = list.findIndex((x) => x.slug === slug);
  if (i >= 0) list[i] = clean; else list.push(clean);
  await saveCustomArticles(list);
  return NextResponse.json({ ok: true, slug });
}

// DELETE · dueño: quita una guía del dueño. Si el slug también existe en el
// código, vuelve a mostrarse la versión original.
export async function DELETE(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const slug = new URL(req.url).searchParams.get('slug') || '';
  const list = (await getCustomArticles()).filter((x) => x.slug !== slug);
  await saveCustomArticles(list);
  return NextResponse.json({ ok: true, revertsToCode: CODE_SLUGS.has(slug) });
}
