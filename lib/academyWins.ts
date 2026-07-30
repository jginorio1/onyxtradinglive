import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Muro de Logros: los alumnos suben pruebas (retiros, retos superados,
// certificados, metas). Pasan por la aprobación del mentor antes de publicarse.
// La moderación de imagen (contenido indebido) se hace al subir (upload route).
// Línea: son logros reales de miembros, no promesa de resultados.
// ============================================================
const KINDS = ['payout', 'challenge', 'certificate', 'goal'];
const nameOf = (p: any) => p?.full_name || (p?.email || '').split('@')[0] || 'Trader';
const WIN_POINTS = 10; // puntos por logro aprobado (alimenta el ranking)

// Añade un logro (queda pendiente de aprobación del mentor).
export async function addWin(mentorId: string, studentId: string, b: any) {
  const kind = KINDS.includes(b.kind) ? b.kind : 'payout';
  const { data } = await supabaseAdmin.from('academy_wins').insert({
    mentor_id: mentorId, student_id: studentId, kind,
    title: b.title ? String(b.title).slice(0, 160) : null,
    amount_cents: b.amount_cents != null ? Math.max(0, Math.round(Number(b.amount_cents) || 0)) : null,
    currency: (b.currency || 'usd').toLowerCase().slice(0, 3),
    prop_firm: b.prop_firm ? String(b.prop_firm).slice(0, 80) : null,
    image_url: b.image_url ? String(b.image_url).slice(0, 500) : null,
    status: 'pending',
  }).select('id').single();
  return { ok: true, id: (data as any)?.id };
}

// Lista de logros aprobados (muro público de la comunidad) + like del viewer.
export async function listWins(mentorId: string, viewerId?: string, kind?: string) {
  let q = supabaseAdmin.from('academy_wins').select('*').eq('mentor_id', mentorId).eq('status', 'approved').order('created_at', { ascending: false }).limit(120);
  if (kind && KINDS.includes(kind)) q = q.eq('kind', kind);
  const { data } = await q;
  const rows = (data || []) as any[];
  const ids = Array.from(new Set(rows.map((w) => w.student_id)));
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids) : { data: [] } as any;
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  let liked = new Set<string>();
  if (viewerId && rows.length) {
    const { data: ls } = await supabaseAdmin.from('academy_win_likes').select('win_id').eq('user_id', viewerId).in('win_id', rows.map((w) => w.id));
    liked = new Set((ls || []).map((l: any) => l.win_id));
  }
  return rows.map((w) => ({ ...w, author_name: nameOf(pmap.get(w.student_id)), liked: liked.has(w.id) }));
}

// Cola de pendientes (solo el mentor).
export async function pendingWins(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_wins').select('*').eq('mentor_id', mentorId).eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
  const rows = (data || []) as any[];
  const ids = Array.from(new Set(rows.map((w) => w.student_id)));
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids) : { data: [] } as any;
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  return rows.map((w) => ({ ...w, author_name: nameOf(pmap.get(w.student_id)) }));
}
export async function pendingCount(mentorId: string) {
  const { count } = await supabaseAdmin.from('academy_wins').select('id', { count: 'exact', head: true }).eq('mentor_id', mentorId).eq('status', 'pending');
  return count || 0;
}

// El mentor aprueba (opcionalmente con sello verificado) o rechaza.
export async function reviewWin(mentorId: string, winId: string, action: 'approve' | 'reject', verified = false) {
  const { data: w } = await supabaseAdmin.from('academy_wins').select('student_id,status').eq('id', winId).eq('mentor_id', mentorId).maybeSingle();
  if (!w) return { ok: false };
  if (action === 'reject') { await supabaseAdmin.from('academy_wins').update({ status: 'rejected' }).eq('id', winId); return { ok: true }; }
  const wasApproved = (w as any).status === 'approved';
  await supabaseAdmin.from('academy_wins').update({ status: 'approved', verified: !!verified, approved_at: new Date().toISOString() }).eq('id', winId);
  // Puntos por logro aprobado (una vez).
  if (!wasApproved) await bumpPoints(mentorId, (w as any).student_id, WIN_POINTS);
  return { ok: true };
}
export async function setWinVerified(mentorId: string, winId: string, on: boolean) {
  await supabaseAdmin.from('academy_wins').update({ verified: !!on }).eq('id', winId).eq('mentor_id', mentorId);
  return { ok: true };
}
export async function deleteWin(mentorId: string, winId: string) {
  await supabaseAdmin.from('academy_wins').delete().eq('id', winId).eq('mentor_id', mentorId);
  return { ok: true };
}

// Like/felicitar (un like por usuario).
export async function toggleWinLike(winId: string, userId: string) {
  const { data: ex } = await supabaseAdmin.from('academy_win_likes').select('win_id').eq('win_id', winId).eq('user_id', userId).maybeSingle();
  if (ex) {
    await supabaseAdmin.from('academy_win_likes').delete().eq('win_id', winId).eq('user_id', userId);
  } else {
    await supabaseAdmin.from('academy_win_likes').insert({ win_id: winId, user_id: userId });
  }
  const { count } = await supabaseAdmin.from('academy_win_likes').select('win_id', { count: 'exact', head: true }).eq('win_id', winId);
  await supabaseAdmin.from('academy_wins').update({ likes: count || 0 }).eq('id', winId);
  return { liked: !ex, likes: count || 0 };
}

async function bumpPoints(mentorId: string, userId: string, delta: number) {
  const { data } = await supabaseAdmin.from('academy_points').select('points').eq('mentor_id', mentorId).eq('user_id', userId).maybeSingle();
  const cur = (data as any)?.points || 0;
  await supabaseAdmin.from('academy_points').upsert({ mentor_id: mentorId, user_id: userId, points: cur + delta }, { onConflict: 'mentor_id,user_id' });
}
