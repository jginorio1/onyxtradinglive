import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Reseñas verificadas de alumnos. Solo miembros; el mentor aprueba antes de
// publicarlas en la landing. "Verificada" = de un alumno real inscrito.
// ============================================================
const nameOf = (p: any) => p?.full_name || (p?.email || '').split('@')[0] || 'Alumno';
const clampR = (n: any) => Math.max(1, Math.min(5, Math.round(Number(n) || 5)));

export async function addReview(mentorId: string, studentId: string, rating: number, body: string) {
  await supabaseAdmin.from('academy_reviews').upsert({
    mentor_id: mentorId, student_id: studentId, rating: clampR(rating),
    body: body ? String(body).slice(0, 600) : null, status: 'pending',
  }, { onConflict: 'mentor_id,student_id' });
  return { ok: true };
}
export async function myReview(mentorId: string, studentId: string) {
  const { data } = await supabaseAdmin.from('academy_reviews').select('rating,body,status').eq('mentor_id', mentorId).eq('student_id', studentId).maybeSingle();
  return (data as any) || null;
}
// Reseñas aprobadas (públicas) + promedio y total.
export async function approvedReviews(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_reviews').select('student_id,rating,body,created_at').eq('mentor_id', mentorId).eq('status', 'approved').order('created_at', { ascending: false }).limit(50);
  const rows = (data || []) as any[];
  const ids = rows.map((r) => r.student_id);
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids) : { data: [] } as any;
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  const list = rows.map((r) => ({ name: nameOf(pmap.get(r.student_id)), rating: r.rating, body: r.body, created_at: r.created_at }));
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : 0;
  return { list, avg, count: rows.length };
}
export async function pendingReviews(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_reviews').select('id,student_id,rating,body,created_at').eq('mentor_id', mentorId).eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
  const rows = (data || []) as any[];
  const ids = rows.map((r) => r.student_id);
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids) : { data: [] } as any;
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, name: nameOf(pmap.get(r.student_id)) }));
}
export async function decideReview(mentorId: string, id: string, approve: boolean) {
  await supabaseAdmin.from('academy_reviews').update({ status: approve ? 'approved' : 'rejected' }).eq('id', id).eq('mentor_id', mentorId);
  return { ok: true };
}
