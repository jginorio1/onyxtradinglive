import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { adminPayouts, adminPayOne, adminHoldOne } from '@/lib/adminPayouts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null, perms: any) {
  return role === 'owner' || perms?.finanzas === 'manage' || perms?.embajadores === 'manage';
}

// GET · todas las solicitudes de retiro (Bot Lab + embajadores) + KPIs.
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const data = await adminPayouts();
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

// POST · acciones: pay (pagar) / hold (retener) / release (liberar).
export async function POST(req: Request) {
  const { isAdmin, role, perms, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (!canManage(role, perms)) return NextResponse.json({ error: 'sin permiso para pagos' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { action, program, id } = b || {};
  if (!program || !id) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });

  if (action === 'pay') {
    const r = await adminPayOne(String(program), String(id));
    if (!r.ok) return NextResponse.json({ error: r.error || 'error' }, { status: 400 });
    try { await logAdmin(user?.email, 'payout_pay', `${program}:${id}${r.manual ? ' (manual)' : ''}`); } catch {}
    return NextResponse.json({ ok: true, manual: r.manual });
  }
  if (action === 'hold' || action === 'release') {
    const r = await adminHoldOne(String(program), String(id), action === 'hold');
    if (!r.ok) return NextResponse.json({ error: r.error || 'error' }, { status: 400 });
    try { await logAdmin(user?.email, action === 'hold' ? 'payout_hold' : 'payout_release', `${program}:${id}`); } catch {}
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
}
