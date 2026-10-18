import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { listStaff } from '@/lib/payroll';
import {
  shiftsForStaff, addShift, updateShift, deleteShift,
  exceptionsForStaff, setException, deleteException,
  whoIsClockedIn, clockOut, workedMinutes, clockHistory,
} from '@/lib/schedule';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Inicio de mes (YYYY-MM-01) y del mes siguiente, en UTC simple (basta para el rango).
function monthRange(ym?: string): { from: string; to: string; fromDay: string; toDay: string } {
  const now = new Date();
  const y = ym ? parseInt(ym.slice(0, 4), 10) : now.getUTCFullYear();
  const m = ym ? parseInt(ym.slice(5, 7), 10) - 1 : now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 1));
  const iso = (d: Date) => d.toISOString();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), fromDay: day(from), toDay: day(to) };
}

// GET · roster con turnos + excepciones del mes + quién ficha ahora + horas del mes.
//   ?month=YYYY-MM (opcional) · ?staff=<id> para traer solo uno con su historial.
export async function GET(req: Request) {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const url = new URL(req.url);
  const month = url.searchParams.get('month') || undefined;
  const one = url.searchParams.get('staff') || '';
  const { from, to, fromDay, toDay } = monthRange(month);

  if (one) {
    // Detalle de un empleado: turnos + excepciones del mes + fichajes recientes.
    const [shifts, exceptions, history, worked] = await Promise.all([
      shiftsForStaff(one), exceptionsForStaff(one, fromDay, toDay), clockHistory(one, 40), workedMinutes(one, from, to),
    ]);
    return NextResponse.json({ shifts, exceptions, history, workedMin: worked, month: month || new Date().toISOString().slice(0, 7) });
  }

  const staffRaw = await listStaff();
  const open = await whoIsClockedIn();
  const staff: any[] = [];
  for (const s of staffRaw) {
    const [shifts, exceptions, worked] = await Promise.all([
      shiftsForStaff(s.id), exceptionsForStaff(s.id, fromDay, toDay), workedMinutes(s.id, from, to),
    ]);
    staff.push({
      id: s.id, name: s.name, department: s.department, position: s.position, status: s.status,
      shifts, exceptions, workedMin: worked, clockedInAt: open[s.id] || null,
    });
  }
  return NextResponse.json({ staff, month: month || new Date().toISOString().slice(0, 7) });
}

// POST · acciones del admin (gestionar turnos/excepciones/fichaje forzado).
export async function POST(req: Request) {
  const { ok } = await requirePerm('equipo', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');
  try {
    if (action === 'add_shift') { const r = await addShift(b.staff_id, Number(b.weekday), b.start_time, b.end_time, b.note); if (r.ok) logAdmin('team.shift_add', { staff: b.staff_id, weekday: b.weekday }); return NextResponse.json(r); }
    if (action === 'update_shift') return NextResponse.json(await updateShift(b.id, b));
    if (action === 'delete_shift') return NextResponse.json(await deleteShift(b.id));
    if (action === 'set_exception') { const r = await setException(b.staff_id, b.day, b.kind === 'custom' ? 'custom' : 'off', b.start_time, b.end_time, b.note); if (r.ok) logAdmin('team.shift_exception', { staff: b.staff_id, day: b.day, kind: b.kind }); return NextResponse.json(r); }
    if (action === 'delete_exception') return NextResponse.json(await deleteException(b.staff_id, b.day));
    if (action === 'force_clock_out') { const r = await clockOut(b.staff_id); return NextResponse.json(r); }
    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
