import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getAutoReload, saveAutoReload } from '@/lib/wallet';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ajustes de auto-recarga del usuario. POST · guardarlos.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
    return NextResponse.json(await getAutoReload(user.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) { await logError('wallet_autoreload_get', e); return NextResponse.json({ enabled: false }); }
}

export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const cur = await getAutoReload(user.id);
    // Para ENCENDER hace falta tener tarjeta guardada.
    if (b.enabled === true && !cur.has_card) {
      return NextResponse.json({ error: 'Guarda una tarjeta primero.', code: 'need_card' }, { status: 400 });
    }
    await saveAutoReload(user.id, {
      enabled: b.enabled,
      threshold_cents: b.threshold_cents !== undefined ? Number(b.threshold_cents) : undefined,
      amount_cents: b.amount_cents !== undefined ? Number(b.amount_cents) : undefined,
    });
    return NextResponse.json({ ok: true, ...(await getAutoReload(user.id)) });
  } catch (e: any) { await logError('wallet_autoreload_post', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
