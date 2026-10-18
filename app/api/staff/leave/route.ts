import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { staffByUser } from '@/lib/payroll';
import { balancesForStaff, requestsForStaff, createRequest, cancelOwnRequest } from '@/lib/leave';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · mis saldos (por tipo) + mis solicitudes.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const st = await staffByUser(user.id);
  if (!st) return NextResponse.json({ isStaff: false });
  const [balances, requests] = await Promise.all([balancesForStaff(st.id), requestsForStaff(st.id)]);
  return NextResponse.json({ isStaff: true, balances, requests });
}

// POST · solicitar días libres | cancelar una propia pendiente.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const st = await staffByUser(user.id);
  if (!st) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || 'request');
  try {
    if (action === 'cancel') return NextResponse.json(await cancelOwnRequest(st.id, String(b.id)));
    // request
    return NextResponse.json(await createRequest(st.id, b.type, b.start_day, b.end_day, b.reason));
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
