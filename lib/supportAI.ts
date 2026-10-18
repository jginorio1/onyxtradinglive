import { dictFor, enBase, aiLangDirective } from '@/lib/i18n';
import { ARTICLES, searchArticles, type Article, type Lang } from '@/lib/guide';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { listPublished } from '@/lib/blog';
import { sendEmail } from '@/lib/mail';
import { getSetting, aiPromptSettings, addonSettings, RECO_BROKER_DEFAULT, type RecoBroker } from '@/lib/settings';
import { planFacts, trialLine } from '@/lib/planFacts';
import { botLabSettings, clampPct, listMarketplace, vpsInfo } from '@/lib/botlab';
import { academyFeeSettings } from '@/lib/settings';
import { pickActiveBar, type PromoQueue } from '@/lib/promo';
import { getRemoteConfig } from '@/lib/remoteSupport';
import { catalogKey, CATALOG_DEFAULTS, type CatalogItem } from '@/lib/catalogDefaults';

// ============================================================
// Cerebro de soporte con IA: clasifica los tickets (triage) y, cuando es
// seguro, redacta una respuesta. NUNCA responde solo temas de dinero,
// facturación, legal o cuentas: esos siempre pasan a un humano.
// ============================================================

// Temas donde JAMÁS auto-respondemos (requieren persona)
const SENSITIVE = /(pago|pagos|cobr|reembols|factur|tarjeta|refund|charge|chargeback|billing|invoice|disput|legal|abogad|retir|withdraw|kyc|estaf|scam|fraud|hack|robo|cancel)/i;

// Palabras de urgencia → prioridad alta
const URGENT = /(urgent|no funciona|not working|no me deja|error|ca[ií]d|down|perd[ií]|bloque|blocked|no puedo|can'?t|falla|broke)/i;

type Category = 'general' | 'conexion' | 'instalacion' | 'guardian' | 'facturacion';
type Priority = 'low' | 'normal' | 'high';

const CAT_RULES: Array<[Category, RegExp]> = [
  ['facturacion', /(pago|pagos|cobr|factur|reembols|refund|billing|invoice|precio|price|suscrip|subscrib|plan|tarjeta)/i],
  ['conexion', /(conect|conex|sincroniz|sync|no aparece|no reporta|api|clave|token|desconect|connect|disconnect|offline)/i],
  ['instalacion', /(instal|install|expert advisor|\bea\b|mt4|mt5|metatrader|descarg|download|\.ex[45])/i],
  ['guardian', /(guardian|regla|l[ií]mite|riesgo|risk|reto|challenge|fondeo|funded|prop\s?firm|drawdown)/i],
];

// Triage por palabras clave: instantáneo, gratis y determinista.
export function classify(text: string): { category: Category; priority: Priority; sensitive: boolean } {
  const t = (text || '').toLowerCase();
  const sensitive = SENSITIVE.test(t);
  let category: Category = 'general';
  for (const [cat, re] of CAT_RULES) { if (re.test(t)) { category = cat; break; } }
  const priority: Priority = sensitive || URGENT.test(t) ? 'high' : 'normal';
  return { category, priority, sensitive };
}

// ---- Clasificación con IA (triage inteligente) ----
// Devuelve categoría, prioridad de 4 niveles, idioma, sentimiento y un resumen de
// una línea. Usa Claude; si no hay clave o falla, cae al triage por palabras clave
// (nunca lanza). Es barata (modelo pequeño, respuesta JSON corta).
export type Priority4 = 'low' | 'normal' | 'high' | 'urgent';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'angry';
export type Triage = { category: Category; priority: Priority4; sensitive: boolean; lang: Lang; sentiment: Sentiment; summary: string };

export async function classifyAI(text: string, hintLang?: Lang): Promise<Triage> {
  const base = classify(text);
  const fallback: Triage = {
    category: base.category,
    priority: base.sensitive ? 'high' : base.priority,
    sensitive: base.sensitive,
    lang: hintLang || (enBase(hintLang || 'es') ? 'en' : 'es'),
    sentiment: /(enoj|molest|indign|estafa|fraude|verg|terrible|p[eé]simo|angry|furious|scam|awful|worst)/i.test(text || '') ? 'angry' : 'neutral',
    summary: (text || '').replace(/\s+/g, ' ').trim().slice(0, 90),
  };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !text || text.trim().length < 3) return fallback;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const sys = `You are a support triage classifier for Onyx Trading Live (a trading SaaS: broker connection, EA/cBot install, Onyx Guardian risk rules, billing/plans).
Reply with ONLY a compact JSON object, nothing else, with these exact keys:
{"category": one of ["general","conexion","instalacion","guardian","facturacion"],
 "priority": one of ["low","normal","high","urgent"],
 "sensitive": boolean (true if about money/billing/refund/chargeback/legal/withdrawal/KYC/fraud/account-blocked),
 "lang": ISO like "es","en","pt","fr","it","de",
 "sentiment": one of ["positive","neutral","negative","angry"],
 "summary": a <=90 char one-line summary in the SAME language as the message}
Rules: "urgent" only for outages/blocked/lost-money/time-critical. Billing/legal/account-specific → sensitive:true. Be strict JSON, no markdown.`;
    const body = JSON.stringify({ model, max_tokens: 200, system: sys, messages: [{ role: 'user', content: String(text).slice(0, 1500) }] });
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body });
    if (!r.ok) return fallback;
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('soporte', data)).catch(() => {});
    const raw = (data?.content || []).map((c: any) => c.text || '').join('').trim();
    const j = JSON.parse(raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim());
    const cats: Category[] = ['general', 'conexion', 'instalacion', 'guardian', 'facturacion'];
    const pris: Priority4[] = ['low', 'normal', 'high', 'urgent'];
    const sents: Sentiment[] = ['positive', 'neutral', 'negative', 'angry'];
    return {
      category: cats.includes(j.category) ? j.category : fallback.category,
      priority: pris.includes(j.priority) ? j.priority : fallback.priority,
      sensitive: typeof j.sensitive === 'boolean' ? j.sensitive : base.sensitive,
      lang: (typeof j.lang === 'string' && j.lang.length >= 2 ? j.lang.slice(0, 2).toLowerCase() : fallback.lang) as Lang,
      sentiment: sents.includes(j.sentiment) ? j.sentiment : fallback.sentiment,
      summary: (typeof j.summary === 'string' && j.summary.trim()) ? j.summary.trim().slice(0, 90) : fallback.summary,
    };
  } catch { return fallback; }
}

// Aplana un artículo de la Guía a texto plano para dárselo a la IA.
function articleText(a: Article, lang: Lang): string {
  const blocks = ((a.body[lang]||a.body.en) || []) as any[];
  const parts = blocks.map((b) => b.p || b.h || b.note || b.warn || (b.list || b.steps || []).join(' · ') || '');
  return `# ${(a.title[lang]||a.title.en)}\n${(a.summary[lang]||a.summary.en)}\n${parts.filter(Boolean).join('\n')}`;
}

// Resumen COMPLETO de Onyx: el "cerebro" que la IA siempre tiene, sin depender
// de que la Guía tenga un artículo para cada tema. Incluye todo lo que hemos
// añadido (copy, Mi reto, app, push, Telegram, planes, embajadores…).
export const ONYX_BRIEF: Record<Lang, string> = {
  es: `Onyx Trading Live es un diario de trading MULTIPLATAFORMA: funciona con MetaTrader (MT4 y MT5), cTrader, MatchTrader, TradeLocker y DXtrade. El conector se llama Onyx (Guardian es el gestor de riesgo): en MetaTrader es un Expert Advisor (EA) y en cTrader es un cBot; MatchTrader, TradeLocker y DXtrade se conectan por la API del bróker (sin instalar nada).

PLATAFORMAS: MetaTrader 4 y 5 (se instala un EA), cTrader (se instala un cBot), MatchTrader, TradeLocker y DXtrade (se conectan por la API del bróker con email y contraseña, sin instalar nada). Cualquier bróker o prop firm que te dé una cuenta MT4/MT5, cTrader, MatchTrader, TradeLocker o DXtrade funciona igual: eliges tu plataforma al conectar.

SEÑALES DE TRADINGVIEW (en planes de pago): tus alertas de TradingView pueden ABRIR la operación en tu cuenta real a través de tu conector de Onyx, con tope de lote y símbolos permitidos; el Guardian te sigue protegiendo. Importante: Onyx NO da señales ni predice el mercado; solo ejecuta las alertas que TÚ configuras en TradingView.

CONECTAR: El trader instala el conector de Onyx dentro de su plataforma (EA en MetaTrader, cBot en cTrader); el conector envía sus operaciones a Onyx. Onyx NUNCA tiene la contraseña ni puede mover dinero. Se conecta creando una clave API desde "Cuentas" y pegándola en el EA o cBot; al primer envío la clave queda atada a ese número de cuenta. Una clave por cuenta; el plan decide cuántas cuentas activas puedes tener.

ONYX GUARDIAN (gestor de riesgo): hace respetar reglas — límite de pérdida diaria, límite de pérdida total, protección/bloqueo de ganancias, aviso antes de noticias de alto impacto y controles de riesgo. "Mi reto" es un marcador para cuentas de fondeo/prop firm que compara tu progreso con las reglas del reto (objetivo, pérdida diaria/total, días mínimos, consistencia). Hay una calculadora de lotaje/riesgo. Cumplir las reglas de la prop firm es responsabilidad del trader.

COPY TRADING (planes Elite y Black Onyx): copia operaciones entre las cuentas del propio trader (una maestra a una o varias esclavas) con PIN y controles de riesgo por enlace. Es un gestor multicuenta legítimo. ANTI-BANEO: reduce el riesgo de baneo en prop firms de dos formas: (1) la ejecución es LOCAL en la terminal del trader, así que Onyx NO estampa una IP compartida en las operaciones (a diferencia de copiadores en la nube); (2) hay un "retraso aleatorio" (jitter) configurable por enlace que añade unos segundos al azar antes de copiar cada apertura, para que el timing de la esclava no sea idéntico al de la master y no salte por patrón. Los cierres salen al instante. IMPORTANTE: la IP es solo una señal; para minimizar el riesgo conviene un VPS/IP por cuenta, y muchas prop firms PROHÍBEN en sus reglas copiar entre cuentas fondeadas sin importar la IP. Onyx reduce el riesgo pero no garantiza inmunidad; cumplir el reglamento de la firma es responsabilidad del trader.

FONDEO / PROP FIRMS: Onyx sirve para challenges y cuentas fondeadas.

PROBAR GRATIS SIN CUENTA (para visitantes): hay DOS formas de probar Onyx sin registrarse, y son PERFECTAS para alguien que aún no tiene cuenta. (1) DEMO EN VIVO en /demo: es el dashboard real de Onyx con datos de ejemplo, se toca y se explora sin login — ideal para quien pregunta "cómo se ve", "qué hace Onyx", "cómo funciona el panel" o "puedo verlo antes de registrarme". (2) ANALIZADOR GRATIS en /analiza: la persona pega su lista de operaciones cerradas (su historial/reporte) y Onyx AI le devuelve hallazgos, un puntaje y un consejo — ideal para quien pregunta "puedo ver mi historial", "analiza mi cuenta", "qué tal vengo operando" o quiere una prueba con SUS propios números. Cuando un visitante sin cuenta pregunte cosas así, ofrécele de forma natural el enlace que mejor encaje (el demo para VER el producto, el analizador para probar con SUS datos). No seas insistente.

CONSTRUCTOR DE ROBOTS ("Crea tu bot" / Onyx Builder): Onyx incluye un constructor de robots SIN programar. Eliges gatillos de entrada, salidas, gestión de riesgo, frenos, sesiones y días operables, con filtro de noticias integrado y reglas de fondeo; Onyx te genera el robot listo para MetaTrader (.mq5/.mq4), cTrader (.cs) y su archivo .set, más una guía PDF personalizada y plantillas. El plan de entrada ya basta para construir robots (tu robot se frena solo, filtra noticias y respeta tu sesión); planes superiores añaden métricas avanzadas (Sharpe, Monte Carlo, walk-forward) y laboratorio de portafolio con correlación. La página es "Crea tu bot" (/bot-builder). Si alguien pregunta por robots, bots o estrategias automáticas, menciona el constructor. PERO si preguntan por precios, planes, prueba gratis o free trial, responde con la sección PRECIOS Y PLANES de abajo (incluida la PRUEBA GRATIS) y NO desvíes la respuesta al constructor.

MIS ROBOTS: Onyx detecta cada robot/EA por su magic number y mide su rendimiento REAL por robot (métricas, portafolio, divergencia con el backtest), con estados prueba vs vivo.

ONYX BOT LAB (marketplace de robots): un mercado aparte donde se compran y venden robots verificados (con Onyx Score y prueba en demo) y también hay servicios para automatizar tu estrategia. Está en /bot-lab.

ALERTAS: por Telegram (planes Elite y superiores) — fondeo, gestor, noticias, EA caído, meta, resumen diario/semanal.

APP MÓVIL: Onyx es instalable como app (PWA) en iPhone y Android desde el navegador (en iPhone: Compartir → Añadir a inicio; en Android: botón instalar). Con notificaciones push.

PLANES: Free, Pro, Elite y Black Onyx. Se empieza gratis. Pago mensual o anual (el anual sale más barato). Los precios exactos están en la sección PRECIOS de abajo. Cambiar de plan desde Mi cuenta → Suscripción: subir es inmediato, bajar se aplica al final del periodo pagado (conservas las funciones hasta que termine).

EMBAJADORES: comisión recurrente por cada suscriptor que traigas y descuento para tu comunidad; se solicita desde la página de Embajadores.

SOPORTE: Onyx AI responde al instante; si hace falta, una persona contesta por correo o en el Centro de soporte.`,
  en: `Onyx Trading Live is a MULTI-PLATFORM trading journal: it works with MetaTrader (MT4 and MT5), cTrader, MatchTrader, TradeLocker and DXtrade. The connector is called Onyx (Guardian is the risk manager): on MetaTrader it is an Expert Advisor (EA) and on cTrader it is a cBot; MatchTrader, TradeLocker and DXtrade connect via the broker API (nothing to install).

PLATFORMS: MetaTrader 4 and 5 (install an EA), cTrader (install a cBot), MatchTrader, TradeLocker and DXtrade (connect via the broker API with email and password, nothing to install). Any broker or prop firm that gives you an MT4/MT5, cTrader, MatchTrader, TradeLocker or DXtrade account works the same: you pick your platform when connecting.

TRADINGVIEW SIGNALS (on paid plans): your TradingView alerts can OPEN the trade in your real account through your Onyx connector, with a lot cap and allowed symbols; Guardian keeps protecting you. Important: Onyx does NOT give signals or predict the market; it only executes the alerts YOU set up in TradingView.

CONNECT: The trader installs the Onyx connector inside their platform (EA on MetaTrader, cBot on cTrader); the connector sends their trades to Onyx. Onyx NEVER has the password and cannot move money. You connect by creating an API key from "Accounts" and pasting it into the EA or cBot; on the first sync the key is bound to that account number. One key per account; the plan decides how many active accounts you can have.

ONYX GUARDIAN (risk manager): enforces rules — daily loss limit, total loss limit, profit protection/lock, warning before high-impact news, and risk controls. "My challenge" is a scoreboard for funded/prop-firm accounts that compares your progress with the challenge rules (target, daily/total loss, minimum days, consistency). There is a lot-size/risk calculator. Following prop-firm rules is the trader's responsibility.

COPY TRADING (Elite and Black Onyx plans): copies trades between the trader's own accounts (one master to one or more slaves) with a PIN and per-link risk controls. It is a legitimate multi-account manager. BAN-SAFE: it lowers the risk of prop-firm bans two ways: (1) execution is LOCAL on the trader's terminal, so Onyx does NOT stamp a shared IP on the trades (unlike cloud copiers); (2) there is a configurable per-link "random delay" (jitter) that adds a few random seconds before copying each open, so the slave's timing is not identical to the master and does not flag by pattern. Closes go out instantly. IMPORTANT: IP is only one signal; to minimize risk use one VPS/IP per account, and many prop firms PROHIBIT copying between funded accounts in their rules regardless of IP. Onyx lowers the risk but does not guarantee immunity; following the firm's rulebook is the trader's responsibility.

FUNDED / PROP FIRMS: Onyx works for challenges and funded accounts.

TRY FREE WITHOUT AN ACCOUNT (for visitors): there are TWO ways to try Onyx without signing up, and they are PERFECT for someone who doesn't have an account yet. (1) LIVE DEMO at /demo: it's the real Onyx dashboard with sample data, tap and explore with no login — ideal for anyone asking "what does it look like", "what does Onyx do", "how does the panel work" or "can I see it before signing up". (2) FREE ANALYZER at /analiza: the person pastes their closed-trades list (their history/report) and Onyx AI returns findings, a score and a quick win — ideal for anyone asking "can I see my history", "analyze my account", "how am I trading" or who wants to try it with THEIR own numbers. When a visitor without an account asks things like this, naturally offer the link that fits best (the demo to SEE the product, the analyzer to try with THEIR data). Don't be pushy.

ROBOT BUILDER ("Build your bot" / Onyx Builder): Onyx includes a NO-CODE robot builder. You pick entry triggers, exits, risk management, brakes, sessions and trading days, with a built-in news filter and firm rules; Onyx generates the ready-to-run robot for MetaTrader (.mq5/.mq4), cTrader (.cs) plus its .set file, and a personalized PDF guide and templates. The entry plan is already enough to build robots (your robot stops itself, filters news and respects your session); higher plans add advanced metrics (Sharpe, Monte Carlo, walk-forward) and a portfolio lab with correlation. The page is "Build your bot" (/bot-builder). If someone asks about robots, bots or automated strategies, mention the builder. BUT if they ask about prices, plans, free trial, answer with the PRICES AND PLANS section below (including the FREE TRIAL) and do NOT divert the answer to the builder.

MY ROBOTS: Onyx detects each robot/EA by its magic number and measures its REAL per-robot performance (metrics, portfolio, divergence from the backtest), with testing vs live states.

ONYX BOT LAB (robot marketplace): a separate marketplace to buy and sell verified robots (with an Onyx Score and demo test) and services to automate your strategy. It lives at /bot-lab.

ALERTS: via Telegram (Elite plan and above) — funding, manager, news, EA down, goal, daily/weekly summary.

MOBILE APP: Onyx installs as an app (PWA) on iPhone and Android from the browser (iPhone: Share → Add to Home Screen; Android: install button). With push notifications.

PLANS: Free, Pro, Elite and Black Onyx. You can start free. Monthly or yearly billing (yearly is cheaper). Exact prices are in the PRICES section below. Change plan from My account → Subscription: upgrading is immediate, downgrading applies at the end of the paid period (you keep features until it ends).

AMBASSADORS: recurring commission for every subscriber you bring and a discount for your community; apply from the Ambassadors page.

SUPPORT: Onyx AI answers instantly; if needed, a person replies by email or in the Support Center.`,
};

// Conocimiento de marca EFECTIVO: si el admin lo editó en el panel, se usa ese; si no,
// el texto interno por defecto. Lo usan TODAS las IAs de marca (soporte, coach, blog,
// campañas, embajadores) para que Onyx cuente lo mismo en todos lados.
// PAGO POR USO / MONEDERO: se añade SIEMPRE al cerebro (haya o no brief
// personalizado en Admin), para que la IA siempre sepa explicarlo con coherencia.
export const PAYG_INFO: Record<Lang, string> = {
  es: `PAGO POR USO / MONEDERO (plan gratis): no hace falta pagar mensualidad. El plan gratis incluye gratis cada mes 1 cuenta conectada y un cupo de análisis de Onyx AI (lo que diga el plan, p. ej. 20). Si usas de más, se descuenta de tu SALDO (un monedero recargable): cada análisis de IA extra cuesta unos centavos y cada cuenta extra una tarifa mensual pequeña; los precios exactos se ven en Mi cuenta → Suscripción. El saldo se recarga con tarjeta o USDT (la recarga con tarjeta lleva una pequeña comisión de servicio que baja cuanto más recargas; USDT a valor nominal). El saldo NO es retirable: solo se usa dentro de Onyx. Si el saldo llega a $0, las funciones de pago se pausan hasta recargar; puedes activar la auto-recarga para que nunca se corte. La idea: empiezas gratis, pagas solo por lo que uses y subes a un plan cuando te convenga (la propia app te avisa cuándo un plan te saldría más barato que seguir pagando por uso). Cuando alguien pregunte "¿puedo usar Onyx sin mensualidad?", "¿cómo funciona el saldo/monedero?", "¿cuánto cuesta la IA?" o "pago por uso", responde con ESTO (saldo, qué va gratis, tarifas por uso, cómo recargar), no solo con "sube a un plan de pago". IMPORTANTE: el monedero, la recarga y los precios por uso NO aparecen dentro de la app de iPhone (regla de Apple); ahí se gestiona desde el sitio web o con los planes del App Store.`,
  en: `PAY AS YOU GO / WALLET (free plan): no monthly fee required. The free plan includes each month 1 connected account and an Onyx AI allowance (whatever the plan says, e.g. 20). If you go over, it's charged to your BALANCE (a top-up wallet): each extra AI analysis costs a few cents and each extra account a small monthly fee; exact prices are in My account → Subscription. You top up with card or USDT (card top-ups carry a small service fee that drops the more you add; USDT at face value). The balance is NOT withdrawable: it's only for use inside Onyx. If the balance hits $0, paid features pause until you top up; you can turn on auto-reload so it never cuts off. The idea: start free, pay only for what you use, and move to a plan when it pays off (the app itself tells you when a plan would be cheaper than paying per use). When someone asks "can I use Onyx with no monthly fee?", "how does the balance/wallet work?", "how much does the AI cost?" or "pay as you go", answer with THIS (balance, what's free, usage rates, how to top up), not just "upgrade to a paid plan". IMPORTANT: the wallet, top-ups and usage prices do NOT appear inside the iPhone app (Apple rule); there it's managed from the website or via App Store plans.`,
};

export async function brandBrief(lang: Lang): Promise<string> {
  try {
    const p = await aiPromptSettings();
    const admin = ((enBase(lang) ? p.brief_en : p.brief_es) || '').trim();
    return (admin || dictFor(ONYX_BRIEF, lang)) + '\n\n' + dictFor(PAYG_INFO, lang);
  } catch { return dictFor(ONYX_BRIEF, lang) + '\n\n' + dictFor(PAYG_INFO, lang); }
}

export type AiReason = 'ok' | 'no_key' | 'sensitive' | 'declined' | 'error';
export type AiAnswer = { answer: string; confident: boolean; articles: Array<{ slug: string; title: string }>; reason: AiReason };

// Redacta una respuesta con el cerebro de Onyx + precios reales + base de
// conocimiento + Guía. Solo escala (NO_ANSWER) cuando necesita datos PRIVADOS de
// la cuenta del usuario que no puede ver. `reason` dice qué pasó exactamente.
// El chat de soporte muestra TEXTO PLANO (no renderiza markdown). Limpiamos las marcas
// que el modelo pueda dejar: **negrita**, ## títulos, `código`, y pasamos "- "/"* " a "• ".
function stripMarkdown(s: string): string {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // **negrita** -> negrita
    .replace(/__([^_]+)__/g, '$1')               // __negrita__ -> negrita
    .replace(/`([^`]+)`/g, '$1')                 // `código` -> código
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, '$1')    // "## Título" -> "Título"
    .replace(/(^|\n)\s*[-*]\s+/g, '$1• ')        // viñetas "- "/"* " -> "• "
    .replace(/\*/g, '')                          // asteriscos sueltos que queden
    .replace(/\n{3,}/g, '\n\n')                   // no más de una línea en blanco
    .trim();
}

// CEREBRO ÚNICO de Onyx AI (lo usan el widget web y las respuestas de ticket).
// Lee TODO el corpus (guía + Base IA + blog), respeta el prompt editable del admin,
// escribe en texto plano, admite historial de conversación y un contexto de cuenta.
// Devuelve la respuesta ya limpia; `declined` = necesita datos privados (→ humano).
export async function supportChatReply(question: string, lang: Lang, history: any[] = [], acctContext = '', opts: { hidePricing?: boolean } = {}): Promise<{ answer: string; ok: boolean; declined: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { answer: '', ok: false, declined: false };
  const en = enBase(lang);
  // Dentro de la app de iOS no se pueden mostrar precios de suscripción ni enviar a
  // comprar fuera de Apple (regla 3.1.1). Cuando hidePricing está activo, NO inyectamos
  // los precios/planes/add-ons/promo al prompt y le decimos a la IA que mande a la web.
  const hidePricing = !!opts.hidePricing;

  // Prompt editable desde el Admin: `brief` reemplaza el conocimiento de marca si el admin
  // lo escribió; `extra` se añade a las instrucciones. Si están vacíos, se usan los del código.
  const prompt = await aiPromptSettings();
  const adminBrief = ((en ? prompt.brief_en : prompt.brief_es) || '').trim();
  // El bloque de pago por uso se añade SALVO en la app de iPhone (hidePricing):
  // ahí no se puede mencionar monedero, recargas ni precios (regla 3.1.1 de Apple).
  const brief = (adminBrief || dictFor(ONYX_BRIEF, lang)) + (hidePricing ? '' : '\n\n' + dictFor(PAYG_INFO, lang));
  const adminExtra = ((en ? prompt.extra_en : prompt.extra_es) || '').trim();

  // === CORPUS COMPLETO ===
  // La base es pequeña, así que Claude LEE TODO (guía + Base IA + blog) y decide por
  // SIGNIFICADO. Esto entiende preguntas incompletas, con sinónimos o mal escritas de
  // forma nativa (ya no es coincidencia de palabras). Va en un bloque CACHEADO para que
  // repetir preguntas sea barato y rápido.
  const guide = ARTICLES.map((a) => articleText(a, lang)).join('\n\n---\n\n');
  let kbText = '';
  try {
    const { data: kb } = await supabaseAdmin.from('kb_articles').select('title,body').eq('published', true).limit(200);
    if (kb?.length) kbText = kb.map((a: any) => `# ${a.title}\n${a.body}`).join('\n\n---\n\n');
  } catch {}
  let blogText = '';
  try {
    const posts = await listPublished(50);
    if (posts.length) blogText = posts.map((p: any) => {
      const t = (en ? p.title_en : p.title_es) || p.title_es || p.title_en;
      const b = (en ? p.body_en : p.body_es) || p.body_es || p.body_en || '';
      return `# ${t}\n${String(b).slice(0, 2500)}`;
    }).join('\n\n---\n\n');
  } catch {}

  // Precios reales (cambian; van FUERA del bloque cacheado para no invalidar la caché).
  let prices = '';
  if (hidePricing) {
    // Dentro de la app de iOS: NO mostramos precios de suscripción ni enviamos a comprar.
    prices += en
      ? `\n\n=== iOS APP (Apple rule 3.1.1) ===\nThe person is inside the iOS app. DO NOT write any figures: no subscription prices, plan costs, trial lengths, discounts or add-on prices (Apple rule). You MAY explain WHAT each plan includes (features, differences, which plan fits their need). When they ask about prices, plans, upgrading or subscribing, point them to the Pricing tab INSIDE the app and share the internal link /pricing so they open it right there — do NOT list dollar amounts and do NOT mention any external website for buying; just send them to the in-app Pricing page.\nALSO (iOS) — STRICT: NEVER share or link the public LANDING pages /bot-builder or /bot-lab (they are marketing pages and kick the user out of the app). You MAY explain the robot builder (it's a plan feature) and, if it helps, point to the in-app builder tab with the internal link /dashboard/constructor — never /bot-builder. Do NOT offer, promote, price, or link the Bot Lab marketplace (buying/selling robots) or add-ons (extra accounts, extra copy master, robots add-on); do NOT mention their prices or payment methods and do NOT link /bot-lab. If directly asked you may say Bot Lab and add-ons exist on the website, without prices and without any link; otherwise don't bring them up.`
      : `\n\n=== APP DE iOS (regla 3.1.1 de Apple) ===\nLa persona está dentro de la app de iOS. NO escribas cifras: ni precios de suscripción, ni costos de planes, ni días de prueba, ni descuentos, ni precios de add-ons (regla de Apple). SÍ puedes explicar QUÉ incluye cada plan (funciones, diferencias, cuál le conviene). Cuando pregunte por precios, planes, subir de plan o suscribirse, indícale que vea el tab de Precios DENTRO de la app y compártele el enlace interno /pricing para que lo abra ahí mismo — NO escribas cantidades en dólares y NO menciones ninguna web externa para comprar; solo dirígela a la página de Precios dentro de la app.\nADEMÁS (iOS) — ESTRICTO: NUNCA compartas ni enlaces los landings públicos /bot-builder ni /bot-lab (son páginas de marketing y sacan al usuario de la app). SÍ puedes explicar el constructor de robots (es una función del plan) y, si ayuda, mandar al tab interno del constructor con el enlace interno /dashboard/constructor — nunca /bot-builder. NO ofrezcas, promociones, pongas precio ni enlaces al marketplace Bot Lab (compra/venta de robots) ni a los add-ons (cuentas extra, maestra extra de copy, add-on de robots); NO menciones sus precios ni métodos de pago y NO enlaces /bot-lab. Solo si te preguntan directamente puedes decir que Bot Lab y los add-ons existen en la web, sin precios y sin ningún enlace; de lo contrario, no los menciones.`;
  }
  if (!hidePricing) try {
    const { data: plans } = await supabaseAdmin.from('plans')
      .select('name,name_en,price_month,price_year,max_accounts,features,features_en,capabilities')
      .eq('active', true).order('sort', { ascending: true });
    if (plans?.length) {
      const rows = plans.map((p: any) => {
        const n = en ? (p.name_en || p.name) : p.name;
        const acc = p.max_accounts >= 999 ? (en ? 'unlimited accounts' : 'cuentas ilimitadas') : `${p.max_accounts} ${en ? 'accounts' : 'cuentas'}`;
        const feats = ((en ? p.features_en : p.features) || []).slice(0, 6).join(', ');
        return `- ${n}: $${p.price_month}/${en ? 'mo' : 'mes'} · $${p.price_year}/${en ? 'yr' : 'año'} · ${acc}. ${feats}`;
      }).join('\n');
      prices = `\n\n=== ${en ? 'PRICES AND PLANS (current)' : 'PRECIOS Y PLANES (actuales)'} ===\n${rows}`;
      // La app pinta los planes como TARJETAS debajo de tu respuesta, así que NO
      // los repitas en texto. Responde la pregunta de precios/planes con UNA sola
      // línea corta y deja que las tarjetas muestren el detalle.
      prices += en
        ? `\n\nIMPORTANT (pricing questions): when the person asks about prices or plans, DO NOT list the plans one by one in text — the app shows them as interactive CARDS right below your reply. Answer with ONE short line only (e.g. "These are Onyx's plans — yearly saves about ~17%."). Do not repeat prices, accounts or features in prose; the cards already show them.`
        : `\n\nIMPORTANTE (preguntas de precios): cuando la persona pregunte por precios o planes, NO listes los planes uno por uno en texto — la app los muestra como TARJETAS justo debajo de tu respuesta. Responde con UNA sola línea corta (p. ej. "Estos son los planes de Onyx. El anual ahorra ~17%."). No repitas precios, cuentas ni funciones en el texto; las tarjetas ya lo muestran.`;
      // Prueba gratis y ahorro anual REALES (calculados de los planes; nada fijo).
      const f = planFacts(plans as any);
      if (f.hasTrial) {
        // Frase EN VIVO (misma que el landing): "todos los planes de pago", un solo
        // plan, o VARIOS planes con días distintos listados uno por uno.
        const line = trialLine(f, en ? 'en' : 'es');
        // Desglose exacto por plan para que la IA nunca invente números.
        const perPlan = (f.trials || []).map((tr) => `${en ? (tr.name_en || tr.name) : (tr.name || tr.name_en)}: ${tr.days}`).join(' · ');
        prices += en
          ? `\nFREE TRIAL: ${line}. Exact days per plan — ${perPlan}. Each plan keeps ITS OWN number of days; never merge or average them and never invent a number. The person enters with a card but is NOT charged until the trial ends; if they cancel before then they pay nothing. Only for new subscribers. If plans have DIFFERENT trial lengths, mention each plan with its own days; if they all share the same, say "all paid plans". Do NOT single out "Onyx Builder" / "the builder" unless it is the only plan with a trial. Answer the trial question directly and do not steer the reply toward the robot builder.`
          : `\nPRUEBA GRATIS: ${line}. Días exactos por plan — ${perPlan}. Cada plan conserva SU PROPIO número de días; nunca los mezcles ni promedies, ni inventes un número. Entra con tarjeta pero NO se le cobra hasta que termina la prueba; si cancela antes no paga nada. Solo para suscriptores nuevos. Si los planes tienen días DISTINTOS, menciona cada plan con sus días; si todos coinciden, di "todos los planes de pago". NO destaques solo "Onyx Builder" / "el constructor" salvo que sea el único plan con prueba. Responde la pregunta de la prueba directamente y no desvíes la respuesta hacia el constructor de robots.`;
      } else {
        prices += en ? `\nFREE TRIAL: none right now. The Free plan is free forever without a card.` : `\nPRUEBA GRATIS: ahora mismo no hay. El plan Free es gratis para siempre y sin tarjeta.`;
      }
      if (f.annualPct > 0) {
        prices += en ? `\nANNUAL SAVING: paying yearly saves about ${f.annualPct}% vs monthly. Use this exact figure; do not invent a discount.` : `\nAHORRO ANUAL: pagar al año ahorra alrededor de un ${f.annualPct}% frente a mensual. Usa esta cifra exacta; no inventes un descuento.`;
      }
    }
  } catch {}

  // ADD-ONS reales (precios y on/off editables en Admin → Planes). En vivo, fuera
  // de la caché. Solo se listan los que están activados; precios mensuales en USD.
  if (!hidePricing) try {
    const a = await addonSettings();
    const lines: string[] = [];
    if (a.extra_account_enabled) lines.push(en ? `extra connected account: $${a.extra_account_price}/mo each` : `cuenta conectada extra: $${a.extra_account_price}/mes cada una`);
    if (a.extra_master_enabled) lines.push(en ? `extra copy master account: $${a.extra_master_price}/mo` : `cuenta maestra extra de copy: $${a.extra_master_price}/mes`);
    if (a.extra_slave_enabled) lines.push(en ? `extra copy slave account: $${a.extra_slave_price}/mo` : `cuenta esclava extra de copy: $${a.extra_slave_price}/mes`);
    if (a.algo_enabled) lines.push(en ? `robots/algo module add-on: $${a.algo_price}/mo` : `módulo de robots/algo (add-on): $${a.algo_price}/mes`);
    if (lines.length) {
      prices += en
        ? `\n\n=== ADD-ONS (current, monthly, do not invent prices) ===\n${lines.map((l) => '- ' + l).join('\n')}\nAdd-ons are extras on top of the plan, managed from My account → Subscription.`
        : `\n\n=== ADD-ONS (actuales, mensuales, no inventes precios) ===\n${lines.map((l) => '- ' + l).join('\n')}\nLos add-ons son extras que se suman al plan; se gestionan desde Mi cuenta → Suscripción.`;
    }
  } catch {}

  // TARIFAS DE PAGO POR USO / MONEDERO EN VIVO (desde usageConfig del Admin). Van FUERA
  // de la caché porque el admin puede cambiarlas. Solo si no es iOS (regla 3.1.1). Así la
  // IA cita el precio REAL por análisis, por cuenta extra y las comisiones de recarga por
  // tramo, en lugar de mandar a "Mi cuenta → Suscripción".
  if (!hidePricing) try {
    const { usageConfig } = await import('@/lib/usage');
    const cfg = await usageConfig();
    const money = (c: number) => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');
    const aiC = Math.max(1, Math.round(Number(cfg.ai_call_cents) || 20));
    const acctC = Math.max(0, Math.round(Number(cfg.account_month_cents) || 0));
    const packAnalyses = Math.round(1000 / aiC); // cuántos análisis rinde una recarga de $10
    const tiers = [...(cfg.topup_fee_tiers || [])].sort((a: any, b: any) => a.min - b.min);
    const tierLines = tiers.map((t: any) => {
      const from = t.min >= 100 ? `$${t.min}+` : `$${t.min}–$99`;
      return en ? `from $${t.min}: ${t.pct}% fee` : `desde $${t.min}: ${t.pct}% de comisión`;
    }).join(' · ');
    const feeMin = Math.max(0, Math.round(Number(cfg.topup_fee_min_cents) || 0));
    prices += en
      ? `\n\n=== PAY-AS-YOU-GO / WALLET PRICES (live, do not invent) ===\n- Each extra Onyx AI analysis (beyond the free monthly allowance): ${money(aiC)}.\n${acctC > 0 ? `- Each extra connected account beyond the free one: ${money(acctC)}/mo, charged from the balance.\n` : ''}- Example: a $10 top-up ≈ ${packAnalyses} extra analyses.\n- Card top-up service fee by amount — ${tierLines}${feeMin > 0 ? ` (minimum ${money(feeMin)})` : ''}. The more you top up at once, the lower the % fee.\n- USDT top-ups: 0% fee (at face value).\n- The balance is NOT withdrawable (only for use inside Onyx). Auto-reload can be turned on so it never cuts off.\nQuote THESE exact figures when asked how much the AI / extra accounts / top-ups cost. Full guide at /monedero.`
      : `\n\n=== PRECIOS DE PAGO POR USO / MONEDERO (en vivo, no inventes) ===\n- Cada análisis extra de Onyx AI (más allá del cupo gratis mensual): ${money(aiC)}.\n${acctC > 0 ? `- Cada cuenta conectada extra además de la gratis: ${money(acctC)}/mes, se descuenta del saldo.\n` : ''}- Ejemplo: una recarga de $10 ≈ ${packAnalyses} análisis extra.\n- Comisión de servicio al recargar con tarjeta según el monto — ${tierLines}${feeMin > 0 ? ` (mínimo ${money(feeMin)})` : ''}. Cuanto más recargas de una vez, menor el % de comisión.\n- Recargas con USDT: 0% de comisión (a valor nominal).\n- El saldo NO es retirable (solo se usa dentro de Onyx). Se puede activar la auto-recarga para que nunca se corte.\nCita ESTAS cifras exactas cuando pregunten cuánto cuesta la IA / las cuentas extra / las recargas. Guía completa en /monedero.`;
  } catch {}

  // SOPORTE REMOTO DE PAGO (si el dueño lo activó). La IA puede OFRECERLO cuando la
  // persona necesita ayuda práctica (instalar el EA/cBot, configurar, conectar la
  // cuenta, un error que no logra resolver). En iOS NO se ofrece (hidePricing): es un
  // cobro fuera de Apple, así que ahí ni se menciona el precio ni se empuja.
  if (!hidePricing) try {
    const rs = await getRemoteConfig();
    if (rs.on && rs.price > 0) {
      prices += en
        ? `\n\n=== PAID REMOTE SUPPORT (live) ===\nOnyx offers a paid 1-on-1 remote session ($${rs.price} for ~${rs.minutes} min, screen-share with ${rs.tool}) for hands-on help. Offer it ONLY when the person clearly needs practical help you can't fully solve in chat — installing the EA/cBot, setting it up, connecting the account, or an error they're stuck on — and only after trying to help first. When you offer it: logged-in users can tap the "Remote support" button in this chat; a visitor should leave their email so an agent sets it up. Mention it once, briefly; don't push it on general questions and don't invent a different price.`
        : `\n\n=== SOPORTE REMOTO DE PAGO (en vivo) ===\nOnyx ofrece una sesión remota 1 a 1 de pago ($${rs.price} por ~${rs.minutes} min, compartiendo pantalla con ${rs.tool}) para ayuda práctica. Ofrécela SOLO cuando la persona claramente necesita ayuda de manos que no puedes resolver del todo por chat — instalar el EA/cBot, configurarlo, conectar la cuenta, o un error en el que está atascada — y solo después de intentar ayudar primero. Cuando la ofrezcas: los usuarios con sesión pueden tocar el botón "Soporte remoto" en este chat; un visitante que deje su correo para que un agente la coordine. Menciónala una vez, breve; no la empujes en preguntas generales ni inventes otro precio.`;
    }
  } catch {}

  // PROMO / DESCUENTO ACTIVO (barra del landing, en vivo). Solo si hay una barra
  // encendida ahora mismo; el AI la menciona cuando pregunten por ofertas.
  if (!hidePricing) try {
    const q = await getSetting<PromoQueue | null>('promo_queue', null as any);
    const bars = (q && Array.isArray((q as any).bars)) ? (q as any).bars : [];
    const bar = pickActiveBar(bars, Date.now(), { lang: en ? 'en' : 'es', isLanding: true, isPricing: true, loggedIn: false, plan: 'free' });
    if (bar) {
      const txt = (en ? ((bar as any).text_en || (bar as any).text_es) : ((bar as any).text_es || (bar as any).text_en)) || '';
      const code = String((bar as any).coupon || '').trim();
      if (txt) {
        prices += en
          ? `\n\n=== ACTIVE PROMO (live — mention only while active) ===\n${txt}${code ? ` — coupon code: ${code}` : ''}. Mention it only if the person asks about discounts/offers or it clearly helps; do not invent other discounts.`
          : `\n\n=== PROMO ACTIVA (en vivo — menciónala solo mientras esté activa) ===\n${txt}${code ? ` — cupón: ${code}` : ''}. Menciónala solo si preguntan por descuentos/ofertas o si claramente ayuda; no inventes otros descuentos.`;
      }
    }
  } catch {}

  // PLATAFORMAS Y PROP FIRMS (catálogo editable en Admin → Catálogos, en vivo).
  try {
    const plats = await getSetting<CatalogItem[]>(catalogKey('platform'), CATALOG_DEFAULTS.platform);
    const firms = await getSetting<CatalogItem[]>(catalogKey('firm'), CATALOG_DEFAULTS.firm);
    const pl = (plats || []).map((x) => (en ? (x.en || x.es) : (x.es || x.en))).filter(Boolean);
    const fl = (firms || []).map((x) => (en ? (x.en || x.es) : (x.es || x.en))).filter(Boolean);
    if (pl.length || fl.length) {
      prices += en
        ? `\n\n=== SUPPORTED PLATFORMS & FIRMS (live catalog) ===\n${pl.length ? `Platforms: ${pl.join(', ')}.` : ''}${fl.length ? `\nProp firms / brokers: ${fl.join(', ')}. Any broker/firm that uses one of these platforms works; the exact platforms and account sizes per firm can change, so suggest confirming on the firm's site.` : ''}`
        : `\n\n=== PLATAFORMAS Y PROP FIRMS COMPATIBLES (catálogo en vivo) ===\n${pl.length ? `Plataformas: ${pl.join(', ')}.` : ''}${fl.length ? `\nProp firms / brókers: ${fl.join(', ')}. Cualquier bróker/firma que use una de esas plataformas funciona; las plataformas y tamaños por firma pueden cambiar, así que sugiere confirmarlo en el sitio de la firma.` : ''}`;
    }
  } catch {}

  // BRÓKER RECOMENDADO (afiliado) — editable en Admin → Módulos, en vivo.
  // Solo cuando está ACTIVADO. La IA lo recomienda SOLO si la persona pregunta por
  // bróker / dónde abrir cuenta / con quién operar. Siempre indica que es un socio.
  try {
    const rb = await getSetting<RecoBroker>('reco_broker', RECO_BROKER_DEFAULT);
    if (rb?.enabled && rb.name && rb.url) {
      const blurb = (en ? (rb.blurb_en || rb.blurb_es) : (rb.blurb_es || rb.blurb_en)) || '';
      prices += en
        ? `\n\n=== RECOMMENDED BROKER (partner — recommend ONLY when asked) ===\nWhen the person asks which broker you recommend, where to open an account, or who to trade with, recommend ${rb.name}${blurb ? ` (${blurb})` : ''} and share this link: ${rb.url}\nAlways say that ${rb.name} is a partner of Onyx (affiliate link). Do NOT push it in other conversations, do NOT invent features, and if they already have a broker that works with our platforms, don't insist.`
        : `\n\n=== BRÓKER RECOMENDADO (socio — recomiéndalo SOLO si preguntan) ===\nCuando la persona pregunte qué bróker recomiendas, dónde abrir cuenta, o con quién operar, recomienda ${rb.name}${blurb ? ` (${blurb})` : ''} y comparte este enlace: ${rb.url}\nDi siempre que ${rb.name} es un socio de Onyx (enlace de afiliado). NO lo empujes en otras conversaciones, NO inventes características, y si ya tiene un bróker que funciona con nuestras plataformas, no insistas.`;
    }
  } catch {}

  // VPS RECOMENDADO (afiliado) — mismo ajuste que las tarjetas/guía (Admin → Bot Lab).
  // La IA lo recomienda SOLO si preguntan por VPS / dejarlo 24-7 / Mac+cTrader. Socio.
  try {
    const vi = await vpsInfo();
    if (vi?.on && vi.url) {
      const note = (en ? (vi.note_en || vi.note_es) : (vi.note_es || vi.note_en)) || '';
      const nm = vi.name || (en ? 'our recommended VPS' : 'nuestro VPS recomendado');
      prices += en
        ? `\n\n=== RECOMMENDED VPS (partner — recommend ONLY when asked) ===\nWhen the person asks whether they need a VPS, how to keep the EA/bot running 24/7 without the PC on, or (on Mac/cTrader) where to run it, recommend ${nm}${note ? ` (${note})` : ''} and share this link: ${vi.url}\nSay it is a partner of Onyx (affiliate link). Do NOT push it in other conversations.`
        : `\n\n=== VPS RECOMENDADO (socio — recomiéndalo SOLO si preguntan) ===\nCuando la persona pregunte si necesita un VPS, cómo dejar el EA/bot corriendo 24/7 sin el PC encendido, o (en Mac/cTrader) dónde ejecutarlo, recomienda ${nm}${note ? ` (${note})` : ''} y comparte este enlace: ${vi.url}\nDi que es un socio de Onyx (enlace de afiliado). NO lo empujes en otras conversaciones.`;
    }
  } catch {}

  // BOT LAB: precio "desde" del marketplace + métodos de pago activos (en vivo).
  // En iOS no se ofrece Bot Lab (compra de bienes digitales fuera de Apple).
  if (!hidePricing) try {
    const s2 = await botLabSettings();
    const fromCfg = Math.max(0, Math.round(Number((s2 as any).stat_price_from) || 0));
    let low = 0;
    try {
      const mk: any[] = await listMarketplace({ limit: 50 });
      const ps = (mk || []).map((p: any) => Number(p.price_cents) || 0).filter((n: number) => n > 0);
      if (ps.length) low = Math.round(Math.min(...ps) / 100);
    } catch {}
    const fromUsd = low || fromCfg;
    const methods = [((s2 as any).pay_card ? (en ? 'card (Stripe)' : 'tarjeta (Stripe)') : ''), (((s2 as any).pay_trc20 || (s2 as any).pay_erc20) ? 'USDT' : '')].filter(Boolean);
    if (fromUsd > 0 || methods.length) {
      prices += en
        ? `\n\n=== BOT LAB (live) ===\n${fromUsd > 0 ? `Robots on the marketplace start from about $${fromUsd}. ` : ''}${methods.length ? `Bot Lab payment methods active right now: ${methods.join(', ')}.` : ''} Do not invent prices or payment methods.`
        : `\n\n=== BOT LAB (en vivo) ===\n${fromUsd > 0 ? `Los robots del marketplace empiezan desde ~$${fromUsd}. ` : ''}${methods.length ? `Métodos de pago de Bot Lab activos ahora: ${methods.join(', ')}.` : ''} No inventes precios ni métodos de pago.`;
    }
  } catch {}

  // Términos de dinero de Bot Lab y Academia (editables en admin) para que la IA
  // dé cifras REALES en vez de inventarlas. Fuera de la caché por si cambian.
  try {
    const s = await botLabSettings();
    const onyxPct = clampPct(s.fee_pct);
    const sellerPct = Math.max(0, 100 - onyxPct);
    const minUsd = Math.max(0, Math.round((Number(s.payout_min_cents) || 1000) / 100));
    let acadPct = 10;
    try { const af = await academyFeeSettings(); acadPct = Math.max(0, Math.min(50, Math.round(Number(af?.default_pct) || 10))); } catch {}
    prices += en
      ? `\n\n=== EARNINGS & FEES (current, do not invent numbers) ===\n- Bot Lab (selling robots): the creator keeps ${sellerPct}% of each sale, Onyx keeps ${onyxPct}%. Payouts are in USDT with a $${minUsd} minimum to withdraw.\n- Onyx Academy (mentors): Onyx's platform fee is ${acadPct}% by default and can be lower on higher Onyx plans; the mentor gets paid the rest into their own Stripe. Use these exact figures.`
      : `\n\n=== GANANCIAS Y COMISIONES (actuales, no inventes números) ===\n- Bot Lab (vender robots): el creador se queda el ${sellerPct}% de cada venta, Onyx retiene el ${onyxPct}%. Los cobros son en USDT con un mínimo de $${minUsd} para retirar.\n- Onyx Academy (mentores): la comisión de plataforma de Onyx es del ${acadPct}% por defecto y puede bajar en planes de Onyx superiores; el mentor cobra el resto en su propia cuenta de Stripe. Usa estas cifras exactas.`;
  } catch {}

  const persona = en
    ? `You are Onyx AI, the support agent for Onyx Trading Live. ALWAYS reply in English, regardless of the language the question is written in. Assume the person may know NOTHING about Onyx and may ask in vague, incomplete or misspelled ways — figure out their intent and help anyway. Be brief, warm and clear. IMPORTANT: write in PLAIN TEXT only — do NOT use markdown: no asterisks for bold (no ** **), no # headings, no backticks. To emphasize, just write the words normally. For lists use a simple "• " bullet at the start of the line. A few tasteful emojis are fine.
LINKS: whenever you share ANY link, write the FULL clickable URL starting with https:// (external) or starting with / (an Onyx page like /pricing). The chat turns those into clickable buttons automatically. NEVER tell the person to "copy and paste" a link, never write a link without https://, and never describe a URL in words instead of giving the real link.
KNOWLEDGE RULES:
• For GENERAL trading and industry questions — what a prop firm is, what FTMO / FundedNext / The5ers / FundingPips are, trading platforms (MetaTrader, cTrader, TradingView), and trading terms (drawdown, profit factor, pips, lot size...) — answer with your OWN general knowledge. You do NOT need an article for that; never say "I have no article on this". Keep it accurate and neutral.
• For ONYX-SPECIFIC facts (what Onyx does, its features, how to connect, and PRICES) rely on the knowledge and prices below. Never invent Onyx features or make up prices.
• When a general concept relates to Onyx (e.g. "does Onyx work with FTMO?"), explain the concept briefly AND connect it to Onyx using the knowledge below.
Never give financial/market advice or predict the market. If the question is too vague to answer well, ask ONE short clarifying question instead of guessing. Do NOT add a signature. ONLY reply with the exact token NO_ANSWER (nothing else) when the question needs the user's PRIVATE account data you cannot see — e.g. "why was I charged", "is MY account blocked", "MY balance". For everything else, help.`
    : `Eres Onyx AI, el agente de soporte de Onyx Trading Live. Responde SIEMPRE en español, sin importar en qué idioma esté escrita la pregunta. Supón que la persona quizá NO conoce nada de Onyx y puede preguntar de forma vaga, incompleta o con errores — deduce su intención y ayúdala igual. Sé breve, cercano y claro. IMPORTANTE: escribe en TEXTO PLANO — NO uses markdown: nada de asteriscos para negrita (nada de ** **), ni títulos con #, ni comillas invertidas. Para enfatizar, escribe las palabras normal. Para listas usa una viñeta simple "• " al inicio de la línea. Algunos emojis con criterio están bien.
ENLACES: cuando compartas CUALQUIER enlace, escribe la URL COMPLETA y clicable empezando por https:// (externo) o empezando por / (una página de Onyx como /pricing). El chat los convierte en botones clicables automáticamente. NUNCA le digas a la persona que "copie y pegue" un enlace, nunca escribas un enlace sin https://, y nunca describas una URL con palabras en vez de dar el enlace real.
REGLAS DE CONOCIMIENTO:
• Para preguntas GENERALES de trading y del sector — qué es una prop firm, qué son FTMO / FundedNext / The5ers / FundingPips, plataformas (MetaTrader, cTrader, TradingView) y términos (drawdown, profit factor, pips, lotaje...) — responde con tu PROPIO conocimiento general. NO necesitas un artículo para eso; nunca digas "no tengo información sobre esto en mis artículos". Sé exacto y neutral.
• Para hechos ESPECÍFICOS de Onyx (qué hace Onyx, sus funciones, cómo conectar y los PRECIOS) usa el conocimiento y los precios de abajo. Nunca inventes funciones de Onyx ni te inventes precios.
• Cuando un concepto general se relaciona con Onyx (p. ej. "¿Onyx funciona con FTMO?"), explica el concepto brevemente Y conéctalo con Onyx usando el conocimiento de abajo.
Nunca des consejo financiero/de mercado ni predigas el mercado. Si la pregunta es demasiado vaga para responder bien, haz UNA pregunta corta de aclaración en vez de adivinar. No añadas firma. SOLO responde con el token exacto NO_ANSWER (y nada más) cuando la pregunta necesite datos PRIVADOS de la cuenta del usuario que no puedes ver — p. ej. "por qué me cobraron", "está bloqueada MI cuenta", "MI saldo". Para todo lo demás, ayuda.`;

  const knowledge = `=== ${en ? 'ONYX KNOWLEDGE' : 'CONOCIMIENTO DE ONYX'} ===\n${brief}\n\n=== ${en ? 'HELP ARTICLES' : 'ARTÍCULOS DE AYUDA'} ===\n${guide}`
    + (kbText ? `\n\n=== ${en ? 'KNOWLEDGE BASE' : 'BASE DE CONOCIMIENTO'} ===\n${kbText}` : '')
    + (blogText ? `\n\n=== BLOG ===\n${blogText}` : '')
    + (acctContext ? `\n\n${acctContext}` : '');

  // Instrucciones extra del admin (tono, reglas propias) — se añaden al final del persona.
  const personaFull = persona + aiLangDirective(lang) + (adminExtra ? `\n\n${en ? 'EXTRA INSTRUCTIONS (from admin)' : 'INSTRUCCIONES EXTRA (del admin)'}:\n${adminExtra}` : '');

  const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
  const headers: any = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  // Historial de conversación (para seguimientos como "¿y en iPhone?") + la pregunta nueva.
  const prior = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-6).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  const userMsg = [...prior, { role: 'user', content: question.slice(0, 2000) }];

  // Cuerpo con caché de Claude (bloques de sistema). Si el modelo/cuenta no soporta
  // cache_control, reintentamos con un system de texto plano (misma calidad, sin caché).
  const cachedBody = JSON.stringify({
    model, max_tokens: 700,
    system: [
      { type: 'text', text: personaFull },
      { type: 'text', text: knowledge, cache_control: { type: 'ephemeral' } },
      ...(prices ? [{ type: 'text', text: prices }] : []),
    ],
    messages: userMsg,
  });
  const plainBody = JSON.stringify({
    model, max_tokens: 700,
    system: personaFull + '\n\n' + knowledge + prices,
    messages: userMsg,
  });

  try {
    let r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: cachedBody });
    if (!r.ok) r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: plainBody });
    if (!r.ok) return { answer: '', ok: false, declined: false };
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('soporte', data)).catch(() => {});
    const raw = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    if (!raw || /NO_ANSWER/i.test(raw)) return { answer: '', ok: false, declined: true };
    // El chat muestra texto plano; quitamos cualquier markdown que se le escape al modelo.
    return { answer: stripMarkdown(raw), ok: true, declined: false };
  } catch {
    return { answer: '', ok: false, declined: false };
  }
}

// Auto-respuesta de TICKETS: usa el mismo cerebro. `sensitive` = temas de dinero/legales → humano.
export async function aiAnswer(question: string, lang: Lang, sensitive = false): Promise<AiAnswer> {
  const found = searchArticles(question, lang).slice(0, 4);
  const chips = (found.length ? found : ARTICLES.slice(0, 4)).map((a) => ({ slug: a.slug, title: (a.title[lang] || a.title.en) }));
  if (!process.env.ANTHROPIC_API_KEY) return { answer: '', confident: false, articles: chips, reason: 'no_key' };
  if (sensitive) return { answer: '', confident: false, articles: chips, reason: 'sensitive' };
  const r = await supportChatReply(question, lang);
  if (r.declined) return { answer: '', confident: false, articles: chips, reason: 'declined' };
  if (!r.ok || !r.answer) return { answer: '', confident: false, articles: chips, reason: 'error' };
  return { answer: r.answer, confident: true, articles: chips, reason: 'ok' };
}

export type AutoSettings = { enabled: boolean };
export const autoReplySettings = () => getSetting<AutoSettings>('support_ai', { enabled: true });

async function addNote(ticketId: string, body: string) {
  try { await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'note', body }); } catch {}
}

// Asigna el ticket al mejor agente (idioma + categoría + carga) si aún no tiene
// dueño y el ruteo está activo. Avisa al agente (campana + push) y deja nota.
// Nunca lanza. Devuelve el id asignado o null.
async function autoRoute(ticketId: string, category: string, custLang: string, subject?: string): Promise<string | null> {
  try {
    const { data: t } = await supabaseAdmin.from('support_tickets').select('assignee_id').eq('id', ticketId).maybeSingle();
    if ((t as any)?.assignee_id) return (t as any).assignee_id;   // ya tiene dueño
    const { pickAssignee } = await import('@/lib/supportRoute');
    const to = await pickAssignee({ category, lang: custLang });
    if (!to) return null;
    await supabaseAdmin.from('support_tickets').update({ assignee_id: to, updated_at: new Date().toISOString() }).eq('id', ticketId);
    try {
      const { emitNotif } = await import('@/lib/emitNotif');
      await emitNotif(to, 'support_assigned', { ignorePlan: true, url: '/admin#soporte', body: subject || '' });
    } catch {}
    await addNote(ticketId, `🎯 Asignado automáticamente por ruteo (idioma/categoría/carga).`);
    return to;
  } catch { return null; }
}

// Orquesta el manejo automático de un ticket recién creado:
// 1) Triage: fija categoría y prioridad (siempre, gratis).
// 2) Auto-respuesta: si está activada y el tema NO es sensible y la IA tiene
//    confianza, responde por el hilo + correo. Si no, deja una nota para el humano.
export async function autoHandleTicket(opts: { ticketId: string; question: string; lang: Lang; email?: string | null; subject?: string }): Promise<{ answered: boolean }> {
  const { ticketId, question, lang } = opts;
  const email = opts.email || '';
  try {
    // Triage INTELIGENTE con IA (categoría, prioridad 4 niveles, idioma, sentimiento,
    // resumen). Cae al triage por palabras clave si no hay IA. Guardado tolerante:
    // si una columna nueva no existe aún (SQL sin correr), reintenta con lo básico.
    const tri = await classifyAI(question, lang);
    const { category, priority, sensitive } = tri;
    const full: any = { category, priority, lang: tri.lang, sentiment: tri.sentiment, ai_summary: tri.summary, updated_at: new Date().toISOString() };
    const r = await supabaseAdmin.from('support_tickets').update(full).eq('id', ticketId);
    if ((r as any)?.error) {
      const r2 = await supabaseAdmin.from('support_tickets').update({ category, priority, updated_at: new Date().toISOString() }).eq('id', ticketId);
      if ((r2 as any)?.error) await supabaseAdmin.from('support_tickets').update({ category }).eq('id', ticketId);
    }

    const cfg = await autoReplySettings();

    if (!cfg.enabled) { await addNote(ticketId, enBase(lang) ? 'AI auto-reply is off: needs a human.' : 'Auto-respuesta IA apagada: requiere un humano.'); await autoRoute(ticketId, category, tri.lang, opts.subject); return { answered: false }; }
    if (sensitive) { await addNote(ticketId, enBase(lang) ? '⚠️ Sensitive topic (money/legal/account): needs a human, not auto-answered.' : '⚠️ Tema sensible (dinero/legal/cuenta): requiere un humano, no se auto-responde.'); await autoRoute(ticketId, category, tri.lang, opts.subject); return { answered: false }; }

    const ai = await aiAnswer(question, lang, sensitive);
    if (ai.confident && ai.answer) {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'ai', body: ai.answer });
      await supabaseAdmin.from('support_tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', ticketId);
      if (email) {
        const subj = opts.subject || (enBase(lang) ? 'Your question at Onyx' : 'Tu consulta en Onyx');
        await sendEmail(
          email,
          `Re: ${subj}`,
          `${ai.answer}\n\n—\n${enBase(lang) ? 'Onyx Trading Live team' : 'Equipo de Onyx Trading Live'}`,
          { kind: 'support' },
        );
      }
      await addNote(ticketId, (enBase(lang) ? '🤖 Auto-answered by Onyx AI. Review if it needs follow-up.' : '🤖 Respondido automáticamente por Onyx AI. Revisa si necesita seguimiento.'));
      return { answered: true };
    }
    // Nota clara según el motivo real de la escalada
    let why: string;
    if (ai.reason === 'no_key') why = enBase(lang) ? '⚠️ AI not configured: ANTHROPIC_API_KEY is missing in Vercel. Add it so the AI can answer.' : '⚠️ IA no configurada: falta ANTHROPIC_API_KEY en Vercel. Agrégala para que la IA responda.';
    else if (ai.reason === 'error') why = enBase(lang) ? '⚠️ The AI had a temporary error. This ticket needs a human for now.' : '⚠️ La IA tuvo un error temporal. Este ticket necesita un humano por ahora.';
    else why = (enBase(lang) ? 'The AI escalated: the question needs private account data it cannot see. Needs a human.' : 'La IA escaló: la pregunta necesita datos privados de la cuenta que no puede ver. Requiere un humano.') + (ai.articles.length ? (enBase(lang) ? ' Suggested: ' : ' Sugerencia: ') + ai.articles.map((a) => a.title).join(', ') : '');
    await addNote(ticketId, why);
    await autoRoute(ticketId, category, tri.lang, opts.subject);
    return { answered: false };
  } catch { return { answered: false }; }
}

// ===== Planes para el chat (tarjetas en vez de texto) =====
// Cuando la persona pregunta por precios/planes, el widget pinta tarjetas en vez
// de un párrafo largo. Estos datos salen de la tabla `plans` real (precios, cuentas
// y días de prueba), así que se mantienen solos desde Admin → Planes.
export type ChatPlan = { name: string; price_month: number; price_year: number; accounts: string; summary: string; trial_days: number; popular: boolean };

// ¿La pregunta es de precios/planes? (ES + EN). Determinista, sin IA.
export function isPricingQuestion(q: string): boolean {
  const s = (q || '').toLowerCase();
  return /\bprecios?\b|\bplanes?\b|\bplan\b|cu[aá]nto\s+(cuesta|vale|es)|\btarifa|mensualidad|\bcost(e|o)s?\b|\bpricing\b|how much|\bprice\b|what.*plans|which plan/.test(s);
}

export async function plansForChat(lang: Lang): Promise<ChatPlan[]> {
  try {
    const { data: plans } = await supabaseAdmin.from('plans')
      .select('name,name_en,price_month,price_year,max_accounts,features,features_en,capabilities,active,sort')
      .eq('active', true).order('sort', { ascending: true });
    if (!plans?.length) return [];
    const en = enBase(lang);
    return (plans as any[]).map((p) => {
      const td = Math.max(0, Math.round(Number(p?.capabilities?.trial_days) || 0));
      return {
        name: en ? (p.name_en || p.name) : p.name,
        price_month: Math.round(Number(p.price_month) || 0),
        price_year: Math.round(Number(p.price_year) || 0),
        accounts: p.max_accounts >= 999 ? (en ? 'Unlimited accounts' : 'Cuentas ilimitadas') : `${p.max_accounts} ${en ? 'accounts' : 'cuentas'}`,
        summary: ((en ? p.features_en : p.features) || []).slice(0, 3).join(' · '),
        trial_days: td,
        popular: td > 0,
      } as ChatPlan;
    });
  } catch { return []; }
}
