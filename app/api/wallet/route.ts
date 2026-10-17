import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { balance, movements } from '@/lib/wallet';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · saldo y últimos movimientos del usuario con sesión.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ balanceCents: 0, movements: [] });
    const [bal, mv] = await Promise.all([balance(user.id), movements(user.id, 50)]);
    return NextResponse.json({ balanceCents: bal, movements: mv }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    await logError('wallet_get', e);
    return NextResponse.json({ balanceCents: 0, movements: [] });
  }
}
