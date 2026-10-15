import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pickLang, enBase } from '@/lib/i18n';
import { type Lang } from '@/lib/guide';
import { supportChatReply } from '@/lib/supportAI';
import { getSupportContext, contextToPrompt } from '@/lib/supportContext';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Borrador de respuesta PARA EL AGENTE HUMANO.
// A diferencia del chat público (/api/support/ai), aquí la IA ve:
//   · TODO el hilo del ticket (no solo el primer mensaje), y
//   · la ficha del trader (plan, conector, Guardian, copy, facturación…)
// para que el borrador salga personalizado y casi listo para enviar.
// También refina un borrador ya escrito (acortar / más formal / traducir).
// ============================================================
export async function POST(req: Request) {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const b = await req.json().catch(() => ({} as any));
    const ticketId = String(b.ticket_id || '').trim();
    const lang: Lang = pickLang(b.lang);
    const en = enBase(lang);
    const mode: 'draft' | 'refine' = b.mode === 'refine' ? 'refine' : 'draft';

    // --- REFINAR: reescribe un borrador ya escrito con una instrucción corta ---
    if (mode === 'refine') {
      const current = String(b.current || '').slice(0, 4000).trim();
      if (!current) return NextResponse.json({ error: 'empty', code: 'empty' }, { status: 400 });
      const op = String(b.op || 'shorten');
      // "Traducir" va al idioma OPUESTO al del agente (ES↔EN).
      const toEN = !en; // si el agente trabaja en español, traduce al inglés, y viceversa
      const instr = en
        ? ({
            shorten: 'Rewrite the following support message to be clearly shorter and tighter, keeping the key info and a warm tone.',
            formal: 'Rewrite the following support message in a more professional, polished tone, keeping the meaning.',
            translate: `Translate the following support message into ${toEN ? 'English' : 'Spanish'}, keeping the tone natural.`,
          } as any)[op] || 'Improve the following support message.'
        : ({
            shorten: 'Reescribe el siguiente mensaje de soporte para que sea claramente más corto y directo, conservando lo importante y un tono cercano.',
            formal: 'Reescribe el siguiente mensaje de soporte con un tono más profesional y pulido, conservando el significado.',
            translate: `Traduce el siguiente mensaje de soporte al ${toEN ? 'inglés' : 'español'}, con un tono natural.`,
          } as any)[op] || 'Mejora el siguiente mensaje de soporte.';
      const q = `${instr}\n${en ? 'Return ONLY the rewritten message — no quotes, no preamble, no explanation.' : 'Devuelve SOLO el mensaje reescrito — sin comillas, sin preámbulo, sin explicación.'}\n\n${en ? 'MESSAGE' : 'MENSAJE'}:\n${current}`;
      // El idioma con el que llamamos a la IA = idioma DESTINO (para traducir, el opuesto),
      // así su directiva de idioma no pelea con la instrucción.
      const callLang: Lang = op === 'translate' ? (en ? 'es' : 'en') : lang;
      const r = await supportChatReply(q, callLang, [], '');
      if (!r.ok || !r.answer) return NextResponse.json({ error: 'ai', code: 'ai' }, { status: 502 });
      return NextResponse.json({ answer: r.answer });
    }

    // --- BORRADOR: respuesta nueva con contexto + hilo completo ---
    if (!ticketId) return NextResponse.json({ error: 'falta ticket', code: 'missing' }, { status: 400 });

    const { data: tk } = await supabaseAdmin
      .from('support_tickets').select('id,user_id,email,subject').eq('id', ticketId).maybeSingle();
    if (!tk) return NextResponse.json({ error: 'ticket no existe', code: 'notfound' }, { status: 404 });

    // Resolver user_id (por cuenta o emparejando por correo, igual que la ficha).
    let userId = (tk as any).user_id || null;
    const email = (tk as any).email || '';
    if (!userId && email) {
      const { data: byMail } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
      if (byMail) userId = (byMail as any).id;
    }

    // Hilo completo → historial de conversación (sin notas internas).
    const { data: rows } = await supabaseAdmin
      .from('support_messages').select('sender,body,created_at')
      .eq('ticket_id', ticketId).order('created_at', { ascending: true }).limit(40);
    const msgs = (rows || []).filter((m: any) => m.sender !== 'note' && String(m.body || '').trim());
    // El historial son todos menos el último mensaje del cliente, que es la "pregunta".
    const history = msgs.map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: String(m.body || ''),
    }));
    // La "pregunta" que la IA debe responder: el último mensaje del cliente; si el
    // último es del equipo, usamos igualmente el último del cliente (o el asunto).
    let question = '';
    for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].sender === 'user') { question = String(msgs[i].body || ''); break; } }
    if (!question) question = String((tk as any).subject || '').trim() || (en ? 'How can we help?' : '¿En qué podemos ayudar?');
    // Quitamos del historial ese último mensaje del cliente (va como pregunta).
    const qi = history.map((h) => h.content).lastIndexOf(question);
    const hist = qi >= 0 ? history.slice(0, qi) : history;

    // Ficha del trader → contexto personalizado (solo estados, nunca cifras).
    let acctContext = '';
    if (userId) {
      try { acctContext = contextToPrompt(await getSupportContext(userId), en); } catch {}
    } else if (email) {
      acctContext = en
        ? `=== CONTEXT ===\nThis is a VISITOR/LEAD without an Onyx account (email: ${email}).`
        : `=== CONTEXTO ===\nEs un VISITANTE/LEAD sin cuenta en Onyx (correo: ${email}).`;
    }
    // Directiva para el agente: esto es un BORRADOR para que una persona lo envíe.
    acctContext += en
      ? `\n\n=== DRAFT FOR A HUMAN AGENT ===\nYou are drafting the reply that a human support agent will review and send to this customer. Write ONLY the message body to send — warm, direct and personalized using the state signals above (use their first name if known). No greeting line like "Hi, this is support", no signature, no internal notes.`
      : `\n\n=== BORRADOR PARA UN AGENTE HUMANO ===\nEstás redactando la respuesta que un agente humano revisará y enviará a este cliente. Escribe SOLO el cuerpo del mensaje a enviar — cercano, directo y personalizado con las señales de estado de arriba (usa su nombre si se conoce). Sin encabezado tipo "Hola, soy soporte", sin firma, sin notas internas.`;

    const r = await supportChatReply(question, lang, hist, acctContext);
    if (!r.ok || !r.answer) {
      const code = r.declined ? 'declined' : 'ai';
      return NextResponse.json({ error: code, code }, { status: 502 });
    }
    return NextResponse.json({ answer: r.answer });
  } catch (e: any) {
    await logError('support_draft', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
