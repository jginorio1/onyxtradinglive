import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyNewTicket } from '@/lib/supportNotify';
import { rateLimit, clientIp, tooMany } from '@/lib/ratelimit';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Hilo público del lead (visitante SIN cuenta) por TOKEN.
// El token (uuid, imposible de adivinar) se entregó al crear el lead y vive en
// el navegador del visitante. Con él, el widget muestra las respuestas del agente
// y deja que el visitante siga escribiendo — sin exponer nada de otros tickets.
// Nunca devuelve notas internas (sender 'note') ni datos de terceros.
// ============================================================

async function ticketByToken(token: string) {
  if (!token || token.length < 10) return null;
  const { data } = await supabaseAdmin.from('support_tickets')
    .select('id,status,subject').eq('public_token', token).maybeSingle();
  return data || null;
}

// GET ?token=... · mensajes del hilo (sin notas internas)
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token') || '';
    const tk = await ticketByToken(token);
    if (!tk) return NextResponse.json({ ok: false, messages: [] });
    // Intentamos traer también `meta` (versiones traducidas); si la columna aún no
    // existe, reintentamos sin ella para no romper el hilo.
    let msgs: any[] = [];
    {
      const r = await supabaseAdmin.from('support_messages')
        .select('id,sender,sender_id,body,attachments,meta,created_at')
        .eq('ticket_id', (tk as any).id).neq('sender', 'note')
        .order('created_at', { ascending: true }).limit(200);
      if (r.error) {
        const r2 = await supabaseAdmin.from('support_messages')
          .select('id,sender,sender_id,body,attachments,created_at')
          .eq('ticket_id', (tk as any).id).neq('sender', 'note')
          .order('created_at', { ascending: true }).limit(200);
        msgs = r2.data || [];
      } else { msgs = r.data || []; }
    }

    // Nombre del agente que atiende (el humano que respondió más reciente). Así el
    // cliente ve CON QUIÉN habla, no solo "Equipo". Si no hay humano aún, queda ''.
    let agent = '';
    let agentAvatar = '';
    try {
      const adminIds = Array.from(new Set((msgs || []).filter((m: any) => m.sender === 'admin' && m.sender_id).map((m: any) => m.sender_id)));
      if (adminIds.length) {
        const { data: profs } = await supabaseAdmin.from('profiles').select('id,full_name,email,avatar_url').in('id', adminIds as any);
        const lastAdmin = [...(msgs || [])].reverse().find((m: any) => m.sender === 'admin' && m.sender_id);
        if (lastAdmin) {
          const p: any = (profs || []).find((x: any) => x.id === (lastAdmin as any).sender_id);
          agent = (p?.full_name || (p?.email ? String(p.email).split('@')[0] : '') || '').trim();
          agentAvatar = String(p?.avatar_url || '').trim();
        }
      }
    } catch {}

    // El cliente ve SIEMPRE en su idioma. Para mensajes del agente guardamos la
    // versión del cliente en meta.alt (si existe); los del propio cliente ya están
    // en su idioma. Así nunca ve español si él escribe en inglés.
    const messages = (msgs || []).map((m: any) => {
      const meta = m.meta || null;
      let content = m.body || '';
      if (m.sender !== 'user' && meta && meta.alt) content = meta.alt; // versión en idioma del cliente
      return {
        role: m.sender === 'user' ? 'user' : 'assistant',   // agente e IA se ven como "assistant"
        by: m.sender,                                         // 'user' | 'admin' | 'ai'
        content,
        attachments: m.attachments || [],
        at: m.created_at,
      };
    });
    // ¿El agente está escribiendo ahora? (sello de tiempo reciente < 8s). Tolerante:
    // si la columna agent_typing_at no existe, simplemente no se muestra.
    let agentTyping = false;
    try {
      const { data: tt } = await supabaseAdmin.from('support_tickets').select('agent_typing_at').eq('id', (tk as any).id).maybeSingle();
      const at = (tt as any)?.agent_typing_at;
      if (at) agentTyping = (Date.now() - new Date(at).getTime()) < 8000;
    } catch {}

    return NextResponse.json({ ok: true, status: (tk as any).status, agent, agentAvatar, agentTyping, messages });
  } catch (e: any) {
    await logError('support_thread', e);
    return NextResponse.json({ ok: false, messages: [] });
  }
}

// POST { token, body } · el visitante responde desde el widget
export async function POST(req: Request) {
  try {
    const rl = await rateLimit('support_thread', clientIp(req), 20, 60);
    if (!rl.ok) return tooMany(rl.retryAfter, 'es');
    const b = await req.json().catch(() => ({} as any));
    const token = String(b.token || '');
    const body = String(b.body || '').trim().slice(0, 4000);
    if (!body) return NextResponse.json({ error: 'empty', code: 'empty' }, { status: 400 });
    const tk = await ticketByToken(token);
    if (!tk) return NextResponse.json({ error: 'not found', code: 'notfound' }, { status: 404 });

    // Soporte bilingüe: detecta el idioma del cliente y guarda junto al original
    // la versión en el idioma del empleado (para que éste la lea). Tolerante: si no
    // hay clave de IA o la columna meta no existe, guarda el mensaje tal cual.
    try {
      const { inbound, insertMessage, setTicketClientLang, ticketClientLang } = await import('@/lib/supportTranslate');
      const known = await ticketClientLang((tk as any).id);
      const { clientLang, meta } = await inbound(body, known);
      await insertMessage({ ticket_id: (tk as any).id, sender: 'user', body }, meta);
      if (!known && clientLang) await setTicketClientLang((tk as any).id, clientLang);
    } catch {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: (tk as any).id, sender: 'user', body });
    }
    // Reabrir si estaba resuelto y marcar actividad para que suba en la bandeja.
    const patch: any = { updated_at: new Date().toISOString() };
    if ((tk as any).status === 'resolved') patch.status = 'open';
    await supabaseAdmin.from('support_tickets').update(patch).eq('id', (tk as any).id);
    try { await notifyNewTicket({ email: '', subject: (tk as any).subject || 'Respuesta del visitante', isLead: true }); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('support_thread', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
