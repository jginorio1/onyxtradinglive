import type { Metadata } from 'next';
import Link from 'next/link';
import { PROP_FIRMS } from '@/lib/propFirms';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import JsonLd from '../JsonLd';

export const dynamic = 'force-dynamic';

const T = {
  es: {
    title: 'Onyx para traders de fondeo | Sigue las reglas de tu prop firm',
    desc: 'El sistema operativo del trader de fondeo: sigue las reglas de FTMO, FundedNext, The5ers y FundingPips, protege tu riesgo con el Guardian y lleva varias cuentas a la vez.',
    h1: 'El sistema operativo del trader de fondeo',
    sub: 'Conecta tus cuentas de prop firm, sigue el marcador de tu reto en vivo y deja que el Guardian cuide tu riesgo. Todo en un solo lugar, para todas tus cuentas y firmas.',
    firmsT: 'Elige tu prop firm',
    why: '¿Por qué los traders de fondeo eligen Onyx?',
    bullets: [
      'Marcador del reto en vivo: drawdown, pérdida diaria y días de operación.',
      'Onyx Guardian: freno automático para no romper las reglas.',
      'Varias cuentas y varias prop firms a la vez, sin mezclar tus números.',
      'Copy trading con buenas prácticas anti-baneo entre tus cuentas.',
      'Ganancia neta real: después de comisiones y swap.',
      'Avisos por Telegram al acercarte a un límite o alcanzar una meta.',
    ],
    cta: 'Empezar gratis', see: 'Ver planes',
    open: 'Abrir →',
  },
  en: {
    title: 'Onyx for funded traders | Track your prop firm rules',
    desc: 'The funded trader’s operating system: track FTMO, FundedNext, The5ers and FundingPips rules, protect your risk with Guardian and manage several accounts at once.',
    h1: 'The funded trader’s operating system',
    sub: 'Connect your prop firm accounts, track your challenge scoreboard live and let Guardian protect your risk. All in one place, for every account and firm.',
    firmsT: 'Choose your prop firm',
    why: 'Why funded traders choose Onyx',
    bullets: [
      'Live challenge scoreboard: drawdown, daily loss and trading days.',
      'Onyx Guardian: automatic stop so you don’t break the rules.',
      'Multiple accounts and prop firms at once, numbers kept separate.',
      'Copy trading with anti-ban best practices across your accounts.',
      'Real net profit: after commissions and swap.',
      'Telegram alerts when you approach a limit or hit a goal.',
    ],
    cta: 'Start free', see: 'See plans',
    open: 'Open →',
  },
};

export function generateMetadata(): Metadata {
  const es = serverLang() === 'es';
  const t = es ? T.es : T.en;
  return {
    title: t.title,
    description: t.desc,
    keywords: es
      ? ['prop firm', 'trader de fondeo', 'reglas prop firm', 'ftmo', 'fundednext', 'the5ers', 'fundingpips', 'gestion de riesgo', 'diario de trading']
      : ['prop firm', 'funded trader', 'prop firm rules', 'ftmo', 'fundednext', 'the5ers', 'fundingpips', 'risk management', 'trading journal'],
    alternates: localeAlternates('/prop-firms'),
    openGraph: { title: t.title, description: t.desc, type: 'website', url: `${SITE}/prop-firms` },
  };
}

export default function PropFirmsHub() {
  const es = serverLang() === 'es';
  const t = es ? T.es : T.en;
  const ld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: t.h1, description: t.desc, inLanguage: es ? 'es' : 'en',
    mainEntityOfPage: `${SITE}/prop-firms`,
    hasPart: PROP_FIRMS.map((f) => ({ '@type': 'WebPage', name: f.name, url: `${SITE}/prop-firms/${f.slug}` })),
    publisher: { '@type': 'Organization', name: 'Onyx Trading Live', logo: { '@type': 'ImageObject', url: `${SITE}/onyx-symbol.png` } },
  };

  return (
    <div className="wrap section" style={{ maxWidth: 900 }}>
      <JsonLd data={ld} />

      <div style={{ textAlign: 'center', padding: '8px 0 6px' }}>
        <span className="muted" style={{ fontSize: 12.5, letterSpacing: '.5px', textTransform: 'uppercase' }}>Prop firms</span>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '8px 0 12px' }}>{t.h1}</h1>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 640, margin: '0 auto 18px' }}>{t.sub}</p>
        <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/login?mode=signup">{t.cta}</Link>
          <Link className="btn btn-ghost" href="/pricing">{t.see}</Link>
        </div>
      </div>

      <h2 style={{ marginTop: 34, marginBottom: 14 }}>{t.firmsT}</h2>
      <div className="grid g2" style={{ gap: 14 }}>
        {PROP_FIRMS.map((f) => (
          <Link key={f.slug} href={`/prop-firms/${f.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{f.name}</div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.45, flex: 1 }}>{f.tagline[es ? 'es' : 'en']}</div>
            <span style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 600 }}>{t.open}</span>
          </Link>
        ))}
      </div>

      <h2 style={{ marginTop: 34, marginBottom: 12 }}>{t.why}</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
          {t.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 26, textAlign: 'center', padding: 24, background: 'linear-gradient(180deg, color-mix(in srgb,var(--brand) 8%,transparent), transparent)' }}>
        <h3 style={{ margin: '0 0 8px' }}>{es ? '¿Listo para operar tu reto con datos?' : 'Ready to trade your challenge with data?'}</h3>
        <p className="muted" style={{ fontSize: 14, maxWidth: 480, margin: '0 auto 16px' }}>
          {es ? 'Conecta tu primera cuenta en minutos y sigue tu marcador en vivo.' : 'Connect your first account in minutes and track your scoreboard live.'}
        </p>
        <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/login?mode=signup">{t.cta}</Link>
          <Link className="btn btn-ghost" href="/pricing">{t.see}</Link>
        </div>
      </div>
    </div>
  );
}
