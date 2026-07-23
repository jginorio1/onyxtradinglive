'use client';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import SectionNav from './SectionNav';

type Lang = 'es' | 'en';

/* ─────────────────────────────────────────────────────────────
   ⚠️  EDITA ESTOS NÚMEROS CON TUS DATOS REALES.
   No inventes cifras: si un usuario descubre que son falsas,
   pierdes su confianza (y legalmente no puedes afirmar datos falsos).
   Cuando aún no tengas usuarios, usa datos verdaderos del producto
   (los de abajo lo son) y ve subiendo los reales con el tiempo.
   ───────────────────────────────────────────────────────────── */
const STATS = [
  { to: 100, suffix: '%', es: 'Conexión solo lectura', en: 'Read-only connection' },
  { to: 15, prefix: '+', es: 'Métricas profesionales', en: 'Pro metrics' },
  { to: 2, suffix: '', es: 'Plataformas · MT4 y MT5', en: 'Platforms · MT4 & MT5' },
  { to: 4, prefix: '+', es: 'Prop firms compatibles', en: 'Compatible prop firms' },
];

/* Marcas para el carrusel (broker/prop firm + plataformas) */
const LOGOS = [
  { n: 'FTMO', c: '#2f6bff' }, { n: 'FundedNext', c: '#16c98d' },
  { n: 'FundingPips', c: '#8b5cff' }, { n: 'The5%ers', c: '#ffce00' },
  { n: 'MetaTrader 4', c: '#f0a020' }, { n: 'MetaTrader 5', c: '#2f6bff' },
  { n: 'Axi', c: '#ff4757' }, { n: 'IC Markets', c: '#e23b55' },
  { n: 'Pepperstone', c: '#e2531f' }, { n: 'Exness', c: '#ffcf5c' },
];

function Counter({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const run = () => {
      if (done.current) return; done.current = true;
      const dur = 1200, t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); setN(Math.round((1 - Math.pow(1 - p, 3)) * to)); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    };
    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((ents) => { if (ents[0].isIntersecting) run(); }, { threshold: 0.3 });
      io.observe(el);
    }
    const timer = setTimeout(run, 1500); // respaldo: anima aunque el observer no dispare
    return () => { if (io) io.disconnect(); clearTimeout(timer); };
  }, [to]);
  return <div ref={ref} style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1px', background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{prefix}{n.toLocaleString()}{suffix}</div>;
}

const dict = {
  es: {
    mgr: {
      badge: 'Módulo activo · Pro y Elite',
      title: 'Onyx Guardian — el gestor que te protege de ti mismo',
      sub: 'Nunca abre operaciones. Solo cuida las que abres tú y hace cumplir el plan de trading que escribiste cuando estabas tranquilo. Ya funcionando en MT4 y MT5.',
      cards: [
        { i: '🎯', t: 'Break even que sale a cero de verdad', d: 'Mueve el stop cuando la operación va a favor y suma la comisión y el swap que te cobró el bróker. Cero real, no cero de precio.' },
        { i: '📐', t: 'Trailing y cierres por partes', d: 'Persigue al precio y cierra en varios niveles. Tú eliges si mides en pips, en R o en dinero.' },
        { i: '⏰', t: 'Tu horario, respetado', d: 'Días y franjas en las que operas. Fuera de ahí, si abres una operación se cierra sola. Con la fricción que tú decidas.' },
        { i: '🛡️', t: 'Límites de pérdida y de fondeo', d: 'Pérdida diaria y total, con margen de seguridad. Te para antes de llegar al tope, no cuando ya lo rompiste.' },
        { i: '🔥', t: 'Freno de racha', d: 'Tras varias pérdidas seguidas, te para un rato. Es el antídoto contra la operación de venganza.' },
        { i: '📰', t: 'Bloqueo por noticias', d: 'Evita operar alrededor de datos de alto impacto, los minutos que tú marques. Disponible en Elite.' },
      ],
      honestT: 'Lo que no hace, dicho claro',
      honestD: 'MetaTrader no permite que un EA impida una orden antes de enviarse. Lo que Onyx hace es cerrarla en cuanto aparece, en uno o dos segundos, y eso te cuesta el spread de esa entrada. No es un fallo: es la fricción. Y sin MetaTrader abierto no protege nada — para uso serio, un VPS.',
    },
    nav: { features: 'Funciones', how: 'Cómo funciona', fondeo: 'Fondeo', gestor: 'Guardian', pricing: 'Precios', amb: 'Embajadores', faq: 'FAQ', login: 'Entrar', cta: 'Empieza gratis' },
    hero: {
      badge: '🔗 Conecta MT4 y MT5 · Sincronización automática',
      h1a: 'Opera con datos,', h1b: 'no con memoria',
      sub: 'Conecta tu cuenta de MetaTrader o de fondeo y deja que Onyx analice cada operación: sesiones y noticias en vivo, costes, calendario y reglas de fondeo. Todo en un panel.',
      cta1: 'Empieza gratis →', cta2: 'Ver precios', note: 'Sin tarjeta para empezar · Cancela cuando quieras',
    },
    trust: ['✅ Compatible con MT4 y MT5', '🔒 Conexión de solo lectura', '💳 Pagos seguros con Stripe'],
    logosT: 'Compatible con tu bróker y tu prop firm',
    videoBadge: '▶ En acción',
    videoT: 'Mira Onyx por dentro',
    videoS: 'Un recorrido por el dashboard: portafolio, calendario, curva de equity y estadísticas en tiempo real.',
    videoNote: 'Demo en video · sin audio',
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
    prop: {
      badge: '🏆 Hecho para cuentas de fondeo',
      t: 'Compatible con tu prop firm',
      s: 'Tu cuenta de fondeo es una cuenta de MetaTrader. Onyx se conecta igual que a cualquier broker: instalas el connector, pegas tu API key y listo. Elige tu firma para ver los detalles:',
      onyx: '✓ Compatible con Onyx',
      plats: 'Plataformas disponibles',
      sizes: 'Tamaños de cuenta',
      note: '¿Tu firma no está en la lista? Si te da una cuenta MT4 o MT5, Onyx funciona igual.',
      tTitle: '📊 Seguimiento de fondeo en vivo',
      tSub: 'Mueve el control y mira cómo Onyx vigila tus reglas en tiempo real. Ejemplo con cuenta de $50.000.',
      tPnl: 'Tu P&L actual',
      tTarget: 'Objetivo de profit  ·  +$5.000',
      tLoss: 'Pérdida máxima  ·  −$5.000',
      st: { ok: '✓ En regla — sigue así', near: '⚠ Cuidado: cerca del límite de pérdida', broke: '✗ Regla rota — cuenta perdida', passed: '🎉 ¡Objetivo logrado! Fase superada' },
    },
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
    amb: {
      t: '¿Tienes una comunidad de trading?',
      d: 'Recomienda Onyx a tus seguidores y cobra una comisión recurrente cada mes, mientras sigan suscritos. Ellos entran con descuento, tú cobras siempre.',
      k1: 'recurrente', k2: 'Sin límite', k2s: 'de ganancias', k3: 'para tu gente', k3s: 'con tu código',
      cta: 'Ver el programa →',
    },
    faqT: 'Preguntas frecuentes',
    faqs: [
      ['¿Con qué brokers y prop firms funciona?', 'Con cualquier cuenta MT4 o MT5: FTMO, FundedNext, The5ers, FundingPips y tu bróker de siempre. Tu cuenta de fondeo es una cuenta de MetaTrader, así que se conecta igual.'],
      ['¿Es seguro conectar mi cuenta?', 'Sí. La conexión es de solo lectura: Onyx lee tu historial pero nunca puede operar, retirar ni mover tus fondos.'],
      ['¿Necesito saber programar?', 'No. Instalas el connector, pegas tu API key y listo. Te guiamos paso a paso; no hay que tocar código.'],
      ['¿Cuántas cuentas puedo conectar?', 'Depende de tu plan: desde 1 cuenta en el plan gratis hasta cuentas ilimitadas. Ves todas juntas en tu portafolio.'],
      ['¿Tienen programa de afiliados o embajadores?', 'Sí. Si tienes comunidad, canal o seguidores, cobras una comisión recurrente por cada persona que se suscriba con tu enlace, mientras siga pagando. Además tu audiencia entra con descuento usando tu código. Míralo en la página de Embajadores.'],
      ['¿Funciona en el móvil?', 'Sí. El panel se adapta a móvil, tablet y monitores grandes, así que lo revisas desde cualquier dispositivo.'],
      ['¿En qué se diferencia de un Excel?', 'Onyx sincroniza solo, calcula 15+ métricas, tiene calendario, sesiones y noticias en vivo, costes, fondeo y gráficas modernas. Un Excel no hace nada de eso.'],
      ['¿Funciona con MT4 y MT5?', 'Sí, con las dos. Solo cambias el archivo del connector según tu plataforma; la misma API key sirve para ambas.'],
      ['¿Puedo cancelar cuando quiera?', 'Claro. Gestionas tu suscripción desde tu panel y cancelas o cambias de plan en cualquier momento.'],
      ['¿Qué formas de pago aceptan?', 'Pago seguro con tarjeta a través de Stripe. Tus datos de pago nunca pasan por nuestros servidores.'],
    ],
    finalT: 'Empieza a operar con datos, no con memoria', finalCta: 'Crear cuenta gratis',
    footer: { terms: 'Términos', privacy: 'Privacidad', amb: 'Embajadores', rights: '© 2026 Onyx Trading Live' },
  },
  en: {
    mgr: {
      badge: 'Live module · Pro and Elite',
      title: 'Onyx Guardian — the manager that protects you from yourself',
      sub: 'It never opens trades. It only looks after the ones you open and enforces the trading plan you wrote while you were calm. Already running on MT4 and MT5.',
      cards: [
        { i: '🎯', t: 'Break even that really means zero', d: 'Moves the stop once the trade goes your way and adds the commission and swap your broker charged. Real zero, not price zero.' },
        { i: '📐', t: 'Trailing and partial closes', d: 'Follows price and closes at several levels. You choose whether you measure in pips, R or money.' },
        { i: '⏰', t: 'Your hours, respected', d: 'The days and windows you trade. Outside them, a trade you open gets closed. With whatever friction you set.' },
        { i: '🛡️', t: 'Loss and funded-account limits', d: 'Daily and total loss, with a safety margin. It stops you before the cap, not after you broke it.' },
        { i: '🔥', t: 'Losing-streak brake', d: 'After several losses in a row it stops you for a while. The antidote to revenge trading.' },
        { i: '📰', t: 'News blackout', d: 'Avoids trading around high-impact releases, for the minutes you set. Available on Elite.' },
      ],
      honestT: 'What it does not do, said plainly',
      honestD: 'MetaTrader does not let an EA block an order before it is sent. What Onyx does is close it as soon as it appears, within a second or two, and that costs you the spread on that entry. Not a bug: that is the friction. And with MetaTrader closed it protects nothing — for serious use, a VPS.',
    },
    nav: { features: 'Features', how: 'How it works', fondeo: 'Prop firms', gestor: 'Guardian', pricing: 'Pricing', amb: 'Ambassadors', faq: 'FAQ', login: 'Log in', cta: 'Start free' },
    hero: {
      badge: '🔗 Connect MT4 & MT5 · Automatic sync',
      h1a: 'Trade with data,', h1b: 'not memory',
      sub: 'Connect your MetaTrader or funded account and let Onyx analyze every trade: live sessions and news, costs, calendar and prop-firm rules. All in one panel.',
      cta1: 'Start free →', cta2: 'See pricing', note: 'No card to start · Cancel anytime',
    },
    trust: ['✅ Works with MT4 & MT5', '🔒 Read-only connection', '💳 Secure payments with Stripe'],
    logosT: 'Works with your broker and prop firm',
    videoBadge: '▶ In action',
    videoT: 'See Onyx from the inside',
    videoS: 'A walkthrough of the dashboard: portfolio, calendar, equity curve and real-time stats.',
    videoNote: 'Video demo · no audio',
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
    prop: {
      badge: '🏆 Built for funded accounts',
      t: 'Works with your prop firm',
      s: 'Your funded account is a MetaTrader account. Onyx connects just like any broker: install the connector, paste your API key, done. Pick your firm to see the details:',
      onyx: '✓ Works with Onyx',
      plats: 'Available platforms',
      sizes: 'Account sizes',
      note: 'Your firm not listed? If it gives you an MT4 or MT5 account, Onyx works too.',
      tTitle: '📊 Live funding tracker',
      tSub: 'Drag the control and watch Onyx guard your rules in real time. Example with a $50,000 account.',
      tPnl: 'Your current P&L',
      tTarget: 'Profit target  ·  +$5,000',
      tLoss: 'Max loss  ·  −$5,000',
      st: { ok: '✓ Within rules — keep going', near: '⚠ Careful: near the loss limit', broke: '✗ Rule broken — account lost', passed: '🎉 Target reached! Phase passed' },
    },
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
    amb: {
      t: 'Do you have a trading community?',
      d: 'Recommend Onyx to your followers and earn a recurring commission every month, for as long as they stay subscribed. They join with a discount, you get paid every time.',
      k1: 'recurring', k2: 'No cap', k2s: 'on earnings', k3: 'for your people', k3s: 'with your code',
      cta: 'See the program →',
    },
    faqT: 'Frequently asked questions',
    faqs: [
      ['Which brokers and prop firms does it work with?', 'Any MT4 or MT5 account: FTMO, FundedNext, The5ers, FundingPips and your usual broker. Your funded account is a MetaTrader account, so it connects the same way.'],
      ['Is it safe to connect my account?', 'Yes. The connection is read-only: Onyx reads your history but can never trade, withdraw or move your funds.'],
      ['Do I need to know how to code?', 'No. Install the connector, paste your API key and you\'re done. We guide you step by step — no code required.'],
      ['How many accounts can I connect?', 'Depends on your plan: from 1 account on Free to unlimited accounts. You see them all combined in your portfolio.'],
      ['Do you have an affiliate or ambassador program?', 'Yes. If you have a community, channel or followers, you earn a recurring commission for every person who subscribes through your link, for as long as they keep paying. Your audience also gets a discount with your code. Check the Ambassadors page.'],
      ['Does it work on mobile?', 'Yes. The dashboard adapts to phone, tablet and large monitors, so you can check it from any device.'],
      ['How is it different from a spreadsheet?', 'Onyx syncs automatically, computes 15+ metrics, and has a calendar, live sessions and news, costs, prop-firm tracking and modern charts. A spreadsheet does none of that.'],
      ['Does it work with MT4 and MT5?', 'Yes, both. You just use the connector file for your platform; the same API key works for both.'],
      ['Can I cancel anytime?', 'Of course. Manage your subscription from your panel and cancel or change plan anytime.'],
      ['What payment methods do you accept?', 'Secure card payments through Stripe. Your payment data never touches our servers.'],
    ],
    finalT: 'Trade with data, not memory', finalCta: 'Create free account',
    footer: { terms: 'Terms', privacy: 'Privacy', amb: 'Ambassadors', rights: '© 2026 Onyx Trading Live' },
  },
} as const;

const FIRMS = [
  { name: 'FTMO', mono: 'F', color: '#2f6bff', logo: '/logos/ftmo.png', plats: ['MT4', 'MT5', 'cTrader', 'DXtrade'], sizes: ['10K', '25K', '50K', '100K', '200K'],
    es: 'El estándar de la industria. Evaluación en dos fases y cuentas de hasta $200K.', en: 'The industry standard. Two-step evaluation and accounts up to $200K.' },
  { name: 'FundedNext', mono: 'N', color: '#16c98d', logo: '/logos/fundednext.png', plats: ['MT4', 'MT5'], sizes: ['6K', '15K', '25K', '50K', '100K', '200K'],
    es: 'Reparto de hasta 95% y modelos flexibles. Cuentas MT4 y MT5.', en: 'Up to 95% profit split and flexible models. MT4 and MT5 accounts.' },
  { name: 'The5ers', mono: '5', color: '#ff8a3d', logo: '/logos/the5ers.png', plats: ['MT5', 'cTrader'], sizes: ['5K', '20K', '60K', '100K'],
    es: 'Programas de bajo drawdown y escalado rápido de capital.', en: 'Low-drawdown programs with fast capital scaling.' },
  { name: 'FundingPips', mono: 'P', color: '#8b5cff', logo: '/logos/fundingpips.png', plats: ['MT5', 'cTrader', 'MatchTrader'], sizes: ['5K', '10K', '25K', '50K', '100K', '200K'],
    es: 'Precios agresivos y evaluación flexible de una o dos fases.', en: 'Aggressive pricing and flexible one- or two-step evaluations.' },
];

const PROWS: { es: string; en: string; v: (boolean | string)[]; head?: boolean }[] = [
  { es: 'Historial', en: 'History', v: ['30 días', 'Ilimitado', 'Ilimitado'] },
  { es: 'Sesiones y noticias en vivo', en: 'Live sessions & news', v: [true, true, true] },
  { es: 'KPIs, gráficas y calendario', en: 'KPIs, charts & calendar', v: [true, true, true] },
  { es: 'Perfil del trader (radar)', en: 'Trader profile (radar)', v: [true, true, true] },
  { es: 'Diario con fotos y notas', en: 'Journal with photos & notes', v: [false, true, true] },
  { es: 'Comparar cuentas', en: 'Compare accounts', v: [false, true, true] },
  { es: 'Reglas de fondeo y retiros', en: 'Funding rules & payouts', v: [false, true, true] },
  { es: 'Costes (comisión y swap)', en: 'Costs (commission & swap)', v: [false, true, true] },
  { es: 'Exportar CSV', en: 'Export CSV', v: [false, true, true] },

  // Onyx Guardian — el módulo de gestión de riesgo, ya activo en MT4 y MT5
  { es: 'Onyx Guardian', en: 'Onyx Guardian', v: ['', '', ''], head: true },
  { es: 'Break even que cubre costes', en: 'Break even that covers costs', v: [false, true, true] },
  { es: 'Trailing stop', en: 'Trailing stop', v: [false, true, true] },
  { es: 'Mi plan de trading (horarios, rachas)', en: 'My trading plan (hours, streaks)', v: [false, true, true] },
  { es: 'Límites con margen de seguridad', en: 'Limits with safety margin', v: [false, true, true] },
  { es: 'Indicador de disciplina', en: 'Discipline indicator', v: [false, true, true] },
  { es: 'Cierres parciales (varios TP)', en: 'Partial closes (multiple TPs)', v: [false, false, true] },
  { es: 'Bloqueo por noticias', en: 'News blackout', v: [false, false, true] },
  { es: 'Alertas por Telegram', en: 'Telegram alerts', v: [false, false, true] },

  { es: 'Informes automáticos', en: 'Automatic reports', v: [false, false, true] },
  { es: 'Soporte prioritario', en: 'Priority support', v: [false, false, true] },
];

export default function Home() {
  const { lang, setLang } = useLang();
  const [annual, setAnnual] = useState(false);
  const [firm, setFirm] = useState(0);
  const [pnl, setPnl] = useState(1800);
  const [vidErr, setVidErr] = useState(false);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const t = dict[lang];

  useEffect(() => {
    fetch('/api/admin/plans').then((r) => r.json()).then((j) => setDbPlans(j.plans || [])).catch(() => {});
  }, []);
  const f = FIRMS[firm];
  const target = 5000, maxLoss = 5000;
  const targetPct = Math.max(0, Math.min(100, (pnl / target) * 100));
  const lossPct = pnl < 0 ? Math.min(100, (-pnl / maxLoss) * 100) : 0;
  const st = pnl <= -maxLoss ? t.prop.st.broke : pnl >= target ? t.prop.st.passed : (pnl < 0 && -pnl > maxLoss * 0.7) ? t.prop.st.near : t.prop.st.ok;
  const stColor = pnl <= -maxLoss ? '#ff6b7d' : pnl >= target ? '#34e2a0' : (pnl < 0 && -pnl > maxLoss * 0.7) ? '#ffcf5c' : '#7c8cff';
  const grad = { background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as any;

  const SECTIONS = [
    { id: 'features', label: t.nav.features },
    { id: 'how', label: t.nav.how },
    { id: 'fondeo', label: t.nav.fondeo },
    { id: 'gestor', label: t.nav.gestor },
    { id: 'pricing', label: t.nav.pricing },
    { id: 'embajadores', label: t.nav.amb },
    { id: 'faq', label: t.nav.faq },
  ];

  return (
    <>
      <SectionNav items={SECTIONS} />

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

        {/* vista previa moderna del dashboard (cabina) */}
        <div className="card" style={{ maxWidth: 940, margin: '46px auto 0', padding: 16, background: '#0b0f18' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px', gap: 10, textAlign: 'left' }} className="heroPreview">
            {/* sesiones */}
            <div style={{ background: '#151a28', borderRadius: 12, padding: 12, fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>🕐 Sesiones</div>
              {[['🇬🇧 Londres', '#34e2a0', 'OPEN'], ['🇺🇸 N.York', '#34e2a0', 'OPEN'], ['🇯🇵 Tokio', '#9aa6bd', '3h'], ['🇦🇺 Sídney', '#9aa6bd', '6h']].map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', color: '#9aa6bd' }}><span>{s[0]}</span><b style={{ color: s[1] as string }}>{s[2]}</b></div>
              ))}
            </div>
            {/* panel */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
                {[['Health', '78', '#34e2a0', 0.78], ['Win', '63%', '#7c8cff', 0.63], ['P.factor', '1.94', '#b98bff', 0.65]].map((r, i) => {
                  const C = 2 * Math.PI * 15, d = (r[3] as number) * C;
                  return (<div key={i} style={{ background: '#151a28', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#3a4a68" strokeWidth="5" /><circle cx="20" cy="20" r="15" fill="none" stroke={r[2] as string} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${d} ${C - d}`} transform="rotate(-90 20 20)" /><text x="20" y="24" textAnchor="middle" fill="#f2f5fb" fontSize="10" fontWeight="800">{r[1]}</text></svg>
                    <span style={{ fontSize: 10, color: '#9aa6bd' }}>{r[0]}</span>
                  </div>);
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {[['🎯 Rendimiento', '#7c8cff', '+$8,240', '#34e2a0'], ['🗓️ Calendario', '#34e2a0', '18 verdes', '#f2f5fb'], ['📋 Operaciones', '#b98bff', '142', '#f2f5fb'], ['💸 Costes', '#ffd45e', '-$412', '#ff6b7d']].map((b, i) => (
                  <div key={i} style={{ background: '#151a28', borderTop: `2px solid ${b[1]}`, borderRadius: 10, padding: 10 }}><b style={{ fontSize: 12, color: '#fff' }}>{b[0]}</b><div style={{ fontSize: 15, fontWeight: 800, color: b[3] as string, marginTop: 4 }}>{b[2]}</div></div>
                ))}
              </div>
            </div>
            {/* noticias */}
            <div style={{ background: '#151a28', borderRadius: 12, padding: 12, fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>📰 Noticias</div>
              <div style={{ background: 'rgba(124,140,255,.12)', border: '1px solid #7c8cff', borderRadius: 8, padding: 8 }}>
                <div style={{ color: '#a9b4ff', fontWeight: 700, fontSize: 9 }}>🇺🇸 NFP <span style={{ color: '#ff6b7d' }}>●●●</span></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#a9b4ff' }}>2h 14m</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TRUST */}
      <div className="wrap" style={{ padding: '10px 22px 30px' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 34, flexWrap: 'wrap', color: 'var(--mut)', fontSize: 15 }}>
          {t.trust.map((x, i) => <span key={i}>{x}</span>)}
        </div>
      </div>

      {/* STATS (prueba social) */}
      <div className="wrap section" style={{ paddingTop: 10 }}>
        <div className="grid g4" style={{ textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <div key={i} className="card" style={{ padding: '26px 16px' }}>
              <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
              <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? s.es : s.en}</div>
            </div>
          ))}
        </div>
      </div>

      {/* LOGOS marquee · franja blanca de borde a borde */}
      <div className="wrap" style={{ padding: '6px 22px 14px' }}>
        <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>{t.logosT}</p>
      </div>
      <div className="logostrip">
        <div className="logostrip-track">
          {[...LOGOS, ...LOGOS].map((l, i) => (
            <span key={i} style={{ color: l.c, fontWeight: 800, fontSize: 20, whiteSpace: 'nowrap' }}>{l.n}</span>
          ))}
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

      {/* VIDEO */}
      <div className="wrap section" style={{ textAlign: 'center' }}>
        <span className="pill green">{t.videoBadge}</span>
        <h2 style={{ margin: '16px 0 10px' }}>{t.videoT}</h2>
        <p className="muted" style={{ fontSize: 17, maxWidth: 620, margin: '0 auto 26px' }}>{t.videoS}</p>
        <div className="vframe" style={{ maxWidth: 940, margin: '0 auto' }}>
          <div className="row" style={{ gap: 7, padding: '11px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
            <span className="vdot" style={{ background: '#ff6b7d' }} /><span className="vdot" style={{ background: '#ffc04d' }} /><span className="vdot" style={{ background: '#34e2a0' }} />
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>onyxtradinglive.vercel.app/dashboard</span>
          </div>
          {!vidErr ? (
            <video autoPlay muted loop playsInline onError={() => setVidErr(true)} style={{ background: 'var(--bg2)' }}>
              <source src="/dashboard-demo.mp4" type="video/mp4" />
            </video>
          ) : (
            <svg viewBox="0 0 940 460" width="100%" xmlns="http://www.w3.org/2000/svg" fontFamily="Segoe UI,sans-serif">
              <rect x="0" y="0" width="940" height="460" fill="#0f131e" />
              {[['Neto', '+$8,240', '#34e2a0'], ['Win rate', '63%', '#f2f5fb'], ['Profit factor', '1.94', '#f2f5fb'], ['Expectancy', '+$42', '#7c8cff'], ['Drawdown', '4.1%', '#ff6b7d']].map((c, i) => (
                <g key={i}><rect x={22 + i * 182} y="22" width="168" height="76" rx="10" fill="#151a28" /><text x={38 + i * 182} y="50" fill="#9aa6bd" fontSize="12">{c[0]}</text><text x={38 + i * 182} y="80" fill={c[2] as string} fontSize="23" fontWeight="800">{c[1]}</text></g>
              ))}
              <rect x="22" y="112" width="560" height="326" rx="10" fill="#151a28" /><text x="40" y="140" fill="#f2f5fb" fontSize="13" fontWeight="700">Curva de equity</text>
              <polyline points="44,392 130,378 216,398 302,340 388,352 474,286 540,300 582,232" fill="none" stroke="#7c8cff" strokeWidth="3" />
              <polygon points="44,392 130,378 216,398 302,340 388,352 474,286 540,300 582,232 582,420 44,420" fill="#7c8cff" opacity="0.12" />
              <rect x="598" y="112" width="320" height="326" rx="10" fill="#151a28" /><text x="616" y="140" fill="#f2f5fb" fontSize="13" fontWeight="700">Calendario</text>
              {Array.from({ length: 25 }).map((_, i) => { const g = (i * 7) % 3 !== 0; return <rect key={i} x={616 + (i % 5) * 60} y={156 + Math.floor(i / 5) * 52} width="52" height="44" rx="6" fill={g ? 'rgba(52,226,160,0.42)' : 'rgba(255,107,125,0.42)'} />; })}
            </svg>
          )}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{t.videoNote}</p>
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

      {/* PROP FIRMS */}
      <div id="fondeo" className="wrap section">
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <span className="pill green">{t.prop.badge}</span>
          <h2 style={{ margin: '16px 0 10px' }}>{t.prop.t}</h2>
          <p className="muted" style={{ fontSize: 17, maxWidth: 660, margin: '0 auto' }}>{t.prop.s}</p>
        </div>

        {/* selector de firma */}
        <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          {FIRMS.map((fm, i) => (
            <button key={i} onClick={() => setFirm(i)} style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderRadius: 12,
              border: i === firm ? `2px solid ${fm.color}` : `1px solid ${fm.color}55`,
              background: i === firm ? fm.color + '2e' : fm.color + '14', color: 'inherit', transition: 'all .2s' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: fm.color, flex: 'none', boxShadow: i === firm ? `0 0 8px ${fm.color}` : 'none' }} />
              <b style={{ fontSize: 15, color: i === firm ? '#fff' : fm.color }}>{fm.name}</b>
            </button>
          ))}
        </div>

        {/* detalle + tracker */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
          {/* detalle de la firma */}
          <div className="card" style={{ borderTop: `3px solid ${f.color}` }}>
            <div className="row" style={{ gap: 12, marginBottom: 14, alignItems: 'center' }}>
              <span style={{ width: 46, height: 46, borderRadius: 12, background: f.color + '22', display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 16, height: 16, borderRadius: '50%', background: f.color }} /></span>
              <div><h3 style={{ margin: 0, color: f.color }}>{f.name}</h3><span className="pill green" style={{ marginTop: 4, display: 'inline-block' }}>{t.prop.onyx}</span></div>
            </div>
            <p className="muted" style={{ fontSize: 15, marginBottom: 16 }}>{lang === 'es' ? f.es : f.en}</p>
            <div style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 7 }}>{t.prop.plats}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {f.plats.map((p, j) => {
                const ok = p.indexOf('MT') === 0;
                return <span key={j} style={{ padding: '5px 11px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: ok ? 'rgba(52,226,160,0.14)' : 'var(--bg2)', color: ok ? '#34e2a0' : 'var(--mut)',
                  border: ok ? '1px solid rgba(52,226,160,0.45)' : '1px solid var(--line)' }}>{ok ? '✓ ' : ''}{p}</span>;
              })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 7 }}>{t.prop.sizes}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {f.sizes.map((s, j) => <span key={j} style={{ padding: '5px 11px', borderRadius: 8, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--line)' }}>${s}</span>)}
            </div>
          </div>

          {/* tracker en vivo */}
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>{t.prop.tTitle}</h3>
            <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>{t.prop.tSub}</p>

            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="muted" style={{ fontSize: 14 }}>{t.prop.tPnl}</span>
              <b style={{ color: pnl >= 0 ? '#34e2a0' : '#ff6b7d', fontSize: 19 }}>{pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toLocaleString()}</b>
            </div>
            <input type="range" min={-6000} max={6500} step={100} value={pnl} onChange={(e) => setPnl(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: stColor, marginBottom: 20 }} />

            <div className="row between" style={{ fontSize: 13, marginBottom: 5 }}><span className="muted">{t.prop.tTarget}</span><span style={{ fontWeight: 700 }}>{Math.round(targetPct)}%</span></div>
            <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: targetPct + '%', height: '100%', background: '#34e2a0', transition: 'width .12s' }} />
            </div>

            <div className="row between" style={{ fontSize: 13, marginBottom: 5 }}><span className="muted">{t.prop.tLoss}</span><span style={{ fontWeight: 700 }}>{Math.round(lossPct)}%</span></div>
            <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: lossPct + '%', height: '100%', background: lossPct > 70 ? '#ff6b7d' : '#ffcf5c', transition: 'width .12s' }} />
            </div>

            <div style={{ textAlign: 'center', padding: '11px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid ' + stColor, color: stColor, fontWeight: 700 }}>{st}</div>
          </div>
        </div>

        <p className="muted" style={{ textAlign: 'center', fontSize: 14, marginTop: 20 }}>{t.prop.note}</p>
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

      {/* GESTOR DE RIESGO — el EA que gestiona y frena, sin abrir nunca una operación */}
      <div id="gestor" className="wrap section">
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <span className="pill green">{t.mgr.badge}</span>
          <h2 style={{ marginTop: 14 }}>{t.mgr.title}</h2>
          <p className="muted" style={{ fontSize: 17, margin: '12px auto 0', maxWidth: 640 }}>{t.mgr.sub}</p>
        </div>

        <div className="grid g3" style={{ marginBottom: 24 }}>
          {t.mgr.cards.map((c: any, i: number) => (
            <div key={i} className="card">
              <div style={{ fontSize: 26, marginBottom: 10 }}>{c.i}</div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>{c.t}</h3>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{c.d}</p>
            </div>
          ))}
        </div>

        {/* Lo que NO hace importa tanto como lo que hace */}
        <div className="card" style={{ border: '1px solid var(--amber)', maxWidth: 720, margin: '0 auto' }}>
          <h3 style={{ color: 'var(--amber)', marginBottom: 8, fontSize: 16 }}>{t.mgr.honestT}</h3>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.8 }}>{t.mgr.honestD}</p>
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
        <div className="row" style={{ justifyContent: 'center', marginBottom: 30 }}>
          <button className={'btn ' + (!annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(false)}>{lang === 'es' ? 'Mensual' : 'Monthly'}</button>
          <button className={'btn ' + (annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(true)}>{lang === 'es' ? 'Anual · ahorra 2 meses' : 'Annual · save 2 months'}</button>
        </div>
        <div className="grid g3" style={{ alignItems: 'start' }}>
          {dbPlans.map((p, i) => {
            const price = annual ? p.price_year : p.price_month;
            const name = lang === 'es' ? p.name : (p.name_en || p.name);
            const desc = lang === 'es' ? p.desc_es : (p.desc_en || p.desc_es);
            const feats = (lang === 'es' ? p.features : (p.features_en?.length ? p.features_en : p.features)) || [];
            const badge = lang === 'es' ? p.badge : (p.badge_en || p.badge);
            const pop = !!badge;
            const prev = dbPlans[i - 1];
            const prevName = prev ? (lang === 'es' ? prev.name : (prev.name_en || prev.name)) : '';
            return (
              <div key={p.id} className="card" style={pop ? { border: '2px solid var(--brand)', boxShadow: '0 0 30px rgba(124,140,255,.25)', position: 'relative' } : { position: 'relative' }}>
                {pop && <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'var(--grad)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>★ {badge}</span>}
                <h3 style={{ marginTop: pop ? 6 : 0 }}>{name}</h3>
                {desc && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{desc}</p>}
                <div style={{ fontSize: 42, fontWeight: 800, margin: '10px 0 2px' }}>${price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? (lang === 'es' ? 'año' : 'yr') : (lang === 'es' ? 'mes' : 'mo')}</span></div>
                <ul style={{ listStyle: 'none', margin: '16px 0' }}>
                  {i > 0 && <li style={{ padding: '7px 0', color: 'var(--mut)', fontWeight: 700, fontSize: 13 }}>{lang === 'es' ? `Todo lo de ${prevName}, y además:` : `Everything in ${prevName}, and more:`}</li>}
                  {feats.map((it: string, j: number) => <li key={j} style={{ padding: '7px 0', color: '#d6dae6' }}><span style={{ color: '#34e2a0' }}>✓</span> {it}</li>)}
                </ul>
                <Link className={'btn ' + (pop ? 'btn-primary' : 'btn-ghost')} href="/login?mode=signup" style={{ display: 'block', textAlign: 'center' }}>{price === 0 ? (lang === 'es' ? 'Empezar gratis' : 'Start free') : (lang === 'es' ? 'Elegir ' : 'Choose ') + name}</Link>
              </div>
            );
          })}
        </div>

        {/* Tabla comparativa */}
        {dbPlans.length > 0 && (() => {
          const cols = ['free', 'pro', 'elite'];
          const byId = (id: string) => dbPlans.find((p: any) => p.id === id);
          const acc = (id: string) => { const p = byId(id); if (!p) return '—'; return p.max_accounts >= 999 ? (lang === 'es' ? 'Ilimitadas' : 'Unlimited') : String(p.max_accounts); };
          const chk = (v: boolean | string) => typeof v === 'string' ? <span style={{ fontSize: 13 }}>{v}</span> : v ? <span style={{ color: '#34e2a0', fontSize: 16 }}>✓</span> : <span style={{ color: '#66708a', fontSize: 14 }}>🔒</span>;
          return (
            <div style={{ marginTop: 46 }}>
              <h2 style={{ textAlign: 'center', marginBottom: 18 }}>{lang === 'es' ? 'Compara los planes' : 'Compare plans'}</h2>
              <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table style={{ minWidth: 520 }}>
                  <thead><tr><th style={{ padding: '14px 16px' }}></th>{cols.map((id) => { const p = byId(id); const on = !!(p && (lang === 'es' ? p.badge : p.badge_en)); return <th key={id} style={{ textAlign: 'center', padding: '14px 16px', color: on ? 'var(--brand)' : 'var(--tx)', fontSize: 15 }}>{p ? (lang === 'es' ? p.name : (p.name_en || p.name)) : id}</th>; })}</tr></thead>
                  <tbody>
                    <tr><td style={{ padding: '12px 16px', color: 'var(--mut)' }}>{lang === 'es' ? 'Cuentas MT' : 'MT accounts'}</td>{cols.map((id) => <td key={id} style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700 }}>{acc(id)}</td>)}</tr>
                    {PROWS.map((r, ri) => r.head
                      ? (<tr key={ri}><td colSpan={4} style={{ padding: '16px 16px 8px', color: 'var(--brand)', fontWeight: 700, fontSize: 13, letterSpacing: '.02em' }}>🛡️ {lang === 'es' ? r.es : r.en}</td></tr>)
                      : (<tr key={ri}><td style={{ padding: '12px 16px', color: 'var(--mut)' }}>{lang === 'es' ? r.es : r.en}</td>{r.v.map((v, ci) => <td key={ci} style={{ textAlign: 'center', padding: '12px 16px' }}>{chk(v)}</td>)}</tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Embajadores */}
      <div id="embajadores" className="wrap section">
        <div className="card" style={{ border: '1px solid var(--brand)', background: 'linear-gradient(135deg,rgba(124,140,255,.14),rgba(160,107,255,.06))', textAlign: 'center', padding: '34px 22px' }}>
          <h2 style={{ marginBottom: 10 }}>{t.amb.t}</h2>
          <p className="muted" style={{ maxWidth: 620, margin: '0 auto 22px', fontSize: 16 }}>{t.amb.d}</p>
          <div className="grid g3" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
            <div><div style={{ fontSize: 32, fontWeight: 800, background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>30%</div><div className="muted" style={{ fontSize: 13 }}>{t.amb.k1}</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)' }}>{t.amb.k2}</div><div className="muted" style={{ fontSize: 13 }}>{t.amb.k2s}</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gold)' }}>-20%</div><div className="muted" style={{ fontSize: 13 }}>{t.amb.k3} {t.amb.k3s}</div></div>
          </div>
          <Link className="btn btn-primary" href="/embajadores" style={{ padding: '12px 26px', fontSize: 16 }}>{t.amb.cta}</Link>
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
          <div className="logo" style={{ fontSize: 16 }}><img src="/onyx-symbol.png" alt="Onyx" style={{ width: 24, height: 24, objectFit: 'contain' }} /> Onyx Trading Live</div>
          <div className="row" style={{ gap: 20 }}>
            <Link href="/embajadores">{t.footer.amb}</Link>
            <Link href="/terms">{t.footer.terms}</Link>
            <Link href="/privacy">{t.footer.privacy}</Link>
            <span>{t.footer.rights}</span>
          </div>
        </div>
      </div>
    </>
  );
}
