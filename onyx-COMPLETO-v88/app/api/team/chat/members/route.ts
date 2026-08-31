import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · añade a un compañero a la conversación. { channel, user_id }
// Un canal abierto lo ve todo el equipo; añadir a alguien a un DM lo suma a la charla.
export async function POST(req: Request) {
  const g = await requirePerm('chat', 'manage');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const channel = String(b.channel || '');
    const userId = String(b.user_id || '');
    if (!channel || !userId) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });

    const { data: ch } = await supabaseAdmin.from('chat_channels').select('id,name,kind').eq('id', channel).maybeSingle();
    if (!ch) return NextResponse.json({ error: 'canal no existe' }, { status: 404 });

    await supabaseAdmin.from('chat_members').upsert({ channel_id: channel, user_id: userId });
    await notify(userId, { kind: 'info', title: 'Te añadieron a una conversación', body: ch.kind === 'dm' ? 'Mensaje directo del equipo' : `#${ch.name}`, url: `/admin?chat=${channel}#chat` });
    await logAdmin(g.user.email || '', 'team_chat_add', channel, { userId });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
