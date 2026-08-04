import { dictFor, enBase, aiLangDirective } from '@/lib/i18n';
import { ARTICLES, searchArticles, type Article, type Lang } from '@/lib/guide';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { listPublished } from '@/lib/blog';
import { sendEmail } from '@/lib/mail';
import { getSetting, aiPromptSettings } from '@/lib/settings';

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
  es: `Onyx Trading Live es un diario de trading MULTIPLATAFORMA: funciona con MetaTrader (MT4 y MT5) y con cTrader, y MatchTrader llega pronto. El conector se llama Onyx (Guardian es el gestor de riesgo): en MetaTrader es un Expert Advisor (EA) y en cTrader es un cBot.

PLATAFORMAS: MetaTrader 4 y 5 (se instala un EA), cTrader (se instala un cBot) y MatchTrader próximamente (se conectará por la API del bróker, sin instalar nada). Cualquier bróker o prop firm que te dé una cuenta MT4/MT5 o cTrader funciona igual: eliges tu plataforma al conectar y descargas el conector correcto.

SEÑALES DE TRADINGVIEW (en planes de pago): tus alertas de TradingView pueden ABRIR la operación en tu cuenta real a través de tu conector de Onyx, con tope de lote y símbolos permitidos; el Guardian te sigue protegiendo. Importante: Onyx NO da señales ni predice el mercado; solo ejecuta las alertas que TÚ configuras en TradingView.

CONECTAR: El trader instala el conector de Onyx dentro de su plataforma (EA en MetaTrader, cBot en cTrader); el conector envía sus operaciones a Onyx. Onyx NUNCA tiene la contraseña ni puede mover dinero. Se conecta creando una clave API desde "Cuentas" y pegándola en el EA o cBot; al primer envío la clave queda atada a ese número de cuenta. Una clave por cuenta; el plan decide cuántas cuentas activas puedes tener.

ONYX GUARDIAN (gestor de riesgo): hace respetar reglas — límite de pérdida diaria, límite de pérdida total, protección/bloqueo de ganancias, aviso antes de noticias de alto impacto y controles de riesgo. "Mi reto" es un marcador para cuentas de fondeo/prop firm que compara tu progreso con las reglas del reto (objetivo, pérdida diaria/total, días mínimos, consistencia). Hay una calculadora de lotaje/riesgo. Cumplir las reglas de la prop firm es responsabilidad del trader.

COPY TRADING: copia operaciones entre las cuentas del propio trader (una maestra a una o varias esclavas) con PIN y controles de riesgo por enlace. Es un gestor multicuenta legítimo.

FONDEO / PROP FIRMS: Onyx sirve para challenges y cuentas fondeadas.

ALERTAS: por Telegram (planes Elite y superiores) — fondeo, gestor, noticias, EA caído, meta, resumen diario/semanal.

APP MÓVIL: Onyx es instalable como app (PWA) en iPhone y Android desde el navegador (en iPhone: Compartir → Añadir a inicio; en Android: botón instalar). Con notificaciones push.

PLANES: Free, Pro, Elite y Black Onyx. Se empieza gratis. Pago mensual o anual (el anual sale más barato). Los precios exactos están en la sección PRECIOS de abajo. Cambiar de plan desde Mi cuenta → Suscripción: subir es inmediato, bajar se aplica al final del periodo pagado (conservas las funciones hasta que termine).

EMBAJADORES: comisión recurrente por cada suscriptor que traigas y descuento para tu comunidad; se solicita desde la página de Embajadores.

SOPORTE: Onyx AI responde al instante; si hace falta, una persona contesta por correo o en el Centro de soporte.`,
  en: `Onyx Trading Live is a MULTI-PLATFORM trading journal: it works with MetaTrader (MT4 and MT5) and cTrader, and MatchTrader is coming soon. The connector is called Onyx (Guardian is the risk manager): on MetaTrader it is an Expert Advisor (EA) and on cTrader it is a cBot.

PLATFORMS: MetaTrader 4 and 5 (install an EA), cTrader (install a cBot) and MatchTrader soon (connects via the broker API, nothing to install). Any broker or prop firm that gives you an MT4/MT5 or cTrader account works the same: you pick your platform when connecting and download the right connector.

TRADINGVIEW SIGNALS (on paid plans): your TradingView alerts can OPEN the trade in your real account through your Onyx connector, with a lot cap and allowed symbols; Guardian keeps protecting you. Important: Onyx does NOT give signals or predict the market; it only executes the alerts YOU set up in TradingView.

CONNECT: The trader installs the Onyx connector inside their platform (EA on MetaTrader, cBot on cTrader); the connector sends their trades to Onyx. Onyx NEVER has the password and cannot move money. You connect by creating an API key from "Accounts" and pasting it into the EA or cBot; on the first sync the key is bound to that account number. One key per account; the plan decides how many active accounts you can have.

ONYX GUARDIAN (risk manager): enforces rules — daily loss limit, total loss limit, profit protection/lock, warning before high-impact news, and risk controls. "My challenge" is a scoreboard for funded/prop-firm accounts that compares your progress with the challenge rules (target, daily/total loss, minimum days, consistency). There is a lot-size/risk calculator. Following prop-firm rules is the trader's responsibility.

COPY TRADING: copies trades between the trader's own accounts (one master to one or more slaves) with a PIN and per-link risk controls. It is a legitimate multi-account manager.

FUNDED / PROP FIRMS: Onyx works for challenges and funded accounts.

ALERTS: via Telegram (Elite plan and above) — funding, manager, news, EA down, goal, daily/weekly summary.

MOBILE APP: Onyx installs as an app (PWA) on iPhone and Android from the browser (iPhone: Share → Add to Home Screen; Android: install button). With push notifications.

PLANS: Free, Pro, Elite and Black Onyx. You can start free. Monthly or yearly billing (yearly is cheaper). Exact prices are in the PRICES section below. Change plan from My account → Subscription: upgrading is immediate, downgrading applies at the end of the paid period (you keep features until it ends).

AMBASSADORS: recurring commission for every subscriber you bring and a discount for your community; apply from the Ambassadors page.

SUPPORT: Onyx AI answers instantly; if needed, a person replies by email or in the Support Center.`,
};

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

export async function aiAnswer(question: string, lang: Lang, sensitive = false): Promise<AiAnswer> {
  // Chips "Abrir: ..." (solo para los botones). NO limita lo que la IA sabe: eso ahora es TODO el corpus.
  const found = searchArticles(question, lang).slice(0, 4);
  const chips = (found.length ? found : ARTICLES.slice(0, 4)).map((a) => ({ slug: a.slug, title: (a.title[lang] || a.title.en) }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { answer: '', confident: false, articles: chips, reason: 'no_key' };
  if (sensitive) return { answer: '', confident: false, articles: chips, reason: 'sensitive' };

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
      .select('name,name_en,price_month,price_year,max_accounts,features,features_en')
      .eq('active', true).order('sort', { ascending: true });
    if (plans?.length) {
      const rows = plans.map((p: any) => {
        const n = en ? (p.name_en || p.name) : p.name;
        const acc = p.max_accounts >= 999 ? (en ? 'unlimited accounts' : 'cuentas ilimitadas') : `${p.max_accounts} ${en ? 'accounts' : 'cuentas'}`;
        const feats = ((en ? p.features_en : p.features) || []).slice(0, 6).join(', ');
        return `- ${n}: $${p.price_month}/${en ? 'mo' : 'mes'} · $${p.price_year}/${en ? 'yr' : 'año'} · ${acc}. ${feats}`;
      }).join('\n');
      prices = `\n\n=== ${en ? 'PRICES AND PLANS (current)' : 'PRECIOS Y PLANES (actuales)'} ===\n${rows}`;
    }
  } catch {}

  const persona = en
    ? `You are Onyx AI, the support agent for Onyx Trading Live. Assume the person may know NOTHING about Onyx and may ask in vague, incomplete or misspelled ways — figure out their intent and help anyway. Be brief, warm and clear. IMPORTANT: write in PLAIN TEXT only — do NOT use markdown: no asterisks for bold (no ** **), no # headings, no backticks. To emphasize, just write the words normally. For lists use a simple "• " bullet at the start of the line. A few tasteful emojis are fine.
KNOWLEDGE RULES:
• For GENERAL trading and industry questions — what a prop firm is, what FTMO / FundedNext / The5ers / FundingPips are, trading platforms (MetaTrader, cTrader, TradingView), and trading terms (drawdown, profit factor, pips, lot size...) — answer with your OWN general knowledge. You do NOT need an article for that; never say "I have no article on this". Keep it accurate and neutral.
• For ONYX-SPECIFIC facts (what Onyx does, its features, how to connect, and PRICES) rely on the knowledge and prices below. Never invent Onyx features or make up prices.
• When a general concept relates to Onyx (e.g. "does Onyx work with FTMO?"), explain the concept briefly AND connect it to Onyx using the knowledge below.
Never give financial/market advice or predict the market. If the question is too vague to answer well, ask ONE short clarifying question instead of guessing. Do NOT add a signature. ONLY reply with the exact token NO_ANSWER (nothing else) when the question needs the user's PRIVATE account data you cannot see — e.g. "why was I charged", "is MY account blocked", "MY balance". For everything else, help.`
    : `Eres Onyx AI, el agente de soporte de Onyx Trading Live. Supón que la persona quizá NO conoce nada de Onyx y puede preguntar de forma vaga, incompleta o con errores — deduce su intención y ayúdala igual. Sé breve, cercano y claro. IMPORTANTE: escribe en TEXTO PLANO — NO uses markdown: nada de asteriscos para negrita (nada de ** **), ni títulos con #, ni comillas invertidas. Para enfatizar, escribe las palabras normal. Para listas usa una viñeta simple "• " al inicio de la línea. Algunos emojis con criterio están bien.
REGLAS DE CONOCIMIENTO:
• Para preguntas GENERALES de trading y del sector — qué es una prop firm, qué son FTMO / FundedNext / The5ers / FundingPips, plataformas (MetaTrader, cTrader, TradingView) y términos (drawdown, profit factor, pips, lotaje...) — responde con tu PROPIO conocimiento general. NO necesitas un artículo para eso; nunca digas "no tengo información sobre esto en mis artículos". Sé exacto y neutral.
• Para hechos ESPECÍFICOS de Onyx (qué hace Onyx, sus funciones, cómo conectar y los PRECIOS) usa el conocimiento y los precios de abajo. Nunca inventes funciones de Onyx ni te inventes precios.
• Cuando un concepto general se relaciona con Onyx (p. ej. "¿Onyx funciona con FTMO?"), explica el concepto brevemente Y conéctalo con Onyx usando el conocimiento de abajo.
Nunca des consejo financiero/de mercado ni predigas el mercado. Si la pregunta es demasiado vaga para responder bien, haz UNA pregunta corta de aclaración en vez de adivinar. No añadas firma. SOLO responde con el token exacto NO_ANSWER (y nada más) cuando la pregunta necesite datos PRIVADOS de la cuenta del usuario que no puedes ver — p. ej. "por qué me cobraron", "está bloqueada MI cuenta", "MI saldo". Para todo lo demás, ayuda.`;

  const knowledge = `=== ${en ? 'ONYX KNOWLEDGE' : 'CONOCIMIENTO DE ONYX'} ===\n${brief}\n\n=== ${en ? 'HELP ARTICLES' : 'ARTÍCULOS DE AYUDA'} ===\n${guide}`
    + (kbText ? `\n\n=== ${en ? 'KNOWLEDGE BASE' : 'BASE DE CONOCIMIENTO'} ===\n${kbText}` : '')
    + (blogText ? `\n\n=== BLOG ===\n${blogText}` : '');

  // Instrucciones extra del admin (tono, reglas propias) — se añaden al final del persona.
  const personaFull = persona + aiLangDirective(lang) + (adminExtra ? `\n\n${en ? 'EXTRA INSTRUCTIONS (from admin)' : 'INSTRUCCIONES EXTRA (del admin)'}:\n${adminExtra}` : '');

  const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
  const headers: any = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  const userMsg = [{ role: 'user', content: question.slice(0, 2000) }];

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
    if (!r.ok) return { answer: '', confident: false, articles: chips, reason: 'error' };
    const data = await r.json();
    const raw = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    if (!raw || /NO_ANSWER/i.test(raw)) return { answer: '', confident: false, articles: chips, reason: 'declined' };
    // El chat muestra texto plano; quitamos cualquier markdown que se le escape al modelo
    // (negritas **, títulos #, `código`) y normalizamos las viñetas a "• ".
    const answer = stripMarkdown(raw);
    return { answer, confident: true, articles: chips, reason: 'ok' };
  } catch {
    return { answer: '', confident: false, articles: chips, reason: 'error' };
  }
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
