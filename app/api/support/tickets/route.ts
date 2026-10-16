import { pickLang, langFromCookie } from '@/lib/i18n';
import { reqGeo } from '@/lib/geo';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyNewTicket } from '@/lib/supportNotify';
import { autoHandleTicket } from '@/lib/supportAI';
import { getSupportContext } from '@/lib/supportContext';

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
      // Intentamos traer también `meta` (traducciones); si la columna no existe aún,
      // reintentamos sin ella para no romper el Centro de soporte.
      let rows: any[] = [];
      const r = await supabaseAdmin
        .from('support_messages')
        .select('id,ticket_id,sender,sender_id,body,attachments,meta,read_at,created_at')
        .in('ticket_id', ids)
        .neq('sender', 'note')   // las notas internas del equipo NO se muestran al trader
        .order('created_at', { ascending: true });
      if (r.error) {
        const r2 = await supabaseAdmin
          .from('support_messages')
          .select('id,ticket_id,sender,sender_id,body,attachments,read_at,created_at')
          .in('ticket_id', ids).neq('sender', 'note').order('created_at', { ascending: true });
        rows = r2.data || [];
      } else { rows = r.data || []; }
      // Soporte bilingüe: el cliente registrado ve SIEMPRE en su idioma. Para mensajes
      // del equipo/IA, si hay versión traducida al idioma del cliente (meta.alt), esa se
      // muestra; sus propios mensajes ya están en su idioma.
      messages = rows.map((m: any) => {
        const meta = m.meta || null;
        if (m.sender !== 'user' && meta && meta.alt) return { ...m, body: meta.alt };
        return m;
      });
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
    // Adjuntos (URLs ya subidas por /api/chat/upload). Máx 3.
    const attachments = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 3)
      .filter((a: any) => a && typeof a.url === 'string');
    // Conversación previa con la IA del widget (para que el equipo vea el hilo completo,
    // incluido el PRIMER mensaje del cliente, no solo lo que escribió en la caja).
    const history: any[] = Array.isArray(b.history) ? b.history.slice(-20) : [];
    const hasHistory = history.some((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim());
    // Se permite un ticket con solo captura o solo historial siempre que haya asunto.
    if (!subject || (!body && !attachments.length && !hasHistory)) return NextResponse.json({ error: 'faltan datos', code: 'missing' }, { status: 400 });

    // De dónde escribe (aproximado por IP, cabeceras de Vercel). Tolerante: si las
    // columnas country/city no existen, reintenta sin ellas.
    const geo = reqGeo(req);
    const tbase: any = { user_id: user.id, email: user.email || null, subject, category, status: 'open' };
    const tgeo: any = { ...tbase };
    if (geo.country) tgeo.country = geo.country;
    if (geo.city) tgeo.city = geo.city;
    let ticket: any = null; let error: any = null;
    {
      const r = await supabaseAdmin.from('support_tickets').insert(tgeo).select('id').single();
      if (r.error) { const r2 = await supabaseAdmin.from('support_tickets').insert(tbase).select('id').single(); ticket = r2.data; error = r2.error; }
      else ticket = r.data;
    }
    if (error || !ticket) return NextResponse.json({ error: error?.message || 'error' }, { status: 500 });

    // 1) Guardamos TODO el hilo previo con la IA (usuario e IA), en orden.
    if (hasHistory) {
      const rows = history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
        .map((m) => ({ ticket_id: ticket.id, sender: m.role === 'assistant' ? 'ai' : 'user', body: String(m.content).slice(0, 4000) }));
      if (rows.length) await supabaseAdmin.from('support_messages').insert(rows);
    }
    // 2) El mensaje de la caja de contacto (si escribió algo o adjuntó captura).
    //    Si solo había historial sin texto nuevo, no insertamos un mensaje vacío.
    if (body || attachments.length) {
      const firstMsg: any = { ticket_id: ticket.id, sender: 'user', body };
      if (attachments.length) firstMsg.attachments = attachments;
      const im = await supabaseAdmin.from('support_messages').insert(firstMsg);
      if ((im as any)?.error && attachments.length) await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'user', body });
    }
    // Nota interna con roles/plan/estado del usuario (solo la ve el equipo, no el trader).
    try {
      const ctx = await getSupportContext(user.id);
      const roles = [ctx.roles.trader && 'trader', ctx.roles.ambassador !== 'none' && `embajador(${ctx.roles.ambassador})`, ctx.roles.mentor && `mentor(${ctx.roles.mentorConnected ? 'stripe ok' : 'sin stripe'})`].filter(Boolean).join(', ');
      const note = `🧭 Contexto: ${roles || 'usuario'} · Plan ${ctx.plan} · Conector ${ctx.ea} · Guardian ${ctx.guardianOn ? 'ON' : 'off'} · Copy ${ctx.copyActive ? 'activo' : 'inactivo'} · Facturación ${ctx.billing}`;
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'note', body: note });
    } catch { /* la nota es opcional */ }
    await notifyNewTicket({ email: user.email || '', subject, isLead: false });

    // Triage + auto-respuesta con IA, en el idioma del trader. La "pregunta" es lo
    // que escribió en la caja o, si solo venía del chat, el primer mensaje del cliente.
    const firstUserMsg = (history.find((m) => m?.role === 'user' && String(m?.content || '').trim())?.content as string) || '';
    const question = body || firstUserMsg;
    const { data: prof } = await supabaseAdmin.from('profiles').select('lang').eq('id', user.id).maybeSingle();
    const lang = pickLang((prof as any)?.lang);
    // Soporte bilingüe: guardamos el idioma del cliente en el ticket (según su perfil)
    // para que tus respuestas se traduzcan solas a su idioma. Tolerante si falta columna.
    try { const { setTicketClientLang } = await import('@/lib/supportTranslate'); await setTicketClientLang(ticket.id, lang); } catch {}
    await autoHandleTicket({ ticketId: ticket.id, question, lang, email: user.email, subject });

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
      await supabaseAdmin.from('support_tickets').update({ status: 'resolved', updated_at: new Date().toISOString() }).eq('id', ticketId).eq('user_id', user.id);
      return NextResponse.json({ ok: true });
    }

    // Marcar como leídos los mensajes del equipo/IA (palomitas para el admin)
    if (b.read) {
      await supabaseAdmin.from('support_messages').update({ read_at: new Date().toISOString() })
        .eq('ticket_id', ticketId).neq('sender', 'user').is('read_at', null);
      return NextResponse.json({ ok: true });
    }

    const body = String(b.body || '').trim().slice(0, 4000);
    const attachments = Array.isArray(b.attachments) ? b.attachments.slice(0, 5) : [];
    if (!body && !attachments.length) return NextResponse.json({ error: 'vacío', code: 'missing' }, { status: 400 });
    // Soporte bilingüe: guardamos junto al mensaje del cliente su versión en el idioma
    // del empleado, para que tú lo leas traducido. Tolerante a falta de clave/columna.
    try {
      const { inbound, insertMessage, setTicketClientLang, ticketClientLang } = await import('@/lib/supportTranslate');
      const known = await ticketClientLang(ticketId);
      const { clientLang, meta } = await inbound(body, known);
      await insertMessage({ ticket_id: ticketId, sender: 'user', body, attachments }, meta);
      if (!known && clientLang) await setTicketClientLang(ticketId, clientLang);
    } catch {
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'user', body, attachments });
    }
    // Reabrir si estaba resuelto y marcar actividad
    await supabaseAdmin.from('support_tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', ticketId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
