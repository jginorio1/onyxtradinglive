'use client';
import { useState } from 'react';
import Link from 'next/link';

type Lang = 'es' | 'en';

const dict = {
  es: {
    nav: { features: 'Funciones', how: 'Cómo funciona', pricing: 'Precios', faq: 'FAQ', login: 'Entrar', cta: 'Empieza gratis' },
    hero: {
      badge: '🔗 Conecta MT4 y MT5 · Sincronización automática',
      h1a: 'Tu diario de trading', h1b: 'inteligente y automático',
      sub: 'Conecta tus cuentas de MetaTrader y deja que Onyx registre y analice cada operación. Descubre qué funciona y opera con datos, no con memoria.',
      cta1: 'Empieza gratis →', cta2: 'Ver precios', note: 'Sin tarjeta para empezar · Cancela cuando quieras',
    },
    trust: ['✅ Compatible con MT4 y MT5', '🔒 Conexión de solo lectura', '💳 Pagos seguros con Stripe'],
    probT: 'Deja de operar a ciegas',
    probS: 'La mayoría de traders no sabe qué le hace ganar y qué le hace perder. Onyx convierte tu historial en información clara para que mejores de verdad.',
    featT: 'Todo lo que necesitas para mejorar',
    features: [
      { i: '🔗', t: 'Conexión MT4/MT5', d: 'Vincula tus cuentas y sincroniza el historial automáticamente, sin subir nada a mano.' },
      { i: '📈', t: 'Estadísticas avanzadas', d: 'Win rate, profit factor, expectancy, payoff, drawdown, break even y mucho más.' },
      { i: '🗓️', t: 'Calendario de resultados', d: 'Visualiza tu P&L por día, mes y año con un calendario tipo mapa de calor.' },
      { i: '🗂️', t: 'Multi-cuenta y portafolio', d: 'Gestiona varias cuentas (real, demo, fondeo) y ve tu portafolio completo sumado.' },
      { i: '🌍', t: 'Sesiones, días y pares', d: 'Descubre tus mejores y peores horas, sesiones, días y pares.' },
      { i: '🏆', t: 'Seguimiento de fondeo', d: 'Sigue tu drawdown y objetivo de FTMO y otras prop firms en tiempo real.' },
    ],
    showT: 'Un dashboard profesional de verdad',
    showS: 'Calendario, curva de equity, distribución, mejores pares y sesiones. Todo calculado por ti, en tiempo real.',
    howT: 'Listo en 3 minutos',
    steps: [
      { t: 'Crea tu cuenta', d: 'Regístrate gratis con tu email. Sin tarjeta.' },
      { t: 'Conecta MetaTrader', d: 'Instala el Onyx Connector y pega tu API key. Solo lectura.' },
      { t: 'Analiza y mejora', d: 'Tus operaciones aparecen al instante con todas las estadísticas.' },
    ],
    whoT: '¿Para quién es Onyx?',
    who: [
      { i: '👤', t: 'Trader retail', d: 'Entiende tu operativa y corrige tus fugas de dinero.' },
      { i: '🏦', t: 'Trader de fondeo', d: 'Controla las reglas de FTMO y otras prop firms sin romperlas.' },
      { i: '🤖', t: 'Trader algorítmico', d: 'Analiza el rendimiento real de tus bots y estrategias.' },
    ],
    cmpT: 'Onyx vs lo de siempre',
    cmp: {
      head: ['', 'Excel a mano', 'Onyx'],
      rows: [
        ['Sincronización automática', '❌', '✅'],
        ['Estadísticas avanzadas', 'Limitado', '✅'],
        ['Calendario y gráficas', '❌', '✅'],
        ['Multi-cuenta y portafolio', 'Difícil', '✅'],
        ['Reglas de fondeo', '❌', '✅'],
      ],
    },
    secT: 'Seguro por diseño',
    secS: 'Onyx se conecta en modo solo lectura: lee tu historial de operaciones, pero nunca puede operar, retirar ni mover tus fondos. Tus pagos van cifrados a través de Stripe.',
    priceT: 'Planes para cada trader', priceS: 'Empieza gratis. Cambia o cancela cuando quieras.',
    monthly: 'Mensual', annual: 'Anual (2 meses gratis)',
    plans: [
      { n: 'Free', p: 0, items: ['1 cuenta MT', 'Estadísticas básicas', '30 días de historial'], cta: 'Empezar gratis', pop: false },
      { n: 'Pro', p: 19, items: ['5 cuentas MT', 'Todas las estadísticas', 'Historial ilimitado', 'Calendario y gráficas', 'Reglas de fondeo'], cta: 'Elegir Pro', pop: true },
      { n: 'Elite', p: 39, items: ['Cuentas ilimitadas', 'Todo lo de Pro', 'Informes automáticos', 'Alertas por Telegram', 'Soporte prioritario'], cta: 'Elegir Elite', pop: false },
    ],
    faqT: 'Preguntas frecuentes',
    faqs: [
      ['¿Es seguro conectar mi cuenta?', 'Sí. La conexión es de solo lectura: Onyx lee tu historial pero nunca puede operar ni retirar fondos.'],
      ['¿Funciona con MT4 y MT5?', 'Sí, con las dos. Solo cambias el archivo del connector según tu plataforma; la misma API key sirve para ambas.'],
      ['¿Sirve para cuentas de fondeo (FTMO)?', 'Sí. Puedes seguir tu drawdown, objetivo y días operados en tiempo real.'],
      ['¿Puedo cancelar cuando quiera?', 'Claro. Gestionas tu suscripción desde tu panel y cancelas o cambias de plan en cualquier momento.'],
      ['¿Qué formas de pago aceptan?', 'Pago seguro con tarjeta a través de Stripe. Tus datos de pago nunca pasan por nuestros servidores.'],
    ],
    finalT: 'Empieza a operar con datos, no con memoria', finalCta: 'Crear cuenta gratis',
    footer: { terms: 'Términos', privacy: 'Privacidad', rights: '© 2026 Onyx Trading Live' },
  },
  en: {
    nav: { features: 'Features', how: 'How it works', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', cta: 'Start free' },
    hero: {
      badge: '🔗 Connect MT4 & MT5 · Automatic sync',
      h1a: 'Your trading journal,', h1b: 'smart and automatic',
      sub: 'Connect your MetaTrader accounts and let Onyx log and analyze every trade. Find out what works and trade with data, not memory.',
      cta1: 'Start free →', cta2: 'See pricing', note: 'No card to start · Cancel anytime',
    },
    trust: ['✅ Works with MT4 & MT5', '🔒 Read-only connection', '💳 Secure payments with Stripe'],
    probT: 'Stop trading blind',
    probS: 'Most traders don\'t know what makes them win or lose. Onyx turns your history into clear insights so you actually improve.',
    featT: 'Everything you need to improve',
    features: [
      { i: '🔗', t: 'MT4/MT5 connection', d: 'Link your accounts and sync your history automatically — nothing to upload by hand.' },
      { i: '📈', t: 'Advanced stats', d: 'Win rate, profit factor, expectancy, payoff, drawdown, break even and much more.' },
      { i: '🗓️', t: 'Results calendar', d: 'See your P&L by day, month and year with a heatmap-style calendar.' },
      { i: '🗂️', t: 'Multi-account & portfolio', d: 'Manage several accounts (live, demo, funded) and see your full portfolio combined.' },
      { i: '🌍', t: 'Sessions, days & pairs', d: 'Discover your best and worst hours, sessions, days and pairs.' },
      { i: '🏆', t: 'Prop-firm tracking', d: 'Track your drawdown and target for FTMO and other prop firms in real time.' },
    ],
    showT: 'A truly professional dashboard',
    showS: 'Calendar, equity curve, distribution, best pairs and sessions. All computed for you, in real time.',
    howT: 'Ready in 3 minutes',
    steps: [
      { t: 'Create your account', d: 'Sign up free with your email. No card.' },
      { t: 'Connect MetaTrader', d: 'Install the Onyx Connector and paste your API key. Read-only.' },
      { t: 'Analyze & improve', d: 'Your trades show up instantly with all the stats.' },
    ],
    whoT: 'Who is Onyx for?',
    who: [
      { i: '👤', t: 'Retail trader', d: 'Understand your trading and fix your money leaks.' },
      { i: '🏦', t: 'Funded trader', d: 'Stay within FTMO and other prop-firm rules with ease.' },
      { i: '🤖', t: 'Algo trader', d: 'Analyze the real performance of your bots and strategies.' },
    ],
    cmpT: 'Onyx vs the usual',
    cmp: {
      head: ['', 'Manual Excel', 'Onyx'],
      rows: [
        ['Automatic sync', '❌', '✅'],
        ['Advanced stats', 'Limited', '✅'],
        ['Calendar & charts', '❌', '✅'],
        ['Multi-account & portfolio', 'Hard', '✅'],
        ['Prop-firm rules', '❌', '✅'],
      ],
    },
    secT: 'Secure by design',
    secS: 'Onyx connects in read-only mode: it reads your trade history but can never trade, withdraw or move your funds. Your payments are encrypted through Stripe.',
    priceT: 'Plans for every trader', priceS: 'Start free. Switch or cancel anytime.',
    monthly: 'Monthly', annual: 'Annual (2 months free)',
    plans: [
      { n: 'Free', p: 0, items: ['1 MT account', 'Basic stats', '30 days of history'], cta: 'Start free', pop: false },
      { n: 'Pro', p: 19, items: ['5 MT accounts', 'All stats', 'Unlimited history', 'Calendar & charts', 'Prop-firm rules'], cta: 'Choose Pro', pop: true },
      { n: 'Elite', p: 39, items: ['Unlimited accounts', 'Everything in Pro', 'Automatic reports', 'Telegram alerts', 'Priority support'], cta: 'Choose Elite', pop: false },
    ],
    faqT: 'Frequently asked questions',
    faqs: [
      ['Is it safe to connect my account?', 'Yes. The connection is read-only: Onyx reads your history but can never trade or withdraw funds.'],
      ['Does it work with MT4 and MT5?', 'Yes, both. You just use the connector file for your platform; the same API key works for both.'],
      ['Does it work with funded accounts (FTMO)?', 'Yes. You can track your drawdown, target and trading days in real time.'],
      ['Can I cancel anytime?', 'Of course. Manage your subscription from your panel and cancel or change plan anytime.'],
      ['What payment methods do you accept?', 'Secure card payments through Stripe. Your payment data never touches our servers.'],
    ],
    finalT: 'Trade with data, not memory', finalCta: 'Create free account',
    footer: { terms: 'Terms', privacy: 'Privacy', rights: '© 2026 Onyx Trading Live' },
  },
} as const;

export default function Home() {
  const [lang, setLang] = useState<Lang>('es');
  const [annual, setAnnual] = useState(false);
  const t = dict[lang];
  const grad = { background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as any;

  return (
    <>
      {/* NAV */}
      <div className="topbar"><div className="wrap">
        <div className="logo"><span className="mark">◆</span> Onyx Trading Live</div>
        <div className="navl"><a href="#features">{t.nav.features}</a><a href="#how">{t.nav.how}</a><a href="#pricing">{t.nav.pricing}</a><a href="#faq">{t.nav.faq}</a></div>
        <div className="row">
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>{lang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}</button>
          <Link className="btn btn-ghost" href="/login">{t.nav.login}</Link>
          <Link className="btn btn-primary" href="/login?mode=signup">{t.nav.cta}</Link>
        </div>
      </div></div>

      {/* HERO */}
      <div className="wrap" style={{ textAlign: 'center', padding: '78px 22px 30px' }}>
        <span className="pill green">{t.hero.badge}</span>
        <h1 style={{ fontSize: 50, margin: '20px 0', lineHeight: 1.08 }}>{t.hero.h1a}<br /><span style={grad}>{t.hero.h1b}</span></h1>
        <p className="muted" style={{ fontSize: 19, maxWidth: 640, margin: '0 auto 26px' }}>{t.hero.sub}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/login?mode=signup" style={{ padding: '14px 28px', fontSize: 16 }}>{t.hero.cta1}</Link>
          <Link className="btn btn-ghost" href="#pricing" style={{ padding: '14px 28px', fontSize: 16 }}>{t.hero.cta2}</Link>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>{t.hero.note}</p>

        {/* dashboard mockup */}
        <div className="card" style={{ maxWidth: 900, margin: '46px auto 0', padding: 14 }}>
          <svg viewBox="0 0 880 380" width="100%" xmlns="http://www.w3.org/2000/svg" fontFamily="Segoe UI,sans-serif">
            <rect x="0" y="0" width="880" height="380" rx="12" fill="#0f131e" />
            {[['Neto', '+$8,240', '#34e2a0'], ['Win rate', '63%', '#f2f5fb'], ['Profit factor', '1.94', '#f2f5fb'], ['Expectancy', '+$42', '#7c8cff']].map((c, i) => (
              <g key={i}><rect x={20 + i * 212} y="20" width="196" height="74" rx="10" fill="#151a28" /><text x={36 + i * 212} y="46" fill="#9aa6bd" fontSize="12">{c[0]}</text><text x={36 + i * 212} y="76" fill={c[2] as string} fontSize="24" fontWeight="800">{c[1]}</text></g>
            ))}
            <rect x="20" y="106" width="520" height="254" rx="10" fill="#151a28" /><text x="38" y="132" fill="#f2f5fb" fontSize="13" fontWeight="700">Curva de equity</text>
            <polyline points="40,320 110,310 180,322 250,288 320,296 390,250 460,262 520,212" fill="none" stroke="#7c8cff" strokeWidth="3" />
            <polygon points="40,320 110,310 180,322 250,288 320,296 390,250 460,262 520,212 520,346 40,346" fill="#7c8cff" opacity="0.12" />
            <rect x="556" y="106" width="304" height="254" rx="10" fill="#151a28" /><text x="574" y="132" fill="#f2f5fb" fontSize="13" fontWeight="700">Calendario</text>
            {Array.from({ length: 20 }).map((_, i) => { const g = (i * 7) % 3 !== 0; return <rect key={i} x={574 + (i % 5) * 56} y={146 + Math.floor(i / 5) * 50} width="48" height="42" rx="6" fill={g ? 'rgba(52,226,160,0.4)' : 'rgba(255,107,125,0.4)'} />; })}
          </svg>
        </div>
      </div>

      {/* TRUST */}
      <div className="wrap" style={{ padding: '10px 22px 30px' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 34, flexWrap: 'wrap', color: 'var(--mut)', fontSize: 15 }}>
          {t.trust.map((x, i) => <span key={i}>{x}</span>)}
        </div>
      </div>

      {/* PROBLEM */}
      <div className="wrap section" style={{ textAlign: 'center', maxWidth: 720 }}>
        <h2>{t.probT}</h2><p className="muted" style={{ fontSize: 17, marginTop: 10 }}>{t.probS}</p>
      </div>

      {/* FEATURES */}
      <div id="features" className="wrap section">
        <h2 style={{ textAlign: 'center', marginBottom: 34 }}>{t.featT}</h2>
        <div className="grid g3">
          {t.features.map((f, i) => (
            <div key={i} className="card"><div style={{ fontSize: 26, marginBottom: 10 }}>{f.i}</div><h3 style={{ marginBottom: 6 }}>{f.t}</h3><p className="muted" style={{ fontSize: 15 }}>{f.d}</p></div>
          ))}
        </div>
      </div>

      {/* SHOWCASE */}
      <div className="wrap section" style={{ textAlign: 'center' }}>
        <h2>{t.showT}</h2><p className="muted" style={{ fontSize: 17, margin: '10px auto 26px', maxWidth: 620 }}>{t.showS}</p>
        <div className="grid g3" style={{ textAlign: 'left' }}>
          <div className="card"><h3>🗓️ {lang === 'es' ? 'Calendario' : 'Calendar'}</h3><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'P&L por día en verde/rojo, con total mensual y anual.' : 'Daily P&L in green/red, with monthly and yearly totals.'}</p></div>
          <div className="card"><h3>📊 {lang === 'es' ? 'Gráficas' : 'Charts'}</h3><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Por día, hora, sesión, par, largos vs cortos y más.' : 'By day, hour, session, pair, long vs short and more.'}</p></div>
          <div className="card"><h3>🗂️ {lang === 'es' ? 'Portafolio' : 'Portfolio'}</h3><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Suma varias cuentas y ponles nombre (FTMO 50K…).' : 'Combine several accounts and name them (FTMO 50K…).'}</p></div>
        </div>
      </div>

      {/* HOW */}
      <div id="how" className="wrap section">
        <h2 style={{ textAlign: 'center', marginBottom: 34 }}>{t.howT}</h2>
        <div className="grid g3">
          {t.steps.map((s, i) => (
            <div key={i} className="card"><div className="mark" style={{ width: 34, height: 34, borderRadius: 10, marginBottom: 12, fontWeight: 700 }}>{i + 1}</div><h3>{s.t}</h3><p className="muted" style={{ marginTop: 6 }}>{s.d}</p></div>
          ))}
        </div>
      </div>

      {/* WHO */}
      <div className="wrap section">
        <h2 style={{ textAlign: 'center', marginBottom: 34 }}>{t.whoT}</h2>
        <div className="grid g3">
          {t.who.map((w, i) => (<div key={i} className="card"><div style={{ fontSize: 26, marginBottom: 8 }}>{w.i}</div><h3>{w.t}</h3><p className="muted" style={{ marginTop: 6 }}>{w.d}</p></div>))}
        </div>
      </div>

      {/* COMPARISON */}
      <div className="wrap section" style={{ maxWidth: 720 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>{t.cmpT}</h2>
        <div className="card">
          <table>
            <thead><tr>{t.cmp.head.map((h, i) => <th key={i} style={{ textAlign: i === 0 ? 'left' : 'center', fontSize: 15 }}>{h}</th>)}</tr></thead>
            <tbody>{t.cmp.rows.map((r, i) => (<tr key={i}><td>{r[0]}</td><td style={{ textAlign: 'center' }} className="muted">{r[1]}</td><td style={{ textAlign: 'center' }}>{r[2]}</td></tr>))}</tbody>
          </table>
        </div>
      </div>

      {/* SECURITY */}
      <div className="wrap section" style={{ textAlign: 'center', maxWidth: 720 }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
        <h2>{t.secT}</h2><p className="muted" style={{ fontSize: 17, marginTop: 10 }}>{t.secS}</p>
      </div>

      {/* PRICING */}
      <div id="pricing" className="wrap section">
        <h2 style={{ textAlign: 'center' }}>{t.priceT}</h2>
        <p className="muted" style={{ textAlign: 'center', margin: '10px 0 20px' }}>{t.priceS}</p>
        <div className="row" style={{ justifyContent: 'center', marginBottom: 26 }}>
          <button className={'btn ' + (!annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(false)}>{t.monthly}</button>
          <button className={'btn ' + (annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(true)}>{t.annual}</button>
        </div>
        <div className="grid g3">
          {t.plans.map((p, i) => (
            <div key={i} className="card" style={p.pop ? { border: '2px solid var(--brand)' } : {}}>
              {p.pop && <span className="pill green" style={{ marginBottom: 8, display: 'inline-block' }}>★ {lang === 'es' ? 'Más popular' : 'Most popular'}</span>}
              <h3>{p.n}</h3>
              <div style={{ fontSize: 42, fontWeight: 800, margin: '6px 0 2px' }}>${annual ? p.p * 10 : p.p}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? (lang === 'es' ? 'año' : 'yr') : (lang === 'es' ? 'mes' : 'mo')}</span></div>
              <ul style={{ listStyle: 'none', margin: '16px 0' }}>{p.items.map((it, j) => <li key={j} style={{ padding: '7px 0', color: '#d6dae6' }}>✓ {it}</li>)}</ul>
              <Link className={'btn ' + (p.pop ? 'btn-primary' : 'btn-ghost')} href="/login?mode=signup" style={{ display: 'block', textAlign: 'center' }}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="wrap section" style={{ maxWidth: 760 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 26 }}>{t.faqT}</h2>
        {t.faqs.map((f, i) => (
          <details key={i} className="card" style={{ marginBottom: 12, padding: '4px 20px' }}>
            <summary style={{ cursor: 'pointer', padding: '16px 0', fontWeight: 600, fontSize: 16 }}>{f[0]}</summary>
            <p className="muted" style={{ padding: '0 0 16px', fontSize: 15 }}>{f[1]}</p>
          </details>
        ))}
      </div>

      {/* FINAL CTA */}
      <div className="wrap section">
        <div className="card" style={{ textAlign: 'center', padding: '54px 30px', background: 'linear-gradient(120deg,#1a1f30,#141826)' }}>
          <h2 style={{ marginBottom: 20 }}>{t.finalT}</h2>
          <Link className="btn btn-primary" href="/login?mode=signup" style={{ padding: '15px 34px', fontSize: 17 }}>{t.finalCta}</Link>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid var(--line)', padding: '32px 0' }}>
        <div className="wrap row between" style={{ flexWrap: 'wrap', gap: 16, color: 'var(--mut)', fontSize: 14 }}>
          <div className="logo" style={{ fontSize: 16 }}><span className="mark" style={{ width: 24, height: 24, fontSize: 13 }}>◆</span> Onyx Trading Live</div>
          <div className="row" style={{ gap: 20 }}>
            <Link href="/terms">{t.footer.terms}</Link>
            <Link href="/privacy">{t.footer.privacy}</Link>
            <span>{t.footer.rights}</span>
          </div>
        </div>
      </div>
    </>
  );
}
