import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATS = ['general', 'conexion', 'facturacion', 'guardian', 'instalacion'];

// GET · mis tickets con sus mensajes
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const { data: tickets } = await supabaseAdmin
      .from('support_tickets')
      .select('id,subject,category,status,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    const ids = (tickets || []).map((t: any) => t.id);
    let messages: any[] = [];
    if (ids.length) {
      const { data } = await supabaseAdmin
        .from('support_messages')
        .select('id,ticket_id,sender,body,created_at')
        .in('ticket_id', ids)
        .order('created_at', { ascending: true });
      messages = data || [];
    }
    return NextResponse.json({ tickets: tickets || [], messages });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · crear un ticket con su primer mensaje
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const subject = String(b.subject || '').trim().slice(0, 160);
    const body = String(b.body || '').trim().slice(0, 4000);
    const category = CATS.includes(String(b.category)) ? String(b.category) : 'general';
    if (!subject || !body) return NextResponse.json({ error: 'faltan datos', code: 'missing' }, { status: 400 });

    const { data: ticket, error } = await supabaseAdmin
      .from('support_tickets')
      .insert({ user_id: user.id, email: user.email || null, subject, category, status: 'open' })
      .select('id').single();
    if (error || !ticket) return NextResponse.json({ error: error?.message || 'error' }, { status: 500 });

    await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'user', body });
    return NextResponse.json({ ok: true, id: ticket.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · responder en un ticket propio, o marcarlo resuelto
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const ticketId = String(b.ticket_id || '');
    if (!ticketId) return NextResponse.json({ error: 'falta ticket', code: 'missing' }, { status: 400 });

    // El ticket debe ser suyo
    const { data: own } = await supabaseAdmin
      .from('support_tickets').select('id').eq('id', ticketId).eq('user_id', user.id).maybeSingle();
    if (!own) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    if (b.close) {
      await supabaseAdmin.from('support_tickets').update({ status: 'resolved', updated_at: new Date().toISOString() }).eq('id', ticketId);
      return NextResponse.json({ ok: true });
    }

    const body = String(b.body || '').trim().slice(0, 4000);
    if (!body) return NextResponse.json({ error: 'vacío', code: 'missing' }, { status: 400 });
    await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'user', body });
    // Reabrir si estaba resuelto y marcar actividad
    await supabaseAdmin.from('support_tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', ticketId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
