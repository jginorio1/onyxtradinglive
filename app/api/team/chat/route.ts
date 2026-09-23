import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Nombre visible de un miembro del equipo (nombre de perfil o email).
function nameOf(p: any) { return (p?.name || p?.full_name || (p?.email || '').split('@')[0] || 'Equipo'); }

// GET · canales que puede ver el empleado + no leídas + lista del equipo.
export async function GET() {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado', channels: [], team: [] }, { status: 403 });
  const me = g.user.id;
  try {
    // Canales abiertos + DMs donde soy miembro
    const [{ data: chans }, { data: mine }] = await Promise.all([
      supabaseAdmin.from('chat_channels').select('id,name,kind,topic,created_at').order('created_at', { ascending: true }),
      supabaseAdmin.from('chat_members').select('channel_id').eq('user_id', me),
    ]);
    const mineSet = new Set((mine || []).map((r: any) => r.channel_id));
    const visible = (chans || []).filter((c: any) => c.kind !== 'dm' || mineSet.has(c.id));
    const ids = visible.map((c: any) => c.id);

    // No leídas: mensajes tras mi last_read_at (por canal) que no envié yo
    const reads: Record<string, string> = {};
    if (ids.length) {
      const { data: rd } = await supabaseAdmin.from('chat_reads').select('channel_id,last_read_at').eq('user_id', me).in('channel_id', ids);
      (rd || []).forEach((r: any) => { reads[r.channel_id] = r.last_read_at; });
    }
    const unread: Record<string, number> = {};
    const last: Record<string, any> = {};
    if (ids.length) {
      const { data: msgs } = await supabaseAdmin.from('chat_messages').select('channel_id,sender_id,body,created_at').in('channel_id', ids).order('created_at', { ascending: true });
      for (const m of (msgs || []) as any[]) {
        last[m.channel_id] = { body: m.body, at: m.created_at };
        const since = reads[m.channel_id];
        if (m.sender_id !== me && (!since || new Date(m.created_at) > new Date(since))) unread[m.channel_id] = (unread[m.channel_id] || 0) + 1;
      }
    }

    const { data: team } = await supabaseAdmin.from('profiles').select('id,email,full_name,role,available,last_active').eq('is_admin', true);

    // Miembros explícitos por canal (para DMs y para "quién está en la conversación")
    const membersByCh: Record<string, string[]> = {};
    if (ids.length) {
      const { data: mem } = await supabaseAdmin.from('chat_members').select('channel_id,user_id').in('channel_id', ids);
      (mem || []).forEach((r: any) => { (membersByCh[r.channel_id] ||= []).push(r.user_id); });
    }
    const channels = visible.map((c: any) => ({ ...c, unread: unread[c.id] || 0, last: last[c.id] || null, members: membersByCh[c.id] || [] }));
    return NextResponse.json({ channels, team: (team || []).map((p: any) => ({ id: p.id, name: nameOf(p), email: p.email, role: p.role || 'admin', available: p.available, last_active: p.last_active })), me });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', channels: [], team: [] }, { status: 500 });
  }
}

// POST · crear un canal (o DM). body: { name, kind?, members?[] }
export async function POST(req: Request) {
  const g = await requirePerm('chat', 'manage');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const kind = b.kind === 'dm' ? 'dm' : 'channel';
    const name = String(b.name || '').trim().slice(0, 60) || (kind === 'dm' ? 'Mensaje directo' : 'nuevo-canal');
    const { data: ch, error } = await supabaseAdmin.from('chat_channels').insert({ name, kind, topic: String(b.topic || '').slice(0, 120) || null, created_by: g.user.id }).select('id').single();
    if (error || !ch) return NextResponse.json({ error: error?.message || 'error' }, { status: 500 });
    // Miembros de un DM (yo + los elegidos)
    if (kind === 'dm') {
      const members = Array.from(new Set([g.user.id, ...((b.members || []) as string[])]));
      await supabaseAdmin.from('chat_members').upsert(members.map((uid) => ({ channel_id: ch.id, user_id: uid })));
    }
    return NextResponse.json({ ok: true, id: ch.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
