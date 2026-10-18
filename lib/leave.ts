// ============================================================
// Onyx Trading Live · Motor de DÍAS LIBRES / AUSENCIAS (lib/leave.ts)
//   Encima de la nómina (`staff`). Al APROBAR, marca cada día como excepción
//   'off' en HORARIOS (staff_shift_exceptions) para que salga "libre" en el
//   calendario del horario. No duplica nada: reutiliza lib/schedule.setException.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { leavePolicySettings, type LeavePolicy } from '@/lib/settings';
import { setException, deleteException } from '@/lib/schedule';

export type LeaveType = 'vacation' | 'sick' | 'personal';
export const LEAVE_TYPES: LeaveType[] = ['vacation', 'sick', 'personal'];
export const LEAVE_LABEL: Record<LeaveType, { es: string; en: string }> = {
  vacation: { es: 'Vacaciones', en: 'Vacation' },
  sick: { es: 'Enfermedad', en: 'Sick' },
  personal: { es: 'Personal', en: 'Personal' },
};

export type LeaveRequest = {
  id: string; staff_id: string; type: LeaveType; start_day: string; end_day: string;
  days: number; reason?: string | null; status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  admin_note?: string | null; decided_at?: string | null; created_at: string;
};

export const curYear = () => new Date().getUTCFullYear();

// Nº de días del rango (inclusive). Cuenta días naturales; simple y predecible
// (un empleado puede trabajar fines de semana, así que no excluimos sábados).
export function countDays(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00Z').getTime();
  const b = new Date(end + 'T00:00:00Z').getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}
// Lista de fechas 'YYYY-MM-DD' del rango inclusive (para marcar excepciones).
function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00Z'); const b = new Date(end + 'T00:00:00Z');
  while (d.getTime() <= b.getTime()) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out.slice(0, 120);   // tope de seguridad
}

// ── Saldos por empleado (asignado / usado / restante) para un año ────
export async function balancesForStaff(staffId: string, year = curYear()): Promise<Record<LeaveType, { allotted: number; used: number; remaining: number }>> {
  const policy = await leavePolicySettings();
  const { data: rows } = await supabaseAdmin.from('staff_leave_balance').select('type,allotted').eq('staff_id', staffId).eq('year', year);
  const allot: any = {}; (rows || []).forEach((r: any) => { allot[r.type] = Number(r.allotted); });
  // Días ya aprobados este año por tipo.
  const { data: reqs } = await supabaseAdmin.from('staff_leave_requests')
    .select('type,days,start_day,status').eq('staff_id', staffId).eq('status', 'approved')
    .gte('start_day', `${year}-01-01`).lte('start_day', `${year}-12-31`);
  const used: any = {}; (reqs || []).forEach((r: any) => { used[r.type] = (used[r.type] || 0) + Number(r.days); });
  const out: any = {};
  for (const t of LEAVE_TYPES) {
    const a = allot[t] != null ? allot[t] : (policy as any)[t] || 0;
    const u = used[t] || 0;
    out[t] = { allotted: a, used: u, remaining: Math.max(0, a - u) };
  }
  return out;
}

export async function setAllotment(staffId: string, year: number, type: LeaveType, allotted: number): Promise<{ ok: boolean }> {
  await supabaseAdmin.from('staff_leave_balance').upsert({ staff_id: staffId, year, type, allotted, updated_at: new Date().toISOString() }, { onConflict: 'staff_id,year,type' });
  return { ok: true };
}

// ── Solicitudes ──────────────────────────────────────────────────────
export async function requestsForStaff(staffId: string, limit = 40): Promise<LeaveRequest[]> {
  const { data } = await supabaseAdmin.from('staff_leave_requests').select('*').eq('staff_id', staffId).order('created_at', { ascending: false }).limit(limit);
  return (data || []) as LeaveRequest[];
}
// Cola del admin: pendientes primero (más antiguas arriba), luego el resto.
export async function allRequests(status?: string, limit = 200): Promise<LeaveRequest[]> {
  let q = supabaseAdmin.from('staff_leave_requests').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return (data || []) as LeaveRequest[];
}

export async function createRequest(staffId: string, type: LeaveType, start: string, end: string, reason?: string): Promise<{ ok: boolean; error?: string; id?: string; days?: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { ok: false, error: 'fecha inválida' };
  const days = countDays(start, end);
  if (days <= 0) return { ok: false, error: 'rango inválido' };
  const t: LeaveType = LEAVE_TYPES.includes(type) ? type : 'vacation';
  const { data, error } = await supabaseAdmin.from('staff_leave_requests')
    .insert({ staff_id: staffId, type: t, start_day: start, end_day: end, days, reason: reason?.slice(0, 500) || null })
    .select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any)?.id, days };
}

export async function cancelOwnRequest(staffId: string, id: string): Promise<{ ok: boolean }> {
  // Solo puede cancelar una propia que siga PENDIENTE.
  await supabaseAdmin.from('staff_leave_requests').update({ status: 'cancelled' }).eq('id', id).eq('staff_id', staffId).eq('status', 'pending');
  return { ok: true };
}

// Aprobar/rechazar (admin). Al APROBAR, marca cada día como 'off' en horarios para
// que aparezca libre en el calendario. Al RECHAZAR/cancelar una ya aprobada, limpia
// esas excepciones. Idempotente.
export async function decideRequest(id: string, approve: boolean, deciderId?: string, adminNote?: string): Promise<{ ok: boolean; error?: string }> {
  const { data: r } = await supabaseAdmin.from('staff_leave_requests').select('*').eq('id', id).maybeSingle();
  if (!r) return { ok: false, error: 'no encontrada' };
  const req = r as any;
  const newStatus = approve ? 'approved' : 'rejected';
  await supabaseAdmin.from('staff_leave_requests').update({
    status: newStatus, admin_note: adminNote?.slice(0, 500) || null, decided_by: deciderId || null, decided_at: new Date().toISOString(),
  }).eq('id', id);
  const days = eachDay(req.start_day, req.end_day);
  const noteLabel = LEAVE_LABEL[(req.type as LeaveType)]?.es || 'Día libre';
  try {
    if (approve) { for (const d of days) await setException(req.staff_id, d, 'off', undefined, undefined, noteLabel); }
    else { for (const d of days) await deleteException(req.staff_id, d); }
  } catch { /* si horarios no está, no rompemos la decisión */ }
  return { ok: true };
}
