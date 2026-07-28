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
  const blocks = (a.body[lang] || []) as any[];
  const parts = blocks.map((b) => b.p || b.h || b.note || b.warn || (b.list || b.steps || []).join(' · ') || '');
  return `# ${a.title[lang]}\n${a.summary[lang]}\n${parts.filter(Boolean).join('\n')}`;
}

export type AiAnswer = { answer: string; confident: boolean; articles: Array<{ slug: string; title: string }> };

// Redacta una respuesta apoyada SOLO en la Guía. `confident` es true únicamente
// cuando el modelo devolvió una respuesta real (no un fallback) y el tema no es
// sensible. Si no hay clave del proveedor, confident = false (no auto-responder).
export async function aiAnswer(question: string, lang: Lang, sensitive = false): Promise<AiAnswer> {
  const found = searchArticles(question, lang).slice(0, 4);
  const pool = found.length ? found : ARTICLES.slice(0, 4);
  const articles = pool.map((a) => ({ slug: a.slug, title: a.title[lang] }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || sensitive) return { answer: '', confident: false, articles };

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
        const n = lang === 'en' ? (p.name_en || p.name) : p.name;
        const acc = p.max_accounts >= 999 ? (lang === 'en' ? 'unlimited accounts' : 'cuentas ilimitadas') : `${p.max_accounts} ${lang === 'en' ? 'accounts' : 'cuentas'}`;
        const feats = ((lang === 'en' ? p.features_en : p.features) || []).slice(0, 6).join(', ');
        return `- ${n}: $${p.price_month}/${lang === 'en' ? 'mo' : 'mes'} · $${p.price_year}/${lang === 'en' ? 'yr' : 'año'} · ${acc}. ${feats}`;
      }).join('\n');
      extra += `\n\n=== ${lang === 'en' ? 'PRICES AND PLANS (current)' : 'PRECIOS Y PLANES (actuales)'} ===\n${rows}`;
    }
  } catch {}
  try {
    const words = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const { data: kb } = await supabaseAdmin.from('kb_articles').select('title,body,tags').eq('published', true).limit(30);
    const scored = (kb || []).map((a: any) => {
      const hay = `${a.title} ${a.tags} ${a.body}`.toLowerCase();
      return { a, score: words.reduce((s: number, w: string) => s + (hay.includes(w) ? 1 : 0), 0) };
    }).sort((x, y) => y.score - x.score).slice(0, 3).filter((x) => x.score > 0);
    if (scored.length) extra += `\n\n=== ${lang === 'en' ? 'KNOWLEDGE BASE' : 'BASE DE CONOCIMIENTO'} ===\n` + scored.map((x) => `# ${x.a.title}\n${x.a.body}`).join('\n\n');
  } catch {}

  const system = (lang === 'en'
    ? `You are Onyx AI, support for Onyx Trading Live (a trading journal with an MT4/MT5 Expert Advisor called Onyx Guardian). Reply to the user's message ONLY from the help info below (help articles, current prices/plans, and knowledge base), in English, briefly, warmly and helpfully, as if you were a support agent. Prices and plans below are authoritative — use them for any pricing question. Sign as "Onyx Trading Live team". If the answer is NOT clearly in the info below, reply exactly with the token NO_ANSWER and nothing else. Never invent features. Never give financial advice.`
    : `Eres Onyx AI, soporte de Onyx Trading Live (un diario de trading con un Expert Advisor para MT4/MT5 llamado Onyx Guardian). Responde al mensaje del usuario SOLO con la información de abajo (artículos de ayuda, precios/planes actuales y base de conocimiento), en español, breve, cercano y resolutivo, como un agente de soporte. Los precios y planes de abajo son la fuente oficial — úsalos para cualquier pregunta de precios. Firma como "Equipo de Onyx Trading Live". Si la respuesta NO está claramente en la información de abajo, responde exactamente con el token NO_ANSWER y nada más. No inventes funciones. No des consejo financiero.`)
    + `\n\n=== ARTÍCULOS DE AYUDA ===\n${context}` + extra;

  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: 'user', content: question.slice(0, 2000) }] }),
    });
    if (!r.ok) return { answer: '', confident: false, articles };
    const data = await r.json();
    const answer = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    // El modelo declara que no sabe → no auto-respondemos
    if (!answer || /NO_ANSWER/i.test(answer)) return { answer: '', confident: false, articles };
    return { answer, confident: true, articles };
  } catch {
    return { answer: '', confident: false, articles };
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

    if (!cfg.enabled) { await addNote(ticketId, lang === 'en' ? 'AI auto-reply is off: needs a human.' : 'Auto-respuesta IA apagada: requiere un humano.'); return { answered: false }; }
    if (sensitive) { await addNote(ticketId, lang === 'en' ? '⚠️ Sensitive topic (money/legal/account): needs a human, not auto-answered.' : '⚠️ Tema sensible (dinero/legal/cuenta): requiere un humano, no se auto-responde.'); return { answered: false }; }

    const ai = await aiAnswer(question, lang, sensitive);
    if (ai.confident && ai.answer) {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'ai', body: ai.answer });
      await supabaseAdmin.from('support_tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', ticketId);
      if (email) {
        const subj = opts.subject || (lang === 'en' ? 'Your question at Onyx' : 'Tu consulta en Onyx');
        await sendEmail(
          email,
          `Re: ${subj}`,
          `${ai.answer}\n\n—\n${lang === 'en' ? 'Onyx Trading Live team' : 'Equipo de Onyx Trading Live'}\n${lang === 'en' ? 'Reply to this email or open your Support Center if you need more help.' : 'Responde a este correo o entra a tu Centro de soporte si necesitas más ayuda.'}`,
          { kind: 'support' },
        );
      }
      await addNote(ticketId, (lang === 'en' ? '🤖 Auto-answered by Onyx AI. Review if it needs follow-up.' : '🤖 Respondido automáticamente por Onyx AI. Revisa si necesita seguimiento.'));
      return { answered: true };
    }
    await addNote(ticketId, (lang === 'en' ? 'AI could not resolve it confidently: needs a human.' : 'La IA no pudo resolverlo con seguridad: requiere un humano.') + (ai.articles.length ? (lang === 'en' ? ' Suggested: ' : ' Sugerencia: ') + ai.articles.map((a) => a.title).join(', ') : ''));
    return { answered: false };
  } catch { return { answered: false }; }
}
