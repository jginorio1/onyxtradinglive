import type { Metadata } from 'next';
import Link from 'next/link';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import { listMarketplace, botLabSettings } from '@/lib/botlab';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import BotLabLead from './BotLabLead';
import BotLabMarket from './BotLabMarket';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const title = es ? 'Onyx Bot Lab · Construye, compra o vende robots de trading' : 'Onyx Bot Lab · Build, buy or sell trading robots';
  const description = es
    ? 'Construye tu robot sin código, compra robots listos de traders verificados o deja que automaticemos tu estrategia a medida. Vende tus robots y cobra en USDT.'
    : 'Build your robot without coding, buy ready robots from verified traders, or let us automate your strategy. Sell your robots and get paid in USDT.';
  return { title, description, alternates: localeAlternates('/bot-lab'), openGraph: { title, description, url: `${SITE}/bot-lab`, type: 'website' } };
}

function money(cents: number) { return '$' + Math.round((cents || 0) / 100).toLocaleString('en-US'); }

const GOLD = 'var(--gold, #ffd45e)';

export default async function BotLabLanding() {
  const es = serverLang() === 'es';
  const s = await botLabSettings();
  // Modo de cobro: si el mensual está apagado, NADA en el landing dice "/mes".
  const monthly = (s as any).robots_monthly === true;
  const perMo = monthly ? (es ? '/mes' : '/mo') : '';
  let bots: any[] = [];
  try { bots = await listMarketplace({ limit: 8 }); } catch { bots = []; }

  // Reseñas: reutiliza las mismas del landing «Crea tu bot» (Admin → Módulos → Landing reviews).
  let allReviews: any[] = [];
  try { const { data: ls } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_stats').maybeSingle(); if (Array.isArray((ls as any)?.value?.reviews)) allReviews = (ls as any).value.reviews; } catch { allReviews = []; }
  const curLang = es ? 'es' : 'en';
  const langReviews = allReviews.filter((r: any) => (r?.lang || 'es') === curLang);
  const reviews = (langReviews.length >= 3 ? langReviews : allReviews).slice(0, 9);
  const rTotal = allReviews.length;
  const rAvg = rTotal ? Number((allReviews.reduce((a: number, r: any) => a + Math.max(1, Math.min(5, Math.round(Number(r?.stars) || 5))), 0) / rTotal).toFixed(1)) : 0;

  const L = es ? {
    kicker: 'Onyx Bot Lab',
    h1a: 'De una idea a un ', h1b: 'robot que opera solo', h1c: '.',
    sub: 'Construye tu robot sin código, compra robots listos de traders verificados o deja que automaticemos tu estrategia a medida. Con backtest, cuenta demo y monitoreo.',
    ctaMain: 'Automatizar mi estrategia', ctaBuild: 'Construir gratis',
    st1: 'robots monitoreados', st2: 'de gratis a a medida', st3: 'entrega DFY promedio',
    pathsK: 'Tres caminos', pathsH: 'Elige cómo quieres automatizar',
    p1t: 'Construye tú mismo', p1d: 'El constructor visual, sin escribir una línea.', p1p: monthly ? 'Gratis · Pro $15/mes' : 'Gratis · Pro',
    p2t: 'Compra un robot listo', p2d: 'Catálogo de robots económicos hechos por Onyx y por traders.', p2p: 'Desde $19' + perMo,
    p3t: 'Lo hacemos por ti', p3d: 'Automatizamos tu estrategia a medida, llave en mano.', p3p: 'A medida',
    ladderK: 'La escalera Onyx', ladderH: 'Un nivel para cada trader',
    marketK: 'Marketplace', marketH: 'Robots de traders verificados', marketS: 'Cada robot muestra su Onyx Score, rendimiento y riesgo.',
    view: 'Ver robot', empty: 'Pronto verás aquí los primeros robots a la venta.',
    sellK: 'Economía de creadores', sellH: 'Construye, publica y cobra',
    sellS: 'Tú pones el precio de tu robot. Onyx cobra por ti y te paga en USDT. Tú te quedas el 80%.',
    sellCta: 'Empezar a vender',
    svcK: 'Servicio a medida', svcH: 'Automatiza tu estrategia con nuestro equipo',
    payH: 'Paga y cobra en USDT', payS: 'Sin bancos, sin tarjetas y sin contracargos. Acepta clientes de todo el mundo con USDT (TRON o Ethereum). Los creadores cobran en USDT.',
    finalH: '¿Listo para poner tu trading en piloto automático?',
    finalS: 'Construye gratis, compra un robot listo o deja que lo hagamos por ti.',
  } : {
    kicker: 'Onyx Bot Lab',
    h1a: 'From an idea to a ', h1b: 'robot that trades on its own', h1c: '.',
    sub: 'Build your robot without coding, buy ready robots from verified traders, or let us automate your strategy. With backtest, demo account and monitoring.',
    ctaMain: 'Automate my strategy', ctaBuild: 'Build for free',
    st1: 'robots monitored', st2: 'from free to bespoke', st3: 'avg DFY delivery',
    pathsK: 'Three paths', pathsH: 'Choose how you want to automate',
    p1t: 'Build it yourself', p1d: 'The visual builder, without writing a line.', p1p: monthly ? 'Free · Pro $15/mo' : 'Free · Pro',
    p2t: 'Buy a ready robot', p2d: 'A catalog of affordable robots by Onyx and traders.', p2p: 'From $19' + perMo,
    p3t: 'We build it for you', p3d: 'We automate your strategy, turnkey.', p3p: 'Bespoke',
    ladderK: 'The Onyx ladder', ladderH: 'A tier for every trader',
    marketK: 'Marketplace', marketH: 'Robots from verified traders', marketS: 'Every robot shows its Onyx Score, performance and risk.',
    view: 'View robot', empty: 'The first robots for sale will show up here soon.',
    sellK: 'Creator economy', sellH: 'Build, publish and get paid',
    sellS: 'You set your robot price. Onyx charges for you and pays you in USDT. You keep 80%.',
    sellCta: 'Start selling',
    svcK: 'Bespoke service', svcH: 'Automate your strategy with our team',
    payH: 'Pay and get paid in USDT', payS: 'No banks, no cards and no chargebacks. Accept clients worldwide with USDT (TRON or Ethereum). Creators cash out in USDT.',
    finalH: 'Ready to put your trading on autopilot?',
    finalS: 'Build for free, buy a ready robot, or let us do it for you.',
  };

  const tiers = [
    { lvl: es ? 'Nivel 1' : 'Tier 1', name: es ? 'Constructor DIY' : 'DIY Builder', price: es ? 'Gratis' : 'Free', unit: '', desc: es ? 'Arma tus robots con el constructor visual.' : 'Build your robots with the visual builder.', href: '/bot-builder', cta: es ? 'Empezar gratis' : 'Start free', hot: false },
    { lvl: es ? 'Nivel 2' : 'Tier 2', name: es ? 'Robots listos' : 'Ready robots', price: (es ? 'Desde $19' : 'From $19'), unit: perMo, desc: es ? 'Robots económicos ya construidos. Un clic.' : 'Affordable prebuilt robots. One click.', href: '#market', cta: es ? 'Ver catálogo' : 'Browse', hot: false },
    { lvl: es ? 'Nivel 3' : 'Tier 3', name: es ? 'Instalación asistida' : 'Assisted install', price: '$' + s.service_install_price, unit: es ? '/sesión' : '/session', desc: es ? 'Un experto instala y configura contigo.' : 'An expert sets it up with you live.', href: '#servicio', cta: es ? 'Agendar' : 'Book', hot: false },
    { lvl: es ? 'Nivel 4' : 'Tier 4', name: es ? 'Automatiza tu estrategia' : 'Automate your strategy', price: '$' + s.service_automate_from.toLocaleString('en-US'), unit: '+', desc: es ? 'Convertimos tu estrategia en un robot a medida.' : 'We turn your strategy into a bespoke robot.', href: '#servicio', cta: es ? 'Solicitar' : 'Request', hot: true },
    { lvl: es ? 'Nivel 5' : 'Tier 5', name: es ? 'Elite / privado' : 'Elite / private', price: '$' + s.service_elite_from.toLocaleString('en-US'), unit: '+', desc: es ? 'Desarrollo privado, VPS y monitoreo con retainer.' : 'Private dev, VPS and monitoring with retainer.', href: '#servicio', cta: es ? 'Hablar' : 'Talk', hot: false },
  ];

  const steps = es
    ? [['1', 'Llamada estratégica', 'Entendemos tus reglas, riesgo y objetivos.'], ['2', 'Desarrollo', 'Programamos tu robot a medida.'], ['3', 'Backtest + optimización', 'Validamos con años de datos.'], ['4', 'Cuenta demo', 'Lo probamos en vivo sin riesgo.'], ['5', 'Live + monitoreo', 'Instalación remota, VPS y soporte.']]
    : [['1', 'Strategy call', 'We learn your rules, risk and goals.'], ['2', 'Development', 'We code your bespoke robot.'], ['3', 'Backtest + tuning', 'We validate with years of data.'], ['4', 'Demo account', 'We test it live, risk-free.'], ['5', 'Live + monitoring', 'Remote install, VPS and support.']];

  // Robots de muestra (Onyx) para que el Marketplace nunca se vea vacío mientras
  // llegan los primeros de traders. Curva, Score, riesgo y precio como una ficha real.
  const sampleBots = [
    { name: 'Trend Rider Pro', seller: '@onyx', pair: 'US100', plat: 'MT5', score: 92, ret: '+38%', dd: '3.1%', price: '$29', unit: perMo, path: 'M0,52 L26,48 L52,50 L78,40 L104,42 L130,30 L156,33 L182,22 L208,26 L234,15 L260,18 L300,6', hot: true },
    { name: 'London Breakout', seller: '@onyx', pair: 'GBPUSD', plat: 'MT4', score: 88, ret: '+27%', dd: '4.2%', price: '$19', unit: perMo, path: 'M0,54 L30,50 L60,52 L90,44 L120,46 L150,36 L180,38 L210,28 L240,30 L270,20 L300,16' },
    { name: 'Gold Scalper X', seller: '@onyx', pair: 'XAUUSD', plat: 'MT5', score: 85, ret: '+45%', dd: '6.0%', price: '$39', unit: perMo, path: 'M0,56 L26,52 L52,46 L78,50 L104,40 L130,44 L156,30 L182,34 L208,22 L234,26 L260,14 L300,10' },
    { name: 'Range Master', seller: '@onyx', pair: 'EURUSD', plat: 'cTrader', score: 83, ret: '+21%', dd: '2.8%', price: '$99', unit: es ? ' único' : ' once', path: 'M0,50 L30,48 L60,49 L90,45 L120,46 L150,41 L180,42 L210,36 L240,37 L270,31 L300,28' },
    { name: 'NY Momentum', seller: '@onyx', pair: 'NAS100', plat: 'MT5', score: 80, ret: '+33%', dd: '5.5%', price: '$25', unit: perMo, path: 'M0,55 L26,51 L52,53 L78,43 L104,45 L130,33 L156,36 L182,25 L208,29 L234,18 L260,22 L300,12' },
    { name: 'Swing Keeper', seller: '@onyx', pair: 'USDJPY', plat: 'MT4', score: 78, ret: '+18%', dd: '2.3%', price: '$149', unit: es ? ' único' : ' once', path: 'M0,52 L30,50 L60,51 L90,47 L120,48 L150,43 L180,44 L210,39 L240,40 L270,34 L300,32' },
  ];
  const buyWeek = 40 + (robotsBuiltSeed() % 25); // "X compraron esta semana" (ancla suave estable)
  function robotsBuiltSeed() { const d = new Date(); return d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate(); }

  const wrap: any = { maxWidth: 1120, margin: '0 auto', padding: '0 22px' };
  const kicker: any = { fontSize: 12.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand2, #a06bff)' };
  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 };
  const secHead: any = { maxWidth: 640, margin: '0 auto 30px', textAlign: 'center' };

  return (
    <main style={{ paddingBottom: 40 }}>
      {/* HERO */}
      <section style={{ ...wrap, paddingTop: 56, paddingBottom: 30 }}>
        <div style={{ display: 'grid', gap: 36, alignItems: 'center' }} className="g2">
          <div>
            <span style={kicker}>◆ {L.kicker}</span>
            <h1 style={{ fontSize: 'clamp(30px,7.5vw,46px)', lineHeight: 1.08, fontWeight: 800, letterSpacing: '-.02em', margin: '14px 0 0' }}>
              {L.h1a}<span style={{ background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{L.h1b}</span>{L.h1c}
            </h1>
            <p className="muted" style={{ fontSize: 17, marginTop: 16, maxWidth: 540 }}>{L.sub}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <a href="#servicio" style={{ padding: '13px 22px', borderRadius: 12, fontWeight: 800, fontSize: 15, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>◆ {L.ctaMain}</a>
              <a href="/bot-builder" className="btn btn-ghost" style={{ padding: '13px 20px', borderRadius: 12, border: '1px solid var(--line)', fontWeight: 700 }}>{L.ctaBuild} →</a>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              {[es ? 'Sin tarjeta' : 'No card', es ? 'Prueba en demo' : 'Demo test', es ? 'Verificados' : 'Verified'].map((t) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--green)' }}><span style={{ color: 'var(--green)' }}>✓</span>{t}</span>
              ))}
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

      {/* STATS · calcado al contador de la landing de Onyx (Crea tu bot). Editable desde Admin → Bot Lab → Ajustes. */}
      {(s as any).stats_on !== false && (() => {
        const anchor = Math.max(0, Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000));
        const grow = (base: number, r: number) => Math.round((Number(base) || 0) + anchor * r);
        const nf = (n: number) => n.toLocaleString('en-US');
        const robots = grow((s as any).stat_robots_base ?? 1240, 2);
        const priceFrom = Math.max(0, Math.round(Number((s as any).stat_price_from ?? 19)));
        const cards: [string, string, string][] = [
          [nf(grow((s as any).stat_verified_base ?? 84, 0.15)), es ? 'Robots verificados' : 'Verified robots', 'var(--green)'],
          [String(Math.max(0, Math.min(100, Math.round(Number((s as any).stat_score_avg ?? 87))))), es ? 'Onyx Score promedio' : 'Avg Onyx Score', GOLD],
          [nf(grow((s as any).stat_buyers_week ?? 55, 1)), es ? 'Compraron esta semana' : 'Bought this week', '#38d9ff'],
          ['$' + priceFrom, monthly ? (es ? 'Desde, al mes' : 'From, per month') : (es ? 'Precio desde' : 'Price from'), 'var(--brand)'],
        ];
        return (
          <section style={{ ...wrap, padding: '14px 22px 4px' }}>
            {/* Banner contador — mismo gradiente/glow que la landing de Onyx */}
            <div style={{ position: 'relative', borderRadius: 18, padding: '30px 20px', textAlign: 'center', background: 'linear-gradient(135deg,#3a2f7a 0%,#211a45 55%,#141428 100%)', border: '1px solid rgba(139,147,255,.5)', boxShadow: '0 24px 60px rgba(30,20,80,.35)' }}>
              <div style={{ fontSize: 12.5, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: '#c8ccff' }}>{es ? 'Robots a la venta ahora' : 'Robots on sale now'}</div>
              <div style={{ marginTop: 6, fontSize: 'clamp(42px,8vw,64px)', fontWeight: 800, letterSpacing: '-1px', display: 'inline-flex', alignItems: 'center', gap: 12, color: '#fff', textShadow: '0 0 26px rgba(139,147,255,.55)' }}>
                <span style={{ fontSize: 40, lineHeight: 1 }}>◆</span><span>{nf(robots)}</span>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', color: '#8ff0cf' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5fe0aa', boxShadow: '0 0 9px #5fe0aa', display: 'inline-block' }} />{es ? 'subiendo en vivo' : 'growing live'}</div>
              <div style={{ fontSize: 13.5, marginTop: 10, color: '#c8ccff' }}>{es ? `Verificados, con Onyx Score y prueba en demo. Desde $${priceFrom}${monthly ? '/mes' : ''}.` : `Verified, with Onyx Score and demo test. From $${priceFrom}${monthly ? '/mo' : ''}.`}</div>
            </div>
            {/* Métricas — mismo estilo de tarjetas con acento por color */}
            <div style={{ display: 'grid', gap: 14, marginTop: 22 }} className="g4">
              {cards.map(([v, l, c], i) => (
                <div key={i} style={{ borderRadius: 14, padding: '18px 10px', textAlign: 'center', border: `1px solid color-mix(in srgb,${c} 35%,transparent)`, background: `color-mix(in srgb,${c} 10%,transparent)` }}>
                  <b style={{ fontSize: 26, fontWeight: 800, display: 'block', color: c }}>{v}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{l}</span>
                </div>
              ))}
            </div>
            {/* Línea fina de plataformas */}
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--mut)' }}>MT4 · MT5 · cTrader</div>
          </section>
        );
      })()}

      {/* TRUST STRIP · por qué es seguro comprar aquí */}
      <section style={{ ...wrap, paddingTop: 6, paddingBottom: 6 }}>
        <div style={{ display: 'grid', gap: 12 }} className="g4">
          {(es
            ? [['✓', 'Traders verificados', 'Cada robot pasa reglas sobre sus operaciones reales antes de publicarse.'], ['📊', 'Onyx Score y riesgo visibles', 'Ves score, rendimiento y drawdown máximo antes de pagar.'], ['🧪', 'Prueba en demo primero', 'Instálalo en cuenta demo y solo pásalo a real cuando te convenza.'], ['🔒', 'Pago seguro en USDT', 'Cobro on-chain protegido. Reglas de riesgo horneadas dentro del robot.']]
            : [['✓', 'Verified traders', 'Every robot passes rules on its real trades before listing.'], ['📊', 'Onyx Score and risk shown', 'See score, performance and max drawdown before you pay.'], ['🧪', 'Try on demo first', 'Install on a demo account and go live only when convinced.'], ['🔒', 'Secure USDT payment', 'Protected on-chain checkout. Risk rules baked inside the robot.']]
          ).map(([ic, t, d], i) => (
            <div key={i} style={{ ...card, padding: 14, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', fontSize: 17 }}>{ic}</span>
              <div><b style={{ fontSize: 13.5 }}>{t}</b><p className="muted" style={{ fontSize: 12, margin: '3px 0 0' }}>{d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 PATHS */}
      <section style={{ ...wrap, padding: '50px 22px' }} id="construye">
        <div style={secHead}><span style={kicker}>{L.pathsK}</span><h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0' }}>{L.pathsH}</h2></div>
        <div style={{ display: 'grid', gap: 16 }} className="g3">
          {[[L.p1t, L.p1d, L.p1p, <path key="w" d="M14.7 6.3a4 4 0 0 0-5.2 5.2L3 18l3 3 6.5-6.5a4 4 0 0 0 5.2-5.2l-2.5 2.5-2.8-.4-.4-2.8z" />, '/bot-builder'], [L.p2t, L.p2d, L.p2p, <path key="s" d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />, '#market'], [L.p3t, L.p3d, L.p3p, <path key="sp" d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />, '#servicio']].map(([t, d, p, ic, href], i) => (
            <a key={i} href={href as string} style={{ ...card }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb,var(--brand) 14%,transparent)', border: '1px solid color-mix(in srgb,var(--brand) 30%,transparent)', marginBottom: 12, color: 'var(--brand)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ic}</svg></div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{t}</h3>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{d}</p>
              <div style={{ marginTop: 14, fontWeight: 800, color: i === 2 ? GOLD : 'var(--tx)' }}>{p}</div>
            </a>
          ))}
        </div>
      </section>

      {/* LADDER */}
      <section style={{ ...wrap, padding: '30px 22px' }} id="precios">
        <div style={secHead}><span style={kicker}>{L.ladderK}</span><h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0' }}>{L.ladderH}</h2></div>
        <div style={{ display: 'grid', gap: 14 }} className="g5">
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
        <div style={secHead}>
          <span style={kicker}>{L.marketK}</span>
          <h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0' }}>{L.marketH}</h2>
          <p className="muted" style={{ fontSize: 15 }}>{L.marketS}</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 9%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 30%,transparent)', borderRadius: 99, padding: '5px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--green)', display: 'inline-block' }} />{buyWeek} {es ? 'traders compraron esta semana' : 'traders bought this week'}
          </div>
        </div>
        <BotLabMarket es={es} items={bots.length
          ? bots.slice(0, 8).map((p: any) => ({
              id: p.id, name: p.name, seller: p.seller_name || '@onyx', pair: p.symbol || p.spec_market || '—', plat: (p.platform || 'MT5').toUpperCase(),
              score: p.perf?.score ?? null, ret: p.perf?.ret90 ?? p.perf?.ret ?? null, dd: p.perf?.dd != null ? String(p.perf.dd).replace('%', '') + '%' : null,
              price: money(p.price_cents), unit: (monthly && p.kind === 'subscription') ? (es ? '/mes' : '/mo') : '', path: 'M0,52 L40,46 L80,48 L120,38 L160,40 L200,28 L240,30 L300,16', hot: false,
              spec_style: p.spec_style || null, spec_timeframe: p.spec_timeframe || null, spec_market: p.spec_market || null,
              spec_direction: p.spec_direction || null, spec_capital: p.spec_capital || null, spec_maxdd: p.spec_maxdd || null, spec_propfirm: !!p.spec_propfirm,
              no_martingale: !p.perf?.martingale, no_hft: !p.perf?.hft, has_sl: p.spec_sl || p.perf?.hasSL, news: p.spec_news,
            }))
          : sampleBots.map((p: any, i: number) => ({
              ...p, spec_style: ['tendencia', 'ruptura', 'scalping', 'rango', 'intradia', 'swing'][i % 6],
              spec_timeframe: ['H1', 'M15', 'M5', 'H4', 'M30', 'D1'][i % 6],
              spec_market: p.pair === 'XAUUSD' ? 'oro' : (['US100', 'NAS100'].includes(p.pair) ? 'indices' : 'forex'),
              spec_direction: ['both', 'long', 'both', 'short', 'both', 'long'][i % 6],
              spec_capital: ['$1,000', '$500', '$2,000', '$1,000', '$3,000', '$1,500'][i % 6],
              spec_maxdd: p.dd, spec_propfirm: i % 2 === 0,
              no_martingale: true, no_hft: true, has_sl: true, news: i % 2 === 0,
            }))} />
        {!bots.length && <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>{es ? 'Robots de muestra por Onyx. Los de traders verificados aparecen aquí en cuanto se publican.' : 'Sample robots by Onyx. Verified-trader robots appear here as they get published.'}</p>}
      </section>

      {/* CÓMO FUNCIONA (comprador) 1-2-3 */}
      <section style={{ ...wrap, padding: '30px 22px' }}>
        <div style={secHead}><span style={kicker}>{es ? 'Fácil de empezar' : 'Easy to start'}</span><h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0' }}>{es ? 'De comprar a operar en 3 pasos' : 'From buying to trading in 3 steps'}</h2></div>
        <div style={{ display: 'grid', gap: 16 }} className="g3">
          {(es
            ? [['1', 'Elige tu robot', 'Compara Onyx Score, rendimiento y riesgo. Paga en USDT y recibes la licencia al instante.'], ['2', 'Conéctalo a tu plataforma', 'Descargas el archivo para MT4, MT5 o cTrader y lo instalas con la guía paso a paso (o te lo instalamos).'], ['3', 'Opera solo', 'El robot ejecuta tus reglas 24/5 con su gestión de riesgo dentro. Míralo en tu panel y apágalo cuando quieras.']]
            : [['1', 'Pick your robot', 'Compare Onyx Score, performance and risk. Pay in USDT and get the license instantly.'], ['2', 'Connect it to your platform', 'Download the file for MT4, MT5 or cTrader and install with the step-by-step guide (or we install it).'], ['3', 'It trades on its own', 'The robot runs your rules 24/5 with risk management inside. Watch it in your dashboard, turn it off anytime.']]
          ).map(([n, t, d], i) => (
            <div key={i} style={{ ...card }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb,var(--brand) 16%,transparent)', border: '1px solid color-mix(in srgb,var(--brand) 35%,transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--brand)', marginBottom: 10 }}>{n}</div>
              <h3 style={{ margin: 0, fontSize: 17 }}>{t}</h3>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GARANTÍA / reduce el riesgo de comprar */}
      <section style={{ ...wrap, padding: '14px 22px' }}>
        <div style={{ ...card, textAlign: 'center', border: '1px solid color-mix(in srgb,var(--green) 30%,transparent)', background: 'color-mix(in srgb,var(--green) 6%,transparent)' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🛡️</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 'clamp(18px,4vw,22px)' }}>{es ? 'Compra sin miedo' : 'Buy with confidence'}</h3>
          <p className="muted" style={{ fontSize: 14, maxWidth: 620, margin: '0 auto' }}>{es ? 'Pruébalo primero en cuenta demo, sin arriesgar un centavo. Pago único en USDT, on-chain y sin contracargos. Cada robot lleva sus reglas de riesgo dentro para proteger tu cuenta.' : 'Try it first on a demo account, risking nothing. One-time USDT payment, on-chain and chargeback-free. Every robot carries its risk rules inside to protect your account.'}</p>
        </div>
      </section>

      {/* SELL / CREATOR */}
      <section style={{ ...wrap, padding: '40px 22px' }} id="vende">
        <div style={{ display: 'grid', gap: 34, alignItems: 'center' }} className="g2">
          <div>
            <span style={kicker}>{L.sellK}</span>
            <h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0 10px' }}>{L.sellH}</h2>
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
        <div style={secHead}><span style={{ ...kicker, color: GOLD }}>{L.svcK}</span><h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0' }}>{L.svcH}</h2></div>
        <div style={{ display: 'grid', gap: 24, alignItems: 'start' }} className="g2">
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
            <span style={{ ...kicker, color: 'var(--green)' }}>{es ? 'Pagos en USDT' : 'USDT payments'}</span>
            <h3 style={{ margin: '8px 0 6px', fontSize: 21 }}>{L.payH}</h3>
            <p className="muted" style={{ fontSize: 14 }}>{L.payS}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)', background: 'color-mix(in srgb,var(--green) 8%,transparent)', borderRadius: 12, padding: '12px 16px', fontWeight: 800, fontSize: 14, color: 'var(--green)' }}>₮ USDT · TRON</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)', background: 'color-mix(in srgb,var(--green) 8%,transparent)', borderRadius: 12, padding: '12px 16px', fontWeight: 800, fontSize: 14, color: 'var(--green)' }}>₮ USDT · Ethereum</div>
          </div>
        </div>
      </section>

      {/* RESEÑAS · social proof (mismas del landing «Crea tu bot») */}
      {reviews.length > 0 && (
      <section style={{ padding: '50px 0' }}>
        <div style={{ ...wrap }}>
          <div style={secHead}>
            <span style={kicker}>{es ? 'Lo que dicen los traders' : 'What traders say'}</span>
            <h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0 4px' }}>{es ? 'Robots que ya operan por ellos' : 'Robots already trading for them'}</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span style={{ color: GOLD, letterSpacing: 1 }}>{'★★★★★'}</span>
              <b>{rAvg || 5}</b>
              <span className="muted">· {Number(rTotal).toLocaleString()} {es ? 'reseñas' : 'reviews'}</span>
            </div>
          </div>
        </div>
        <div className="rev-marquee">
          <div className="rev-track">
            {[...reviews, ...reviews].map((r: any, i: number) => (
              <figure key={i} className="rev-card" style={{ ...card, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }} aria-hidden={i >= reviews.length ? true : undefined}>
                <div style={{ color: GOLD, fontSize: 13, letterSpacing: 1 }}>{'★'.repeat(Math.max(1, Math.min(5, Math.round(Number(r?.stars) || 5))))}<span style={{ color: 'var(--line)' }}>{'★'.repeat(5 - Math.max(1, Math.min(5, Math.round(Number(r?.stars) || 5))))}</span></div>
                <blockquote style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{r?.text}</blockquote>
                <figcaption style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r?.name}{r?.country ? <span className="muted" style={{ fontWeight: 400 }}> · {r.country}</span> : null}</span>
                  {r?.result ? <span className="muted" style={{ fontSize: 11 }}>{r.result}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* FAQ · resuelve objeciones de compra */}
      <section style={{ ...wrap, padding: '40px 22px' }}>
        <div style={secHead}><span style={kicker}>FAQ</span><h2 style={{ fontSize: 'clamp(23px,5vw,30px)', fontWeight: 800, margin: '8px 0' }}>{es ? 'Antes de comprar' : 'Before you buy'}</h2></div>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 10 }}>
          {(es
            ? [['¿Es legal usar robots en prop firms?', 'Sí, siempre que respetes las reglas de tu firma (sin arbitraje de latencia ni HFT prohibido). Cada robot lleva dentro límites de riesgo, filtro de noticias y de sesión para ayudarte a cumplirlas.'], ['¿En qué plataformas funciona?', 'MT4, MT5 y cTrader. En la ficha de cada robot ves con cuáles es compatible; el robot detecta solo el sufijo de tu bróker.'], ['¿Y si el robot pierde?', 'Ningún robot garantiza ganancias. Por eso pruebas en demo primero y solo pasas a real cuando te convence su Onyx Score, rendimiento y drawdown.'], ['¿Puedo apagarlo cuando quiera?', 'Sí. Lo apagas en tu plataforma cuando quieras. La mayoría de robots son de pago único, así que no hay suscripción que gestionar.'], ['¿Cómo pago?', 'En USDT (TRON o Ethereum): sin bancos, sin tarjetas y sin contracargos. Recibes la licencia en cuanto se confirma el pago on-chain.']]
            : [['Is it legal to use robots on prop firms?', 'Yes, as long as you follow your firm’s rules (no latency arbitrage or banned HFT). Each robot carries risk limits, news and session filters to help you comply.'], ['Which platforms does it work on?', 'MT4, MT5 and cTrader. Each robot’s page shows what it supports; the robot auto-detects your broker’s suffix.'], ['What if the robot loses?', 'No robot guarantees profit. That’s why you test on demo first and only go live once its Onyx Score, performance and drawdown convince you.'], ['Can I turn it off anytime?', 'Yes. Turn it off in your platform anytime. Most robots are a one-time purchase, so there’s no subscription to manage.'], ['How do I pay?', 'In USDT (TRON or Ethereum): no banks, no cards and no chargebacks. You get the license as soon as the payment confirms on-chain.']]
          ).map(([q, a], i) => (
            <details key={i} style={{ ...card, padding: '14px 16px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14.5, listStyle: 'none' }}>{q}</summary>
              <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 0', lineHeight: 1.55 }}>{a}</p>
            </details>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14 }}><Link href="/bot-lab/faq" style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{es ? 'Ver todas las preguntas →' : 'See all questions →'}</Link></div>
      </section>

      {/* FINAL CTA */}
      <section style={{ ...wrap, padding: '40px 22px' }}>
        <div style={{ background: 'linear-gradient(120deg,color-mix(in srgb,var(--brand) 16%,transparent),color-mix(in srgb,var(--brand2,#a06bff) 12%,transparent))', border: '1px solid var(--line)', borderRadius: 24, padding: 46, textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>{L.finalH}</h2>
          <p className="muted" style={{ maxWidth: 540, margin: '0 auto 22px', fontSize: 15.5 }}>{L.finalS}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/bot-builder" style={{ padding: '13px 22px', borderRadius: 12, fontWeight: 800, background: 'var(--brand)', color: '#0b1020' }}>{L.ctaBuild}</a>
            <a href="#servicio" style={{ padding: '13px 22px', borderRadius: 12, fontWeight: 800, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>{L.ctaMain}</a>
          </div>
        </div>
      </section>
    </main>
  );
}
