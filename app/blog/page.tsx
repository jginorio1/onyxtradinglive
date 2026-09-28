import type { Metadata } from 'next';
import { listPublishedLite, blogCoverUrl, slugFor } from '@/lib/blog';
import { serverLang, localeAlternates } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';
import BlogList, { type BlogCard } from './BlogList';
import AdSlot from '@/app/components/AdSlot';

export const dynamic = 'force-dynamic'; // se renderiza en cada visita (contenido siempre fresco)

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'blog', es,
    es ? 'Blog | Prop Firms, Gestión de Riesgo y Disciplina' : 'Blog | Prop Firms, Risk Management & Discipline',
    es ? 'Retos de prop firm, drawdown diario, diario de trading, psicología y gestión de riesgo. Estrategias reales para traders fondeados.'
       : 'Prop firm challenges, daily drawdown, trading journal, psychology and risk management. Real strategies for funded traders.');
  return { title: seo.title, description: seo.description, alternates: localeAlternates('/blog') };
}

// Palabras clave por categoría (espejo del piloto de noticias). Clasifica cada
// artículo en un tema para el filtro y los chips. Las guías = artículos que NO son
// noticia (is_news === false).
const CATS_KW: Record<string, string[]> = {
  crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'stablecoin', 'binance', 'coinbase', 'token', 'blockchain', 'solana', 'xrp', 'defi', 'cripto'],
  earnings: ['earnings', 'revenue', 'guidance', 'quarterly', 'results', 'beats', 'misses', 'profit', 'eps', 'forecast', 'ingresos', 'resultados'],
  macro: ['fed', 'fomc', 'rate', 'cpi', 'inflation', 'pce', 'gdp', 'jobs', 'payroll', 'unemployment', 'ecb', 'boe', 'boj', 'recession', 'tariff', 'powell', 'treasury', 'yield', 'central bank', 'interest', 'jobless', 'inflaci', 'tasas', 'aranceles'],
};
function catOf(p: any): string {
  if (p.is_news === false) return 'guide';
  const t = ((p.title_es || '') + ' ' + (p.title_en || '') + ' ' + (p.tags || '')).toLowerCase();
  for (const k of CATS_KW.crypto) if (t.includes(k)) return 'crypto';
  for (const k of CATS_KW.earnings) if (t.includes(k)) return 'earnings';
  for (const k of CATS_KW.macro) if (t.includes(k)) return 'macro';
  return 'markets';
}
function readMin(p: any, es: boolean): number {
  // La lista ligera NO trae cuerpos (por velocidad). Usamos el conteo de palabras
  // guardado (words_es/words_en) si existe; si no, un estimado prudente (~5 min).
  const words = Number(es ? p.words_es : p.words_en) || Number(p.words_es) || Number(p.words_en) || 0;
  if (words > 0) return Math.max(1, Math.round(words / 200));
  // Respaldo cuando aún no hay conteo: estimar desde el largo del extracto.
  const ex = (es ? p.excerpt_es : p.excerpt_en) || p.excerpt_es || p.excerpt_en || '';
  const exWords = String(ex).split(/\s+/).filter(Boolean).length;
  return Math.min(12, Math.max(3, Math.round(exWords / 6)));
}
function fmtDate(iso: string, es: boolean) {
  try { return new Date(iso).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' }); } catch { return ''; }
}

export default async function BlogIndex() {
  const es = serverLang() === 'es';
  const raw = await listPublishedLite(300);
  const pref = <T,>(a: T, b: T) => (a || b);

  // Aplanamos cada post al idioma actual + categoría + tiempo de lectura.
  const posts: BlogCard[] = raw.map((p: any) => {
    const href = es ? `/blog/${p.slug}` : `/en/blog/${slugFor(p, 'en')}`;
    return {
      id: p.id,
      href,
      title: pref(es ? p.title_es : p.title_en, es ? p.title_en : p.title_es) || '',
      excerpt: pref(es ? p.excerpt_es : p.excerpt_en, es ? p.excerpt_en : p.excerpt_es) || '',
      cover: blogCoverUrl(p, es ? 'es' : 'en'),
      dateLabel: fmtDate(p.published_at, es),
      cat: catOf(p),
      readMin: readMin(p, es),
    };
  });

  // JSON-LD: Blog + lista de artículos + migas de pan. Mejora el SEO y los rich results.
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        name: es ? 'Blog de Onyx Trading Live' : 'Onyx Trading Live Blog',
        url: SITE + (es ? '/blog' : '/en/blog'),
        inLanguage: es ? 'es' : 'en',
        blogPost: posts.slice(0, 12).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: SITE + p.href, image: p.cover })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: es ? 'Inicio' : 'Home', item: SITE + (es ? '/' : '/en') },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + (es ? '/blog' : '/en/blog') },
        ],
      },
    ],
  };

  return (
    <div className="wrap section" style={{ maxWidth: 980 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <h1 style={{ fontSize: 30 }}>{es ? 'Blog de Onyx' : 'Onyx Blog'}</h1>
        <p className="muted" style={{ fontSize: 16, marginTop: 8, maxWidth: 640, marginInline: 'auto' }}>
          {es ? 'Noticias del mercado y guías prácticas sobre disciplina, gestión de riesgo y prop firms. Filtra por categoría o busca lo que necesites.'
              : 'Market news and practical guides on discipline, risk management and prop firms. Filter by category or search for what you need.'}
        </p>
      </div>

      {/* Espacio patrocinado · leaderboard superior del blog */}
      <AdSlot slot="blog_top" lang={es ? 'es' : 'en'} />

      {posts.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>
          {es ? 'Pronto habrá artículos aquí.' : 'Articles coming soon.'}
        </div>
      ) : (
        <BlogList posts={posts} es={es} pageSize={12} />
      )}

      {/* Un solo anuncio in-feed al pie del listado del blog. */}
      <AdSlot slot="blog_infeed" lang={es ? 'es' : 'en'} />
    </div>
  );
}
