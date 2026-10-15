import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · últimas notificaciones del trader + no leídas.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ items: [], unread: 0 });
    const { data } = await supabaseAdmin.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
    let items = data || [];
    // Marcamos como "urgente" los avisos cuyo TIPO el dueño marcó urgente en Admin
    // (notif_config). Así la campanita puede resaltarlos en rojo.
    try {
      const { loadNotifConfig } = await import('@/lib/notifConfig');
      const cfg = await loadNotifConfig();
      items = items.map((n: any) => ({ ...n, urgent: !!(cfg as any)[n.kind]?.urgent }));
    } catch {}
    const unread = items.filter((n: any) => !n.read_at).length;
    return NextResponse.json({ items, unread });
  } catch {
    return NextResponse.json({ items: [], unread: 0 });
  }
}

// POST · marcar leído: {id} una, o {all:true} todas.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const now = new Date().toISOString();
    let q = supabaseAdmin.from('notifications').update({ read_at: now }).eq('user_id', user.id).is('read_at', null);
    if (!b.all && b.id) q = supabaseAdmin.from('notifications').update({ read_at: now }).eq('user_id', user.id).eq('id', b.id);
    await q;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
