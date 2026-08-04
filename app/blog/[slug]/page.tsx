import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedBySlug } from '@/lib/blog';
import { mdToHtml } from '@/lib/md';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import JsonLd from '../../JsonLd';

export const dynamic = 'force-dynamic';

const pref = (a: string, b: string) => (a && a.trim() ? a : b);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPublishedBySlug(params.slug);
  if (!p) return { title: 'Blog · Onyx Trading Live' };
  const es = serverLang() === 'es';
  const title = pref(es ? p.title_es : p.title_en, es ? p.title_en : p.title_es);
  const desc = pref(es ? p.excerpt_es : p.excerpt_en, es ? p.excerpt_en : p.excerpt_es);
  return {
    title: `${title} · Onyx Trading Live`,
    description: desc || title,
    alternates: localeAlternates(`/blog/${p.slug}`),
    openGraph: { title, description: desc || title, type: 'article', images: p.cover_url ? [p.cover_url] : undefined },
  };
}

function fmtDate(iso: string, es: boolean) {
  try { return new Date(iso).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; }
}

export default async function BlogArticle({ params }: { params: { slug: string } }) {
  const p = await getPublishedBySlug(params.slug);
  if (!p) notFound();
  const es = serverLang() === 'es';
  const title = pref(es ? p.title_es : p.title_en, es ? p.title_en : p.title_es);
  const excerpt = pref(es ? p.excerpt_es : p.excerpt_en, es ? p.excerpt_en : p.excerpt_es);
  const body = pref(es ? p.body_es : p.body_en, es ? p.body_en : p.body_es);
  const html = mdToHtml(body);

  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: title, description: excerpt, inLanguage: es ? 'es' : 'en',
    datePublished: p.published_at, dateModified: p.published_at,
    image: p.cover_url || undefined,
    mainEntityOfPage: `${SITE}/blog/${p.slug}`,
    author: { '@type': 'Organization', name: 'Onyx Trading Live' },
    publisher: { '@type': 'Organization', name: 'Onyx Trading Live', logo: { '@type': 'ImageObject', url: `${SITE}/onyx-symbol.png` } },
  };

  return (
    <div className="wrap section" style={{ maxWidth: 760 }}>
      <JsonLd data={ld} />
      <Link href="/blog" className="muted" style={{ fontSize: 13.5, textDecoration: 'none' }}>← {es ? 'Blog' : 'Blog'}</Link>
      <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>{fmtDate(p.published_at, es)}</div>
      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '6px 0 8px' }}>{title}</h1>
      {excerpt && <p className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>{excerpt}</p>}
      {p.cover_url && <img src={p.cover_url} alt="" style={{ width: '100%', borderRadius: 14, margin: '16px 0' }} />}
      <article className="blog-body" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="card" style={{ marginTop: 34, textAlign: 'center', padding: 24 }}>
        <h3 style={{ marginBottom: 8 }}>{es ? 'Lleva tu trading al siguiente nivel' : 'Take your trading to the next level'}</h3>
        <p className="muted" style={{ fontSize: 14, maxWidth: 480, margin: '0 auto 14px' }}>
          {es ? 'Onyx analiza cada operación, cuida tu riesgo con el Guardian y te muestra tus números reales.'
              : 'Onyx analyzes every trade, protects your risk with Guardian and shows your real numbers.'}
        </p>
        <Link className="btn btn-primary" href="/pricing">{es ? 'Ver planes' : 'See plans'}</Link>
      </div>
    </div>
  );
}
