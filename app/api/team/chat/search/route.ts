import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · buscar texto en los mensajes del equipo. ?q=texto
// Solo busca en los canales que el empleado puede ver (abiertos + sus DMs/grupos).
export async function GET(req: Request) {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado', results: [] }, { status: 403 });
  try {
    const q = (new URL(req.url).searchParams.get('q') || '').trim();
    if (q.length < 2) return NextResponse.json({ results: [] });
    const me = g.user.id;

    // Canales visibles: abiertos + aquellos donde soy miembro (DM/grupo).
    const [{ data: chans }, { data: mine }] = await Promise.all([
      supabaseAdmin.from('chat_channels').select('id,name,kind'),
      supabaseAdmin.from('chat_members').select('channel_id').eq('user_id', me),
    ]);
    const mineSet = new Set((mine || []).map((r: any) => r.channel_id));
    const visible = (chans || []).filter((c: any) => c.kind === 'channel' || mineSet.has(c.id));
    const chById: Record<string, any> = Object.fromEntries(visible.map((c: any) => [c.id, c]));
    const ids = visible.map((c: any) => c.id);
    if (!ids.length) return NextResponse.json({ results: [] });

    const esc = q.replace(/[%_]/g, (m) => '\\' + m);
    const { data } = await supabaseAdmin.from('chat_messages')
      .select('id,channel_id,sender_name,body,created_at')
      .in('channel_id', ids).ilike('body', `%${esc}%`)
      .order('created_at', { ascending: false }).limit(40);

    const results = (data || []).map((m: any) => {
      const ch = chById[m.channel_id] || {};
      return {
        id: m.id, channel_id: m.channel_id, channel_name: ch.name, channel_kind: ch.kind,
        sender_name: m.sender_name, body: (m.body || '').slice(0, 160), created_at: m.created_at,
      };
    });
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', results: [] }, { status: 500 });
  }
}
