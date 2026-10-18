import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { staffByUser } from '@/lib/payroll';
import {
  shiftsForStaff, exceptionsForStaff, openClock, clockIn, clockOut,
  clockHistory, workedMinutes, resolveDay,
} from '@/lib/schedule';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function monthBounds(): { from: string; to: string; fromDay: string; toDay: string } {
  const n = new Date();
  const from = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  const to = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1));
  return { from: from.toISOString(), to: to.toISOString(), fromDay: from.toISOString().slice(0, 10), toDay: to.toISOString().slice(0, 10) };
}

// GET · mi horario (plantilla + excepciones del mes) + mi fichaje + horas del mes.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const st = await staffByUser(user.id);
  if (!st) return NextResponse.json({ isStaff: false });
  const { from, to, fromDay, toDay } = monthBounds();
  const [shifts, exceptions, open, history, worked] = await Promise.all([
    shiftsForStaff(st.id), exceptionsForStaff(st.id, fromDay, toDay), openClock(st.id), clockHistory(st.id, 30), workedMinutes(st.id, from, to),
  ]);
  // Turno de HOY (según zona del navegador la UI lo recalcula; aquí damos UTC base).
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().getUTCDay();
  const excToday = exceptions.find((e) => e.day === today) || null;
  const todayShift = resolveDay(today, weekday, shifts, excToday);
  return NextResponse.json({
    isStaff: true, name: st.name,
    shifts, exceptions, todayShift,
    open: open ? { id: open.id, clock_in: open.clock_in } : null,
    history, workedMin: worked,
  });
}

// POST · el empleado ficha entrada/salida.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const st = await staffByUser(user.id);
  if (!st) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');
  const source = b.source === 'app' ? 'app' : 'web';
  try {
    if (action === 'clock_in') return NextResponse.json(await clockIn(st.id, source));
    if (action === 'clock_out') return NextResponse.json(await clockOut(st.id));
    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
