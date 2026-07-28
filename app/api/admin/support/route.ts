import { NextResponse } from 'next/server';
import { getAdmin, requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = ['open', 'in_progress', 'resolved'];

// GET · bandeja compartida: tickets + mensajes (incluidas notas internas) + equipo
export async function GET() {
  try {
    const g = await requirePerm('soporte', 'view');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    // La columna priority puede no existir aún (support_helpdesk.sql sin correr):
    // intentamos con ella y, si falla, repetimos sin ella para no romper la bandeja.
    let tickets: any[] = [];
    {
      const r = await supabaseAdmin
        .from('support_tickets')
        .select('id,user_id,email,subject,category,status,is_lead,channel,assignee_id,priority,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(300);
      if (r.error) {
        const r2 = await supabaseAdmin
          .from('support_tickets')
          .select('id,user_id,email,subject,category,status,is_lead,channel,assignee_id,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(300);
        tickets = r2.data || [];
      } else {
        tickets = r.data || [];
      }
    }

    const ids = tickets.map((t: any) => t.id);
    let messages: any[] = [];
    let participants: any[] = [];
    if (ids.length) {
      const [m, p] = await Promise.all([
        supabaseAdmin.from('support_messages').select('id,ticket_id,sender,body,created_at').in('ticket_id', ids).order('created_at', { ascending: true }),
        supabaseAdmin.from('ticket_participants').select('ticket_id,user_id').in('ticket_id', ids),
      ]);
      messages = m.data || [];
      participants = p.data || [];
    }
    // Marca presencia: el admin que carga la bandeja está activo ahora.
    if (g.user?.id) { try { await supabaseAdmin.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', g.user.id); } catch {} }

    // Equipo (para mostrar quién tiene asignado / disponible / última vez)
    const { data: team } = await supabaseAdmin.from('profiles').select('id,email,available,last_active').eq('is_admin', true);

    const counts = { open: 0, in_progress: 0, resolved: 0 } as any;
    tickets.forEach((t: any) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return NextResponse.json({ tickets, messages, participants, team: team || [], counts, me: g.user?.id || null });
  } catch (e: any) {
    await logError('support_admin', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · responder / nota interna / estado / asignar / invitar compañero
export async function PATCH(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const user = g.user;

    const b = await req.json().catch(() => ({}));
    const ticketId = String(b.ticket_id || '');
    if (!ticketId) return NextResponse.json({ error: 'falta ticket', code: 'missing' }, { status: 400 });

    const patch: any = { updated_at: new Date().toISOString() };
    if (b.status && STATUSES.includes(String(b.status))) patch.status = String(b.status);
    if (b.priority && ['low', 'normal', 'high'].includes(String(b.priority))) patch.priority = String(b.priority);

    // Tomar / asignar
    if (b.take) patch.assignee_id = user.id;
    if (b.assignee_id !== undefined) patch.assignee_id = b.assignee_id || null;

    // Nota interna (NO se envía al trader ni por correo)
    const note = String(b.note || '').trim().slice(0, 4000);
    if (note) {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'note', body: note });
      await logAdmin(user?.email || '', 'support_note', ticketId, {});
    }

    // Invitar a otro miembro a la conversación
    const invite = String(b.invite_email || '').trim().toLowerCase();
    if (invite) {
      const { data: m } = await supabaseAdmin.from('profiles').select('id').eq('email', invite).eq('is_admin', true).maybeSingle();
      if (m) { await supabaseAdmin.from('ticket_participants').upsert({ ticket_id: ticketId, user_id: m.id }); await logAdmin(user?.email || '', 'support_invite', ticketId, { invite }); }
    }

    // Respuesta al trader (+ correo)
    const body = String(b.body || '').trim().slice(0, 4000);
    let emailed = false;
    if (body) {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'admin', body });
      if (!patch.status) patch.status = 'in_progress';
      const { data: tk } = await supabaseAdmin.from('support_tickets').select('email,subject').eq('id', ticketId).maybeSingle();
      if (tk?.email) {
        emailed = await sendEmail(
          tk.email,
          `Re: ${tk.subject || 'Tu consulta en Onyx'}`,
          `${body}\n\n—\nEquipo de Onyx Trading Live\nResponde a este correo o entra a tu Centro de soporte para seguir la conversación.`,
        );
      }
      await logAdmin(user?.email || '', 'support_reply', ticketId, { emailed });
    }

    if (Object.keys(patch).length > 1 || body || note) {
      await supabaseAdmin.from('support_tickets').update(patch).eq('id', ticketId);
    }
    return NextResponse.json({ ok: true, emailed });
  } catch (e: any) {
    await logError('support_admin', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
