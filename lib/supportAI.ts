import { dictFor, enBase, aiLangDirective } from '@/lib/i18n';
import { ARTICLES, searchArticles, type Article, type Lang } from '@/lib/guide';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { listPublished } from '@/lib/blog';
import { sendEmail } from '@/lib/mail';
import { getSetting, aiPromptSettings, addonSettings, RECO_BROKER_DEFAULT, type RecoBroker } from '@/lib/settings';
import { planFacts } from '@/lib/planFacts';
import { botLabSettings, clampPct, listMarketplace, vpsInfo } from '@/lib/botlab';
import { academyFeeSettings } from '@/lib/settings';
import { pickActiveBar, type PromoQueue } from '@/lib/promo';
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
export async function brandBrief(lang: Lang): Promise<string> {
  try {
    const p = await aiPromptSettings();
    const admin = ((enBase(lang) ? p.brief_en : p.brief_es) || '').trim();
    return admin || dictFor(ONYX_BRIEF, lang);
  } catch { return dictFor(ONYX_BRIEF, lang); }
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
export async function supportChatReply(question: string, lang: Lang, history: any[] = [], acctContext = ''): Promise<{ answer: string; ok: boolean; declined: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { answer: '', ok: false, declined: false };
  const en = enBase(lang);

  // Prompt editable desde el Admin: `brief` reemplaza el conocimiento de marca si el admin
  // lo escribió; `extra` se añade a las instrucciones. Si están vacíos, se usan los del código.
  const prompt = await aiPromptSettings();
  const adminBrief = ((en ? prompt.brief_en : prompt.brief_es) || '').trim();
  const brief = adminBrief || dictFor(ONYX_BRIEF, lang);
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
  try {
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
      // Prueba gratis y ahorro anual REALES (calculados de los planes; nada fijo).
      const f = planFacts(plans as any);
      if (f.hasTrial) {
        const nm = en ? f.trialPlanNameEn : f.trialPlanName;
        prices += en
          ? `\nFREE TRIAL: ${f.trialDays} days on ${nm}. The person enters with a card but is NOT charged until day ${f.trialDays}; if they cancel before then they pay nothing. Only for new subscribers. Say the exact number of days; never invent a different number.`
          : `\nPRUEBA GRATIS: ${f.trialDays} días en ${nm}. Entra con tarjeta pero NO se le cobra hasta el día ${f.trialDays}; si cancela antes no paga nada. Solo para suscriptores nuevos. Di el número exacto de días; nunca inventes otro número.`;
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
  try {
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

  // PROMO / DESCUENTO ACTIVO (barra del landing, en vivo). Solo si hay una barra
  // encendida ahora mismo; el AI la menciona cuando pregunten por ofertas.
  try {
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
  try {
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
    ? `You are Onyx AI, the support agent for Onyx Trading Live. Assume the person may know NOTHING about Onyx and may ask in vague, incomplete or misspelled ways — figure out their intent and help anyway. Be brief, warm and clear. IMPORTANT: write in PLAIN TEXT only — do NOT use markdown: no asterisks for bold (no ** **), no # headings, no backticks. To emphasize, just write the words normally. For lists use a simple "• " bullet at the start of the line. A few tasteful emojis are fine.
LINKS: whenever you share ANY link, write the FULL clickable URL starting with https:// (external) or starting with / (an Onyx page like /pricing). The chat turns those into clickable buttons automatically. NEVER tell the person to "copy and paste" a link, never write a link without https://, and never describe a URL in words instead of giving the real link.
KNOWLEDGE RULES:
• For GENERAL trading and industry questions — what a prop firm is, what FTMO / FundedNext / The5ers / FundingPips are, trading platforms (MetaTrader, cTrader, TradingView), and trading terms (drawdown, profit factor, pips, lot size...) — answer with your OWN general knowledge. You do NOT need an article for that; never say "I have no article on this". Keep it accurate and neutral.
• For ONYX-SPECIFIC facts (what Onyx does, its features, how to connect, and PRICES) rely on the knowledge and prices below. Never invent Onyx features or make up prices.
• When a general concept relates to Onyx (e.g. "does Onyx work with FTMO?"), explain the concept briefly AND connect it to Onyx using the knowledge below.
Never give financial/market advice or predict the market. If the question is too vague to answer well, ask ONE short clarifying question instead of guessing. Do NOT add a signature. ONLY reply with the exact token NO_ANSWER (nothing else) when the question needs the user's PRIVATE account data you cannot see — e.g. "why was I charged", "is MY account blocked", "MY balance". For everything else, help.`
    : `Eres Onyx AI, el agente de soporte de Onyx Trading Live. Supón que la persona quizá NO conoce nada de Onyx y puede preguntar de forma vaga, incompleta o con errores — deduce su intención y ayúdala igual. Sé breve, cercano y claro. IMPORTANTE: escribe en TEXTO PLANO — NO uses markdown: nada de asteriscos para negrita (nada de ** **), ni títulos con #, ni comillas invertidas. Para enfatizar, escribe las palabras normal. Para listas usa una viñeta simple "• " al inicio de la línea. Algunos emojis con criterio están bien.
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

// Orquesta el manejo automático de un ticket recién creado:
// 1) Triage: fija categoría y prioridad (siempre, gratis).
// 2) Auto-respuesta: si está activada y el tema NO es sensible y la IA tiene
//    confianza, responde por el hilo + correo. Si no, deja una nota para el humano.
export async function autoHandleTicket(opts: { ticketId: string; question: string; lang: Lang; email?: string | null; subject?: string }): Promise<{ answered: boolean }> {
  const { ticketId, question, lang } = opts;
  const email = opts.email || '';
  try {
    const { category, priority, sensitive } = classify(question);
    // Triage (tolerante: si la columna priority no existe, reintenta solo categoría)
    const r = await supabaseAdmin.from('support_tickets').update({ category, priority, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if ((r as any)?.error) await supabaseAdmin.from('support_tickets').update({ category }).eq('id', ticketId);

    const cfg = await autoReplySettings();

    if (!cfg.enabled) { await addNote(ticketId, enBase(lang) ? 'AI auto-reply is off: needs a human.' : 'Auto-respuesta IA apagada: requiere un humano.'); return { answered: false }; }
    if (sensitive) { await addNote(ticketId, enBase(lang) ? '⚠️ Sensitive topic (money/legal/account): needs a human, not auto-answered.' : '⚠️ Tema sensible (dinero/legal/cuenta): requiere un humano, no se auto-responde.'); return { answered: false }; }

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
    return { answered: false };
  } catch { return { answered: false }; }
}
