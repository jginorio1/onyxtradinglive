import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { runIntegrity, fixPayoutTotals } from '@/lib/paymentsIntegrity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null, perms: any) {
  return role === 'owner' || perms?.finanzas === 'manage' || perms?.embajadores === 'manage';
}

// GET · corre la revisión de integridad del dinero (solo lectura).
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const report = await runIntegrity();
  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
}

// POST · arreglos seguros. Por ahora solo fix_payout_totals (recalcula el total
// de pagos descuadrados a partir de sus comisiones; no crea ni borra dinero).
export async function POST(req: Request) {
  const { isAdmin, role, perms, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (!canManage(role, perms)) return NextResponse.json({ error: 'sin permiso para pagos' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const action = String(b?.action || '');
  if (action === 'fix_payout_totals') {
    const r = await fixPayoutTotals();
    try { await logAdmin(user?.email || '', 'pay_integrity_fix', action, { fixed: r.fixed }); } catch {}
    return NextResponse.json({ ok: true, ...r });
  }
  return NextResponse.json({ error: 'acción no reconocida' }, { status: 400 });
}
