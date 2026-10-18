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
    await notify(userId, { kind: 'info', title: 'Te añadieron a una conversación', body: ch.kind === 'dm' ? 'Mensaje directo del equipo' : ch.kind === 'group' ? `Grupo privado: ${ch.name}` : `#${ch.name}`, url: `/admin?chat=${channel}#chat` });
    await logAdmin(g.user.email || '', 'team_chat_add', channel, { userId });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · quitar a alguien de un grupo privado / DM (o salir uno mismo).
// { channel, user_id }. Solo aplica a grupos y DMs (en un canal abierto no hay
// "miembros" que quitar). No se puede quedar un grupo sin gente: si era el último,
// se borra el canal entero.
export async function DELETE(req: Request) {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const channel = String(b.channel || '');
    const userId = String(b.user_id || g.user.id); // por defecto, salir uno mismo
    if (!channel) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });

    const { data: ch } = await supabaseAdmin.from('chat_channels').select('id,name,kind').eq('id', channel).maybeSingle();
    if (!ch) return NextResponse.json({ error: 'canal no existe' }, { status: 404 });
    if (ch.kind === 'channel') return NextResponse.json({ error: 'un canal abierto no tiene miembros' }, { status: 400 });

    await supabaseAdmin.from('chat_members').delete().eq('channel_id', channel).eq('user_id', userId);
    // Si ya no queda nadie, borra el canal (y en cascada sus mensajes/lecturas).
    const { count } = await supabaseAdmin.from('chat_members').select('user_id', { count: 'exact', head: true }).eq('channel_id', channel);
    if (!count) await supabaseAdmin.from('chat_channels').delete().eq('id', channel);
    await logAdmin(g.user.email || '', 'team_chat_remove', channel, { userId, emptied: !count });
    return NextResponse.json({ ok: true, removed: true, deleted: !count });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
