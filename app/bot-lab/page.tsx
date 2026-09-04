import type { Metadata } from 'next';
import Link from 'next/link';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import { listMarketplace, botLabSettings } from '@/lib/botlab';
import BotLabLead from './BotLabLead';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const title = es ? 'Onyx Bot Lab · Construye, compra o vende robots de trading' : 'Onyx Bot Lab · Build, buy or sell trading robots';
  const description = es
    ? 'Construye tu robot sin código, compra robots listos de traders verificados o deja que automaticemos tu estrategia a medida. Vende tus robots y cobra con tarjeta o USDT.'
    : 'Build your robot without coding, buy ready robots from verified traders, or let us automate your strategy. Sell your robots and get paid by card or USDT.';
  return { title, description, alternates: localeAlternates('/bot-lab'), openGraph: { title, description, url: `${SITE}/bot-lab`, type: 'website' } };
}

function money(cents: number) { return '$' + Math.round((cents || 0) / 100).toLocaleString('en-US'); }

const GOLD = 'var(--gold, #ffd45e)';

export default async function BotLabLanding() {
  const es = serverLang() === 'es';
  const s = await botLabSettings();
  let bots: any[] = [];
  try { bots = await listMarketplace({ limit: 8 }); } catch { bots = []; }

  const L = es ? {
    kicker: 'Onyx Bot Lab',
    h1a: 'De una idea a un ', h1b: 'robot que opera solo', h1c: '.',
    sub: 'Construye tu robot sin código, compra robots listos de traders verificados o deja que automaticemos tu estrategia a medida. Con backtest, cuenta demo y monitoreo.',
    ctaMain: 'Automatizar mi estrategia', ctaBuild: 'Construir gratis',
    st1: 'robots monitoreados', st2: 'de gratis a a medida', st3: 'entrega DFY promedio',
    pathsK: 'Tres caminos', pathsH: 'Elige cómo quieres automatizar',
    p1t: 'Construye tú mismo', p1d: 'El constructor visual, sin escribir una línea.', p1p: 'Gratis · Pro $15/mes',
    p2t: 'Compra un robot listo', p2d: 'Catálogo de robots económicos hechos por Onyx y por traders.', p2p: 'Desde $19/mes',
    p3t: 'Lo hacemos por ti', p3d: 'Automatizamos tu estrategia a medida, llave en mano.', p3p: 'A medida',
    ladderK: 'La escalera Onyx', ladderH: 'Un nivel para cada trader',
    marketK: 'Marketplace', marketH: 'Robots de traders verificados', marketS: 'Cada robot muestra su Onyx Score, rendimiento y riesgo.',
    view: 'Ver robot', empty: 'Pronto verás aquí los primeros robots a la venta.',
    sellK: 'Economía de creadores', sellH: 'Construye, publica y cobra',
    sellS: 'Tú pones el precio de tu robot. Onyx cobra por ti y te paga en banco o USDT. Tú te quedas el 80%.',
    sellCta: 'Empezar a vender',
    svcK: 'Servicio a medida', svcH: 'Automatiza tu estrategia con nuestro equipo',
    payH: 'Paga y cobra con tarjeta o USDT', payS: 'Acepta clientes de todo el mundo: tarjeta, transferencia o cripto. Los creadores cobran en USDT o a su banco.',
    finalH: '¿Listo para poner tu trading en piloto automático?',
    finalS: 'Construye gratis, compra un robot listo o deja que lo hagamos por ti.',
  } : {
    kicker: 'Onyx Bot Lab',
    h1a: 'From an idea to a ', h1b: 'robot that trades on its own', h1c: '.',
    sub: 'Build your robot without coding, buy ready robots from verified traders, or let us automate your strategy. With backtest, demo account and monitoring.',
    ctaMain: 'Automate my strategy', ctaBuild: 'Build for free',
    st1: 'robots monitored', st2: 'from free to bespoke', st3: 'avg DFY delivery',
    pathsK: 'Three paths', pathsH: 'Choose how you want to automate',
    p1t: 'Build it yourself', p1d: 'The visual builder, without writing a line.', p1p: 'Free · Pro $15/mo',
    p2t: 'Buy a ready robot', p2d: 'A catalog of affordable robots by Onyx and traders.', p2p: 'From $19/mo',
    p3t: 'We build it for you', p3d: 'We automate your strategy, turnkey.', p3p: 'Bespoke',
    ladderK: 'The Onyx ladder', ladderH: 'A tier for every trader',
    marketK: 'Marketplace', marketH: 'Robots from verified traders', marketS: 'Every robot shows its Onyx Score, performance and risk.',
    view: 'View robot', empty: 'The first robots for sale will show up here soon.',
    sellK: 'Creator economy', sellH: 'Build, publish and get paid',
    sellS: 'You set your robot price. Onyx charges for you and pays you to bank or USDT. You keep 80%.',
    sellCta: 'Start selling',
    svcK: 'Bespoke service', svcH: 'Automate your strategy with our team',
    payH: 'Pay and get paid by card or USDT', payS: 'Accept clients worldwide: card, transfer or crypto. Creators cash out in USDT or to their bank.',
    finalH: 'Ready to put your trading on autopilot?',
    finalS: 'Build for free, buy a ready robot, or let us do it for you.',
  };

  const tiers = [
    { lvl: es ? 'Nivel 1' : 'Tier 1', name: es ? 'Constructor DIY' : 'DIY Builder', price: es ? 'Gratis' : 'Free', unit: '', desc: es ? 'Arma tus robots con el constructor visual.' : 'Build your robots with the visual builder.', href: '/bot-builder', cta: es ? 'Empezar gratis' : 'Start free', hot: false },
    { lvl: es ? 'Nivel 2' : 'Tier 2', name: es ? 'Robots listos' : 'Ready robots', price: '$19', unit: es ? '/mes' : '/mo', desc: es ? 'Robots económicos ya construidos. Un clic.' : 'Affordable prebuilt robots. One click.', href: '#market', cta: es ? 'Ver catálogo' : 'Browse', hot: false },
    { lvl: es ? 'Nivel 3' : 'Tier 3', name: es ? 'Instalación asistida' : 'Assisted install', price: '$' + s.service_install_price, unit: es ? '/sesión' : '/session', desc: es ? 'Un experto instala y configura contigo.' : 'An expert sets it up with you live.', href: '#servicio', cta: es ? 'Agendar' : 'Book', hot: false },
    { lvl: es ? 'Nivel 4' : 'Tier 4', name: es ? 'Automatiza tu estrategia' : 'Automate your strategy', price: '$' + s.service_automate_from.toLocaleString('en-US'), unit: '+', desc: es ? 'Convertimos tu estrategia en un robot a medida.' : 'We turn your strategy into a bespoke robot.', href: '#servicio', cta: es ? 'Solicitar' : 'Request', hot: true },
    { lvl: es ? 'Nivel 5' : 'Tier 5', name: es ? 'Elite / privado' : 'Elite / private', price: '$' + s.service_elite_from.toLocaleString('en-US'), unit: '+', desc: es ? 'Desarrollo privado, VPS y monitoreo con retainer.' : 'Private dev, VPS and monitoring with retainer.', href: '#servicio', cta: es ? 'Hablar' : 'Talk', hot: false },
  ];

  const steps = es
    ? [['1', 'Llamada estratégica', 'Entendemos tus reglas, riesgo y objetivos.'], ['2', 'Desarrollo', 'Programamos tu robot a medida.'], ['3', 'Backtest + optimización', 'Validamos con años de datos.'], ['4', 'Cuenta demo', 'Lo probamos en vivo sin riesgo.'], ['5', 'Live + monitoreo', 'Instalación remota, VPS y soporte.']]
    : [['1', 'Strategy call', 'We learn your rules, risk and goals.'], ['2', 'Development', 'We code your bespoke robot.'], ['3', 'Backtest + tuning', 'We validate with years of data.'], ['4', 'Demo account', 'We test it live, risk-free.'], ['5', 'Live + monitoring', 'Remote install, VPS and support.']];

  const wrap: any = { maxWidth: 1120, margin: '0 auto', padding: '0 22px' };
  const kicker: any = { fontSize: 12.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand2, #a06bff)' };
  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 };
  const secHead: any = { maxWidth: 640, margin: '0 auto 30px', textAlign: 'center' };

  return (
    <main style={{ paddingBottom: 40 }}>
      {/* HERO */}
      <section style={{ ...wrap, paddingTop: 56, paddingBottom: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 36, alignItems: 'center' }} className="g2">
          <div>
            <span style={kicker}>◆ {L.kicker}</span>
            <h1 style={{ fontSize: 46, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-.02em', margin: '14px 0 0' }}>
              {L.h1a}<span style={{ background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{L.h1b}</span>{L.h1c}
            </h1>
            <p className="muted" style={{ fontSize: 17, marginTop: 16, maxWidth: 540 }}>{L.sub}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <a href="#servicio" style={{ padding: '13px 22px', borderRadius: 12, fontWeight: 800, fontSize: 15, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>◆ {L.ctaMain}</a>
              <Link href="/bot-builder" className="btn btn-ghost" style={{ padding: '13px 20px', borderRadius: 12, border: '1px solid var(--line)', fontWeight: 700 }}>{L.ctaBuild} →</Link>
            </div>
            <div style={{ display: 'flex', gap: 26, marginTop: 28, flexWrap: 'wrap' }}>
              <div><b style={{ fontSize: 24, fontWeight: 800, display: 'block' }}>1,240+</b><span className="muted" style={{ fontSize: 12.5 }}>{L.st1}</span></div>
              <div><b style={{ fontSize: 24, fontWeight: 800, display: 'block' }}>$0 → {es ? 'a medida' : 'bespoke'}</b><span className="muted" style={{ fontSize: 12.5 }}>{L.st2}</span></div>
              <div><b style={{ fontSize: 24, fontWeight: 800, display: 'block' }}>72h</b><span className="muted" style={{ fontSize: 12.5 }}>{L.st3}</span></div>
            </div>
          </div>
          <div style={{ ...card, borderRadius: 22, boxShadow: '0 30px 80px -34px rgba(124,140,255,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>▲</div>
                <div><div style={{ fontWeight: 800 }}>Trend Rider Pro</div><div className="muted" style={{ fontSize: 12 }}>@carlos_fx</div></div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)', border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)', background: 'color-mix(in srgb,var(--green) 10%,transparent)', padding: '3px 9px', borderRadius: 99 }}>✓ {es ? 'Verificado' : 'Verified'}</span>
            </div>
            <svg viewBox="0 0 320 64" preserveAspectRatio="none" style={{ width: '100%', height: 64, margin: '14px 0' }}>
              <path d="M0,52 L28,48 L56,50 L84,40 L112,42 L140,30 L168,33 L196,22 L224,26 L252,15 L280,18 L320,6" fill="none" stroke="var(--green)" strokeWidth="2.5" />
            </svg>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[[GOLD, '92', 'Onyx Score'], ['var(--green)', '+38%', '90 días'], ['var(--tx)', '3.1%', 'DD máx']].map(([c, v, l], i) => (
                <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 10 }}>
                  <b style={{ fontSize: 17, fontWeight: 800, color: c as string }}>{v}</b>
                  <div className="muted" style={{ fontSize: 11 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3 PATHS */}
      <section style={{ ...wrap, padding: '50px 22px' }} id="construye">
        <div style={secHead}><span style={kicker}>{L.pathsK}</span><h2 style={{ fontSize: 30, fontWeight: 800, margin: '8px 0' }}>{L.pathsH}</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="g3">
          {[[L.p1t, L.p1d, L.p1p, '🛠️', '/bot-builder'], [L.p2t, L.p2d, L.p2p, '🛒', '#market'], [L.p3t, L.p3d, L.p3p, '✨', '#servicio']].map(([t, d, p, ic, href], i) => (
            <a key={i} href={href as string} style={{ ...card }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'color-mix(in srgb,var(--brand) 14%,transparent)', border: '1px solid color-mix(in srgb,var(--brand) 30%,transparent)', marginBottom: 12 }}>{ic}</div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{t}</h3>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{d}</p>
              <div style={{ marginTop: 14, fontWeight: 800, color: i === 2 ? GOLD : 'var(--tx)' }}>{p}</div>
            </a>
          ))}
        </div>
      </section>

      {/* LADDER */}
      <section style={{ ...wrap, padding: '30px 22px' }} id="precios">
        <div style={secHead}><span style={kicker}>{L.ladderK}</span><h2 style={{ fontSize: 30, fontWeight: 800, margin: '8px 0' }}>{L.ladderH}</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }} className="g4">
          {tiers.map((t, i) => (
            <a key={i} href={t.href} style={{ display: 'flex', flexDirection: 'column', ...card, position: 'relative', ...(t.hot ? { border: `1.5px solid ${GOLD}`, boxShadow: `0 0 40px -8px color-mix(in srgb,${GOLD} 45%,transparent)` } : {}) }}>
              {t.hot && <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06', fontSize: 10.5, fontWeight: 800, padding: '4px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>★ {es ? 'Más solicitado' : 'Most requested'}</span>}
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{t.lvl}</div>
              <h3 style={{ margin: '6px 0 4px', fontSize: 16 }}>{t.name}</h3>
              <div style={{ fontSize: 23, fontWeight: 800, margin: '6px 0' }}>{t.price}<small className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{t.unit}</small></div>
              <p className="muted" style={{ fontSize: 12.5, flex: 1 }}>{t.desc}</p>
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, padding: 9, borderRadius: 10, border: '1px solid var(--line)', ...(t.hot ? { background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06', border: 'none' } : {}) }}>{t.cta}</div>
            </a>
          ))}
        </div>
      </section>

      {/* MARKETPLACE */}
      <section style={{ ...wrap, padding: '50px 22px' }} id="market">
        <div style={secHead}><span style={kicker}>{L.marketK}</span><h2 style={{ fontSize: 30, fontWeight: 800, margin: '8px 0' }}>{L.marketH}</h2><p className="muted" style={{ fontSize: 15 }}>{L.marketS}</p></div>
        {bots.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }} className="g4">
            {bots.slice(0, 8).map((p) => (
              <div key={p.id} style={{ ...card, padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(p.name || '?').slice(0, 1)}</div>
                  <div><div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1 }}>{p.name}</div><div className="muted" style={{ fontSize: 11 }}>{p.seller_name}</div></div>
                </div>
                {p.perf?.score != null && <span style={{ fontSize: 11, fontWeight: 800, color: GOLD, border: `1px solid color-mix(in srgb,${GOLD} 35%,transparent)`, background: `color-mix(in srgb,${GOLD} 8%,transparent)`, padding: '2px 7px', borderRadius: 7 }}>Score {p.perf.score}</span>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 10 }}><span className="muted">{es ? 'Precio' : 'Price'}</span><b>{money(p.price_cents)}{p.kind === 'subscription' ? (es ? '/mes' : '/mo') : ''}</b></div>
                <Link href="/dashboard/bot-lab" style={{ display: 'block', marginTop: 12, textAlign: 'center', fontSize: 12.5, fontWeight: 800, padding: '8px', borderRadius: 9, background: 'var(--brand)', color: '#0b1020' }}>{L.view}</Link>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...card, textAlign: 'center', color: 'var(--mut)' }}>{L.empty}</div>
        )}
      </section>

      {/* SELL / CREATOR */}
      <section style={{ ...wrap, padding: '40px 22px' }} id="vende">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34, alignItems: 'center' }} className="g2">
          <div>
            <span style={kicker}>{L.sellK}</span>
            <h2 style={{ fontSize: 30, fontWeight: 800, margin: '8px 0 10px' }}>{L.sellH}</h2>
            <p className="muted" style={{ fontSize: 15.5, maxWidth: 460 }}>{L.sellS}</p>
            <Link href="/dashboard/bot-lab?tab=vender" style={{ display: 'inline-block', marginTop: 18, padding: '13px 22px', borderRadius: 12, fontWeight: 800, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>{L.sellCta}</Link>
          </div>
          <div style={{ ...card }}>
            <span className="muted" style={{ fontSize: 13 }}>{es ? 'Ejemplo de ganancias' : 'Earnings example'}</span>
            <div style={{ fontSize: 38, fontWeight: 800, background: `linear-gradient(120deg,${GOLD},#ffb020)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>$2,436</div>
            <div style={{ height: 10, borderRadius: 99, background: 'var(--bg2)', overflow: 'hidden', margin: '12px 0 6px' }}><div style={{ height: '100%', width: '80%', background: `linear-gradient(120deg,${GOLD},#ffb020)` }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--mut)' }}><span>{es ? 'Tú te quedas 80%' : 'You keep 80%'}</span><span>{es ? 'Onyx 20%' : 'Onyx 20%'}</span></div>
          </div>
        </div>
      </section>

      {/* SERVICE + LEAD FORM */}
      <section style={{ ...wrap, padding: '50px 22px' }} id="servicio">
        <div style={secHead}><span style={{ ...kicker, color: GOLD }}>{L.svcK}</span><h2 style={{ fontSize: 30, fontWeight: 800, margin: '8px 0' }}>{L.svcH}</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }} className="g2">
          <div style={{ display: 'grid', gap: 12 }}>
            {steps.map(([n, t, d], i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, background: 'color-mix(in srgb,var(--brand) 16%,transparent)', border: '1px solid color-mix(in srgb,var(--brand) 35%,transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--brand)' }}>{n}</div>
                <div><b style={{ fontSize: 15 }}>{t}</b><p className="muted" style={{ fontSize: 13 }}>{d}</p></div>
              </div>
            ))}
          </div>
          <BotLabLead defaultService="automate" />
        </div>
      </section>

      {/* PAYMENTS */}
      <section style={{ ...wrap, padding: '20px 22px' }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', border: '1px solid color-mix(in srgb,var(--green) 25%,transparent)' }}>
          <div style={{ maxWidth: 520 }}>
            <span style={{ ...kicker, color: 'var(--green)' }}>{es ? 'Pagos flexibles' : 'Flexible payments'}</span>
            <h3 style={{ margin: '8px 0 6px', fontSize: 21 }}>{L.payH}</h3>
            <p className="muted" style={{ fontSize: 14 }}>{L.payS}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px', fontWeight: 800, fontSize: 14 }}>💳 {es ? 'Tarjeta' : 'Card'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)', background: 'color-mix(in srgb,var(--green) 8%,transparent)', borderRadius: 12, padding: '12px 16px', fontWeight: 800, fontSize: 14, color: 'var(--green)' }}>₮ USDT</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px', fontWeight: 800, fontSize: 14 }}>🏦 {es ? 'Transferencia' : 'Transfer'}</div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ ...wrap, padding: '40px 22px' }}>
        <div style={{ background: 'linear-gradient(120deg,color-mix(in srgb,var(--brand) 16%,transparent),color-mix(in srgb,var(--brand2,#a06bff) 12%,transparent))', border: '1px solid var(--line)', borderRadius: 24, padding: 46, textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>{L.finalH}</h2>
          <p className="muted" style={{ maxWidth: 540, margin: '0 auto 22px', fontSize: 15.5 }}>{L.finalS}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/bot-builder" style={{ padding: '13px 22px', borderRadius: 12, fontWeight: 800, background: 'var(--brand)', color: '#0b1020' }}>{L.ctaBuild}</Link>
            <a href="#servicio" style={{ padding: '13px 22px', borderRadius: 12, fontWeight: 800, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>{L.ctaMain}</a>
          </div>
        </div>
      </section>
    </main>
  );
}
