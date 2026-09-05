import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · marca un canal como leído hasta ahora. { channel }
export async function POST(req: Request) {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const channel = String(b.channel || '');
    if (!channel) return NextResponse.json({ error: 'falta canal' }, { status: 400 });
    await supabaseAdmin.from('chat_reads').upsert({ channel_id: channel, user_id: g.user.id, last_read_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
