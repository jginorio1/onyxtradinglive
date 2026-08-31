import { pickLang } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ARTICLES, searchArticles, type Lang } from '@/lib/guide';
import { supportChatReply } from '@/lib/supportAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Chat público de Onyx AI (el widget de la web). Usa el MISMO cerebro que el resto:
// lee toda la Guía + Base IA + blog, respeta el prompt editable del admin, responde en
// texto plano y en el idioma del usuario, con historial de conversación. Si no hay clave
// del proveedor, cae a un modo buscador para no romper nunca.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();

    const b = await req.json().catch(() => ({}));
    const question = String(b.question || '').slice(0, 2000).trim();
    const lang: Lang = pickLang(b.lang);
    const history: any[] = Array.isArray(b.history) ? b.history.slice(-6) : [];
    if (!question) return NextResponse.json({ error: 'empty' }, { status: 400 });

    // Artículos sugeridos para los botones "Abrir: ...".
    const found = searchArticles(question, lang).slice(0, 5);
    const pool = found.length ? found : ARTICLES.slice(0, 5);
    const refs = pool.map((a) => ({ slug: a.slug, title: a.title[lang] || a.title.en }));

    // Sin proveedor de IA → modo buscador (nunca rompe).
    if (!process.env.ANTHROPIC_API_KEY) {
      const top = pool[0];
      const answer = lang === 'en'
        ? `Here is the help article that best matches your question: "${top.title.en}". If it does not solve it, open a ticket and a person will help you.`
        : `Este es el artículo de ayuda que mejor encaja con tu pregunta: "${top.title.es}". Si no lo resuelve, abre un ticket y te ayuda una persona.`;
      return NextResponse.json({ answer, articles: refs, escalate: true, mode: 'search' });
    }

    // Contexto de la cuenta (solo con sesión), para respuestas conscientes.
    let acctContext = '';
    if (user) {
      const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('last_sync_at').eq('user_id', user.id)
        .order('last_sync_at', { ascending: false, nullsFirst: false }).limit(1);
      const last = accs?.[0]?.last_sync_at;
      const live = last && (Date.now() - new Date(last).getTime()) < 120000;
      const eaState = !last ? 'aún no ha conectado ningún EA' : live ? 'su EA está reportando ahora' : `su EA no reporta desde ${new Date(last).toLocaleString()}`;
      acctContext = `=== CONTEXTO DEL USUARIO (úsalo para personalizar, no lo repitas literal) ===\nTiene cuenta. Plan: ${prof?.plan || 'free'}. Estado del EA: ${eaState}.`;
    } else {
      acctContext = lang === 'en'
        ? `=== CONTEXT ===\nThis is a VISITOR without an account. If it fits, naturally invite them to create a free account or leave their email so we can reply. Do not be pushy.`
        : `=== CONTEXTO ===\nEs un VISITANTE sin cuenta. Si encaja, invítale de forma natural a crear su cuenta gratis o a dejar su correo para responderle. No seas insistente.`;
    }

    const r = await supportChatReply(question, lang, history, acctContext);

    // Necesita datos privados de la cuenta → a un humano.
    if (r.declined) {
      const answer = lang === 'en'
        ? 'For that I need details only your account team can see. The best is to open a ticket and a person will check it for you. 🙌'
        : 'Para eso necesito datos que solo puede ver el equipo de tu cuenta. Lo mejor es abrir un ticket y una persona lo revisa por ti. 🙌';
      return NextResponse.json({ answer, articles: refs, escalate: true, mode: 'ai' });
    }
    // Error / proveedor ocupado → artículo + ticket.
    if (!r.ok || !r.answer) {
      const top = pool[0];
      const answer = lang === 'en'
        ? `The assistant is busy right now. Meanwhile, this article should help: "${top.title.en}". You can also open a ticket.`
        : `El asistente está ocupado ahora. Mientras tanto, este artículo debería ayudarte: "${top.title.es}". También puedes abrir un ticket.`;
      return NextResponse.json({ answer, articles: refs, escalate: true, mode: 'fallback' });
    }
    return NextResponse.json({ answer: r.answer, articles: refs, escalate: false, mode: 'ai' });
  } catch (e: any) {
    await logError('support_ai', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
