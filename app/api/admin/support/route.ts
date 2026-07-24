import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = ['open', 'in_progress', 'resolved'];

// GET · bandeja: todos los tickets con sus mensajes
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const { data: tickets } = await supabaseAdmin
      .from('support_tickets')
      .select('id,user_id,email,subject,category,status,is_lead,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);

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
    const counts = { open: 0, in_progress: 0, resolved: 0 } as any;
    (tickets || []).forEach((t: any) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return NextResponse.json({ tickets: tickets || [], messages, counts });
  } catch (e: any) {
    await logError('support_admin', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · responder y/o cambiar el estado de un ticket
export async function PATCH(req: Request) {
  try {
    const { user, isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    const ticketId = String(b.ticket_id || '');
    if (!ticketId) return NextResponse.json({ error: 'falta ticket', code: 'missing' }, { status: 400 });

    const patch: any = { updated_at: new Date().toISOString() };
    if (b.status && STATUSES.includes(String(b.status))) patch.status = String(b.status);

    const body = String(b.body || '').trim().slice(0, 4000);
    let emailed = false;
    if (body) {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'admin', body });
      if (!patch.status) patch.status = 'in_progress';   // responder pasa a "en curso" salvo que se indique otro

      // Avisar al trader/lead por correo (si Resend está configurado)
      const { data: tk } = await supabaseAdmin.from('support_tickets').select('email,subject').eq('id', ticketId).maybeSingle();
      if (tk?.email) {
        emailed = await sendEmail(
          tk.email,
          `Re: ${tk.subject || 'Tu consulta en Onyx'}`,
          `${body}\n\n—\nEquipo de Onyx Trading Live\nResponde a este correo o entra a tu Centro de soporte para seguir la conversación.`,
        );
      }
    }

    await supabaseAdmin.from('support_tickets').update(patch).eq('id', ticketId);
    await logAdmin(user?.email || '', 'support_reply', ticketId, { status: patch.status, emailed });
    return NextResponse.json({ ok: true, emailed });
  } catch (e: any) {
    await logError('support_admin', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
