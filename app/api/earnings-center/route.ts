import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { earningsCenter } from '@/lib/earningsCenter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · Centro de ganancias: agrega TODOS los ingresos del usuario en un solo lugar.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    const data = await earningsCenter(user.id);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', currency: 'USD', totalAvailableCents: 0, totalCreditCents: 0, totalPendingCents: 0, totalPaidCents: 0, programs: [] }, { status: 200 });
  }
}
