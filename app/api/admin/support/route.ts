import { NextResponse } from 'next/server';
import { getAdmin, requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { notify } from '@/lib/notify';
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
        .select('id,user_id,email,subject,category,status,is_lead,channel,assignee_id,priority,name,country,city,ticket_no,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(300);
      if (r.error) {
        const r2 = await supabaseAdmin
          .from('support_tickets')
          .select('id,user_id,email,subject,category,status,is_lead,channel,assignee_id,ticket_no,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(300);
        tickets = r2.data || [];
      } else {
        tickets = r.data || [];
      }
    }

    // Etiqueta de ROL de quien abrió cada ticket (mentor, embajador, Bot Lab,
    // cliente de pago o usuario), para verlo/filtrar de un vistazo. Cada consulta
    // es tolerante a fallos: si una tabla no existe, se ignora sin romper la bandeja.
    const uids = Array.from(new Set(tickets.map((t: any) => t.user_id).filter(Boolean)));
    const roleMap: Record<string, string> = {};
    if (uids.length) {
      const safe = async (fn: () => Promise<any>) => { try { return (await fn())?.data || []; } catch { return []; } };
      const [amb, men, sell, prof] = await Promise.all([
        safe(() => supabaseAdmin.from('ambassadors').select('user_id').in('user_id', uids).eq('status', 'approved')),
        safe(() => supabaseAdmin.from('mentors').select('user_id').in('user_id', uids)),
        safe(() => supabaseAdmin.from('bot_products').select('seller_id').in('seller_id', uids)),
        safe(() => supabaseAdmin.from('profiles').select('id,plan,subscription_status').in('id', uids)),
      ]);
      const ambSet = new Set(amb.map((x: any) => x.user_id));
      const menSet = new Set(men.map((x: any) => x.user_id));
      const sellSet = new Set(sell.map((x: any) => x.seller_id));
      const paid: Record<string, boolean> = {};
      prof.forEach((p: any) => { paid[p.id] = !!(p.plan && p.plan !== 'free' && ['active', 'trialing', 'past_due'].includes(String(p.subscription_status || ''))); });
      uids.forEach((id: any) => {
        roleMap[id] = menSet.has(id) ? 'mentor' : ambSet.has(id) ? 'ambassador' : sellSet.has(id) ? 'botlab' : paid[id] ? 'paid' : 'user';
      });
    }
    tickets = tickets.map((t: any) => ({ ...t, role: (t.is_lead || !t.user_id) ? 'lead' : (roleMap[t.user_id] || 'user') }));

    const ids = tickets.map((t: any) => t.id);
    let messages: any[] = [];
    let participants: any[] = [];
    if (ids.length) {
      const [m, p] = await Promise.all([
        supabaseAdmin.from('support_messages').select('id,ticket_id,sender,sender_id,body,attachments,meta,read_at,created_at').in('ticket_id', ids).order('created_at', { ascending: true }),
        supabaseAdmin.from('ticket_participants').select('ticket_id,user_id,invited_by').in('ticket_id', ids),
      ]);
      // Si la columna meta no existe aún, reintentamos sin ella.
      messages = m.error
        ? ((await supabaseAdmin.from('support_messages').select('id,ticket_id,sender,sender_id,body,attachments,read_at,created_at').in('ticket_id', ids).order('created_at', { ascending: true })).data || [])
        : (m.data || []);
      // Si la columna invited_by no existe aún, reintentamos sin ella.
      participants = p.error
        ? ((await supabaseAdmin.from('ticket_participants').select('ticket_id,user_id').in('ticket_id', ids)).data || [])
        : (p.data || []);
    }
    // Marca presencia: el admin que carga la bandeja está activo ahora.
    if (g.user?.id) { try { await supabaseAdmin.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', g.user.id); } catch {} }

    // Equipo (para mostrar quién tiene asignado / disponible / última vez)
    const { data: team } = await supabaseAdmin.from('profiles').select('id,email,name,role,available,last_active,job_title,country,languages').eq('is_admin', true);

    const counts = { open: 0, in_progress: 0, resolved: 0, mine: 0, invited: 0 } as any;
    tickets.forEach((t: any) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    // Conteos PERSONALES para el empleado que carga la bandeja: cuántos tickets
    // (abiertos / en curso) tiene asignados y a cuántos lo invitaron. Alimentan el
    // badge personal en el nav de Soporte y el filtro "Me invitaron".
    const me = g.user?.id || null;
    if (me) {
      const activeIds = new Set(tickets.filter((t: any) => t.status !== 'resolved').map((t: any) => t.id));
      counts.mine = tickets.filter((t: any) => t.assignee_id === me && t.status !== 'resolved').length;
      const invitedIds = new Set(participants.filter((p: any) => p.user_id === me).map((p: any) => p.ticket_id));
      counts.invited = tickets.filter((t: any) => invitedIds.has(t.id) && t.assignee_id !== me && t.status !== 'resolved').length;
    }
    return NextResponse.json({ tickets, messages, participants, team: team || [], counts, me });
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

    // Marcar como leídos los mensajes del cliente (palomitas para el trader)
    if (b.read) {
      await supabaseAdmin.from('support_messages').update({ read_at: new Date().toISOString() })
        .eq('ticket_id', ticketId).eq('sender', 'user').is('read_at', null);
      return NextResponse.json({ ok: true });
    }

    const patch: any = { updated_at: new Date().toISOString() };
    if (b.status && STATUSES.includes(String(b.status))) patch.status = String(b.status);
    if (b.priority && ['low', 'normal', 'high'].includes(String(b.priority))) patch.priority = String(b.priority);

    // Tomar / asignar
    if (b.take) patch.assignee_id = user.id;
    if (b.assignee_id !== undefined) patch.assignee_id = b.assignee_id || null;

    // Aviso al compañero cuando se le ASIGNA un ticket (no cuando uno lo "toma"
    // para sí): campana + push + Telegram, con enlace al panel de soporte. Editable
    // en Admin → Notificaciones (clave 'support_assigned'). Tolerante a fallos.
    const assignTo = String(b.assignee_id || '').trim();
    if (assignTo && assignTo !== user.id) {
      try {
        const { data: tkA } = await supabaseAdmin.from('support_tickets').select('subject').eq('id', ticketId).maybeSingle();
        const subj = (tkA as any)?.subject ? String((tkA as any).subject).slice(0, 90) : 'Nuevo ticket';
        const { emitNotif } = await import('@/lib/emitNotif');
        await emitNotif(assignTo, 'support_assigned', { ignorePlan: true, url: `/admin#soporte`, body: subj });
        await logAdmin(user?.email || '', 'support_assign', ticketId, { to: assignTo });
      } catch {}
    }

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
      if (m && m.id !== user.id) {
        // Candado: quien fue invitado NO puede invitar de vuelta al que lo invitó.
        // Si el invitado (m) ya figura como quien invitó al usuario actual en este
        // ticket, rechazamos (evita el ping-pong de invitaciones).
        let blocked = false;
        try {
          const { data: mine } = await supabaseAdmin.from('ticket_participants').select('invited_by').eq('ticket_id', ticketId).eq('user_id', user.id).maybeSingle();
          if ((mine as any)?.invited_by && (mine as any).invited_by === m.id) blocked = true;
        } catch {}
        if (blocked) return NextResponse.json({ error: 'no puedes invitar a quien te invitó', code: 'invite_back' }, { status: 400 });

        // Guardamos quién invitó (invited_by). Si la columna no existe aún, caemos
        // al upsert simple para no romper la invitación.
        let up = await supabaseAdmin.from('ticket_participants').upsert({ ticket_id: ticketId, user_id: m.id, invited_by: user.id } as any);
        if ((up as any)?.error) await supabaseAdmin.from('ticket_participants').upsert({ ticket_id: ticketId, user_id: m.id });
        await logAdmin(user?.email || '', 'support_invite', ticketId, { invite });

        // Recuadro INTERNO en el chat (solo lo ve el equipo, nunca el cliente: las
        // rutas del trader filtran sender 'note'). Dice quién invitó a quién.
        const inviteeEmail = invite;
        const inviterEmail = (user?.email || '').toLowerCase() || 'un compañero';
        // La etiqueta [[invite]] permite que la bandeja la pinte como una línea
        // centrada y destacada en el hilo (no una notita lateral fácil de perder).
        const noteIns = await supabaseAdmin.from('support_messages').insert({
          ticket_id: ticketId, sender: 'note',
          body: `[[invite]]👥 ${inviterEmail} invitó a ${inviteeEmail} a esta conversación.`,
        });
        // Si por algún motivo falla con la etiqueta, reintentamos como nota simple.
        if ((noteIns as any)?.error) {
          await supabaseAdmin.from('support_messages').insert({
            ticket_id: ticketId, sender: 'note',
            body: `👥 ${inviterEmail} invitó a ${inviteeEmail} a esta conversación.`,
          });
        }

        // Línea VISIBLE para el cliente (neutra, sin nombres del equipo). Se guarda
        // como sender 'system' → ambas vistas la muestran como línea centrada de
        // sistema; el cliente solo entiende que se sumó otra persona de soporte.
        await supabaseAdmin.from('support_messages').insert({
          ticket_id: ticketId, sender: 'system',
          body: 'Se ha sumado otra persona de nuestro equipo de soporte para ayudarte.',
        });

        // Avisar al compañero invitado (campana + push + Telegram), con enlace.
        try {
          const { data: tkI } = await supabaseAdmin.from('support_tickets').select('subject').eq('id', ticketId).maybeSingle();
          const subj = (tkI as any)?.subject ? String((tkI as any).subject).slice(0, 90) : 'Nuevo ticket';
          const { emitNotif } = await import('@/lib/emitNotif');
          await emitNotif(m.id, 'support_assigned', { ignorePlan: true, url: `/admin#soporte`, body: subj });
        } catch {}
      }
    }

    // Respuesta al trader (+ correo)
    const body = String(b.body || '').trim().slice(0, 4000);
    const attachments = Array.isArray(b.attachments) ? b.attachments.slice(0, 5) : [];
    let emailed = false;
    if (body || attachments.length) {
      // Soporte bilingüe: si el cliente escribe en otro idioma, traducimos la
      // respuesta del empleado al idioma del cliente. Guardamos ambas versiones
      // (body = lo que escribió el empleado · meta.alt = lo que recibe el cliente)
      // y el correo sale en el idioma del cliente. Tolerante a falta de clave/columna.
      let clientBody = body;   // lo que verá y recibirá el cliente
      let outMeta: any = null;
      try {
        const { outbound, ticketClientLang, insertMessage } = await import('@/lib/supportTranslate');
        const cl = await ticketClientLang(ticketId);
        if (cl && body) {
          const { clientText, meta } = await outbound(body, cl);
          clientBody = clientText; outMeta = meta;
        }
        await insertMessage({ ticket_id: ticketId, sender: 'admin', sender_id: user.id, body, attachments }, outMeta);
      } catch {
        await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'admin', sender_id: user.id, body, attachments });
      }
      if (!patch.status) patch.status = 'in_progress';
      const { data: tk } = await supabaseAdmin.from('support_tickets').select('email,subject,user_id').eq('id', ticketId).maybeSingle();
      if (tk?.email && body) {
        // Reply-To con token del ticket: si el cliente responde el correo, Resend
        // Inbound lo devuelve al hilo (se ve en Soporte). Sin dominio inbound = '' → normal.
        let replyTo = '';
        try { const { ensureTicketToken, replyToForTicket } = await import('@/lib/supportInbound'); const tok = await ensureTicketToken(ticketId); replyTo = replyToForTicket(tok); } catch {}
        emailed = await sendEmail(
          tk.email,
          `Re: ${tk.subject || 'Tu consulta en Onyx'}`,
          `${clientBody}${attachments.length ? `\n\n(${attachments.length} ${attachments.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'} en tu Centro de soporte)` : ''}\n\n—\nEquipo de Onyx Trading Live\nResponde a este correo o entra a tu Centro de soporte para seguir la conversación.`,
          replyTo ? { replyTo } : undefined,
        );
      }
      // Notificación al trader (campana/push según lo que el dueño dejó activo).
      if ((tk as any)?.user_id) {
        const { emitNotif } = await import('@/lib/emitNotif');
        await emitNotif((tk as any).user_id, 'support_reply', { vars: { body: `${tk?.subject ? tk.subject + ': ' : ''}${body.slice(0, 90)}` }, url: `/dashboard/soporte?ticket=${ticketId}` }).catch(() => {});
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
