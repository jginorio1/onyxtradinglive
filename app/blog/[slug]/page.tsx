import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedBySlug, relatedByTags, blogCoverUrl } from '@/lib/blog';
import { mdToHtml, parseFaq } from '@/lib/md';
import { blogAuthorSettings } from '@/lib/settings';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import JsonLd from '../../JsonLd';
import BlogCharts from '../BlogCharts';

export const dynamic = 'force-dynamic';

const pref = (a: string, b: string) => (a && a.trim() ? a : b);
const abs = (u: string) => (u.startsWith('http') ? u : `${SITE}${u}`);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPublishedBySlug(params.slug);
  if (!p) return { title: 'Blog · Onyx Trading Live' };
  const es = serverLang() === 'es';
  const title = pref(es ? p.title_es : p.title_en, es ? p.title_en : p.title_es);
  const desc = pref(es ? p.excerpt_es : p.excerpt_en, es ? p.excerpt_en : p.excerpt_es);
  const cover = abs(blogCoverUrl(p, es ? 'es' : 'en'));
  return {
    title: `${title} · Onyx Trading Live`,
    description: desc || title,
    alternates: localeAlternates(`/blog/${p.slug}`),
    openGraph: { title, description: desc || title, type: 'article', images: [cover] },
    twitter: { card: 'summary_large_image', title, description: desc || title, images: [cover] },
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
  const cover = blogCoverUrl(p, es ? 'es' : 'en');
  const coverAlt = pref(es ? p.cover_alt_es : p.cover_alt_en, es ? p.cover_alt_en : p.cover_alt_es) || title;

  const author = await blogAuthorSettings();
  const authorRole = es ? author.role_es : author.role_en;
  const authorBio = es ? author.bio_es : author.bio_en;
  const related = await relatedByTags(p, 3).catch(() => []);
  const faqs = parseFaq(body);

  const updated = p.updated_at || p.published_at;
  const wasUpdated = p.updated_at && p.published_at && new Date(p.updated_at).getTime() - new Date(p.published_at).getTime() > 86400000;
  const wordCount = body.replace(/[#*>\-]/g, ' ').split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.round(wordCount / 200));
  const initials = (author.name || 'Onyx').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const authorLd: any = { '@type': 'Person', name: author.name, jobTitle: authorRole, description: authorBio };
  if (author.url) authorLd.url = author.url;
  if (author.avatar_url) authorLd.image = author.avatar_url;

  const ld: any = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: title, description: excerpt, inLanguage: es ? 'es' : 'en',
    datePublished: p.published_at, dateModified: updated,
    image: [abs(cover)], wordCount,
    mainEntityOfPage: `${SITE}/blog/${p.slug}`,
    author: authorLd,
    publisher: { '@type': 'Organization', name: 'Onyx Trading Live', logo: { '@type': 'ImageObject', url: `${SITE}/onyx-symbol.png` } },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: es ? 'Inicio' : 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
      { '@type': 'ListItem', position: 3, name: title, item: `${SITE}/blog/${p.slug}` },
    ],
  };
  const faqLd = faqs.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null;

  return (
    <div className="wrap section" style={{ maxWidth: 760 }}>
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd} />
      {faqLd && <JsonLd data={faqLd} />}

      {/* Breadcrumbs visibles */}
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>{es ? 'Inicio' : 'Home'}</Link>
        <span style={{ opacity: .5 }}> › </span>
        <Link href="/blog" style={{ color: 'inherit', textDecoration: 'none' }}>Blog</Link>
        <span style={{ opacity: .5 }}> › </span>
        <span style={{ color: 'var(--tx)' }}>{title.length > 42 ? title.slice(0, 42) + '…' : title}</span>
      </div>

      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '4px 0 10px' }}>{title}</h1>
      {excerpt && <p className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>{excerpt}</p>}

      {/* Firma del autor (E-E-A-T) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
        {author.avatar_url
          ? <img src={author.avatar_url} alt={author.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
          : <div style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#0b0f1e', background: 'linear-gradient(135deg,var(--brand),#a679ff)' }}>{initials}</div>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{author.name} <span className="muted" style={{ fontWeight: 400 }}>· {authorRole}</span></div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {wasUpdated
              ? <>{es ? 'Publicado' : 'Published'} {fmtDate(p.published_at, es)} · <b style={{ color: 'var(--tx)' }}>{es ? 'Actualizado' : 'Updated'} {fmtDate(updated, es)}</b></>
              : <>{fmtDate(p.published_at, es)}</>}
            {' · '}{readMin} min{es ? ' de lectura' : ' read'}
          </div>
        </div>
      </div>

      <img src={cover} alt={coverAlt} style={{ width: '100%', borderRadius: 14, margin: '4px 0 18px' }} />
      <article className="blog-body" dangerouslySetInnerHTML={{ __html: html }} />
      <BlogCharts />

      {/* Bio del autor al pie (autoridad) */}
      {authorBio && (
        <div className="card" style={{ marginTop: 28, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {author.avatar_url
            ? <img src={author.avatar_url} alt={author.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
            : <div style={{ width: 48, height: 48, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#0b0f1e', background: 'linear-gradient(135deg,var(--brand),#a679ff)' }}>{initials}</div>}
          <div>
            <div style={{ fontWeight: 700 }}>{author.name}</div>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>{authorRole}</div>
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{authorBio}</div>
          </div>
        </div>
      )}

      {/* Sigue leyendo (enlazado interno) */}
      {related.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3 style={{ marginBottom: 12 }}>{es ? 'Sigue leyendo' : 'Keep reading'}</h3>
          <div className="grid g3" style={{ gap: 14 }}>
            {related.map((r: any) => {
              const rt = pref(es ? r.title_es : r.title_en, es ? r.title_en : r.title_es);
              return (
                <Link key={r.id} href={`/blog/${r.slug}`} className="card" style={{ padding: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                  <img src={blogCoverUrl(r, es ? 'es' : 'en')} alt="" style={{ width: '100%', height: 96, objectFit: 'cover' }} />
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{rt}</div>
                    <span style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 600 }}>{es ? 'Leer →' : 'Read →'}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 30, textAlign: 'center', padding: 24 }}>
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
