import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Métricas reales de la comunidad para el resumen semanal AI del mentor.
export async function communityStats(mentorId: string, days = 7) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [enrTot, enrNew, posts, comments, winsApproved, nextEv] = await Promise.all([
    supabaseAdmin.from('academy_enrollments').select('student_id', { count: 'exact', head: true }).eq('mentor_id', mentorId).eq('status', 'active'),
    supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('status', 'active').gte('joined_at', since),
    supabaseAdmin.from('academy_posts').select('author_id,created_at').eq('mentor_id', mentorId).gte('created_at', since),
    supabaseAdmin.from('academy_comments').select('author_id,created_at').gte('created_at', since),
    supabaseAdmin.from('academy_wins').select('id,kind,amount_cents').eq('mentor_id', mentorId).eq('status', 'approved').gte('approved_at', since),
    supabaseAdmin.from('academy_events').select('title,starts_at').eq('mentor_id', mentorId).gte('starts_at', new Date().toISOString()).order('starts_at').limit(1),
  ]);
  // Actividad por autor (posts + comentarios) para top contributors + activos.
  const act: Record<string, number> = {};
  (posts.data || []).forEach((p: any) => { act[p.author_id] = (act[p.author_id] || 0) + 1; });
  (comments.data || []).forEach((c: any) => { act[c.author_id] = (act[c.author_id] || 0) + 1; });
  const activeCount = Object.keys(act).length;
  const total = enrTot.count || 0;
  // Nombres de los top 3 contribuyentes.
  const topIds = Object.entries(act).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  const { data: profs } = topIds.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', topIds) : { data: [] } as any;
  const nm = (id: string) => { const p = (profs || []).find((x: any) => x.id === id); return p?.full_name || (p?.email || '').split('@')[0] || 'Trader'; };
  const winsList = (winsApproved.data || []) as any[];
  return {
    periodDays: days,
    totalMembers: total,
    newMembers: (enrNew.data || []).length,
    posts: (posts.data || []).length,
    comments: (comments.data || []).length,
    activeMembers: activeCount,
    inactiveMembers: Math.max(0, total - activeCount),
    winsApproved: winsList.length,
    winsPayouts: winsList.filter((w) => w.kind === 'payout').length,
    topContributors: topIds.map((id) => ({ name: nm(id), actions: act[id] })),
    nextClass: (nextEv.data || [])[0] ? { title: (nextEv.data as any)[0].title, when: (nextEv.data as any)[0].starts_at } : null,
  };
}
