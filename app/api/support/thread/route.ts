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
    const { data: msgs } = await supabaseAdmin.from('support_messages')
      .select('id,sender,body,attachments,created_at')
      .eq('ticket_id', (tk as any).id).neq('sender', 'note')
      .order('created_at', { ascending: true }).limit(200);
    const messages = (msgs || []).map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',   // agente e IA se ven como "assistant"
      by: m.sender,                                         // 'user' | 'admin' | 'ai'
      content: m.body || '',
      attachments: m.attachments || [],
      at: m.created_at,
    }));
    return NextResponse.json({ ok: true, status: (tk as any).status, messages });
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

    await supabaseAdmin.from('support_messages').insert({ ticket_id: (tk as any).id, sender: 'user', body });
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
