import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { onyxTeamAnswer } from '@/lib/teamAI';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function nameOf(p: any) { return (p?.name || p?.full_name || (p?.email || '').split('@')[0] || 'Equipo'); }

// Acceso al canal: los canales abiertos los ve todo el equipo; los DM y los GRUPOS
// PRIVADOS, solo sus miembros.
async function canSee(channelId: string, userId: string) {
  const { data: ch } = await supabaseAdmin.from('chat_channels').select('id,kind').eq('id', channelId).maybeSingle();
  if (!ch) return false;
  if (ch.kind !== 'dm' && ch.kind !== 'group') return true;
  const { data: m } = await supabaseAdmin.from('chat_members').select('user_id').eq('channel_id', channelId).eq('user_id', userId).maybeSingle();
  return !!m;
}

// GET · mensajes de un canal. ?channel=ID  ·  ?date=YYYY-MM-DD (búsqueda por día)
export async function GET(req: Request) {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado', messages: [] }, { status: 403 });
  try {
    const u = new URL(req.url);
    const channel = u.searchParams.get('channel') || '';
    if (!channel || !(await canSee(channel, g.user.id))) return NextResponse.json({ error: 'no autorizado', messages: [] }, { status: 403 });

    let q = supabaseAdmin.from('chat_messages').select('id,channel_id,sender_id,sender_name,body,attachments,mentions,reply_to,pinned,pinned_by,urgent,created_at').eq('channel_id', channel);
    const date = u.searchParams.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const from = new Date(date + 'T00:00:00').toISOString();
      const to = new Date(date + 'T23:59:59.999').toISOString();
      q = q.gte('created_at', from).lte('created_at', to);
    }
    const { data } = await q.order('created_at', { ascending: true }).limit(400);
    const rows = (data || []) as any[];

    // Snippet del mensaje citado (responder): resolvemos id → {autor, texto}.
    const replyIds = Array.from(new Set(rows.map((m) => m.reply_to).filter(Boolean)));
    const replyMap: Record<string, any> = {};
    if (replyIds.length) {
      const inSet = new Map(rows.map((m) => [m.id, m]));
      const missing = replyIds.filter((id) => !inSet.has(id));
      let extra: any[] = [];
      if (missing.length) { const { data: ex } = await supabaseAdmin.from('chat_messages').select('id,sender_name,body,attachments').in('id', missing); extra = ex || []; }
      for (const id of replyIds) {
        const r = inSet.get(id) || extra.find((x) => x.id === id);
        if (r) replyMap[id] = { id, authorName: r.sender_name, body: (r.body || (Array.isArray(r.attachments) && r.attachments.length ? '📎' : '')).slice(0, 120) };
      }
    }

    // Reacciones agrupadas por mensaje+emoji, marcando las mías.
    const ids = rows.map((m) => m.id);
    const reactMap: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
    if (ids.length) {
      const { data: rx } = await supabaseAdmin.from('chat_reactions').select('message_id,user_id,emoji').in('message_id', ids);
      const agg: Record<string, Record<string, { count: number; mine: boolean }>> = {};
      for (const r of (rx || []) as any[]) {
        const byEmoji = (agg[r.message_id] ||= {});
        const e = (byEmoji[r.emoji] ||= { count: 0, mine: false });
        e.count++; if (r.user_id === g.user.id) e.mine = true;
      }
      for (const mid of Object.keys(agg)) reactMap[mid] = Object.entries(agg[mid]).map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }));
    }

    const messages = rows.map((m) => ({ ...m, reply_snippet: m.reply_to ? replyMap[m.reply_to] || null : null, reactions: reactMap[m.id] || [] }));
    return NextResponse.json({ messages, me: g.user.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', messages: [] }, { status: 500 });
  }
}

// POST · enviar mensaje. { channel, body, attachments?, mentions? }
export async function POST(req: Request) {
  const g = await requirePerm('chat', 'manage');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const channel = String(b.channel || '');
    if (!channel || !(await canSee(channel, g.user.id))) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const body = String(b.body || '').trim().slice(0, 4000);
    const attachments = Array.isArray(b.attachments) ? b.attachments.slice(0, 5) : [];
    const mentions = Array.isArray(b.mentions) ? b.mentions.slice(0, 10) : [];
    if (!body && !attachments.length) return NextResponse.json({ error: 'vacío' }, { status: 400 });

    // Responder/citar: el id del mensaje citado (debe ser del mismo canal).
    let replyTo: string | null = null;
    if (b.reply_to) {
      const { data: rp } = await supabaseAdmin.from('chat_messages').select('id,channel_id').eq('id', String(b.reply_to)).maybeSingle();
      if (rp && rp.channel_id === channel) replyTo = rp.id;
    }

    const { data: prof } = await supabaseAdmin.from('profiles').select('email,full_name,lang').eq('id', g.user.id).maybeSingle();
    const senderName = nameOf({ ...prof, email: prof?.email || g.user.email });

    // URGENTE y @todos: marca urgente + aviso a todos los miembros del canal.
    const urgent = !!b.urgent;
    const toAll = /@(todos|todes|all|everyone|canal|channel)\b/i.test(body);

    const { data: msg, error } = await supabaseAdmin.from('chat_messages')
      .insert({ channel_id: channel, sender_id: g.user.id, sender_name: senderName, body, attachments, mentions, reply_to: replyTo, urgent })
      .select('id,created_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from('chat_reads').upsert({ channel_id: channel, user_id: g.user.id, last_read_at: new Date().toISOString() });

    // Aviso (campana) a los compañeros mencionados
    const notified = new Set<string>();
    for (const m of mentions as any[]) {
      if (m?.type === 'user' && m.id && m.id !== 'onyx' && m.id !== g.user.id) {
        notified.add(m.id);
        // Campana + push por el catálogo editable en Admin (tipo 'team_mention').
        try { const { emitNotif } = await import('@/lib/emitNotif'); await emitNotif(m.id, 'team_mention', { vars: { name: senderName, body: body.slice(0, 90) }, url: `/admin?chat=${channel}#chat`, ignorePlan: true }); } catch {}
      }
    }

    // Urgente o @todos: avisar a TODOS los destinatarios del canal (sin repetir a
    // los ya mencionados ni a mí mismo). En un canal abierto, todo el equipo; en
    // DM/grupo, sus miembros.
    if (urgent || toAll) {
      try {
        const { data: ch } = await supabaseAdmin.from('chat_channels').select('kind,name').eq('id', channel).maybeSingle();
        let recipients: string[] = [];
        if (ch?.kind === 'channel') {
          const { data: team } = await supabaseAdmin.from('profiles').select('id').eq('is_admin', true);
          recipients = (team || []).map((p: any) => p.id);
        } else {
          const { data: mem } = await supabaseAdmin.from('chat_members').select('user_id').eq('channel_id', channel);
          recipients = (mem || []).map((r: any) => r.user_id);
        }
        const { emitNotif } = await import('@/lib/emitNotif');
        const label = urgent ? '🔴 ' : '';
        for (const uid of recipients) {
          if (uid === g.user.id || notified.has(uid)) continue;
          await emitNotif(uid, 'team_mention', { vars: { name: senderName, body: label + body.slice(0, 90) }, url: `/admin?chat=${channel}#chat`, ignorePlan: true });
        }
      } catch {}
    }

    // Comunicación efectiva: en un DM o GRUPO privado, avisa (campana + push) a los
    // miembros aunque NO los mencionen — así nadie pierde un mensaje directo. En los
    // canales abiertos NO se avisa por cada mensaje (sería ruido): ahí solo cuentan
    // las @menciones y lo urgente/@todos (ya cubiertos arriba).
    if (!urgent && !toAll) {
      try {
        const { data: ch } = await supabaseAdmin.from('chat_channels').select('kind,name').eq('id', channel).maybeSingle();
        if (ch?.kind === 'dm' || ch?.kind === 'group') {
          const { data: mem } = await supabaseAdmin.from('chat_members').select('user_id').eq('channel_id', channel);
          const { emitNotif } = await import('@/lib/emitNotif');
          const title = ch.kind === 'group' ? `${senderName} · ${ch.name}` : senderName;
          for (const r of (mem || []) as any[]) {
            const uid = r.user_id;
            if (uid === g.user.id || notified.has(uid)) continue;
            await emitNotif(uid, 'team_mention', { vars: { name: title, body: body.slice(0, 90) || '📎' }, url: `/admin?chat=${channel}#chat`, ignorePlan: true });
          }
        }
      } catch {}
    }

    // @Onyx AI: si mencionan a la IA, responde en el canal como bot.
    const askedAI = /@onyx/i.test(body) || (mentions as any[]).some((m) => m?.type === 'user' && m.id === 'onyx');
    let ai = null as any;
    if (askedAI) {
      const question = body.replace(/@onyx( ai)?/ig, '').trim() || body;
      const lang = pickLang((prof as any)?.lang);
      const tz = typeof b.tz === 'string' && b.tz ? b.tz : undefined; // zona horaria del admin
      // Onyx interno: responde con datos de conjunto (tickets, pendientes, historial de un cliente).
      const answer = await onyxTeamAnswer({ question, lang: lang as any, tz });
      const { data: aiMsg } = await supabaseAdmin.from('chat_messages')
        .insert({ channel_id: channel, sender_id: null, sender_name: 'Onyx AI', body: answer, attachments: [], mentions: [] })
        .select('id,created_at,sender_id,sender_name,body,attachments,mentions,channel_id').single();
      ai = aiMsg;
    }

    await logAdmin(g.user.email || '', 'team_chat', channel, { ai: askedAI });
    return NextResponse.json({ ok: true, id: msg?.id, created_at: msg?.created_at, ai });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · acciones sobre un mensaje: reaccionar (toggle) o fijar/desfijar.
// { message, action:'react', emoji }  ·  { message, action:'pin', pinned:boolean }
export async function PATCH(req: Request) {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const message = String(b.message || '');
    if (!message) return NextResponse.json({ error: 'falta mensaje' }, { status: 400 });

    // El mensaje debe existir y yo debo poder ver su canal.
    const { data: m } = await supabaseAdmin.from('chat_messages').select('id,channel_id,pinned').eq('id', message).maybeSingle();
    if (!m || !(await canSee(m.channel_id, g.user.id))) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    if (b.action === 'react') {
      const emoji = String(b.emoji || '').slice(0, 8);
      if (!emoji) return NextResponse.json({ error: 'falta emoji' }, { status: 400 });
      // Toggle: si ya reaccioné con ese emoji, lo quito; si no, lo pongo.
      const { data: ex } = await supabaseAdmin.from('chat_reactions').select('emoji').eq('message_id', message).eq('user_id', g.user.id).eq('emoji', emoji).maybeSingle();
      if (ex) await supabaseAdmin.from('chat_reactions').delete().eq('message_id', message).eq('user_id', g.user.id).eq('emoji', emoji);
      else await supabaseAdmin.from('chat_reactions').insert({ message_id: message, user_id: g.user.id, emoji });
      return NextResponse.json({ ok: true, on: !ex });
    }

    if (b.action === 'pin') {
      const pinned = !!b.pinned;
      await supabaseAdmin.from('chat_messages').update({ pinned, pinned_at: pinned ? new Date().toISOString() : null, pinned_by: pinned ? g.user.id : null }).eq('id', message);
      return NextResponse.json({ ok: true, pinned });
    }

    return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
