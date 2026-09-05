import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Analíticas de retención de la academia (para el mentor).
// "Activo" = entró a la academia (last_seen_at) o publicó/comentó en el periodo.
// ============================================================
const nameOf = (p: any) => p?.full_name || (p?.email || '').split('@')[0] || 'Alumno';

export async function retentionStats(mentorId: string) {
  const now = Date.now();
  const d7 = new Date(now - 7 * 864e5).toISOString();
  const d14 = new Date(now - 14 * 864e5).toISOString();
  const d30 = new Date(now - 30 * 864e5).toISOString();

  const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id,joined_at').eq('mentor_id', mentorId).eq('status', 'active');
  const rows = (enr || []) as any[];
  const ids = rows.map((r) => r.student_id);
  const total = ids.length;
  if (!total) return { total: 0, active7: 0, active30: 0, inactive30: 0, retention30: 0, churn30: 0, newByWeek: [], atRisk: [] as any[] };

  const [{ data: profs }, { data: recentPosts }, { data: recentComments }, { data: canceledMem }, { data: canceledBuys }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,email,last_seen_at').in('id', ids),
    supabaseAdmin.from('academy_posts').select('author_id,created_at').eq('mentor_id', mentorId).gte('created_at', d30).in('author_id', ids),
    supabaseAdmin.from('academy_comments').select('author_id,created_at').gte('created_at', d30).in('author_id', ids),
    supabaseAdmin.from('academy_memberships').select('student_id,updated_at').eq('mentor_id', mentorId).eq('status', 'canceled'),
    supabaseAdmin.from('academy_purchases').select('student_id').eq('mentor_id', mentorId).eq('status', 'canceled'),
  ]);
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  const joinOf = new Map(rows.map((r) => [r.student_id, r.joined_at]));
  // Última actividad = max(last_seen_at, último post/comentario).
  const lastAct: Record<string, number> = {};
  for (const p of (profs || []) as any[]) if (p.last_seen_at) lastAct[p.id] = new Date(p.last_seen_at).getTime();
  const bump = (arr: any[]) => arr.forEach((x: any) => { const t = new Date(x.created_at).getTime(); if (t > (lastAct[x.author_id] || 0)) lastAct[x.author_id] = t; });
  bump(recentPosts || []); bump(recentComments || []);

  const t7 = new Date(d7).getTime(), t14 = new Date(d14).getTime(), t30 = new Date(d30).getTime();
  let active7 = 0, active30 = 0;
  const atRisk: any[] = [];
  for (const id of ids) {
    const la = lastAct[id] || 0;
    if (la >= t7) active7++;
    if (la >= t30) active30++;
    // En riesgo: sin actividad en 14+ días (y no es alguien que se acaba de unir hoy).
    if (la < t14) atRisk.push({ user_id: id, name: nameOf(pmap.get(id)), lastActive: la ? new Date(la).toISOString() : null, joined_at: joinOf.get(id) || null });
  }
  atRisk.sort((a, b) => (a.lastActive ? new Date(a.lastActive).getTime() : 0) - (b.lastActive ? new Date(b.lastActive).getTime() : 0));

  // Altas por semana (últimas 6 semanas).
  const newByWeek: { label: string; n: number }[] = [];
  for (let w = 5; w >= 0; w--) {
    const from = now - (w + 1) * 7 * 864e5, to = now - w * 7 * 864e5;
    const n = rows.filter((r) => { const t = r.joined_at ? new Date(r.joined_at).getTime() : 0; return t >= from && t < to; }).length;
    newByWeek.push({ label: w === 0 ? 'Esta sem.' : `-${w}sem`, n });
  }

  const churn30 = ((canceledMem || []).filter((c: any) => c.updated_at && new Date(c.updated_at).getTime() >= t30).length) + ((canceledBuys || []).length);
  return {
    total, active7, active30, inactive30: total - active30,
    retention30: total ? Math.round((active30 / total) * 100) : 0,
    churn30, newByWeek, atRisk: atRisk.slice(0, 40),
  };
}
