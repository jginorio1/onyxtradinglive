import { dictFor } from '@/lib/i18n';
import { ARTICLES, searchArticles, type Article, type Lang } from '@/lib/guide';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { getSetting } from '@/lib/settings';

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
  es: `Onyx Trading Live es un diario de trading para MetaTrader (MT4 y MT5) con un Expert Advisor (EA) llamado Onyx Guardian.

CONECTAR: El trader instala el EA de Onyx dentro de su MetaTrader; el EA envía sus operaciones a Onyx. Onyx NUNCA tiene la contraseña ni puede mover dinero. Se conecta creando una clave API desde "Cuentas", pegándola en el EA; al primer envío la clave queda atada a ese número de cuenta. Una clave por cuenta; el plan decide cuántas cuentas activas puedes tener.

ONYX GUARDIAN (gestor de riesgo): hace respetar reglas — límite de pérdida diaria, límite de pérdida total, protección/bloqueo de ganancias, aviso antes de noticias de alto impacto y controles de riesgo. "Mi reto" es un marcador para cuentas de fondeo/prop firm que compara tu progreso con las reglas del reto (objetivo, pérdida diaria/total, días mínimos, consistencia). Hay una calculadora de lotaje/riesgo. Cumplir las reglas de la prop firm es responsabilidad del trader.

COPY TRADING: copia operaciones entre las cuentas del propio trader (una maestra a una o varias esclavas) con PIN y controles de riesgo por enlace. Es un gestor multicuenta legítimo.

FONDEO / PROP FIRMS: Onyx sirve para challenges y cuentas fondeadas.

ALERTAS: por Telegram (planes Elite y superiores) — fondeo, gestor, noticias, EA caído, meta, resumen diario/semanal.

APP MÓVIL: Onyx es instalable como app (PWA) en iPhone y Android desde el navegador (en iPhone: Compartir → Añadir a inicio; en Android: botón instalar). Con notificaciones push.

PLANES: Free, Pro, Elite y Black Onyx. Se empieza gratis. Pago mensual o anual (el anual sale más barato). Los precios exactos están en la sección PRECIOS de abajo. Cambiar de plan desde Mi cuenta → Suscripción: subir es inmediato, bajar se aplica al final del periodo pagado (conservas las funciones hasta que termine).

EMBAJADORES: comisión recurrente por cada suscriptor que traigas y descuento para tu comunidad; se solicita desde la página de Embajadores.

SOPORTE: Onyx AI responde al instante; si hace falta, una persona contesta por correo o en el Centro de soporte.`,
  en: `Onyx Trading Live is a trading journal for MetaTrader (MT4 and MT5) with an Expert Advisor (EA) called Onyx Guardian.

CONNECT: The trader installs the Onyx EA inside their MetaTrader; the EA sends their trades to Onyx. Onyx NEVER has the password and cannot move money. You connect by creating an API key from "Accounts" and pasting it into the EA; on the first sync the key is bound to that account number. One key per account; the plan decides how many active accounts you can have.

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
export async function aiAnswer(question: string, lang: Lang, sensitive = false): Promise<AiAnswer> {
  const found = searchArticles(question, lang).slice(0, 4);
  const pool = found.length ? found : ARTICLES.slice(0, 4);
  const articles = pool.map((a) => ({ slug: a.slug, title: (a.title[lang]||a.title.en) }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { answer: '', confident: false, articles, reason: 'no_key' };
  if (sensitive) return { answer: '', confident: false, articles, reason: 'sensitive' };

  const context = pool.map((a) => articleText(a, lang)).join('\n\n---\n\n');

  // Contexto extra: precios y planes REALES (de la BD) + base de conocimiento.
  // Es lo mismo que usa el chat de la web, para que preguntas de precios se
  // respondan solas y con datos correctos (no "no sé").
  let extra = '';
  try {
    const { data: plans } = await supabaseAdmin.from('plans')
      .select('name,name_en,price_month,price_year,max_accounts,features,features_en')
      .eq('active', true).order('sort', { ascending: true });
    if (plans?.length) {
      const rows = plans.map((p: any) => {
        const n = enBase(lang) ? (p.name_en || p.name) : p.name;
        const acc = p.max_accounts >= 999 ? (enBase(lang) ? 'unlimited accounts' : 'cuentas ilimitadas') : `${p.max_accounts} ${enBase(lang) ? 'accounts' : 'cuentas'}`;
        const feats = ((enBase(lang) ? p.features_en : p.features) || []).slice(0, 6).join(', ');
        return `- ${n}: $${p.price_month}/${enBase(lang) ? 'mo' : 'mes'} · $${p.price_year}/${enBase(lang) ? 'yr' : 'año'} · ${acc}. ${feats}`;
      }).join('\n');
      extra += `\n\n=== ${enBase(lang) ? 'PRICES AND PLANS (current)' : 'PRECIOS Y PLANES (actuales)'} ===\n${rows}`;
    }
  } catch {}
  try {
    const words = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const { data: kb } = await supabaseAdmin.from('kb_articles').select('title,body,tags').eq('published', true).limit(30);
    const scored = (kb || []).map((a: any) => {
      const hay = `${a.title} ${a.tags} ${a.body}`.toLowerCase();
      return { a, score: words.reduce((s: number, w: string) => s + (hay.includes(w) ? 1 : 0), 0) };
    }).sort((x, y) => y.score - x.score).slice(0, 3).filter((x) => x.score > 0);
    if (scored.length) extra += `\n\n=== ${enBase(lang) ? 'KNOWLEDGE BASE' : 'BASE DE CONOCIMIENTO'} ===\n` + scored.map((x) => `# ${x.a.title}\n${x.a.body}`).join('\n\n');
  } catch {}

  const system = (enBase(lang)
    ? `You are Onyx AI, the support agent for Onyx Trading Live. Answer the user's message helpfully and accurately using the ONYX KNOWLEDGE, current PRICES and KNOWLEDGE BASE below. Be brief, warm and clear, like a great support agent. Use a few tasteful emojis and bullet points for readability. Prices below are authoritative for any pricing question. Do NOT add a signature or sign-off — it is added automatically. Never invent features or give financial advice. Answer general product, pricing, how-to and feature questions confidently. ONLY reply with the exact token NO_ANSWER (and nothing else) when the question requires the user's PRIVATE account data that you cannot see — for example "why was I charged X", "is MY account blocked", "what is MY balance", a specific bug tied to their account. For everything else, give a helpful answer.`
    : `Eres Onyx AI, el agente de soporte de Onyx Trading Live. Responde al mensaje del usuario de forma útil y correcta usando el CONOCIMIENTO DE ONYX, los PRECIOS actuales y la BASE DE CONOCIMIENTO de abajo. Sé breve, cercano y claro, como un gran agente de soporte. Usa algunos emojis con criterio y viñetas para que sea legible. Los precios de abajo son la fuente oficial para cualquier pregunta de precios. NO añadas firma ni despedida — se agrega automáticamente. No inventes funciones ni des consejo financiero. Responde con seguridad las preguntas generales de producto, precios, cómo hacer algo y funciones. SOLO responde con el token exacto NO_ANSWER (y nada más) cuando la pregunta necesite datos PRIVADOS de la cuenta del usuario que no puedes ver — por ejemplo "por qué me cobraron X", "está bloqueada MI cuenta", "cuál es MI saldo", o un fallo concreto atado a su cuenta. Para todo lo demás, da una respuesta útil.`)
    + `\n\n=== ${enBase(lang) ? 'ONYX KNOWLEDGE' : 'CONOCIMIENTO DE ONYX'} ===\n${dictFor(ONYX_BRIEF, lang)}`
    + `\n\n=== ${enBase(lang) ? 'HELP ARTICLES' : 'ARTÍCULOS DE AYUDA'} ===\n${context}` + extra + aiLangDirective(lang);

  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: 'user', content: question.slice(0, 2000) }] }),
    });
    if (!r.ok) return { answer: '', confident: false, articles, reason: 'error' };
    const data = await r.json();
    const answer = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    // El modelo declara que necesita datos privados → a un humano
    if (!answer || /NO_ANSWER/i.test(answer)) return { answer: '', confident: false, articles, reason: 'declined' };
    return { answer, confident: true, articles, reason: 'ok' };
  } catch {
    return { answer: '', confident: false, articles, reason: 'error' };
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
