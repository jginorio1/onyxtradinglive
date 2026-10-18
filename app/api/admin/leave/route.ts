import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { listStaff } from '@/lib/payroll';
import { leavePolicySettings, saveSetting, type LeavePolicy } from '@/lib/settings';
import { allRequests, balancesForStaff, decideRequest, setAllotment, curYear, LEAVE_TYPES, type LeaveType } from '@/lib/leave';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · cola de solicitudes + saldos por empleado + política. ?status=pending filtra.
export async function GET(req: Request) {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const status = new URL(req.url).searchParams.get('status') || undefined;
  const year = curYear();
  const [requests, policy, staffRaw] = await Promise.all([allRequests(status), leavePolicySettings(), listStaff()]);
  // Mapa id→nombre y saldos por empleado (para la tabla de la cola y el panel).
  const staff: any[] = [];
  for (const s of staffRaw) {
    const bal = await balancesForStaff(s.id, year);
    staff.push({ id: s.id, name: s.name, department: s.department, position: s.position, balances: bal });
  }
  const nameOf: Record<string, string> = {}; staff.forEach((s) => { nameOf[s.id] = s.name; });
  const enriched = requests.map((r) => ({ ...r, staff_name: nameOf[r.staff_id] || '—' }));
  return NextResponse.json({ requests: enriched, policy, staff, year });
}

// POST · aprobar/rechazar · asignación por empleado · guardar política.
export async function POST(req: Request) {
  const { ok, user } = await requirePerm('equipo', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');
  try {
    if (action === 'decide') {
      const r = await decideRequest(String(b.id), !!b.approve, (user as any)?.id, b.admin_note);
      if (r.ok) logAdmin('team.leave_decide', { id: b.id, approve: !!b.approve });
      return NextResponse.json(r);
    }
    if (action === 'set_allotment') {
      const t = LEAVE_TYPES.includes(b.type) ? (b.type as LeaveType) : null;
      if (!t) return NextResponse.json({ ok: false, error: 'tipo inválido' }, { status: 400 });
      return NextResponse.json(await setAllotment(String(b.staff_id), Number(b.year) || curYear(), t, Math.max(0, Number(b.allotted) || 0)));
    }
    if (action === 'save_policy') {
      const p: LeavePolicy = {
        vacation: Math.max(0, Number(b.policy?.vacation) || 0),
        sick: Math.max(0, Number(b.policy?.sick) || 0),
        personal: Math.max(0, Number(b.policy?.personal) || 0),
      };
      await saveSetting('leave_policy', p);
      return NextResponse.json({ ok: true, policy: p });
    }
    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
