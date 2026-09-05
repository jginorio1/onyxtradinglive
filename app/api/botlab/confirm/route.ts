import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { confirmSession } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · confirma la compra al volver de Stripe. { sessionId }
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const sid = String(b.sessionId || '');
  if (!sid) return NextResponse.json({ error: 'falta sesión' }, { status: 400 });
  try {
    const r = await confirmSession(sid, user.id);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
