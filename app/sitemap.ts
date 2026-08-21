import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/guide';
import { LANGS } from '@/lib/navText';
import { publishedSlugs } from '@/lib/blog';
import { PROP_FIRMS } from '@/lib/propFirms';

// Sitemap: le dice a Google qué páginas existen para que las descubra rápido.
// Para cada página incluimos las variantes de los 6 idiomas con hreflang, para
// que Google indexe y sirva la versión correcta por idioma/región. El español
// va en la raíz; los demás bajo /en, /zh, /ja, /pt, /vi. x-default → español.
const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Construye el mapa hreflang de los 6 idiomas para una ruta base (sin prefijo).
function langMap(path: string): Record<string, string> {
  const m: Record<string, string> = { 'x-default': `${url}${path}` };
  for (const l of LANGS) m[l] = l === 'es' ? `${url}${path}` : `${url}/${l}${path}`;
  return m;
}

// Emite una entrada por idioma (Google prefiere ver cada URL localizada listada),
// cada una apuntando al mismo set de alternates hreflang.
function entriesFor(path: string, opts: { lastModified: Date; changeFrequency: any; priority: number }) {
  const languages = langMap(path);
  return LANGS.map((l) => ({
    url: l === 'es' ? `${url}${path}` : `${url}/${l}${path}`,
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: l === 'es' ? opts.priority : Math.max(0.3, opts.priority - 0.1),
    alternates: { languages },
  }));
}

// Entrada de blog: ES + EN con su slug propio por idioma (URLs localizadas).
function blogEntries(esPath: string, enPath: string, lastModified: Date) {
  const languages: Record<string, string> = { 'x-default': `${url}${esPath}`, es: `${url}${esPath}`, en: `${url}/en${enPath}` };
  return [
    { url: `${url}${esPath}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.7, alternates: { languages } },
    { url: `${url}/en${enPath}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.6, alternates: { languages } },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths: { p: string; pr: number; f: 'weekly' | 'monthly' | 'yearly' }[] = [
    { p: '', pr: 1, f: 'weekly' },
    { p: '/pricing', pr: 0.9, f: 'weekly' },
    { p: '/prop-firms', pr: 0.85, f: 'weekly' },
    { p: '/copy', pr: 0.85, f: 'weekly' },
    { p: '/blog', pr: 0.8, f: 'weekly' },
    { p: '/embajadores', pr: 0.7, f: 'monthly' },
    { p: '/invita', pr: 0.7, f: 'monthly' },
    { p: '/guia', pr: 0.8, f: 'weekly' },
    { p: '/contacto', pr: 0.6, f: 'monthly' },
    { p: '/login', pr: 0.5, f: 'monthly' },
    { p: '/terms', pr: 0.3, f: 'yearly' },
  ];
  const pages = staticPaths.flatMap((s) => entriesFor(s.p, { lastModified: now, changeFrequency: s.f, priority: s.pr }));
  const articles = ARTICLES.flatMap((a) => entriesFor(`/guia/${a.slug}`, { lastModified: now, changeFrequency: 'monthly', priority: 0.6 }));
  const firms = PROP_FIRMS.flatMap((f) => entriesFor(`/prop-firms/${f.slug}`, { lastModified: now, changeFrequency: 'weekly', priority: 0.75 }));
  let blog: MetadataRoute.Sitemap = [];
  try {
    const posts = await publishedSlugs();
    blog = posts.flatMap((p) => blogEntries(`/blog/${p.slug}`, `/blog/${p.slugEn}`, new Date(p.updated)));
  } catch { blog = []; }
  return [...pages, ...firms, ...articles, ...blog];
}
