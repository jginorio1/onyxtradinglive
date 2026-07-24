import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ARTICLES, searchArticles, type Article, type Lang } from '@/lib/guide';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Aplana el cuerpo de un artículo a texto plano, para dárselo a la IA.
function articleText(a: Article, lang: Lang): string {
  const blocks = a.body[lang] || [];
  const parts = blocks.map((b: any) => b.p || b.h || b.note || b.warn || (b.list || b.steps || []).join(' · ') || '');
  return `# ${a.title[lang]}\n${a.summary[lang]}\n${parts.filter(Boolean).join('\n')}`;
}

// Onyx AI: responde con TU Guía. Si no hay clave del proveedor, cae a un
// modo sin IA que devuelve el mejor artículo (para no romper nunca).
export async function POST(req: Request) {
  try {
    // Auth OPCIONAL: los visitantes sin cuenta también pueden preguntar.
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();

    const b = await req.json().catch(() => ({}));
    const question = String(b.question || '').slice(0, 2000).trim();
    const lang: Lang = b.lang === 'en' ? 'en' : 'es';
    const history: any[] = Array.isArray(b.history) ? b.history.slice(-6) : [];
    if (!question) return NextResponse.json({ error: 'empty' }, { status: 400 });

    // Recupera los artículos más relevantes de la Guía
    const found = searchArticles(question, lang).slice(0, 3);
    const pool = found.length ? found : ARTICLES.slice(0, 3);
    const refs = pool.map((a) => ({ slug: a.slug, title: a.title[lang] }));

    const apiKey = process.env.ANTHROPIC_API_KEY;

    // --- Sin proveedor de IA: modo buscador ---
    if (!apiKey) {
      const top = pool[0];
      const answer = lang === 'en'
        ? `Here is the help article that best matches your question: "${top.title.en}". If it does not solve it, open a ticket and a person will help you.`
        : `Este es el artículo de ayuda que mejor encaja con tu pregunta: "${top.title.es}". Si no lo resuelve, abre un ticket y te ayuda una persona.`;
      return NextResponse.json({ answer, articles: refs, escalate: true, mode: 'search' });
    }

    // Contexto de la cuenta (solo si hay sesión), para respuestas conscientes
    let acctContext = '';
    if (user) {
      const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('last_sync_at').eq('user_id', user.id)
        .order('last_sync_at', { ascending: false, nullsFirst: false }).limit(1);
      const last = accs?.[0]?.last_sync_at;
      const live = last && (Date.now() - new Date(last).getTime()) < 120000;
      const eaState = !last ? 'aún no ha conectado ningún EA' : live ? 'su EA está reportando ahora' : `su EA no reporta desde ${new Date(last).toLocaleString()}`;
      acctContext = `\n\n=== CONTEXTO DEL USUARIO (úsalo para personalizar, no lo repitas literal) ===\nTiene cuenta. Plan: ${prof?.plan || 'free'}. Estado del EA: ${eaState}.`;
    } else {
      acctContext = `\n\n=== CONTEXTO ===\nEs un VISITANTE sin cuenta. Si encaja, invítale de forma natural a crear su cuenta gratis o a dejar su correo para que le respondamos. No seas insistente.`;
    }

    // --- Con IA: respuesta conversacional apoyada en la Guía ---
    const context = pool.map((a) => articleText(a, lang)).join('\n\n---\n\n');
    const system = (lang === 'en'
      ? `You are Onyx AI, the support assistant for Onyx Trading Live (a trading journal with an MT4/MT5 Expert Advisor called Onyx Guardian). Answer ONLY from the help articles below, in English, briefly and warmly. If the answer is not in them, say you cannot be sure and suggest opening a ticket. Never invent features. Do not give financial advice.`
      : `Eres Onyx AI, el asistente de soporte de Onyx Trading Live (un diario de trading con un Expert Advisor para MT4/MT5 llamado Onyx Guardian). Responde SOLO con los artículos de ayuda de abajo, en español, breve y cercano. Si la respuesta no está en ellos, di que no puedes asegurarlo y sugiere abrir un ticket. No inventes funciones. No des consejo financiero.`)
      + acctContext
      + `\n\n=== ARTÍCULOS DE AYUDA ===\n${context}`;

    const messages = [
      ...history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
      { role: 'user', content: question },
    ];

    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 600, system, messages }),
    });
    if (!r.ok) {
      const top = pool[0];
      const answer = lang === 'en'
        ? `The assistant is busy right now. Meanwhile, this article should help: "${top.title.en}". You can also open a ticket.`
        : `El asistente está ocupado ahora. Mientras tanto, este artículo debería ayudarte: "${top.title.es}". También puedes abrir un ticket.`;
      return NextResponse.json({ answer, articles: refs, escalate: true, mode: 'fallback' });
    }
    const data = await r.json();
    const answer = (data?.content || []).map((c: any) => c.text || '').join('\n').trim()
      || (lang === 'en' ? 'I could not generate an answer. Try opening a ticket.' : 'No pude generar una respuesta. Prueba a abrir un ticket.');

    return NextResponse.json({ answer, articles: refs, escalate: false, mode: 'ai' });
  } catch (e: any) {
    await logError('support_ai', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
