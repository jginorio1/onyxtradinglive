import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { compStatus, ackCompExpired } from '@/lib/compTrial';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · estado de la prueba de pago para el popup del dashboard.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ state: 'none' });
  return NextResponse.json(await compStatus(user.id));
}

// POST · el usuario cerró el popup de "expiró" y se queda en Free.
export async function POST() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  await ackCompExpired(user.id);
  return NextResponse.json({ ok: true });
}
