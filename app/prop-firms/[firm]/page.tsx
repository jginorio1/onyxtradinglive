import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PROP_FIRMS, firmBySlug } from '@/lib/propFirms';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import JsonLd from '../../JsonLd';

export const dynamic = 'force-dynamic';
export function generateStaticParams() { return PROP_FIRMS.map((f) => ({ firm: f.slug })); }

export async function generateMetadata({ params }: { params: { firm: string } }): Promise<Metadata> {
  const f = firmBySlug(params.firm);
  if (!f) return { title: 'Prop firms · Onyx Trading Live' };
  const es = serverLang() === 'es';
  const l = es ? 'es' : 'en';
  return {
    title: f.seoTitle[l],
    description: f.seoDesc[l],
    keywords: f.keywords[l],
    alternates: localeAlternates(`/prop-firms/${f.slug}`),
    openGraph: { title: f.seoTitle[l], description: f.seoDesc[l], type: 'website', url: `${SITE}/prop-firms/${f.slug}` },
  };
}

export default function FirmPage({ params }: { params: { firm: string } }) {
  const f = firmBySlug(params.firm);
  if (!f) notFound();
  const firm = f!;
  const es = serverLang() === 'es';
  const l = es ? 'es' : 'en';
  const self = `${SITE}/prop-firms/${firm.slug}`;
  const cta = es ? 'Empezar gratis' : 'Start free';
  const see = es ? 'Ver planes' : 'See plans';

  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: firm.faq.map((q) => ({ '@type': 'Question', name: q.q[l], acceptedAnswer: { '@type': 'Answer', text: q.a[l] } })),
  };
  const pageLd = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: firm.seoTitle[l], description: firm.seoDesc[l], inLanguage: l, mainEntityOfPage: self,
    about: { '@type': 'Organization', name: firm.name },
    publisher: { '@type': 'Organization', name: 'Onyx Trading Live', logo: { '@type': 'ImageObject', url: `${SITE}/onyx-symbol.png` } },
  };
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: es ? 'Inicio' : 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Prop firms', item: `${SITE}/prop-firms` },
      { '@type': 'ListItem', position: 3, name: firm.name, item: self },
    ],
  };

  return (
    <div className="wrap section" style={{ maxWidth: 760 }}>
      <JsonLd data={pageLd} />
      <JsonLd data={faqLd} />
      <JsonLd data={crumbLd} />

      <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>{es ? 'Inicio' : 'Home'}</Link>
        <span style={{ opacity: .5 }}> › </span>
        <Link href="/prop-firms" style={{ color: 'inherit', textDecoration: 'none' }}>Prop firms</Link>
        <span style={{ opacity: .5 }}> › </span>
        <span style={{ color: 'var(--tx)' }}>{firm.name}</span>
      </div>

      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '4px 0 10px' }}>
        {es ? `${firm.name} con Onyx: sigue las reglas y pasa el reto` : `${firm.name} with Onyx: track the rules and pass the challenge`}
      </h1>
      <p className="muted" style={{ fontSize: 17, lineHeight: 1.55 }}>{firm.intro[l]}</p>

      <div className="row" style={{ gap: 10, margin: '18px 0 8px', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" href="/login?mode=signup">{cta}</Link>
        <Link className="btn btn-ghost" href="/pricing">{see}</Link>
      </div>

      <h2 style={{ marginTop: 26, marginBottom: 12 }}>{es ? `Cómo te ayuda Onyx con ${firm.name}` : `How Onyx helps you with ${firm.name}`}</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
          {firm.bullets[l].map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>

      <h2 style={{ marginTop: 28, marginBottom: 12 }}>{es ? 'Preguntas frecuentes' : 'Frequently asked questions'}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {firm.faq.map((q, i) => (
          <div key={i} className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{q.q[l]}</div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{q.a[l]}</div>
          </div>
        ))}
      </div>

      {/* Otras firmas (enlazado interno) */}
      <h2 style={{ marginTop: 28, marginBottom: 12 }}>{es ? 'Otras prop firms' : 'Other prop firms'}</h2>
      <div className="grid g3" style={{ gap: 12 }}>
        {PROP_FIRMS.filter((x) => x.slug !== firm.slug).map((x) => (
          <Link key={x.slug} href={`/prop-firms/${x.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontWeight: 700 }}>{x.name}</div>
            <span style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 600 }}>{es ? 'Ver →' : 'Open →'}</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 28, textAlign: 'center', padding: 24, background: 'linear-gradient(180deg, color-mix(in srgb,var(--brand) 8%,transparent), transparent)' }}>
        <h3 style={{ margin: '0 0 8px' }}>{es ? `Conecta tu cuenta de ${firm.name} en minutos` : `Connect your ${firm.name} account in minutes`}</h3>
        <p className="muted" style={{ fontSize: 14, maxWidth: 480, margin: '0 auto 16px' }}>
          {es ? 'Sigue tu marcador en vivo y deja que el Guardian cuide tu riesgo.' : 'Track your scoreboard live and let Guardian protect your risk.'}
        </p>
        <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/login?mode=signup">{cta}</Link>
          <Link className="btn btn-ghost" href="/pricing">{see}</Link>
        </div>
      </div>
    </div>
  );
}
