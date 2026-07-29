import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { aiAnswer } from '@/lib/supportAI';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function nameOf(p: any) { return (p?.name || p?.full_name || (p?.email || '').split('@')[0] || 'Equipo'); }

// Acceso al canal: los canales abiertos los ve todo el equipo; los DM, solo miembros.
async function canSee(channelId: string, userId: string) {
  const { data: ch } = await supabaseAdmin.from('chat_channels').select('id,kind').eq('id', channelId).maybeSingle();
  if (!ch) return false;
  if (ch.kind !== 'dm') return true;
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

    let q = supabaseAdmin.from('chat_messages').select('id,channel_id,sender_id,sender_name,body,attachments,mentions,created_at').eq('channel_id', channel);
    const date = u.searchParams.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const from = new Date(date + 'T00:00:00').toISOString();
      const to = new Date(date + 'T23:59:59.999').toISOString();
      q = q.gte('created_at', from).lte('created_at', to);
    }
    const { data } = await q.order('created_at', { ascending: true }).limit(400);
    return NextResponse.json({ messages: data || [], me: g.user.id });
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

    const { data: prof } = await supabaseAdmin.from('profiles').select('email,full_name,lang').eq('id', g.user.id).maybeSingle();
    const senderName = nameOf({ ...prof, email: prof?.email || g.user.email });

    const { data: msg, error } = await supabaseAdmin.from('chat_messages')
      .insert({ channel_id: channel, sender_id: g.user.id, sender_name: senderName, body, attachments, mentions })
      .select('id,created_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from('chat_reads').upsert({ channel_id: channel, user_id: g.user.id, last_read_at: new Date().toISOString() });

    // Aviso (campana) a los compañeros mencionados
    for (const m of mentions as any[]) {
      if (m?.type === 'user' && m.id && m.id !== 'onyx' && m.id !== g.user.id) {
        await notify(m.id, { kind: 'info', title: `${senderName} te mencionó`, body: body.slice(0, 90), url: `/admin?chat=${channel}#chat` });
      }
    }

    // @Onyx AI: si mencionan a la IA, responde en el canal como bot.
    const askedAI = /@onyx/i.test(body) || (mentions as any[]).some((m) => m?.type === 'user' && m.id === 'onyx');
    let ai = null as any;
    if (askedAI) {
      const question = body.replace(/@onyx( ai)?/ig, '').trim() || body;
      const lang = (prof as any)?.lang === 'en' ? 'en' : 'es';
      const res = await aiAnswer(question, lang as any, false);
      const answer = res.answer || (lang === 'en' ? 'I can help with product, pricing and how-to questions. For a client’s private data, open their ticket.' : 'Puedo ayudar con dudas de producto, precios y cómo hacer algo. Para datos privados de un cliente, abre su ticket.');
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
