import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Blog público. Artículos bilingües (ES/EN) con programación de publicación.
// Las lecturas públicas se hacen con service role (server components), así que
// no dependemos de políticas RLS. Un cron publica los programados a su hora.
// ============================================================

export type BlogStatus = 'draft' | 'scheduled' | 'published';
export type BlogPost = {
  id: string; slug: string;
  title_es: string; title_en: string;
  excerpt_es: string; excerpt_en: string;
  body_es: string; body_en: string;
  cover_url: string | null; tags: string;
  status: BlogStatus; publish_at: string | null; published_at: string | null;
  author: string | null; created_at: string; updated_at: string;
};

// Convierte un texto en un slug limpio para la URL.
export function slugify(s: string): string {
  return String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'articulo';
}

// Garantiza un slug único (agrega -2, -3… si choca). Excluye el propio id al editar.
export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let slug = root, i = 1;
  while (true) {
    const { data } = await supabaseAdmin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (!data || (excludeId && (data as any).id === excludeId)) return slug;
    i++; slug = `${root}-${i}`;
  }
}

const PUB_COLS = 'id,slug,title_es,title_en,excerpt_es,excerpt_en,body_es,body_en,cover_url,tags,published_at';

// Lista de artículos ya publicados (para la página pública /blog).
export async function listPublished(limit = 60) {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin.from('blog_posts')
    .select(PUB_COLS).eq('status', 'published').lte('published_at', nowIso)
    .order('published_at', { ascending: false }).limit(limit);
  return (data || []) as any[];
}

// Un artículo publicado por su slug (para /blog/[slug]).
export async function getPublishedBySlug(slug: string) {
  const { data } = await supabaseAdmin.from('blog_posts')
    .select(PUB_COLS + ',status').eq('slug', slug).maybeSingle();
  if (!data || (data as any).status !== 'published') return null;
  return data as any;
}

// Slugs publicados (para generateStaticParams y el sitemap).
export async function publishedSlugs(): Promise<{ slug: string; updated: string }[]> {
  const { data } = await supabaseAdmin.from('blog_posts')
    .select('slug,published_at').eq('status', 'published').limit(500);
  return (data || []).map((r: any) => ({ slug: r.slug, updated: r.published_at || new Date().toISOString() }));
}

// ---- Admin ----
export async function listAllPosts() {
  const { data } = await supabaseAdmin.from('blog_posts').select('*').order('updated_at', { ascending: false }).limit(300);
  return (data || []) as BlogPost[];
}

export async function savePost(b: any) {
  const clean = (s: any, n = 20000) => (s == null ? '' : String(s).slice(0, n));
  const status: BlogStatus = ['draft', 'scheduled', 'published'].includes(b.status) ? b.status : 'draft';
  const row: any = {
    title_es: clean(b.title_es, 200), title_en: clean(b.title_en, 200),
    excerpt_es: clean(b.excerpt_es, 400), excerpt_en: clean(b.excerpt_en, 400),
    body_es: clean(b.body_es), body_en: clean(b.body_en),
    cover_url: b.cover_url ? clean(b.cover_url, 500) : null,
    tags: clean(b.tags, 300), status,
    publish_at: status === 'scheduled' && b.publish_at ? new Date(b.publish_at).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  // published_at: se fija al pasar a 'published'; scheduled lo dejará el cron.
  if (status === 'published') row.published_at = b.published_at ? new Date(b.published_at).toISOString() : new Date().toISOString();

  if (b.id) {
    if (b.slug) row.slug = await uniqueSlug(b.slug, b.id);
    await supabaseAdmin.from('blog_posts').update(row).eq('id', b.id);
    return { id: b.id };
  }
  row.slug = await uniqueSlug(b.slug || b.title_es || b.title_en || 'articulo');
  row.author = b.author ? String(b.author).slice(0, 120) : null;
  const { data, error } = await supabaseAdmin.from('blog_posts').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return { id: (data as any).id, slug: row.slug };
}

export async function deletePost(id: string) {
  await supabaseAdmin.from('blog_posts').delete().eq('id', id);
}

// Publica los artículos programados cuya hora ya llegó (lo usa el cron).
export async function publishDuePosts() {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin.from('blog_posts')
    .select('id').eq('status', 'scheduled').lte('publish_at', nowIso).limit(100);
  const ids = (data || []).map((r: any) => r.id);
  if (!ids.length) return 0;
  await supabaseAdmin.from('blog_posts').update({ status: 'published', published_at: nowIso }).in('id', ids);
  return ids.length;
}
