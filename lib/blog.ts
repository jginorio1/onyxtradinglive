import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { unstable_cache, revalidateTag } from 'next/cache';

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
  cover_url: string | null; cover_alt_es: string; cover_alt_en: string; tags: string;
  status: BlogStatus; publish_at: string | null; published_at: string | null;
  author: string | null; created_at: string; updated_at: string;
};

// Convierte un texto en un slug limpio para la URL. Corta a L\u00cdMITE DE PALABRA
// (nunca a media palabra) para no dejar slugs rotos como "...debe-do".
export function slugify(s: string, max = 70): string {
  const clean = String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!clean) return 'articulo';
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const at = cut.lastIndexOf('-');              // retrocede a la \u00faltima palabra completa
  return (at > 20 ? cut.slice(0, at) : cut).replace(/-+$/, '') || 'articulo';
}

// Palabras vac\u00edas que no aportan a un slug (se quitan para dejarlo corto y con keyword).
const STOP = new Set('a al ante bajo cabe con contra de del desde durante e el en entre hacia hasta la las lo los mas m\u00e1s o para por que se segun seg\u00fan sin so sobre tras un una unas unos y the a an of to for and or in on que como debe todo tu su es al is are be to your you how what why'.split(' '));

// Slug corto y con keyword (3-6 palabras). Prefiere un slug propuesto; si no,
// lo deriva de la keyword + t\u00edtulo quitando palabras vac\u00edas. M\u00e1x ~6 palabras.
export function shortSlug(proposed: string, title: string, keyword?: string, words = 6): string {
  if (proposed && proposed.trim()) return slugify(proposed, 70);
  const base = `${keyword || ''} ${title || ''}`;
  const parts = slugify(base, 120).split('-').filter((w) => w && !STOP.has(w));
  const seen = new Set<string>(); const picked: string[] = [];
  for (const w of parts) { if (seen.has(w)) continue; seen.add(w); picked.push(w); if (picked.length >= words) break; }
  return (picked.join('-') || slugify(title)).slice(0, 70).replace(/-+$/, '') || 'articulo';
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

const PUB_COLS = 'id,slug,title_es,title_en,excerpt_es,excerpt_en,body_es,body_en,cover_url,cover_alt_es,cover_alt_en,tags,author,published_at,updated_at';
const PUB_COLS2 = PUB_COLS + ',slug_en,author_id';   // con slug EN y autor por artículo

// slug_en único (agrega -2, -3…). Tolerante si la columna aún no existe.
export async function uniqueSlugEn(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let slug = root, i = 1;
  for (let n = 0; n < 50; n++) {
    const r = await supabaseAdmin.from('blog_posts').select('id').eq('slug_en', slug).maybeSingle();
    if (r.error) return root;   // columna no creada: devolvemos el base sin comprobar
    if (!r.data || (excludeId && (r.data as any).id === excludeId)) return slug;
    i++; slug = `${root}-${i}`;
  }
  return root;
}

// Update tolerante: si falla por columnas nuevas (slug_en / author_id aún no creadas), reintenta sin ellas.
async function updateTolerant(id: string, row: any) {
  let r = await supabaseAdmin.from('blog_posts').update(row).eq('id', id);
  if (r.error && ('slug_en' in row || 'author_id' in row)) { const { slug_en, author_id, ...rest } = row; r = await supabaseAdmin.from('blog_posts').update(rest).eq('id', id); }
  return r;
}

const sanSlug = (s: string) => String(s || '').replace(/[^a-z0-9-]/gi, '').toLowerCase();

// Slug del artículo según idioma: inglés usa slug_en (o cae al español).
export function slugFor(post: any, lang: string): string {
  return lang === 'en' ? (post?.slug_en || post?.slug) : post?.slug;
}

// URL de portada: la subida por el editor, o una portada ON-BRAND generada al vuelo
// (degradado Onyx + tema) para que TODO artículo tenga imagen coherente sin coste.
export function blogCoverUrl(post: any, lang: 'es' | 'en' = 'es'): string {
  if (post?.cover_url) return post.cover_url;
  const title = (lang === 'es' ? post?.title_es : post?.title_en) || post?.title_es || post?.title_en || 'Onyx';
  const kicker = String(post?.tags || '').split(',')[0].trim();
  const qs = new URLSearchParams({ t: title.slice(0, 90), k: kicker.slice(0, 24), id: String(post?.id || post?.slug || '') });
  return `/api/blog-cover?${qs.toString()}`;
}

// ---- Redirecciones 301 (al cambiar un slug ya publicado) ----
// Registra vieja→nueva y limpia posibles cadenas/loops.
export async function addRedirect(from: string, to: string) {
  const f = String(from || '').trim(), t = String(to || '').trim();
  if (!f || !t || f === t) return;
  try {
    // Si algo apuntaba a la vieja, reapúntalo a la nueva (evita cadenas 301→301).
    await supabaseAdmin.from('blog_redirects').update({ to_slug: t }).eq('to_slug', f);
    await supabaseAdmin.from('blog_redirects').delete().eq('from_slug', t); // la nueva ya existe: sin redirección
    await supabaseAdmin.from('blog_redirects').upsert({ from_slug: f, to_slug: t }, { onConflict: 'from_slug' });
  } catch { /* tabla no creada aún: no rompemos el guardado */ }
}
export async function findRedirect(slug: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.from('blog_redirects').select('to_slug').eq('from_slug', slug).maybeSingle();
    return (data as any)?.to_slug || null;
  } catch { return null; }
}

// Artículos relacionados por etiquetas compartidas (para "Sigue leyendo" e internal links).
export async function relatedByTags(post: any, limit = 3) {
  const nowIso = new Date().toISOString();
  let rr = await supabaseAdmin.from('blog_posts')
    .select('id,slug,slug_en,title_es,title_en,excerpt_es,excerpt_en,cover_url,tags,published_at')
    .eq('status', 'published').lte('published_at', nowIso).neq('id', post.id)
    .order('published_at', { ascending: false }).limit(40);
  if (rr.error) rr = await supabaseAdmin.from('blog_posts')
    .select('id,slug,title_es,title_en,excerpt_es,excerpt_en,cover_url,tags,published_at')
    .eq('status', 'published').lte('published_at', nowIso).neq('id', post.id)
    .order('published_at', { ascending: false }).limit(40) as any;
  const { data } = rr;
  const mine = new Set(String(post.tags || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean));
  const scored = (data || []).map((p: any) => {
    const tg = String(p.tags || '').toLowerCase().split(',').map((s) => s.trim());
    const overlap = tg.filter((t) => mine.has(t)).length;
    return { p, overlap };
  }).sort((a, b) => b.overlap - a.overlap || new Date(b.p.published_at).getTime() - new Date(a.p.published_at).getTime());
  return scored.slice(0, limit).map((s) => s.p);
}

// Lista de artículos ya publicados (para la página pública /blog).
async function _listPublished(limit = 60) {
  const nowIso = new Date().toISOString();
  let r = await supabaseAdmin.from('blog_posts')
    .select(PUB_COLS2).eq('status', 'published').lte('published_at', nowIso)
    .order('published_at', { ascending: false }).limit(limit);
  if (r.error) r = await supabaseAdmin.from('blog_posts')   // sin slug_en (columna aún no creada)
    .select(PUB_COLS).eq('status', 'published').lte('published_at', nowIso)
    .order('published_at', { ascending: false }).limit(limit) as any;
  return (r.data || []) as any[];
}
// Cacheado en el servidor (la lista se lee en cada visita al blog). Se refresca
// solo cada 2 min; al guardar/publicar un post invalidamos la etiqueta.
export const listPublished = unstable_cache(_listPublished, ['blog_published'], { revalidate: 120, tags: ['blog_posts'] });

// Un artículo publicado por su slug — matchea el slug ES o el slug EN.
export async function getPublishedBySlug(slug: string) {
  const s = sanSlug(slug);
  let data: any = null;
  const r = await supabaseAdmin.from('blog_posts')
    .select(PUB_COLS2 + ',status').or(`slug.eq.${s},slug_en.eq.${s}`).limit(1);
  if (r.error) {
    const r2 = await supabaseAdmin.from('blog_posts').select(PUB_COLS + ',status').eq('slug', s).maybeSingle();
    data = r2.data;
  } else data = (r.data || [])[0] || null;
  if (!data || data.status !== 'published') return null;
  return data;
}

// Slugs publicados (para generateStaticParams y el sitemap).
export async function publishedSlugs(): Promise<{ slug: string; slugEn: string; updated: string }[]> {
  let r = await supabaseAdmin.from('blog_posts').select('slug,slug_en,published_at,updated_at').eq('status', 'published').limit(500);
  if (r.error) r = await supabaseAdmin.from('blog_posts').select('slug,published_at,updated_at').eq('status', 'published').limit(500) as any;
  // lastmod real = updated_at (o published_at si es más reciente) para el sitemap.
  return (r.data || []).map((x: any) => ({ slug: x.slug, slugEn: x.slug_en || x.slug, updated: x.updated_at || x.published_at || new Date().toISOString() }));
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
    cover_alt_es: clean(b.cover_alt_es, 300), cover_alt_en: clean(b.cover_alt_en, 300),
    tags: clean(b.tags, 300), status,
    publish_at: status === 'scheduled' && b.publish_at ? new Date(b.publish_at).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  // published_at: se fija al pasar a 'published'; scheduled lo dejará el cron.
  if (status === 'published') row.published_at = b.published_at ? new Date(b.published_at).toISOString() : new Date().toISOString();
  // Autor por artículo (id del plantel). Guardado tolerante si la columna no existe.
  if (b.author_id !== undefined) row.author_id = b.author_id ? String(b.author_id).slice(0, 60) : null;

  // slug_en (idioma inglés). Solo se incluye cuando corresponde; guardado tolerante
  // si la columna aún no existe.
  if (b.slug_en !== undefined) {
    const se = sanSlug(b.slug_en);
    row.slug_en = se ? await uniqueSlugEn(se, b.id) : null;
  } else if (!b.id) {
    const se = shortSlug('', b.title_en || b.title_es || 'article', b.keyword);
    if (se) row.slug_en = await uniqueSlugEn(se);
  }

  if (b.id) {
    // Al editar NO cambiamos el slug salvo que el editor lo pida. Si cambia, guardamos
    // una redirección 301 de la URL vieja a la nueva (no perder posicionamiento).
    if (b.slug) {
      const { data: cur } = await supabaseAdmin.from('blog_posts').select('slug,status').eq('id', b.id).maybeSingle();
      const newSlug = await uniqueSlug(b.slug, b.id);
      if ((cur as any)?.slug && (cur as any).slug !== newSlug && (cur as any).status === 'published') await addRedirect((cur as any).slug, newSlug);
      row.slug = newSlug;
    }
    await updateTolerant(b.id, row);
    try { revalidateTag('blog_posts'); } catch {}
    return { id: b.id };
  }
  // Post NUEVO: slug corto con keyword (3-6 palabras), cortado a palabra completa.
  const base = shortSlug(b.slug || '', b.title_es || b.title_en || 'articulo', b.keyword);
  row.slug = await uniqueSlug(base);
  row.author = b.author ? String(b.author).slice(0, 120) : null;
  let ins = await supabaseAdmin.from('blog_posts').insert(row).select('id').single();
  if (ins.error && ('slug_en' in row || 'author_id' in row)) { delete row.slug_en; delete row.author_id; ins = await supabaseAdmin.from('blog_posts').insert(row).select('id').single(); }
  if (ins.error) throw new Error(ins.error.message);
  try { revalidateTag('blog_posts'); } catch {}
  return { id: (ins.data as any).id, slug: row.slug };
}

// Reprograma SOLO la fecha/hora de un post (para normalizar el calendario).
export async function setPublishAt(id: string, iso: string) {
  await supabaseAdmin.from('blog_posts').update({ publish_at: iso }).eq('id', id);
}

export async function deletePost(id: string) {
  await supabaseAdmin.from('blog_posts').delete().eq('id', id);
}

// Publica los artículos programados cuya hora ya llegó (lo usa el cron).
export async function publishDuePosts() {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin.from('blog_posts')
    .select('id,body_es,body_en').eq('status', 'scheduled').lte('publish_at', nowIso).limit(100);
  // Nunca publicar una fecha del piloto automático cuyo contenido aún no se generó
  // (cuerpo vacío en ambos idiomas). Se queda programada y el cron la rellenará.
  const ids = (data || []).filter((r: any) => String(r.body_es || '').trim() || String(r.body_en || '').trim()).map((r: any) => r.id);
  if (!ids.length) return 0;
  await supabaseAdmin.from('blog_posts').update({ status: 'published', published_at: nowIso }).in('id', ids);
  try { revalidateTag('blog_posts'); } catch {}
  return ids.length;
}
