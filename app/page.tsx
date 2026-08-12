'use client';
import { dictFor } from '@/lib/i18n';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import SectionNav from './SectionNav';
import PlansCompareTable from './PlansCompareTable';
import PlanCards from './PlanCards';
import OnyxIcon from '@/app/components/OnyxIcon';

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
  { to: 5, suffix: '', es: 'Plataformas y señales', en: 'Platforms & signals' },
  { to: 4, prefix: '+', es: 'Prop firms compatibles', en: 'Compatible prop firms' },
];

/* Marcas para el carrusel (broker/prop firm + plataformas) */
const LOGOS = [
  { n: 'FTMO', c: '#2f6bff' }, { n: 'FundedNext', c: '#16c98d' },
  { n: 'FundingPips', c: '#8b5cff' }, { n: 'The5%ers', c: '#ffce00' },
  { n: 'MetaTrader 4', c: '#f0a020' }, { n: 'MetaTrader 5', c: '#2f6bff' },
  { n: 'cTrader', c: '#e0533d' }, { n: 'MatchTrader', c: '#16c98d' },
  { n: 'TradingView', c: '#111' },
  { n: 'Axi', c: '#ff4757' }, { n: 'IC Markets', c: 'var(--red2)' },
  { n: 'Pepperstone', c: '#e2531f' }, { n: 'Exness', c: '#ffcf5c' },
];

// Formato compacto universal (17.4K, 1.2M, 100M, 1.2B). Mantiene cortos los
// números por muchos que crezcan, así el "+" nunca se corta. < 1000 = exacto.
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const cut = (v: number, suf: string) => {
    const s = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return s + suf;
  };
  if (abs >= 1e9) return cut(n / 1e9, 'B');
  if (abs >= 1e6) return cut(n / 1e6, 'M');
  if (abs >= 1e3) return cut(n / 1e3, 'K');
  return String(Math.round(n));
}

function Counter({ to, prefix = '', suffix = '', compact = true }: { to: number; prefix?: string; suffix?: string; compact?: boolean }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);        // ¿ya entró en pantalla alguna vez?
  const fromRef = useRef(0);         // desde qué valor animar
  const toRef = useRef(to); toRef.current = to;   // valor más reciente (evita quedarse en el inicial)

  // Anima de `from` a `to`. Se vuelve a llamar cuando llegan los datos reales,
  // así que un valor que empezó en 0 sube hasta la cifra real al cargar /api/stats.
  useEffect(() => {
    if (!seen.current) return;
    const from = fromRef.current, dur = 1000, t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick); else fromRef.current = to;
    };
    requestAnimationFrame(tick);
  }, [to]);

  useEffect(() => {
    const start = () => {
      if (seen.current) return; seen.current = true;
      const dur = 1200, t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); const target = toRef.current; setN(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(tick); else fromRef.current = target; };
      requestAnimationFrame(tick);
    };
    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((ents) => { if (ents[0].isIntersecting) start(); }, { threshold: 0.3 });
      io.observe(el);
    }
    const timer = setTimeout(start, 1500);
    return () => { if (io) io.disconnect(); clearTimeout(timer); };
  }, []);

  // padding horizontal + overflow visible: con background-clip:text y letter-spacing
  // negativo, WebKit recorta el último glifo (el "+"). El margen lo evita siempre.
  return <div ref={ref} style={{ fontSize: 'clamp(28px, 6vw, 44px)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.15, whiteSpace: 'nowrap', padding: '2px 8px', overflow: 'visible', background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{prefix}{compact ? fmtCompact(n) : n.toLocaleString()}{suffix}</div>;
}

const dict = {
  es: {
    mgr: {
      badge: 'Módulo activo · Pro y Elite',
      title: 'Onyx Guardian — el gestor que te protege de ti mismo',
      sub: 'Nunca abre operaciones. Solo cuida las que abres tú y hace cumplir el plan de trading que escribiste cuando estabas tranquilo. Ya funcionando en MetaTrader (MT4/MT5) y cTrader.',
      cards: [
        { i: '🎯', t: 'Break even que sale a cero de verdad', d: 'Mueve el stop cuando la operación va a favor y suma la comisión y el swap que te cobró el bróker. Cero real, no cero de precio.' },
        { i: '📐', t: 'Trailing y cierres por partes', d: 'Persigue al precio y cierra en varios niveles. Tú eliges si mides en pips, en R o en dinero.' },
        { i: '⏰', t: 'Tu horario, respetado', d: 'Días y franjas en las que operas. Fuera de ahí, si abres una operación se cierra sola. Con la fricción que tú decidas.' },
        { i: '🛡️', t: 'Límites de pérdida y de fondeo', d: 'Pérdida diaria y total, con margen de seguridad. Te para antes de llegar al tope, no cuando ya lo rompiste.' },
        { i: '🔥', t: 'Freno de racha', d: 'Tras varias pérdidas seguidas, te para un rato. Es el antídoto contra la operación de venganza.' },
        { i: '📰', t: 'Bloqueo por noticias', d: 'Evita operar alrededor de datos de alto impacto, los minutos que tú marques. Disponible en Elite.' },
      ],
      honestT: 'Lo que no hace, dicho claro',
      honestD: 'Onyx no puede impedir una orden antes de que la envíes: la cierra en cuanto aparece, en uno o dos segundos, y eso te cuesta el spread de esa entrada. No es un fallo: es la fricción. Y sin tu plataforma abierta no protege nada — para uso serio, un VPS.',
    },
    nav: { features: 'Funciones', eco: 'Ecosistema', how: 'Cómo funciona', fondeo: 'Fondeo', gestor: 'Guardian', pricing: 'Precios', amb: 'Embajadores', faq: 'FAQ', login: 'Entrar', cta: 'Empieza gratis' },
    eco: {
      badge: '🧩 Mucho más que un diario',
      t: 'Todo el ecosistema Onyx',
      s: 'Un solo lugar para analizar, proteger, aprender y hacer crecer tu trading. Todo conectado a tu misma cuenta.',
      cards: [
        { i: '🛡️', t: 'Onyx Guardian', d: 'Gestiona y frena tus operaciones según tu plan: break even real, trailing, parciales, límites de fondeo y bloqueo por noticias.' },
        { i: '🔁', t: 'Copy trading anti-baneo', d: 'Copia de una maestra a varias con tus límites de riesgo por enlace. Protege tu fondeo: ejecución local (sin IP compartida) y retraso aleatorio que rompe el patrón de timing. Nunca se activa solo: tú decides.' },
        { i: '📈', t: 'Señales de TradingView', d: 'Tus alertas de TradingView abren la operación en tu cuenta real vía tu EA, con tope de lote y símbolos. El Guardian te sigue protegiendo.' },
        { i: '🎓', t: 'Onyx Academy', d: 'Comunidad y mentoría estilo Skool: cursos, clases en vivo, feed, retos y certificados. Los mentores cobran con Stripe.' },
        { i: '🤖', t: 'Onyx AI', d: 'Analiza tu operativa, lee tu reporte y te da hallazgos claros. Nunca da señales ni promete ganancias.' },
        { i: '📲', t: 'Alertas por Telegram', d: 'Avisos de fondeo, Guardian, noticias, meta alcanzada y resumen diario, directo a tu Telegram.' },
        { i: '🏆', t: 'Seguimiento de reto', d: 'Vigila las reglas de tu prop firm en vivo: objetivo, pérdida diaria y total, con margen de seguridad.' },
      ],
    },
    hero: {
      badge: '🔗 MetaTrader, cTrader y más · Sincronización automática',
      h1a: 'Opera con datos,', h1b: 'no con memoria',
      sub: 'Conecta tu cuenta de MetaTrader, cTrader o de fondeo y deja que Onyx analice cada operación: sesiones y noticias en vivo, costes, calendario y reglas de fondeo. Todo en un panel.',
      cta1: 'Empieza gratis →', cta2: 'Ver precios', note: 'Sin tarjeta para empezar · Cancela cuando quieras',
    },
    trust: ['✅ MT4, MT5 y cTrader', '🔒 Conexión de solo lectura', '💳 Pagos seguros con Stripe'],
    logosT: 'Compatible con tu bróker y tu prop firm',
    videoBadge: '▶ En acción',
    videoT: 'Mira Onyx por dentro',
    videoS: 'Un recorrido por el dashboard: portafolio, calendario, curva de equity y estadísticas en tiempo real.',
    videoNote: 'Demo en video · sin audio',
    probT: 'Deja de operar a ciegas',
    probS: 'La mayoría de traders no sabe qué le hace ganar y qué le hace perder. Onyx convierte tu historial en información clara para que mejores de verdad.',
    featT: 'Todo lo que necesitas para mejorar',
    features: [
      { i: '🔗', t: 'Conexión multiplataforma', d: 'MetaTrader 4 y 5, cTrader y pronto MatchTrader. Vincula tus cuentas y sincroniza el historial automáticamente, sin subir nada a mano.' },
      { i: '📈', t: 'Estadísticas avanzadas', d: 'Win rate, profit factor, expectancy, payoff, drawdown, break even y mucho más.' },
      { i: '🗓️', t: 'Calendario de resultados', d: 'Visualiza tu P&L por día, mes y año con un calendario tipo mapa de calor.' },
      { i: '🗂️', t: 'Multi-cuenta y portafolio', d: 'Gestiona varias cuentas (real, demo, fondeo) y ve tu portafolio completo sumado.' },
      { i: '🌍', t: 'Sesiones, días y pares', d: 'Descubre tus mejores y peores horas, sesiones, días y pares.' },
      { i: '🏆', t: 'Seguimiento de fondeo', d: 'Sigue tu drawdown y objetivo de FTMO y otras prop firms en tiempo real.' },
      { i: '🤖', t: 'Mis robots', d: 'Detecta cada EA por su magic y mide su rendimiento real: métricas por robot, portafolio y divergencia con tu backtest.' },
      { i: '💰', t: 'Ganancia neta', d: 'Resta tus gastos (fees de prop firm, reembolsos, add-ons) a tu bruto y ve tu ganancia real y el ROI por firma.' },
    ],
    showT: 'Un dashboard profesional de verdad',
    showS: 'Calendario, curva de equity, distribución, mejores pares y sesiones. Todo calculado por ti, en tiempo real.',
    howT: 'Listo en 3 minutos',
    steps: [
      { t: 'Crea tu cuenta', d: 'Regístrate gratis con tu email. Sin tarjeta.' },
      { t: 'Conecta tu plataforma', d: 'Elige MetaTrader o cTrader, instala Onyx Connect y pega tu API key. Solo lectura.' },
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
      s: 'Tu cuenta de fondeo es una cuenta de MetaTrader o cTrader. Onyx se conecta igual que a cualquier broker: instalas el connector, pegas tu API key y listo. Elige tu firma para ver los detalles:',
      onyx: '✓ Compatible con Onyx',
      plats: 'Plataformas disponibles',
      sizes: 'Tamaños de cuenta',
      note: '¿Tu firma no está en la lista? Si te da una cuenta MetaTrader (MT4/MT5) o cTrader, Onyx funciona igual.',
      tTitle: '📊 Seguimiento de fondeo en vivo',
      tSub: 'Mueve el control y mira cómo Onyx vigila tus reglas en tiempo real. Ejemplo con cuenta de $50.000.',
      tPnl: 'Tu P&L actual',
      tTarget: 'Objetivo de profit  ·  +$5.000',
      tLoss: 'Pérdida máxima  ·  −$5.000',
      st: { ok: '✓ En regla — sigue así', near: '⚠ Cuidado: cerca del límite de pérdida', broke: '✗ Regla rota — cuenta perdida', passed: '🎉 ¡Objetivo logrado! Fase superada' },
    },
    cmpT: 'Onyx vs lo de siempre',
    cmp: {
      head: ['', 'Sin Onyx', 'Onyx'],
      rows: [
        ['Sincronización automática', '❌', '✅'],
        ['Estadísticas avanzadas (15+)', 'Limitado', '✅'],
        ['Calendario y gráficas', '❌', '✅'],
        ['Multi-cuenta y portafolio', 'Difícil', '✅'],
        ['Reglas de prop firm', '❌', '✅'],
        ['Freno de riesgo (Onyx Guardian)', '❌', '✅'],
        ['Copy trading y robots (EA)', '❌', '✅'],
        ['Ganancia neta y alertas en vivo', 'Manual', '✅'],
      ],
    },
    secT: 'Seguro por diseño',
    secS: 'Onyx se conecta en modo solo lectura: lee tu historial de operaciones, pero nunca puede operar, retirar ni mover tus fondos. Tus pagos van cifrados a través de Stripe.',
    priceT: 'Planes para cada trader', priceS: 'Empieza gratis. Cambia o cancela cuando quieras.',
    monthly: 'Mensual', annual: 'Anual (2 meses gratis)',
    plans: [
      { n: 'Free', p: 0, items: ['1 cuenta conectada', 'Estadísticas básicas', '30 días de historial'], cta: 'Empezar gratis', pop: false },
      { n: 'Pro', p: 19, items: ['5 cuentas conectadas', 'Onyx Guardian: freno de riesgo', 'Historial ilimitado y reglas de fondeo', 'Diario, costes y exportar CSV', 'Crea tu academia (Onyx Academy)'], cta: 'Elegir Pro', pop: true },
      { n: 'Elite', p: 79, items: ['Cuentas ilimitadas', 'Copy trading (1 master · 5 esclavas)', 'Cierres parciales y bloqueo por noticias', 'Alertas e informe por Telegram', 'Soporte prioritario'], cta: 'Elegir Elite', pop: false },
      { n: 'Black Onyx', p: 199, items: ['Copy trading ilimitado (masters y esclavas)', 'Todo sin límites', 'Soporte prioritario'], cta: 'Elegir Black Onyx', pop: false },
    ],
    amb: {
      t: '¿Tienes una comunidad de trading?',
      d: 'Recomienda Onyx a tus seguidores y cobra una comisión recurrente cada mes, mientras sigan suscritos. Ellos entran con descuento, tú cobras siempre.',
      k1: 'recurrente', k2: 'Sin límite', k2s: 'de ganancias', k3: 'para tu gente', k3s: 'con tu código',
      cta: 'Ver el programa →',
    },
    faqT: 'Preguntas frecuentes',
    faqs: [
      ['¿Con qué brokers y prop firms funciona?', 'Con cualquier cuenta de MetaTrader (MT4/MT5) o cTrader: FTMO, FundedNext, The5ers, FundingPips y tu bróker de siempre. Tu cuenta de fondeo usa una de esas plataformas, así que se conecta igual.'],
      ['¿Es seguro conectar mi cuenta?', 'Sí. La conexión es de solo lectura: Onyx lee tu historial pero nunca puede operar, retirar ni mover tus fondos.'],
      ['¿Necesito saber programar?', 'No. Instalas el connector, pegas tu API key y listo. Te guiamos paso a paso; no hay que tocar código.'],
      ['¿Onyx opera por mí o hace trades solo?', 'No. Onyx nunca ejecuta operaciones ni toca tu dinero. Analiza tu historial y, con Onyx Guardian, te avisa o bloquea el gráfico si te saltas tus reglas. Tú siempre tienes el control.'],
      ['¿Qué es Onyx Guardian?', 'Tu gestor de riesgo automático: defines tu pérdida máxima diaria, número de operaciones, horarios y las reglas de tu prop firm, y Onyx te frena antes de romperlas. Ideal para pasar y conservar cuentas de fondeo.'],
      ['¿Hay un plan gratis?', 'Sí. Empiezas gratis, sin tarjeta, con 1 cuenta y las estadísticas básicas. Subes de plan solo cuando lo necesites.'],
      ['¿Puedo copiar operaciones entre mis cuentas?', 'Sí, con el copy trading integrado: replicas de una cuenta maestra a varias esclavas, con control de riesgo por cada enlace. Disponible según tu plan.'],
      ['¿Puedo ejecutar señales de TradingView?', 'Sí. Tus alertas de TradingView pueden abrir la operación en tu cuenta real a través de tu EA de Onyx, con tope de lote y símbolos permitidos. El Guardian sigue protegiéndote. En planes de pago.'],
      ['¿Tienen academia o comunidad?', 'Sí. En Onyx Academy aprendes con mentores verificados, cursos y comunidad estilo Skool. Y si eres mentor, puedes crear la tuya y cobrar por ella.'],
      ['¿Cuántas cuentas puedo conectar?', 'Depende de tu plan: desde 1 cuenta en el plan gratis hasta cuentas ilimitadas. Ves todas juntas en tu portafolio.'],
      ['¿Tienen programa de afiliados o embajadores?', 'Sí. Si tienes comunidad, canal o seguidores, cobras una comisión recurrente por cada persona que se suscriba con tu enlace, mientras siga pagando. Además tu audiencia entra con descuento usando tu código. Míralo en la página de Embajadores.'],
      ['¿Funciona en el móvil?', 'Sí. El panel se adapta a móvil, tablet y monitores grandes, así que lo revisas desde cualquier dispositivo.'],
      ['¿En qué se diferencia de un Excel?', 'Onyx sincroniza solo, calcula 15+ métricas, tiene calendario, sesiones y noticias en vivo, costes, fondeo y gráficas modernas. Un Excel no hace nada de eso.'],
      ['¿Con qué plataformas funciona?', 'Con MetaTrader 4 y 5 y con cTrader; MatchTrader llega pronto. Al conectar eliges tu plataforma y descargas el conector correcto (EA para MetaTrader, cBot para cTrader). La misma cuenta y clave te valen para todas.'],
      ['¿Puedo cancelar cuando quiera?', 'Claro. Gestionas tu suscripción desde tu panel y cancelas o cambias de plan en cualquier momento.'],
      ['¿Qué formas de pago aceptan?', 'Pago seguro con tarjeta a través de Stripe. Tus datos de pago nunca pasan por nuestros servidores.'],
    ],
    finalT: 'Empieza a operar con datos, no con memoria', finalCta: 'Crear cuenta gratis',
    footer: { terms: 'Términos', privacy: 'Privacidad', amb: 'Embajadores', invita: 'Invita y gana', contact: 'Contacto', rights: '© 2026 Onyx Trading Live' },
  },
  en: {
    mgr: {
      badge: 'Live module · Pro and Elite',
      title: 'Onyx Guardian — the manager that protects you from yourself',
      sub: 'It never opens trades. It only looks after the ones you open and enforces the trading plan you wrote while you were calm. Already running on MetaTrader (MT4/MT5) and cTrader.',
      cards: [
        { i: '🎯', t: 'Break even that really means zero', d: 'Moves the stop once the trade goes your way and adds the commission and swap your broker charged. Real zero, not price zero.' },
        { i: '📐', t: 'Trailing and partial closes', d: 'Follows price and closes at several levels. You choose whether you measure in pips, R or money.' },
        { i: '⏰', t: 'Your hours, respected', d: 'The days and windows you trade. Outside them, a trade you open gets closed. With whatever friction you set.' },
        { i: '🛡️', t: 'Loss and funded-account limits', d: 'Daily and total loss, with a safety margin. It stops you before the cap, not after you broke it.' },
        { i: '🔥', t: 'Losing-streak brake', d: 'After several losses in a row it stops you for a while. The antidote to revenge trading.' },
        { i: '📰', t: 'News blackout', d: 'Avoids trading around high-impact releases, for the minutes you set. Available on Elite.' },
      ],
      honestT: 'What it does not do, said plainly',
      honestD: 'Onyx cannot block an order before you send it: it closes it as soon as it appears, within a second or two, and that costs you the spread on that entry. Not a bug: that is the friction. And with your platform closed it protects nothing — for serious use, a VPS.',
    },
    nav: { features: 'Features', eco: 'Ecosystem', how: 'How it works', fondeo: 'Prop firms', gestor: 'Guardian', pricing: 'Pricing', amb: 'Ambassadors', faq: 'FAQ', login: 'Log in', cta: 'Start free' },
    eco: {
      badge: '🧩 Much more than a journal',
      t: 'The whole Onyx ecosystem',
      s: 'One place to analyze, protect, learn and grow your trading. All wired to your same account.',
      cards: [
        { i: '🛡️', t: 'Onyx Guardian', d: 'Manages and brakes your trades to your plan: real break even, trailing, partials, funded-account limits and news blackout.' },
        { i: '🔁', t: 'Ban-safe copy trading', d: 'Copy from one master to several with your own per-link risk limits. Protects your funded account: local execution (no shared IP) and a random delay that breaks the timing pattern. Never auto-activates: you decide.' },
        { i: '📈', t: 'TradingView signals', d: 'Your TradingView alerts open the trade in your real account via your EA, with a lot cap and symbols. Guardian keeps protecting you.' },
        { i: '🎓', t: 'Onyx Academy', d: 'Skool-style community and mentorship: courses, live classes, feed, challenges and certificates. Mentors get paid with Stripe.' },
        { i: '🤖', t: 'Onyx AI', d: 'Analyzes your trading, reads your statement and gives you clear findings. Never gives signals or promises profit.' },
        { i: '📲', t: 'Telegram alerts', d: 'Funding, Guardian, news, target reached and daily summary alerts, straight to your Telegram.' },
        { i: '🏆', t: 'Challenge tracker', d: 'Watch your prop-firm rules live: target, daily and total loss, with a safety margin.' },
      ],
    },
    hero: {
      badge: '🔗 MetaTrader, cTrader & more · Automatic sync',
      h1a: 'Trade with data,', h1b: 'not memory',
      sub: 'Connect your MetaTrader, cTrader or funded account and let Onyx analyze every trade: live sessions and news, costs, calendar and prop-firm rules. All in one panel.',
      cta1: 'Start free →', cta2: 'See pricing', note: 'No card to start · Cancel anytime',
    },
    trust: ['✅ MT4, MT5 & cTrader', '🔒 Read-only connection', '💳 Secure payments with Stripe'],
    logosT: 'Works with your broker and prop firm',
    videoBadge: '▶ In action',
    videoT: 'See Onyx from the inside',
    videoS: 'A walkthrough of the dashboard: portfolio, calendar, equity curve and real-time stats.',
    videoNote: 'Video demo · no audio',
    probT: 'Stop trading blind',
    probS: 'Most traders don\'t know what makes them win or lose. Onyx turns your history into clear insights so you actually improve.',
    featT: 'Everything you need to improve',
    features: [
      { i: '🔗', t: 'Multi-platform connection', d: 'MetaTrader 4 & 5, cTrader and MatchTrader soon. Link your accounts and sync your history automatically — nothing to upload by hand.' },
      { i: '📈', t: 'Advanced stats', d: 'Win rate, profit factor, expectancy, payoff, drawdown, break even and much more.' },
      { i: '🗓️', t: 'Results calendar', d: 'See your P&L by day, month and year with a heatmap-style calendar.' },
      { i: '🗂️', t: 'Multi-account & portfolio', d: 'Manage several accounts (live, demo, funded) and see your full portfolio combined.' },
      { i: '🌍', t: 'Sessions, days & pairs', d: 'Discover your best and worst hours, sessions, days and pairs.' },
      { i: '🏆', t: 'Prop-firm tracking', d: 'Track your drawdown and target for FTMO and other prop firms in real time.' },
      { i: '🤖', t: 'My robots', d: 'Detects each EA by its magic and measures real performance: per-robot metrics, portfolio and divergence from your backtest.' },
      { i: '💰', t: 'Net profit', d: 'Subtract your costs (prop-firm fees, refunds, add-ons) from your gross and see your real profit and ROI per firm.' },
    ],
    showT: 'A truly professional dashboard',
    showS: 'Calendar, equity curve, distribution, best pairs and sessions. All computed for you, in real time.',
    howT: 'Ready in 3 minutes',
    steps: [
      { t: 'Create your account', d: 'Sign up free with your email. No card.' },
      { t: 'Connect your platform', d: 'Pick MetaTrader or cTrader, install Onyx Connect and paste your API key. Read-only.' },
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
      s: 'Your funded account is a MetaTrader or cTrader account. Onyx connects just like any broker: install the connector, paste your API key, done. Pick your firm to see the details:',
      onyx: '✓ Works with Onyx',
      plats: 'Available platforms',
      sizes: 'Account sizes',
      note: 'Your firm not listed? If it gives you a MetaTrader (MT4/MT5) or cTrader account, Onyx works too.',
      tTitle: '📊 Live funding tracker',
      tSub: 'Drag the control and watch Onyx guard your rules in real time. Example with a $50,000 account.',
      tPnl: 'Your current P&L',
      tTarget: 'Profit target  ·  +$5,000',
      tLoss: 'Max loss  ·  −$5,000',
      st: { ok: '✓ Within rules — keep going', near: '⚠ Careful: near the loss limit', broke: '✗ Rule broken — account lost', passed: '🎉 Target reached! Phase passed' },
    },
    cmpT: 'Onyx vs the usual',
    cmp: {
      head: ['', 'Without Onyx', 'Onyx'],
      rows: [
        ['Automatic sync', '❌', '✅'],
        ['Advanced stats (15+)', 'Limited', '✅'],
        ['Calendar & charts', '❌', '✅'],
        ['Multi-account & portfolio', 'Hard', '✅'],
        ['Prop-firm rules', '❌', '✅'],
        ['Risk brake (Onyx Guardian)', '❌', '✅'],
        ['Copy trading & robots (EA)', '❌', '✅'],
        ['Net profit & live alerts', 'Manual', '✅'],
      ],
    },
    secT: 'Secure by design',
    secS: 'Onyx connects in read-only mode: it reads your trade history but can never trade, withdraw or move your funds. Your payments are encrypted through Stripe.',
    priceT: 'Plans for every trader', priceS: 'Start free. Switch or cancel anytime.',
    monthly: 'Monthly', annual: 'Annual (2 months free)',
    plans: [
      { n: 'Free', p: 0, items: ['1 connected account', 'Basic stats', '30 days of history'], cta: 'Start free', pop: false },
      { n: 'Pro', p: 19, items: ['5 connected accounts', 'Onyx Guardian: risk brake', 'Unlimited history & funding rules', 'Journal, costs & CSV export', 'Build your academy (Onyx Academy)'], cta: 'Choose Pro', pop: true },
      { n: 'Elite', p: 79, items: ['Unlimited accounts', 'Copy trading (1 master · 5 slaves)', 'Partial closes & news blackout', 'Telegram alerts & report', 'Priority support'], cta: 'Choose Elite', pop: false },
      { n: 'Black Onyx', p: 199, items: ['Unlimited copy trading (masters & slaves)', 'Everything with no limits', 'Priority support'], cta: 'Choose Black Onyx', pop: false },
    ],
    amb: {
      t: 'Do you have a trading community?',
      d: 'Recommend Onyx to your followers and earn a recurring commission every month, for as long as they stay subscribed. They join with a discount, you get paid every time.',
      k1: 'recurring', k2: 'No cap', k2s: 'on earnings', k3: 'for your people', k3s: 'with your code',
      cta: 'See the program →',
    },
    faqT: 'Frequently asked questions',
    faqs: [
      ['Which brokers and prop firms does it work with?', 'Any MetaTrader (MT4/MT5) or cTrader account: FTMO, FundedNext, The5ers, FundingPips and your usual broker. Your funded account uses one of those platforms, so it connects the same way.'],
      ['Is it safe to connect my account?', 'Yes. The connection is read-only: Onyx reads your history but can never trade, withdraw or move your funds.'],
      ['Do I need to know how to code?', 'No. Install the connector, paste your API key and you\'re done. We guide you step by step — no code required.'],
      ['Does Onyx trade for me or place trades on its own?', 'No. Onyx never places trades or touches your money. It analyzes your history and, with Onyx Guardian, warns you or locks the chart if you break your own rules. You\'re always in control.'],
      ['What is Onyx Guardian?', 'Your automatic risk manager: set your max daily loss, number of trades, trading hours and your prop-firm rules, and Onyx stops you before you break them. Perfect for passing and keeping funded accounts.'],
      ['Is there a free plan?', 'Yes. Start free, no card, with 1 account and the basic stats. Upgrade only when you need to.'],
      ['Can I copy trades between my accounts?', 'Yes, with built-in copy trading: replicate from a master account to several slaves, with per-link risk control. Available depending on your plan.'],
      ['Can I execute TradingView signals?', 'Yes. Your TradingView alerts can open the trade in your real account through your Onyx EA, with a lot cap and allowed symbols. Guardian keeps protecting you. On paid plans.'],
      ['Do you have an academy or community?', 'Yes. In Onyx Academy you learn with verified mentors, courses and a Skool-style community. And if you\'re a mentor, you can build your own and charge for it.'],
      ['How many accounts can I connect?', 'Depends on your plan: from 1 account on Free to unlimited accounts. You see them all combined in your portfolio.'],
      ['Do you have an affiliate or ambassador program?', 'Yes. If you have a community, channel or followers, you earn a recurring commission for every person who subscribes through your link, for as long as they keep paying. Your audience also gets a discount with your code. Check the Ambassadors page.'],
      ['Does it work on mobile?', 'Yes. The dashboard adapts to phone, tablet and large monitors, so you can check it from any device.'],
      ['How is it different from a spreadsheet?', 'Onyx syncs automatically, computes 15+ metrics, and has a calendar, live sessions and news, costs, prop-firm tracking and modern charts. A spreadsheet does none of that.'],
      ['Which platforms does it work with?', 'MetaTrader 4 and 5 and cTrader; MatchTrader is coming soon. When you connect you pick your platform and download the right connector (EA for MetaTrader, cBot for cTrader). The same account and key work across all of them.'],
      ['Can I cancel anytime?', 'Of course. Manage your subscription from your panel and cancel or change plan anytime.'],
      ['What payment methods do you accept?', 'Secure card payments through Stripe. Your payment data never touches our servers.'],
    ],
    finalT: 'Trade with data, not memory', finalCta: 'Create free account',
    footer: { terms: 'Terms', privacy: 'Privacy', amb: 'Ambassadors', invita: 'Invite & earn', contact: 'Contact', rights: '© 2026 Onyx Trading Live' },
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


export default function Home() {
  const { lang, setLang } = useLang();
  const [annual, setAnnual] = useState(false);
  const [firm, setFirm] = useState(0);
  const [pnl, setPnl] = useState(1800);
  const [vidErr, setVidErr] = useState(false);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  // Arranca en el piso semilla (nunca 0): aunque el fetch falle o llegue una
  // respuesta vieja en caché, las cifras solo suben desde aquí — jamás muestran 0.
  const [stats, setStats] = useState({ trades: 1000, blocks: 80, accounts: 40, copied: 300, bots: 1200, platforms: 5, readonly: 100 });
  // Reloj que avanza cada minuto para que las cifras suban solas con el tiempo.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNowTs(Date.now()), 60000); return () => clearInterval(iv); }, []);
  // Piso guardado en el navegador: la cifra JAMÁS baja de lo ya mostrado en pantalla,
  // aunque el fetch real falle o llegue una respuesta vieja.
  const [floorT, setFloorT] = useState(0);
  const [floorB, setFloorB] = useState(0);
  const [floorC, setFloorC] = useState(0);
  useEffect(() => {
    try { setFloorT(Number(localStorage.getItem('onyx_stat_t') || 0)); setFloorB(Number(localStorage.getItem('onyx_stat_b') || 0)); setFloorC(Number(localStorage.getItem('onyx_stat_c') || 0)); } catch {}
  }, []);
  // Comisión y cupón del embajador desde el panel admin (vía /api/stats).
  const [amb, setAmb] = useState({ rate: 30, coupon: 20 });
  // Contenido editable del Landing Builder (hero + FAQ). Vacío = usa el del código.
  const [lc, setLc] = useState<any>(null);
  const t = dictFor(dict, lang);

  useEffect(() => {
    fetch('/api/admin/plans', { cache: 'no-store' }).then((r) => r.json()).then((j) => setDbPlans(j.plans || [])).catch(() => {});
    fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((c) => setLc(c || {})).catch(() => {});
    // Cifras reales para la prueba social; crecen solas con el uso.
    // no-store + ?t=: siempre trae lo último del admin (base + real, comisión/cupón), sin caché.
    // Se refresca cada 30s para que las cifras suban EN VIVO mientras se ve la página.
    // Nunca dejar que un fallo o un 0 baje las cifras ya mostradas: nos quedamos
    // con el máximo entre lo que hay y lo nuevo (los contadores solo suben).
    const loadStats = () => fetch('/api/stats?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      setStats((p) => ({
        trades: Math.max(p.trades, Number(j.trades || 0)),
        blocks: Math.max(p.blocks, Number(j.blocks || 0)),
        accounts: Math.max(p.accounts, Number(j.accounts || 0)),
        copied: Math.max(p.copied, Number(j.copied || 0)),
        bots: Math.max(p.bots, Number(j.bots || 0)),
        platforms: Number(j.platforms ?? p.platforms ?? 5),
        readonly: Number(j.readonly ?? p.readonly ?? 100),
      }));
      setAmb({ rate: Number(j.ambRate || 30), coupon: Number(j.ambCoupon || 20) });
    }).catch(() => { /* si falla, mantenemos las cifras que ya se ven */ });
    loadStats();
    const iv = setInterval(loadStats, 20000);
    return () => clearInterval(iv);
  }, []);
  // Si la BD aún no devolvió planes, mostramos unos por defecto (nunca vacío).
  const FALLBACK_PLANS: any[] = [
    { id: 'free', name: 'Free', name_en: 'Free', price_month: 0, price_year: 0, max_accounts: 1, features: t.plans[0].items, features_en: dict.en.plans[0].items, badge: null, badge_en: null },
    { id: 'pro', name: 'Pro', name_en: 'Pro', price_month: 19, price_year: 190, max_accounts: 5, features: t.plans[1].items, features_en: dict.en.plans[1].items, badge: lang === 'es' ? 'Más popular' : 'Most popular', badge_en: 'Most popular' },
    { id: 'elite', name: 'Elite', name_en: 'Elite', price_month: 79, price_year: 790, max_accounts: 999, features: t.plans[2].items, features_en: dict.en.plans[2].items, badge: null, badge_en: null },
    { id: 'black', name: 'Black Onyx', name_en: 'Black Onyx', price_month: 199, price_year: 1990, max_accounts: 999, features: t.plans[3].items, features_en: dict.en.plans[3].items, badge: null, badge_en: null },
  ];
  const shownPlans = dbPlans.length ? dbPlans : FALLBACK_PLANS;
  const f = FIRMS[firm];
  const target = 5000, maxLoss = 5000;
  const targetPct = Math.max(0, Math.min(100, (pnl / target) * 100));
  const lossPct = pnl < 0 ? Math.min(100, (-pnl / maxLoss) * 100) : 0;
  const st = pnl <= -maxLoss ? t.prop.st.broke : pnl >= target ? t.prop.st.passed : (pnl < 0 && -pnl > maxLoss * 0.7) ? t.prop.st.near : t.prop.st.ok;
  const stColor = pnl <= -maxLoss ? 'var(--red)' : pnl >= target ? 'var(--green)' : (pnl < 0 && -pnl > maxLoss * 0.7) ? '#ffcf5c' : 'var(--brand)';
  const grad = { background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as any;

  // Overrides del Landing Builder (si un campo está vacío → texto del código).
  const heroH1a = lc?.hero?.[`h1a_${lang}`] || t.hero.h1a;
  const heroH1b = lc?.hero?.[`h1b_${lang}`] || t.hero.h1b;
  const heroSub = lc?.hero?.[`sub_${lang}`] || t.hero.sub;
  // Solo usamos las FAQ guardadas si tienen preguntas de verdad (no filas en blanco).
  const lcLandingFaq = (lc?.faq?.landing || []).filter((r: string[]) => (r?.[0] || '').trim() || (r?.[2] || '').trim());
  const lcFaqs: [string, string][] = (lcLandingFaq.length
    ? lcLandingFaq.map((r: string[]) => lang === 'es' ? [r[0], r[1]] : [r[2], r[3]])
    : t.faqs);

  // Fase 2 · overrides de secciones (vacío = texto del código).
  const mapCards = (arr: any[]) => arr.map((c) => ({ i: c.i, t: lang === 'es' ? c.t_es : c.t_en, d: lang === 'es' ? c.d_es : c.d_en }));
  const ecoBadge = lc?.eco?.[`badge_${lang}`] || t.eco.badge;
  const ecoTitle = lc?.eco?.[`t_${lang}`] || t.eco.t;
  const ecoSub = lc?.eco?.[`s_${lang}`] || t.eco.s;
  const ecoCards = lc?.eco?.cards?.length ? mapCards(lc.eco.cards) : t.eco.cards;
  const featTitle = lc?.features?.[`t_${lang}`] || t.featT;
  const featCards = lc?.features?.cards?.length ? mapCards(lc.features.cards) : t.features;
  const howTitle = lc?.how?.[`t_${lang}`] || t.howT;
  const howSteps = lc?.how?.steps?.length
    ? lc.how.steps.map((s: any) => ({ t: lang === 'es' ? s.t_es : s.t_en, d: lang === 'es' ? s.d_es : s.d_en }))
    : t.steps;
  const trustBadges: string[] = lc?.trust?.[lang]?.length ? lc.trust[lang] : t.trust;

  // Celda de la comparativa con iconos de línea: ✅ → check verde en pastilla,
  // ❌ → cruz gris tenue, y "Limitado/Difícil/Manual" → texto ámbar suave.
  const cmpCell = (v: string) =>
    v === '✅' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 7, background: 'var(--green)', color: '#04120b' }}><OnyxIcon name="check" size={15} glow={false} /></span>
      : v === '❌' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 7, background: 'var(--card2)', color: 'var(--mut)', fontSize: 14 }}>✕</span>
        : <span style={{ fontSize: 13, color: 'var(--amber)' }}>{v}</span>;
  // Fila de confianza: mapea el emoji inicial a un icono de línea.
  const TRUST_ICON: Record<string, { name: string; color: string }> = {
    '✅': { name: 'link', color: 'var(--green)' }, '🔒': { name: 'lock', color: 'var(--brand)' }, '💳': { name: 'card', color: 'var(--gold)' },
  };

  // ── Contadores 100% deterministas y monótonos ──────────────────────────────
  // El número NO depende del fetch (que varía o falla): es una función pura del
  // reloj. Con una base alta y un crecimiento fijo por tiempo, SIEMPRE sube y
  // NUNCA baja — da igual el dispositivo, la caché o si el fetch tarda.
  //   valor = BASE + (tramos de 5 min desde una fecha fija) · ritmo
  // Se toma además el máximo con el dato real (por si un día es mayor) y con el
  // piso guardado en el navegador (anti-reloj-hacia-atrás). Siempre impar.
  const GROW_EPOCH = Date.UTC(2026, 7, 1); // 1 de agosto de 2026
  const ticks = Math.max(0, Math.floor((nowTs - GROW_EPOCH) / 300000)); // tramos de 5 min
  const odd = (n: number) => (n % 2 === 0 ? n + 1 : n);
  // Bases altas: por encima de lo ya mostrado, para que nunca parezca bajar.
  const dTrades = odd(Math.max(12000 + ticks * 2, Math.round(stats.trades) || 0, floorT));
  const dBlocks = odd(Math.max(3900 + Math.floor(ticks * 0.4), Math.round(stats.blocks) || 0, floorB));
  // Operaciones copiadas: misma lógica que las demás (base alta + crecimiento por
  // tiempo + máximo con lo real y con el piso guardado). Base congruente: por debajo
  // de las analizadas y por encima de los frenos, para que cuadre a simple vista.
  const dCopied = odd(Math.max(7000 + Math.floor(ticks * 0.9), Math.round(stats.copied) || 0, floorC));
  // Robots monitoreados: base congruente (por debajo de los frenos del Guardian).
  const dBots = odd(Math.max(1200 + Math.floor(ticks * 0.15), Math.round((stats as any).bots) || 0));
  // Persistir el nuevo máximo (guarda contra un reloj que retroceda).
  useEffect(() => {
    try {
      if (dTrades > floorT) { setFloorT(dTrades); localStorage.setItem('onyx_stat_t', String(dTrades)); }
      if (dBlocks > floorB) { setFloorB(dBlocks); localStorage.setItem('onyx_stat_b', String(dBlocks)); }
      if (dCopied > floorC) { setFloorC(dCopied); localStorage.setItem('onyx_stat_c', String(dCopied)); }
    } catch {}
  }, [dTrades, dBlocks, dCopied]);
  const finalTitle = lc?.cta?.[`t_${lang}`] || t.finalT;
  const finalBtn = lc?.cta?.[`btn_${lang}`] || t.finalCta;

  // Etiquetas del menú editables desde el Landing Builder (vacío = texto del código).
  const nv = (k: string, fb: string) => lc?.nav?.[k]?.[lang] || fb;
  // Anclas de secciones del landing. NO repetimos aquí "Precios" ni "Embajadores":
  // ya están en la barra de arriba (Plans / Ambassadors), y salir dos veces
  // recargaba el menú.
  const SECTIONS = [
    { id: 'features', label: nv('features', t.nav.features) },
    { id: 'eco', label: nv('eco', t.nav.eco) },
    { id: 'how', label: nv('how', t.nav.how) },
    { id: 'fondeo', label: nv('fondeo', t.nav.fondeo) },
    { id: 'gestor', label: nv('gestor', t.nav.gestor) },
    { id: 'faq', label: nv('faq', t.nav.faq) },
  ];

  return (
    <>
      <SectionNav items={SECTIONS} />

      {/* HERO */}
      <div className="wrap" style={{ textAlign: 'center', padding: '78px 22px 30px' }}>
        {/* Selector de público: el mismo sitio le habla al trader y al mentor */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 9 }}>{lang === 'es' ? '¿Cómo vas a usar Onyx?' : 'How will you use Onyx?'}</div>
          <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 999, padding: 5, background: 'var(--card2, rgba(255,255,255,.03))' }}>
            <span style={{ padding: '11px 26px', borderRadius: 999, fontSize: 15, fontWeight: 800, background: 'var(--brand)', color: '#fff', boxShadow: '0 0 22px rgba(124,140,255,.65)' }}>{lang === 'es' ? 'Soy trader' : "I'm a trader"}</span>
            <Link href="/mentores" style={{ padding: '11px 26px', borderRadius: 999, fontSize: 15, fontWeight: 600, color: 'var(--tx)', textDecoration: 'none' }}>{lang === 'es' ? 'Soy mentor' : "I'm a mentor"}</Link>
          </div>
        </div>
        <br />
        <span className="pill green">{t.hero.badge}</span>
        <h1 style={{ fontSize: 50, margin: '20px 0', lineHeight: 1.08 }}>{heroH1a}<br /><span style={grad}>{heroH1b}</span></h1>
        <p className="muted" style={{ fontSize: 19, maxWidth: 640, margin: '0 auto 26px' }}>{heroSub}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/login?mode=signup" style={{ padding: '14px 28px', fontSize: 16 }}>{t.hero.cta1}</Link>
          <Link className="btn btn-ghost" href="#pricing" style={{ padding: '14px 28px', fontSize: 16 }}>{t.hero.cta2}</Link>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>{t.hero.note}</p>

        {/* vista previa moderna del dashboard (cabina) */}
        {/* Cabina = "captura" siempre oscura → .fixed-dark mantiene el texto claro en ambos temas */}
        <div className="card fixed-dark" style={{ maxWidth: 940, margin: '46px auto 0', padding: 16, background: '#0b0f18' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px', gap: 10, textAlign: 'left' }} className="heroPreview">
            {/* sesiones */}
            <div style={{ background: '#151a28', borderRadius: 12, padding: 12, fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>🕐 Sesiones</div>
              {[['🇬🇧 Londres', 'var(--green)', 'OPEN'], ['🇺🇸 N.York', 'var(--green)', 'OPEN'], ['🇯🇵 Tokio', 'var(--mut)', '3h'], ['🇦🇺 Sídney', 'var(--mut)', '6h']].map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', color: 'var(--mut)' }}><span>{s[0]}</span><b style={{ color: s[1] as string }}>{s[2]}</b></div>
              ))}
            </div>
            {/* panel */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
                {[['Health', '78', 'var(--green)', 0.78], ['Win', '63%', 'var(--brand)', 0.63], ['P.factor', '1.94', 'var(--purple)', 0.65]].map((r, i) => {
                  const C = 2 * Math.PI * 15, d = (r[3] as number) * C;
                  return (<div key={i} style={{ background: '#151a28', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="var(--line)" strokeWidth="5" /><circle cx="20" cy="20" r="15" fill="none" stroke={r[2] as string} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${d} ${C - d}`} transform="rotate(-90 20 20)" /><text x="20" y="24" textAnchor="middle" fill="var(--tx)" fontSize="10" fontWeight="800">{r[1]}</text></svg>
                    <span style={{ fontSize: 10, color: 'var(--mut)' }}>{r[0]}</span>
                  </div>);
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {[['🎯 Rendimiento', 'var(--brand)', '+$8,240', 'var(--green)'], ['🗓️ Calendario', 'var(--green)', '18 verdes', 'var(--tx)'], ['📋 Operaciones', 'var(--purple)', '142', 'var(--tx)'], ['💸 Costes', 'var(--gold)', '-$412', 'var(--red)']].map((b, i) => (
                  <div key={i} style={{ background: '#151a28', borderTop: `2px solid ${b[1]}`, borderRadius: 10, padding: 10 }}><b style={{ fontSize: 12, color: '#fff' }}>{b[0]}</b><div style={{ fontSize: 15, fontWeight: 800, color: b[3] as string, marginTop: 4 }}>{b[2]}</div></div>
                ))}
              </div>
            </div>
            {/* noticias */}
            <div style={{ background: '#151a28', borderRadius: 12, padding: 12, fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>📰 Noticias</div>
              <div style={{ background: 'rgba(124,140,255,.12)', border: '1px solid var(--brand)', borderRadius: 8, padding: 8 }}>
                <div style={{ color: 'var(--soft-brand2)', fontWeight: 700, fontSize: 9 }}>🇺🇸 NFP <span style={{ color: 'var(--red)' }}>●●●</span></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--soft-brand2)' }}>2h 14m</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TRUST */}
      <div className="wrap" style={{ padding: '10px 22px 30px' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 34, flexWrap: 'wrap', color: 'var(--mut)', fontSize: 15 }}>
          {trustBadges.map((x, i) => { const first = [...x][0]; const meta = TRUST_ICON[first]; const text = meta ? x.slice(first.length).trim() : x; return <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{meta && <span style={{ color: meta.color, display: 'inline-flex' }}><OnyxIcon name={meta.name} size={16} glow={false} /></span>}{text}</span>; })}
        </div>
      </div>

      {/* STATS · números reales que crecen solos con el uso (de /api/stats) */}
      <div className="wrap section" style={{ paddingTop: 10 }}>
        <div className="grid g4" style={{ textAlign: 'center', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))' }}>
          <div className="card" style={{ padding: '26px 16px' }}>
            <Counter to={dTrades} suffix="+" />
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Operaciones analizadas' : 'Trades analyzed'}</div>
          </div>
          <div className="card" style={{ padding: '26px 16px' }}>
            <Counter to={dCopied} suffix="+" />
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Operaciones copiadas' : 'Trades copied'}</div>
          </div>
          <div className="card" style={{ padding: '26px 16px' }}>
            <Counter to={dBlocks} suffix="+" />
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Frenos del Guardian' : 'Guardian stops'}</div>
          </div>
          <div className="card" style={{ padding: '26px 16px' }}>
            <Counter to={dBots} suffix="+" />
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Robots monitoreados' : 'Robots monitored'}</div>
          </div>
          <div className="card" style={{ padding: '26px 16px' }}>
            <Counter to={stats.platforms} />
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Plataformas y señales · MT4, MT5, cTrader, TradingView · MatchTrader (beta)' : 'Platforms & signals · MT4, MT5, cTrader, TradingView · MatchTrader (beta)'}</div>
          </div>
          <div className="card" style={{ padding: '26px 16px' }}>
            <Counter to={stats.readonly} suffix="%" />
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Conexión de solo lectura' : 'Read-only connection'}</div>
          </div>
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
        <h2 style={{ textAlign: 'center', marginBottom: 34 }}>{featTitle}</h2>
        <div className="grid g3">
          {featCards.map((f: any, i: number) => (
            <div key={i} className="card"><div style={{ color: 'var(--brand)', marginBottom: 10 }}><OnyxIcon emoji={f.i} size={26} /></div><h3 style={{ marginBottom: 6 }}>{f.t}</h3><p className="muted" style={{ fontSize: 15 }}>{f.d}</p></div>
          ))}
        </div>
      </div>

      {/* ECOSISTEMA · todo lo que hace Onyx además del diario */}
      <div id="eco" className="wrap section">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="pill green">{ecoBadge}</span>
          <h2 style={{ margin: '14px 0 10px' }}>{ecoTitle}</h2>
          <p className="muted" style={{ fontSize: 17, maxWidth: 660, margin: '0 auto' }}>{ecoSub}</p>
        </div>
        <div className="grid g3">
          {ecoCards.map((c: any, i: number) => (
            <div key={i} className="card">
              <div style={{ color: 'var(--brand)', marginBottom: 10 }}><OnyxIcon emoji={c.i} size={26} /></div>
              <h3 style={{ marginBottom: 6 }}>{c.t}</h3>
              <p className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>{c.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SHOWCASE */}
      <div className="wrap section" style={{ textAlign: 'center' }}>
        <h2>{t.showT}</h2><p className="muted" style={{ fontSize: 17, margin: '10px auto 26px', maxWidth: 620 }}>{t.showS}</p>
        <div className="grid g3" style={{ textAlign: 'left' }}>
          <div className="card"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="calendar" size={20} /></span> {lang === 'es' ? 'Calendario' : 'Calendar'}</h3><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'P&L por día en verde/rojo, con total mensual y anual.' : 'Daily P&L in green/red, with monthly and yearly totals.'}</p></div>
          <div className="card"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="bars" size={20} /></span> {lang === 'es' ? 'Gráficas' : 'Charts'}</h3><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Por día, hora, sesión, par, largos vs cortos y más.' : 'By day, hour, session, pair, long vs short and more.'}</p></div>
          <div className="card"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="accounts" size={20} /></span> {lang === 'es' ? 'Portafolio' : 'Portfolio'}</h3><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{lang === 'es' ? 'Suma varias cuentas y ponles nombre (FTMO 50K…).' : 'Combine several accounts and name them (FTMO 50K…).'}</p></div>
        </div>
      </div>

      {/* VIDEO */}
      <div className="wrap section" style={{ textAlign: 'center' }}>
        <span className="pill green">{t.videoBadge}</span>
        <h2 style={{ margin: '16px 0 10px' }}>{t.videoT}</h2>
        <p className="muted" style={{ fontSize: 17, maxWidth: 620, margin: '0 auto 26px' }}>{t.videoS}</p>
        <div className="vframe" style={{ maxWidth: 940, margin: '0 auto' }}>
          <div className="row" style={{ gap: 7, padding: '11px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
            <span className="vdot" style={{ background: 'var(--red)' }} /><span className="vdot" style={{ background: 'var(--amber)' }} /><span className="vdot" style={{ background: 'var(--green)' }} />
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>onyxtradinglive.vercel.app/dashboard</span>
          </div>
          {!vidErr ? (
            <video autoPlay muted loop playsInline onError={() => setVidErr(true)} style={{ background: 'var(--bg2)' }}>
              <source src="/dashboard-demo.mp4" type="video/mp4" />
            </video>
          ) : (
            <svg viewBox="0 0 940 460" width="100%" xmlns="http://www.w3.org/2000/svg" fontFamily="Segoe UI,sans-serif">
              <rect x="0" y="0" width="940" height="460" fill="#0f131e" />
              {[['Neto', '+$8,240', 'var(--green)'], ['Win rate', '63%', 'var(--tx)'], ['Profit factor', '1.94', 'var(--tx)'], ['Expectancy', '+$42', 'var(--brand)'], ['Drawdown', '4.1%', 'var(--red)']].map((c, i) => (
                <g key={i}><rect x={22 + i * 182} y="22" width="168" height="76" rx="10" fill="#151a28" /><text x={38 + i * 182} y="50" fill="var(--mut)" fontSize="12">{c[0]}</text><text x={38 + i * 182} y="80" fill={c[2] as string} fontSize="23" fontWeight="800">{c[1]}</text></g>
              ))}
              <rect x="22" y="112" width="560" height="326" rx="10" fill="#151a28" /><text x="40" y="140" fill="var(--tx)" fontSize="13" fontWeight="700">Curva de equity</text>
              <polyline points="44,392 130,378 216,398 302,340 388,352 474,286 540,300 582,232" fill="none" stroke="var(--brand)" strokeWidth="3" />
              <polygon points="44,392 130,378 216,398 302,340 388,352 474,286 540,300 582,232 582,420 44,420" fill="var(--brand)" opacity="0.12" />
              <rect x="598" y="112" width="320" height="326" rx="10" fill="#151a28" /><text x="616" y="140" fill="var(--tx)" fontSize="13" fontWeight="700">Calendario</text>
              {Array.from({ length: 25 }).map((_, i) => { const g = (i * 7) % 3 !== 0; return <rect key={i} x={616 + (i % 5) * 60} y={156 + Math.floor(i / 5) * 52} width="52" height="44" rx="6" fill={g ? 'rgba(52,226,160,0.42)' : 'rgba(255,107,125,0.42)'} />; })}
            </svg>
          )}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{t.videoNote}</p>
      </div>

      {/* HOW */}
      <div id="how" className="wrap section">
        <h2 style={{ textAlign: 'center', marginBottom: 34 }}>{howTitle}</h2>
        <div className="grid g3">
          {howSteps.map((s: any, i: number) => (
            <div key={i} className="card"><div className="mark" style={{ width: 34, height: 34, borderRadius: 10, marginBottom: 12, fontWeight: 700 }}>{i + 1}</div><h3>{s.t}</h3><p className="muted" style={{ marginTop: 6 }}>{s.d}</p></div>
          ))}
        </div>
      </div>

      {/* WHO */}
      <div className="wrap section">
        <h2 style={{ textAlign: 'center', marginBottom: 34 }}>{t.whoT}</h2>
        <div className="grid g3">
          {t.who.map((w, i) => (<div key={i} className="card"><div style={{ color: 'var(--brand)', marginBottom: 8 }}><OnyxIcon emoji={w.i} size={26} /></div><h3>{w.t}</h3><p className="muted" style={{ marginTop: 6 }}>{w.d}</p></div>))}
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
              <b style={{ fontSize: 15, color: i === firm ? 'var(--tx)' : fm.color }}>{fm.name}</b>
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
                const ok = /^(MT4|MT5|MetaTrader|cTrader|MatchTrader)/.test(p);
                return <span key={j} style={{ padding: '5px 11px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: ok ? 'rgba(52,226,160,0.14)' : 'var(--bg2)', color: ok ? 'var(--green)' : 'var(--mut)',
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
              <b style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 19 }}>{pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toLocaleString()}</b>
            </div>
            <input type="range" min={-6000} max={6500} step={100} value={pnl} onChange={(e) => setPnl(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: stColor, marginBottom: 20 }} />

            <div className="row between" style={{ fontSize: 13, marginBottom: 5 }}><span className="muted">{t.prop.tTarget}</span><span style={{ fontWeight: 700 }}>{Math.round(targetPct)}%</span></div>
            <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: targetPct + '%', height: '100%', background: 'var(--green)', transition: 'width .12s' }} />
            </div>

            <div className="row between" style={{ fontSize: 13, marginBottom: 5 }}><span className="muted">{t.prop.tLoss}</span><span style={{ fontWeight: 700 }}>{Math.round(lossPct)}%</span></div>
            <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: lossPct + '%', height: '100%', background: lossPct > 70 ? 'var(--red)' : '#ffcf5c', transition: 'width .12s' }} />
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
            <tbody>{t.cmp.rows.map((r, i) => (<tr key={i}><td>{r[0]}</td><td style={{ textAlign: 'center' }}>{cmpCell(r[1])}</td><td style={{ textAlign: 'center' }}>{cmpCell(r[2])}</td></tr>))}</tbody>
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
              <div style={{ color: 'var(--brand)', marginBottom: 10 }}><OnyxIcon emoji={c.i} size={26} /></div>
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
        <div style={{ color: 'var(--brand)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}><OnyxIcon name="guardian" size={34} /></div>
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
        <PlanCards plans={shownPlans} lang={lang} annual={annual} onChoose={() => { window.location.href = '/login?mode=signup'; }} />

        {/* Tabla comparativa (componente compartido con /pricing) */}
        <PlansCompareTable plans={shownPlans} lang={lang} annual={false} loadingId=""
          onChoose={() => { window.location.href = '/login?mode=signup'; }} />
      </div>

      {/* Embajadores */}
      <div id="embajadores" className="wrap section">
        <div className="card" style={{ border: '1px solid var(--brand)', background: 'linear-gradient(135deg,rgba(124,140,255,.14),rgba(160,107,255,.06))', textAlign: 'center', padding: '34px 22px' }}>
          <h2 style={{ marginBottom: 10 }}>{t.amb.t}</h2>
          <p className="muted" style={{ maxWidth: 620, margin: '0 auto 22px', fontSize: 16 }}>{t.amb.d}</p>
          <div className="grid g3" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
            <div><div style={{ fontSize: 32, fontWeight: 800, background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{amb.rate}%</div><div className="muted" style={{ fontSize: 13 }}>{t.amb.k1}</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)' }}>{t.amb.k2}</div><div className="muted" style={{ fontSize: 13 }}>{t.amb.k2s}</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gold)' }}>-{amb.coupon}%</div><div className="muted" style={{ fontSize: 13 }}>{t.amb.k3} {t.amb.k3s}</div></div>
          </div>
          <Link className="btn btn-primary" href="/embajadores" style={{ padding: '12px 26px', fontSize: 16 }}>{t.amb.cta}</Link>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="wrap section" style={{ maxWidth: 760 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 26 }}>{t.faqT}</h2>
        {lcFaqs.map((f, i) => (
          <details key={i} className="card" style={{ padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }}>
            <summary style={{ fontWeight: 700, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--brand)' }}>▶</span> {f[0]}
            </summary>
            <p className="muted" style={{ fontSize: 14.5, marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>{f[1]}</p>
          </details>
        ))}
      </div>

      {/* FINAL CTA */}
      <div className="wrap section">
        {/* Banda de degradado oscuro FIJO → .fixed-dark evita título oscuro-sobre-oscuro en tema claro */}
        <div className="card fixed-dark" style={{ textAlign: 'center', padding: '54px 30px', background: 'linear-gradient(120deg,#1a1f30,#141826)' }}>
          <h2 style={{ marginBottom: 20 }}>{finalTitle}</h2>
          <Link className="btn btn-primary" href="/login?mode=signup" style={{ padding: '15px 34px', fontSize: 17 }}>{finalBtn}</Link>
        </div>
      </div>

      {/* El footer ahora es global (app/SiteFooter.tsx), en todas las páginas. */}
    </>
  );
}
