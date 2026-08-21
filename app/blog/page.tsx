import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublished, blogCoverUrl, slugFor } from '@/lib/blog';
import { serverLang, localeAlternates } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

export const dynamic = 'force-dynamic'; // se renderiza en cada visita (contenido siempre fresco)

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'blog', es,
    es ? 'Blog de Onyx Trading Live · Trading, disciplina y prop firms' : 'Onyx Trading Live Blog · Trading, discipline & prop firms',
    es ? 'Artículos sobre gestión de riesgo, psicología, métricas, cuentas de fondeo y cómo sacarle partido a tu diario de trading.'
       : 'Articles on risk management, psychology, metrics, funded accounts and how to get the most out of your trading journal.');
  return { title: seo.title, description: seo.description, alternates: localeAlternates('/blog') };
}

function fmtDate(iso: string, es: boolean) {
  try { return new Date(iso).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; }
}

export default async function BlogIndex() {
  const es = serverLang() === 'es';
  const posts = await listPublished(60);
  const pref = <T,>(a: T, b: T) => (a || b);
  return (
    <div className="wrap section" style={{ maxWidth: 940 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 30 }}>{es ? 'Blog de Onyx' : 'Onyx Blog'}</h1>
        <p className="muted" style={{ fontSize: 16, marginTop: 8, maxWidth: 620, marginInline: 'auto' }}>
          {es ? 'Ideas prácticas sobre disciplina, gestión de riesgo, prop firms y cómo mejorar tu trading con datos.'
              : 'Practical ideas on discipline, risk management, prop firms and how to improve your trading with data.'}
        </p>
      </div>

      {posts.length === 0 && (
        <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>
          {es ? 'Pronto habrá artículos aquí.' : 'Articles coming soon.'}
        </div>
      )}

      <div className="grid g3" style={{ gap: 18, alignItems: 'stretch' }}>
        {posts.map((p: any) => {
          const title = pref(es ? p.title_es : p.title_en, es ? p.title_en : p.title_es);
          const excerpt = pref(es ? p.excerpt_es : p.excerpt_en, es ? p.excerpt_en : p.excerpt_es);
          return (
            <Link key={p.id} href={es ? `/blog/${p.slug}` : `/en/blog/${slugFor(p, 'en')}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none', color: 'inherit', overflow: 'hidden', padding: 0 }}>
              <img src={blogCoverUrl(p, es ? 'es' : 'en')} alt="" loading="lazy" decoding="async" width={400} height={150} style={{ width: '100%', height: 150, objectFit: 'cover' }} />
              <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <div className="muted" style={{ fontSize: 12 }}>{fmtDate(p.published_at, es)}</div>
                <h3 style={{ fontSize: 17, lineHeight: 1.3 }}>{title}</h3>
                {excerpt && <p className="muted" style={{ fontSize: 13.5, flex: 1 }}>{excerpt}</p>}
                <span style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 600 }}>{es ? 'Leer →' : 'Read →'}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
