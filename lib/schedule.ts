// ============================================================
// Onyx Trading Live · Motor de HORARIOS + FICHAJE (lib/schedule.ts)
//   Construido ENCIMA de la nómina ya existente (tabla `staff`, lib/payroll).
//   No recrea la ficha del empleado; solo gestiona su horario y su reloj.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type Shift = { id: string; staff_id: string; weekday: number; start_time: string; end_time: string; note?: string | null; active: boolean };
export type ShiftExc = { id: string; staff_id: string; day: string; kind: 'off' | 'custom'; start_time?: string | null; end_time?: string | null; note?: string | null };
export type ClockRow = { id: string; staff_id: string; clock_in: string; clock_out: string | null; worked_min: number | null; source: string; note?: string | null };

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
export function cleanTime(s: any, fallback = '09:00'): string {
  const v = String(s || '').trim();
  return HHMM.test(v) ? (v.length === 4 ? '0' + v : v) : fallback;
}
// Minutos desde medianoche (para calcular duración de un turno 'HH:MM'-'HH:MM').
function toMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
export function shiftMinutes(start: string, end: string): number {
  let d = toMin(cleanTime(end)) - toMin(cleanTime(start, '00:00'));
  if (d < 0) d += 24 * 60;   // turno que cruza medianoche
  return d;
}

// ── Turnos recurrentes (plantilla semanal) ───────────────────────────
export async function shiftsForStaff(staffId: string): Promise<Shift[]> {
  const { data } = await supabaseAdmin.from('staff_shifts').select('*').eq('staff_id', staffId).order('weekday').order('start_time');
  return (data || []) as Shift[];
}
export async function allShifts(): Promise<Shift[]> {
  const { data } = await supabaseAdmin.from('staff_shifts').select('*').eq('active', true);
  return (data || []) as Shift[];
}
export async function addShift(staffId: string, weekday: number, start: string, end: string, note?: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (weekday < 0 || weekday > 6) return { ok: false, error: 'weekday inválido' };
  const { data, error } = await supabaseAdmin.from('staff_shifts')
    .insert({ staff_id: staffId, weekday, start_time: cleanTime(start), end_time: cleanTime(end, '17:00'), note: note || null })
    .select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any)?.id };
}
export async function updateShift(id: string, patch: Partial<Shift>): Promise<{ ok: boolean }> {
  const p: any = {};
  if (patch.start_time != null) p.start_time = cleanTime(patch.start_time);
  if (patch.end_time != null) p.end_time = cleanTime(patch.end_time, '17:00');
  if (patch.note !== undefined) p.note = patch.note || null;
  if (patch.active !== undefined) p.active = !!patch.active;
  if (patch.weekday !== undefined && patch.weekday >= 0 && patch.weekday <= 6) p.weekday = patch.weekday;
  if (Object.keys(p).length) await supabaseAdmin.from('staff_shifts').update(p).eq('id', id);
  return { ok: true };
}
export async function deleteShift(id: string): Promise<{ ok: boolean }> {
  await supabaseAdmin.from('staff_shifts').delete().eq('id', id);
  return { ok: true };
}

// ── Excepciones por fecha (libre / turno distinto ese día) ────────────
export async function exceptionsForStaff(staffId: string, from?: string, to?: string): Promise<ShiftExc[]> {
  let q = supabaseAdmin.from('staff_shift_exceptions').select('*').eq('staff_id', staffId).order('day');
  if (from) q = q.gte('day', from);
  if (to) q = q.lte('day', to);
  const { data } = await q;
  return (data || []) as ShiftExc[];
}
export async function setException(staffId: string, day: string, kind: 'off' | 'custom', start?: string, end?: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'fecha inválida' };
  const row: any = { staff_id: staffId, day, kind, note: note || null };
  if (kind === 'custom') { row.start_time = cleanTime(start); row.end_time = cleanTime(end, '17:00'); }
  else { row.start_time = null; row.end_time = null; }
  const { error } = await supabaseAdmin.from('staff_shift_exceptions').upsert(row, { onConflict: 'staff_id,day' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
export async function deleteException(staffId: string, day: string): Promise<{ ok: boolean }> {
  await supabaseAdmin.from('staff_shift_exceptions').delete().eq('staff_id', staffId).eq('day', day);
  return { ok: true };
}

// Turno EFECTIVO de un empleado en una fecha: aplica la excepción si existe,
// si no, los turnos recurrentes de ese día de la semana. Devuelve [] si libre.
export function resolveDay(day: string, weekday: number, shifts: Shift[], exc?: ShiftExc | null): { start: string; end: string; note?: string | null }[] {
  if (exc) {
    if (exc.kind === 'off') return [];
    if (exc.kind === 'custom' && exc.start_time && exc.end_time) return [{ start: exc.start_time, end: exc.end_time, note: exc.note }];
  }
  return shifts.filter((s) => s.weekday === weekday && s.active).map((s) => ({ start: s.start_time, end: s.end_time, note: s.note }));
}

// ── Fichaje (clock in / out) ──────────────────────────────────────────
export async function openClock(staffId: string): Promise<ClockRow | null> {
  const { data } = await supabaseAdmin.from('staff_clock').select('*').eq('staff_id', staffId).is('clock_out', null).maybeSingle();
  return (data as any) || null;
}
export async function clockIn(staffId: string, source = 'web'): Promise<{ ok: boolean; error?: string; id?: string }> {
  const open = await openClock(staffId);
  if (open) return { ok: false, error: 'already_open', id: open.id };   // ya está fichado
  const { data, error } = await supabaseAdmin.from('staff_clock').insert({ staff_id: staffId, source }).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any)?.id };
}
export async function clockOut(staffId: string): Promise<{ ok: boolean; error?: string; worked_min?: number }> {
  const open = await openClock(staffId);
  if (!open) return { ok: false, error: 'not_open' };
  const mins = Math.max(0, Math.round((Date.now() - new Date(open.clock_in).getTime()) / 60000));
  await supabaseAdmin.from('staff_clock').update({ clock_out: new Date().toISOString(), worked_min: mins }).eq('id', open.id);
  return { ok: true, worked_min: mins };
}
export async function clockHistory(staffId: string, limit = 60): Promise<ClockRow[]> {
  const { data } = await supabaseAdmin.from('staff_clock').select('*').eq('staff_id', staffId).order('clock_in', { ascending: false }).limit(limit);
  return (data || []) as ClockRow[];
}
// Minutos trabajados en un rango [from,to) (incluye la sesión abierta hasta ahora).
export async function workedMinutes(staffId: string, fromISO: string, toISO: string): Promise<number> {
  const { data } = await supabaseAdmin.from('staff_clock').select('clock_in,clock_out,worked_min')
    .eq('staff_id', staffId).gte('clock_in', fromISO).lt('clock_in', toISO);
  let total = 0;
  for (const r of (data || []) as any[]) {
    if (r.worked_min != null) total += r.worked_min;
    else if (!r.clock_out) total += Math.max(0, Math.round((Date.now() - new Date(r.clock_in).getTime()) / 60000));
  }
  return total;
}

// ¿Quién está FICHADO ahora mismo? (para el panel admin "en línea"). Devuelve
// staff_id → desde cuándo. Una sola consulta de los fichajes abiertos.
export async function whoIsClockedIn(): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin.from('staff_clock').select('staff_id,clock_in').is('clock_out', null);
  const m: Record<string, string> = {};
  for (const r of (data || []) as any[]) m[r.staff_id] = r.clock_in;
  return m;
}

export function fmtDur(min: number, en = false): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
