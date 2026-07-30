import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeStats } from '@/lib/stats';
import crypto from 'crypto';

// ============================================================
// Onyx Academy · comunidad + cursos (estilo Skool).
// Un mentor tiene una academia (mentors). Publica módulos/lecciones y tiene
// alumnos inscritos. Los alumnos ven el contenido, marcan progreso y participan
// en la comunidad. La capacidad de plan `academy` decide quién puede ser mentor.
// ============================================================

const rndCode = () => 'a' + crypto.randomBytes(4).toString('hex');

export async function getMentor(userId: string) {
  const { data } = await supabaseAdmin.from('mentors').select('*').eq('user_id', userId).maybeSingle();
  return data as any;
}
// Crea la academia del mentor si no existe (con código único).
export async function ensureMentor(userId: string) {
  const cur = await getMentor(userId);
  if (cur) return cur;
  let code = rndCode();
  for (let i = 0; i < 4; i++) {
    const { data } = await supabaseAdmin.from('mentors').select('user_id').eq('code', code).maybeSingle();
    if (!data) break; code = rndCode();
  }
  const { data } = await supabaseAdmin.from('mentors').insert({ user_id: userId, code, academy_name: 'Mi academia' }).select('*').single();
  return data as any;
}
export async function updateMentor(userId: string, b: any) {
  const patch: any = {};
  if (b.academy_name !== undefined) patch.academy_name = String(b.academy_name).slice(0, 80);
  if (b.tagline !== undefined) patch.tagline = String(b.tagline || '').slice(0, 160);
  if (b.about !== undefined) patch.about = String(b.about || '').slice(0, 2000);
  if (b.cover_url !== undefined) patch.cover_url = b.cover_url ? String(b.cover_url).slice(0, 500) : null;
  if (b.logo_url !== undefined) patch.logo_url = b.logo_url ? String(b.logo_url).slice(0, 500) : null;
  if (b.brand_info !== undefined) patch.brand_info = b.brand_info ? String(b.brand_info).slice(0, 3000) : null;
  if (b.ai_emojis !== undefined) patch.ai_emojis = !!b.ai_emojis;
  if (b.socials !== undefined && b.socials && typeof b.socials === 'object') {
    const keys = ['whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'telegram', 'x'];
    const s: any = {};
    for (const k of keys) if (b.socials[k]) s[k] = String(b.socials[k]).slice(0, 200);
    patch.socials = s;
  }
  if (b.email_templates !== undefined && b.email_templates && typeof b.email_templates === 'object') patch.email_templates = b.email_templates;
  if (b.intro_video_url !== undefined) patch.intro_video_url = b.intro_video_url ? String(b.intro_video_url).slice(0, 500) : null;
  if (b.pitch !== undefined) patch.pitch = b.pitch ? String(b.pitch).slice(0, 4000) : null;
  if (b.membership_price_cents !== undefined) patch.membership_price_cents = Math.max(0, Math.round(Number(b.membership_price_cents) || 0));
  if (b.membership_currency !== undefined) patch.membership_currency = String(b.membership_currency || 'usd').toLowerCase().slice(0, 3);
  if (b.membership_interval !== undefined) patch.membership_interval = b.membership_interval === 'year' ? 'year' : 'month';
  if (b.active !== undefined) patch.active = !!b.active;
  await supabaseAdmin.from('mentors').update(patch).eq('user_id', userId);
}

// ---- Contenido (módulos + lecciones) ----
export async function getContent(mentorId: string, onlyPublished = false) {
  let mq = supabaseAdmin.from('academy_modules').select('*').eq('mentor_id', mentorId).order('position');
  if (onlyPublished) mq = mq.eq('published', true);
  const { data: mods } = await mq;
  let lq = supabaseAdmin.from('academy_lessons').select('*').eq('mentor_id', mentorId).order('position');
  if (onlyPublished) lq = lq.eq('published', true);
  const { data: lessons } = await lq;
  const byMod: Record<string, any[]> = {};
  (lessons || []).forEach((l: any) => { (byMod[l.module_id] ||= []).push(l); });
  return (mods || []).map((m: any) => ({ ...m, lessons: byMod[m.id] || [] }));
}

export async function saveModule(mentorId: string, b: any) {
  const cover = b.cover_url !== undefined ? (b.cover_url ? String(b.cover_url).slice(0, 500) : null) : undefined;
  if (b.id) {
    const patch: any = { title: String(b.title || '').slice(0, 120), description: b.description ? String(b.description).slice(0, 500) : null, position: Number(b.position) || 0, published: b.published !== false };
    if (cover !== undefined) patch.cover_url = cover;
    await supabaseAdmin.from('academy_modules').update(patch).eq('id', b.id).eq('mentor_id', mentorId); return { id: b.id };
  }
  const { data } = await supabaseAdmin.from('academy_modules').insert({ mentor_id: mentorId, title: String(b.title || 'Módulo').slice(0, 120), description: b.description ? String(b.description).slice(0, 500) : null, position: Number(b.position) || 0, cover_url: cover ?? null }).select('id').single();
  return data as any;
}
export async function deleteModule(mentorId: string, id: string) {
  await supabaseAdmin.from('academy_modules').delete().eq('id', id).eq('mentor_id', mentorId);
}
export async function saveLesson(mentorId: string, b: any) {
  const row: any = {
    title: String(b.title || 'Lección').slice(0, 160),
    section: b.section !== undefined ? (b.section ? String(b.section).slice(0, 120) : null) : undefined,
    video_url: b.video_url ? String(b.video_url).slice(0, 500) : null,
    content: b.content ? String(b.content).slice(0, 8000) : null,
    resources: Array.isArray(b.resources) ? b.resources.slice(0, 20).map((r: any) => ({ label: String(r.label || '').slice(0, 80), url: String(r.url || '').slice(0, 400) })) : [],
    position: Number(b.position) || 0,
    is_free: !!b.is_free,
    published: b.published !== false,
  };
  if (row.section === undefined) delete row.section;
  if (b.id) { await supabaseAdmin.from('academy_lessons').update(row).eq('id', b.id).eq('mentor_id', mentorId); return { id: b.id }; }
  const { data } = await supabaseAdmin.from('academy_lessons').insert({ ...row, mentor_id: mentorId, module_id: b.module_id }).select('id').single();
  return data as any;
}
export async function deleteLesson(mentorId: string, id: string) {
  await supabaseAdmin.from('academy_lessons').delete().eq('id', id).eq('mentor_id', mentorId);
}

// ---- Inscripción ----
export async function enrollByCode(studentId: string, code: string) {
  const { data: m } = await supabaseAdmin.from('mentors').select('user_id,active').eq('code', code).maybeSingle();
  if (!m || !(m as any).active) return { ok: false, error: 'not_found' };
  if ((m as any).user_id === studentId) return { ok: false, error: 'self' };
  await supabaseAdmin.from('academy_enrollments').upsert({ mentor_id: (m as any).user_id, student_id: studentId, status: 'active' }, { onConflict: 'mentor_id,student_id' });
  return { ok: true, mentor_id: (m as any).user_id };
}
export async function isEnrolled(mentorId: string, studentId: string) {
  const { data } = await supabaseAdmin.from('academy_enrollments').select('status').eq('mentor_id', mentorId).eq('student_id', studentId).maybeSingle();
  return !!data && (data as any).status === 'active';
}
export async function myAcademies(studentId: string) {
  const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('mentor_id,joined_at').eq('student_id', studentId).eq('status', 'active');
  const ids = (enr || []).map((e: any) => e.mentor_id);
  if (!ids.length) return [];
  const { data: mentors } = await supabaseAdmin.from('mentors').select('user_id,academy_name,tagline').in('user_id', ids);
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,full_name').in('id', ids);
  const nameOf: Record<string, string> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p.full_name || 'Mentor'; });
  return (mentors || []).map((m: any) => ({ mentor_id: m.user_id, academy_name: m.academy_name, tagline: m.tagline, mentor_name: nameOf[m.user_id] || 'Mentor' }));
}

// ---- Progreso ----
export async function progressSet(studentId: string, mentorId: string): Promise<string[]> {
  const { data: lessons } = await supabaseAdmin.from('academy_lessons').select('id').eq('mentor_id', mentorId);
  const ids = (lessons || []).map((l: any) => l.id);
  if (!ids.length) return [];
  const { data } = await supabaseAdmin.from('lesson_progress').select('lesson_id').eq('student_id', studentId).in('lesson_id', ids);
  return (data || []).map((r: any) => r.lesson_id);
}
export async function markLesson(studentId: string, lessonId: string, done: boolean) {
  if (done) await supabaseAdmin.from('lesson_progress').upsert({ student_id: studentId, lesson_id: lessonId }, { onConflict: 'student_id,lesson_id' });
  else await supabaseAdmin.from('lesson_progress').delete().eq('student_id', studentId).eq('lesson_id', lessonId);
}

// ---- Roster del mentor (alumnos + progreso) ----
export async function roster(mentorId: string) {
  const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id,joined_at,status').eq('mentor_id', mentorId).eq('status', 'active');
  const ids = (enr || []).map((e: any) => e.student_id);
  const { data: lessons } = await supabaseAdmin.from('academy_lessons').select('id').eq('mentor_id', mentorId);
  const total = (lessons || []).length;
  if (!ids.length) return { students: [], totalLessons: total };
  const [{ data: profs }, { data: prog }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids),
    supabaseAdmin.from('lesson_progress').select('student_id,lesson_id').in('student_id', ids),
  ]);
  const nameOf: Record<string, any> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p; });
  const done: Record<string, number> = {}; (prog || []).forEach((r: any) => { done[r.student_id] = (done[r.student_id] || 0) + 1; });
  const students = (enr || []).map((e: any) => ({ id: e.student_id, name: nameOf[e.student_id]?.full_name || (nameOf[e.student_id]?.email || '').split('@')[0] || 'Alumno', joined_at: e.joined_at, done: done[e.student_id] || 0 }));
  return { students, totalLessons: total };
}

// ============================================================
// Gamificación estilo Skool: puntos por likes recibidos y niveles 1–9.
// ============================================================
// Umbrales de puntos acumulados para cada nivel (los de Skool).
export const LEVEL_THRESHOLDS = [0, 5, 20, 65, 155, 515, 2015, 8015, 33015];
export function levelFor(points: number): { level: number; next: number | null; into: number; span: number } {
  const p = Math.max(0, points || 0);
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (p >= LEVEL_THRESHOLDS[i]) level = i + 1;
  const cur = LEVEL_THRESHOLDS[level - 1];
  const next = level < 9 ? LEVEL_THRESHOLDS[level] : null;
  return { level, next, into: p - cur, span: next == null ? 0 : next - cur };
}

// Da/quita "me gusta". Suma o resta 1 punto al autor del contenido en esa comunidad.
export async function toggleLike(userId: string, mentorId: string, targetType: 'post' | 'comment', targetId: string) {
  // Autor del contenido.
  const tbl = targetType === 'post' ? 'academy_posts' : 'academy_comments';
  const { data: row } = await supabaseAdmin.from(tbl).select('author_id').eq('id', targetId).maybeSingle();
  const authorId = (row as any)?.author_id;
  const { data: existing } = await supabaseAdmin.from('academy_likes').select('id').eq('target_type', targetType).eq('target_id', targetId).eq('user_id', userId).maybeSingle();
  let liked: boolean;
  if (existing) {
    await supabaseAdmin.from('academy_likes').delete().eq('id', (existing as any).id);
    liked = false;
    if (authorId && authorId !== userId) await bumpPoints(mentorId, authorId, -1);
  } else {
    await supabaseAdmin.from('academy_likes').insert({ target_type: targetType, target_id: targetId, user_id: userId, mentor_id: mentorId });
    liked = true;
    if (authorId && authorId !== userId) await bumpPoints(mentorId, authorId, +1);
  }
  const { count } = await supabaseAdmin.from('academy_likes').select('id', { count: 'exact', head: true }).eq('target_type', targetType).eq('target_id', targetId);
  return { liked, count: count || 0 };
}
async function bumpPoints(mentorId: string, userId: string, delta: number) {
  const { data } = await supabaseAdmin.from('academy_points').select('points').eq('mentor_id', mentorId).eq('user_id', userId).maybeSingle();
  const points = Math.max(0, ((data as any)?.points || 0) + delta);
  await supabaseAdmin.from('academy_points').upsert({ mentor_id: mentorId, user_id: userId, points, updated_at: new Date().toISOString() }, { onConflict: 'mentor_id,user_id' });
}

// Ranking de la comunidad. range: 'all' (puntos acumulados) | '7d' | '30d'
// (likes recibidos en la ventana). Devuelve top N con nombre y nivel.
export async function leaderboard(mentorId: string, range: 'all' | '7d' | '30d' = 'all', limit = 30) {
  let board: { user_id: string; points: number }[] = [];
  if (range === 'all') {
    const { data } = await supabaseAdmin.from('academy_points').select('user_id,points').eq('mentor_id', mentorId).order('points', { ascending: false }).limit(limit);
    board = (data || []) as any;
  } else {
    const days = range === '7d' ? 7 : 30;
    const since = new Date(Date.now() - days * 864e5).toISOString();
    // Likes recibidos = likes cuyo contenido pertenece a cada autor.
    const { data: likes } = await supabaseAdmin.from('academy_likes').select('target_type,target_id,user_id').eq('mentor_id', mentorId).gte('created_at', since);
    const postIds = (likes || []).filter((l: any) => l.target_type === 'post').map((l: any) => l.target_id);
    const comIds = (likes || []).filter((l: any) => l.target_type === 'comment').map((l: any) => l.target_id);
    const authorOf: Record<string, string> = {};
    if (postIds.length) { const { data } = await supabaseAdmin.from('academy_posts').select('id,author_id').in('id', postIds); (data || []).forEach((r: any) => { authorOf['p' + r.id] = r.author_id; }); }
    if (comIds.length) { const { data } = await supabaseAdmin.from('academy_comments').select('id,author_id').in('id', comIds); (data || []).forEach((r: any) => { authorOf['c' + r.id] = r.author_id; }); }
    const tally: Record<string, number> = {};
    (likes || []).forEach((l: any) => { const a = authorOf[(l.target_type === 'post' ? 'p' : 'c') + l.target_id]; if (a && a !== l.user_id) tally[a] = (tally[a] || 0) + 1; });
    board = Object.entries(tally).map(([user_id, points]) => ({ user_id, points })).sort((a, b) => b.points - a.points).slice(0, limit);
  }
  const ids = board.map((b) => b.user_id);
  if (!ids.length) return [];
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids);
  const nameOf: Record<string, any> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p; });
  // nivel siempre desde puntos acumulados
  const { data: allPts } = await supabaseAdmin.from('academy_points').select('user_id,points').eq('mentor_id', mentorId).in('user_id', ids);
  const ptOf: Record<string, number> = {}; (allPts || []).forEach((r: any) => { ptOf[r.user_id] = r.points; });
  return board.map((b, i) => {
    const pr = nameOf[b.user_id];
    return { rank: i + 1, user_id: b.user_id, name: pr?.full_name || (pr?.email || '').split('@')[0] || 'Trader', points: b.points, level: levelFor(ptOf[b.user_id] || 0).level };
  });
}

// Directorio de miembros (mentor + alumnos) con nivel y puntos.
export async function membersList(mentorId: string) {
  const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id,joined_at').eq('mentor_id', mentorId).eq('status', 'active');
  const ids = new Set<string>((enr || []).map((e: any) => e.student_id));
  ids.add(mentorId); // el mentor también es miembro
  const idArr = Array.from(ids);
  const [{ data: profs }, { data: pts }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,email,country,last_seen_at').in('id', idArr),
    supabaseAdmin.from('academy_points').select('user_id,points').eq('mentor_id', mentorId).in('user_id', idArr),
  ]);
  const ptOf: Record<string, number> = {}; (pts || []).forEach((r: any) => { ptOf[r.user_id] = r.points; });
  const joinOf: Record<string, string> = {}; (enr || []).forEach((e: any) => { joinOf[e.student_id] = e.joined_at; });
  const ONLINE_MS = 5 * 60 * 1000; // "en línea" = actividad en los últimos 5 min
  return (profs || []).map((p: any) => {
    const points = ptOf[p.id] || 0;
    const online = p.last_seen_at ? (Date.now() - new Date(p.last_seen_at).getTime()) < ONLINE_MS : false;
    return {
      user_id: p.id, name: p.full_name || (p.email || '').split('@')[0] || 'Trader',
      points, level: levelFor(points).level, joined_at: joinOf[p.id] || null,
      country: p.country || null, online,
      is_mentor: p.id === mentorId,
    };
  }).sort((a, b) => (b.is_mentor ? 1 : 0) - (a.is_mentor ? 1 : 0) || (b.online ? 1 : 0) - (a.online ? 1 : 0) || b.points - a.points);
}

// ---- Comunidad ----
export async function listPosts(mentorId: string, viewerId?: string, includeScheduled = false) {
  let pq = supabaseAdmin.from('academy_posts').select('*').eq('mentor_id', mentorId);
  if (!includeScheduled) pq = pq.or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`);
  const { data: posts } = await pq.order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  const list = posts || [];
  const authorIds = Array.from(new Set(list.map((p: any) => p.author_id)));
  const postIds = list.map((p: any) => p.id);
  const { data: comments } = postIds.length ? await supabaseAdmin.from('academy_comments').select('*').in('post_id', postIds).order('created_at') : { data: [] } as any;
  (comments || []).forEach((c: any) => authorIds.push(c.author_id));
  const uniqAuthors = Array.from(new Set(authorIds));
  const [{ data: profs }, { data: pts }] = await Promise.all([
    uniqAuthors.length ? supabaseAdmin.from('profiles').select('id,full_name').in('id', uniqAuthors) : Promise.resolve({ data: [] } as any),
    uniqAuthors.length ? supabaseAdmin.from('academy_points').select('user_id,points').eq('mentor_id', mentorId).in('user_id', uniqAuthors) : Promise.resolve({ data: [] } as any),
  ]);
  const nameOf: Record<string, string> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p.full_name || 'Trader'; });
  const lvlOf: Record<string, number> = {}; (pts || []).forEach((r: any) => { lvlOf[r.user_id] = levelFor(r.points).level; });
  // Likes de todos los posts + comentarios de esta tanda.
  const comIds = (comments || []).map((c: any) => c.id);
  const { data: likes } = (postIds.length || comIds.length)
    ? await supabaseAdmin.from('academy_likes').select('target_type,target_id,user_id').eq('mentor_id', mentorId)
    : { data: [] } as any;
  const likeCount: Record<string, number> = {}; const likedMine: Record<string, boolean> = {};
  (likes || []).forEach((l: any) => { const k = l.target_type + ':' + l.target_id; likeCount[k] = (likeCount[k] || 0) + 1; if (viewerId && l.user_id === viewerId) likedMine[k] = true; });
  const byPost: Record<string, any[]> = {};
  (comments || []).forEach((c: any) => { (byPost[c.post_id] ||= []).push({ ...c, author_name: nameOf[c.author_id] || 'Trader', author_level: lvlOf[c.author_id] || 1, likes: likeCount['comment:' + c.id] || 0, liked: !!likedMine['comment:' + c.id] }); });
  return list.map((p: any) => ({
    ...p, author_name: nameOf[p.author_id] || 'Trader', author_level: lvlOf[p.author_id] || 1,
    likes: likeCount['post:' + p.id] || 0, liked: !!likedMine['post:' + p.id],
    comments: byPost[p.id] || [],
  }));
}
export async function addPost(mentorId: string, authorId: string, body: string, pinned = false, imageUrl?: string, scheduledAt?: string) {
  const sched = scheduledAt && new Date(scheduledAt).getTime() > Date.now() ? new Date(scheduledAt).toISOString() : null;
  const { data } = await supabaseAdmin.from('academy_posts').insert({ mentor_id: mentorId, author_id: authorId, body: String(body || '').slice(0, 4000), pinned, image_url: imageUrl ? String(imageUrl).slice(0, 500) : null, scheduled_at: sched }).select('id').single();
  return data as any;
}
export async function addComment(postId: string, authorId: string, body: string, imageUrl?: string) {
  await supabaseAdmin.from('academy_comments').insert({ post_id: postId, author_id: authorId, body: String(body || '').slice(0, 2000), image_url: imageUrl ? String(imageUrl).slice(0, 500) : null });
}
export async function deletePost(mentorId: string, id: string) {
  await supabaseAdmin.from('academy_posts').delete().eq('id', id).eq('mentor_id', mentorId);
}

// ---- Directorio público (páginas /academias y /academia/[code]) ----
// Solo academias activas. Nunca exponemos correos ni datos sensibles.
export async function publicDirectory() {
  const { data: mentors } = await supabaseAdmin.from('mentors')
    .select('user_id,code,academy_name,tagline,active').eq('active', true).order('created_at', { ascending: false }).limit(200);
  const rows = (mentors || []) as any[];
  if (!rows.length) return [];
  const ids = rows.map((m) => m.user_id);
  const [{ data: profs }, { data: enr }, { data: prods }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name').in('id', ids),
    supabaseAdmin.from('academy_enrollments').select('mentor_id').in('mentor_id', ids).eq('status', 'active'),
    supabaseAdmin.from('academy_products').select('mentor_id,price_cents,currency,active').in('mentor_id', ids).eq('active', true),
  ]);
  const nameOf: Record<string, string> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p.full_name || 'Mentor'; });
  const students: Record<string, number> = {}; (enr || []).forEach((e: any) => { students[e.mentor_id] = (students[e.mentor_id] || 0) + 1; });
  const fromPrice: Record<string, any> = {};
  (prods || []).forEach((p: any) => { const cur = fromPrice[p.mentor_id]; if (!cur || p.price_cents < cur.price_cents) fromPrice[p.mentor_id] = p; });
  return rows.map((m) => ({
    code: m.code, academy_name: m.academy_name, tagline: m.tagline || '',
    mentor_name: nameOf[m.user_id] || 'Mentor', students: students[m.user_id] || 0,
    from_price_cents: fromPrice[m.user_id]?.price_cents ?? null, currency: fromPrice[m.user_id]?.currency || 'usd',
  }));
}

// ============================================================
// Template "Academia Onyx" · deja la academia pre-armada en un clic.
// ============================================================
export async function applyTemplate(mentorId: string, force = false, lang: 'es' | 'en' = 'es') {
  // No pisar si ya hay contenido, salvo que el mentor lo pida explícitamente (force).
  const { data: existing } = await supabaseAdmin.from('academy_modules').select('id').eq('mentor_id', mentorId).limit(1);
  if (existing && existing.length && !force) return { ok: true, skipped: true };

  const EN = lang === 'en';
  const modules = EN ? [
    { title: 'Start here', description: 'Welcome and how to get the most out of the academy.', position: 0, lessons: [
      { title: 'Welcome', section: 'Intro', is_free: true, content: 'Welcome! Watch this video and introduce yourself in the community.' },
      { title: 'How the academy works', section: 'Intro', is_free: true, content: 'Classrooms, community, tiers and live classes.' },
    ] },
    { title: 'Fundamentals', description: 'The basics of trading.', position: 1, lessons: [
      { title: 'Core concepts', section: 'Theory', content: '' },
      { title: 'Risk management', section: 'Theory', content: '' },
      { title: 'Your first analysis', section: 'Practice', content: '' },
    ] },
    { title: 'Strategy', description: 'The main strategy step by step.', position: 2, lessons: [
      { title: 'The strategy explained', section: 'Strategy', content: '' },
      { title: 'Real examples', section: 'Strategy', content: '' },
    ] },
  ] : [
    { title: 'Empieza aquí', description: 'Bienvenida y cómo aprovechar la academia.', position: 0, lessons: [
      { title: 'Bienvenida', section: 'Introducción', is_free: true, content: 'Te damos la bienvenida. Mira este video y preséntate en la comunidad.' },
      { title: 'Cómo funciona la academia', section: 'Introducción', is_free: true, content: 'Aulas, comunidad, niveles y clases en vivo.' },
    ] },
    { title: 'Fundamentos', description: 'Las bases del trading.', position: 1, lessons: [
      { title: 'Conceptos básicos', section: 'Teoría', content: '' },
      { title: 'Gestión de riesgo', section: 'Teoría', content: '' },
      { title: 'Tu primer análisis', section: 'Práctica', content: '' },
    ] },
    { title: 'Estrategia', description: 'La estrategia principal paso a paso.', position: 2, lessons: [
      { title: 'La estrategia explicada', section: 'Estrategia', content: '' },
      { title: 'Ejemplos reales', section: 'Estrategia', content: '' },
    ] },
  ];
  for (const m of modules) {
    const { data: mod } = await supabaseAdmin.from('academy_modules').insert({ mentor_id: mentorId, title: m.title, description: m.description, position: m.position }).select('id').single();
    let pos = 0;
    for (const l of m.lessons) {
      await supabaseAdmin.from('academy_lessons').insert({ mentor_id: mentorId, module_id: (mod as any).id, title: l.title, section: (l as any).section || null, content: (l as any).content || null, is_free: !!(l as any).is_free, position: pos++ });
    }
  }
  // Post de bienvenida fijado.
  await supabaseAdmin.from('academy_posts').insert({ mentor_id: mentorId, author_id: mentorId, pinned: true, body: EN
    ? 'Welcome to the community! 🎉\n\n1. Watch the welcome lesson in "Start here".\n2. Introduce yourself in a comment.\n3. Level up by taking part: every like you receive earns points.'
    : '¡Bienvenidos a la comunidad! 🎉\n\n1. Mira la lección de bienvenida en «Empieza aquí».\n2. Preséntate en un comentario.\n3. Sube de nivel participando: cada like que recibes suma puntos.' });
  // Niveles de ejemplo (si aún no hay productos).
  const { data: prods } = await supabaseAdmin.from('academy_products').select('id').eq('mentor_id', mentorId).limit(1);
  if (!prods || !prods.length) {
    await supabaseAdmin.from('academy_products').insert([
      { mentor_id: mentorId, name: 'VIP', description: EN ? 'Access to all classrooms and live classes.' : 'Acceso a todas las aulas y clases en vivo.', kind: 'subscription', interval: 'month', price_cents: 4900, currency: 'usd', grants: 'all', active: false, position: 0 },
    ]);
  }
  return { ok: true };
}

// ============================================================
// Clases en vivo (Zoom) + próximo evento con estado.
// ============================================================
export async function listEvents(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_events').select('*').eq('mentor_id', mentorId).order('starts_at');
  return (data || []) as any[];
}
export async function saveEvent(mentorId: string, b: any) {
  const row: any = {
    title: String(b.title || 'Clase en vivo').slice(0, 160),
    description: b.description ? String(b.description).slice(0, 1000) : null,
    join_url: b.join_url ? String(b.join_url).slice(0, 500) : null,
    starts_at: b.starts_at ? new Date(b.starts_at).toISOString() : new Date().toISOString(),
    duration_min: Math.max(5, Math.min(600, Number(b.duration_min) || 60)),
  };
  if (b.id) { await supabaseAdmin.from('academy_events').update(row).eq('id', b.id).eq('mentor_id', mentorId); return { id: b.id }; }
  const { data } = await supabaseAdmin.from('academy_events').insert({ ...row, mentor_id: mentorId }).select('id').single();
  return data as any;
}
export async function deleteEvent(mentorId: string, id: string) {
  await supabaseAdmin.from('academy_events').delete().eq('id', id).eq('mentor_id', mentorId);
}
// Próxima clase (en curso o futura) con su estado para el banner.
export async function nextEvent(mentorId: string) {
  const now = Date.now();
  const { data } = await supabaseAdmin.from('academy_events').select('*').eq('mentor_id', mentorId).order('starts_at');
  for (const e of (data || []) as any[]) {
    const start = new Date(e.starts_at).getTime();
    const end = start + (e.duration_min || 60) * 60000;
    if (now < end) return { ...e, live: now >= start && now < end };
  }
  return null;
}

// ============================================================
// Mensajes privados (DM) dentro de una comunidad.
// ============================================================
export async function dmThreads(mentorId: string, userId: string) {
  const { data } = await supabaseAdmin.from('academy_messages').select('*').eq('mentor_id', mentorId).or(`from_id.eq.${userId},to_id.eq.${userId}`).order('created_at', { ascending: false }).limit(300);
  const byOther: Record<string, any> = {};
  for (const m of (data || []) as any[]) {
    const other = m.from_id === userId ? m.to_id : m.from_id;
    if (!byOther[other]) byOther[other] = { user_id: other, last: m.body, at: m.created_at, unread: 0 };
    if (m.to_id === userId && !m.read_at) byOther[other].unread++;
  }
  const ids = Object.keys(byOther);
  if (!ids.length) return [];
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids);
  const nameOf: Record<string, any> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p; });
  return Object.values(byOther).map((t: any) => ({ ...t, name: nameOf[t.user_id]?.full_name || (nameOf[t.user_id]?.email || '').split('@')[0] || 'Trader' }));
}
export async function dmUnread(mentorId: string, userId: string) {
  const { count } = await supabaseAdmin.from('academy_messages').select('id', { count: 'exact', head: true }).eq('mentor_id', mentorId).eq('to_id', userId).is('read_at', null);
  return count || 0;
}
export async function dmWith(mentorId: string, userId: string, otherId: string) {
  const { data } = await supabaseAdmin.from('academy_messages').select('*').eq('mentor_id', mentorId)
    .or(`and(from_id.eq.${userId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${userId})`)
    .order('created_at').limit(200);
  await supabaseAdmin.from('academy_messages').update({ read_at: new Date().toISOString() }).eq('mentor_id', mentorId).eq('from_id', otherId).eq('to_id', userId).is('read_at', null);
  const { data: prof } = await supabaseAdmin.from('profiles').select('full_name,email').eq('id', otherId).maybeSingle();
  return { messages: (data || []) as any[], name: (prof as any)?.full_name || ((prof as any)?.email || '').split('@')[0] || 'Trader' };
}
export async function dmSend(mentorId: string, fromId: string, toId: string, body: string, imageUrl?: string) {
  const { data } = await supabaseAdmin.from('academy_messages').insert({ mentor_id: mentorId, from_id: fromId, to_id: toId, body: String(body || '').slice(0, 4000), image_url: imageUrl ? String(imageUrl).slice(0, 500) : null }).select('*').single();
  return data as any;
}

// ============================================================
// Traders verificados · track record REAL desde Onyx (opt-in y sin promesas).
// Solo métricas de ratio (win rate, profit factor, nº operaciones). No exponemos
// el $ de nadie. El usuario decide compartirlo (profiles.academy_share_stats).
// ============================================================
const VERIFIED_DAYS = 90;
const VERIFIED_MIN_TRADES = 10;

export async function userTradeStats(userId: string, days = VERIFIED_DAYS) {
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', userId);
  const ids = (accs || []).map((a: any) => a.id);
  if (!ids.length) return { trades: 0, winRate: 0, profitFactor: 0 };
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data: trades } = await supabaseAdmin.from('trades').select('close_time,net_profit,profit,symbol,side,volume')
    .in('account_id', ids).gte('close_time', since).order('close_time', { ascending: false }).limit(5000);
  const norm = (trades || []).map((t: any) => ({ symbol: t.symbol, side: t.side, volume: t.volume, close_time: t.close_time, net_profit: Number(t.net_profit ?? t.profit ?? 0) || 0 }));
  const s = computeStats(norm);
  return { trades: s.trades, winRate: Math.round(s.winRate), profitFactor: Math.round(s.profitFactor * 100) / 100 };
}

// Devuelve el track record de un usuario si lo comparte (o si es él mismo, con `self`).
export async function verifiedStats(userId: string, self = false) {
  const { data: prof } = await supabaseAdmin.from('profiles').select('academy_share_stats').eq('id', userId).maybeSingle();
  const shared = !!(prof as any)?.academy_share_stats;
  if (!shared && !self) return { shared: false };
  const st = await userTradeStats(userId);
  return { shared, self, days: VERIFIED_DAYS, hasData: st.trades >= VERIFIED_MIN_TRADES, ...st };
}
export async function setShareStats(userId: string, on: boolean) {
  await supabaseAdmin.from('profiles').update({ academy_share_stats: !!on }).eq('id', userId);
  return !!on;
}
// Ranking de traders (rendimiento histórico, no promesa). Solo quienes comparten y
// tienen suficientes operaciones. Ordenado por profit factor.
export async function tradersBoard(mentorId: string, limit = 30) {
  const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('status', 'active');
  const ids = new Set<string>((enr || []).map((e: any) => e.student_id)); ids.add(mentorId);
  const idArr = Array.from(ids).slice(0, 200);
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,full_name,email,academy_share_stats').in('id', idArr);
  const sharers = (profs || []).filter((p: any) => p.academy_share_stats);
  const rows: any[] = [];
  for (const p of sharers) {
    const st = await userTradeStats(p.id);
    if (st.trades >= VERIFIED_MIN_TRADES) rows.push({ user_id: p.id, name: p.full_name || (p.email || '').split('@')[0] || 'Trader', ...st });
  }
  rows.sort((a, b) => b.profitFactor - a.profitFactor || b.winRate - a.winRate);
  return rows.slice(0, limit).map((r, i) => ({ rank: i + 1, ...r }));
}

// ============================================================
// Perfil de miembro: nivel, puntos, contribuciones y mapa de actividad.
// ============================================================
export async function memberProfile(mentorId: string, userId: string, self = false) {
  const [{ data: prof }, { data: pts }, { data: posts }, { data: comments }] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name,email,created_at,country').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('academy_points').select('points').eq('mentor_id', mentorId).eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('academy_posts').select('created_at').eq('mentor_id', mentorId).eq('author_id', userId),
    supabaseAdmin.from('academy_comments').select('created_at,post_id').eq('author_id', userId),
  ]);
  const points = (pts as any)?.points || 0;
  // Mapa de actividad últimos ~180 días (posts + comentarios por día).
  const days: Record<string, number> = {};
  const add = (iso: string) => { const k = iso.slice(0, 10); days[k] = (days[k] || 0) + 1; };
  (posts || []).forEach((p: any) => add(p.created_at));
  (comments || []).forEach((c: any) => add(c.created_at));
  const contributions = (posts || []).length + (comments || []).length;
  const verified = await verifiedStats(userId, !!self);
  // Certificados y auditorías (visibles en el propio perfil / o para el mentor).
  let certificates: any[] = []; let audits: any[] = [];
  try {
    const { data: certs } = await supabaseAdmin.from('academy_certificates').select('code,title,issued_at').eq('mentor_id', mentorId).eq('student_id', userId).order('issued_at', { ascending: false });
    certificates = certs || [];
    const { data: au } = await supabaseAdmin.from('academy_audits').select('period,text,created_at,metrics').eq('mentor_id', mentorId).eq('student_id', userId).order('created_at', { ascending: false }).limit(10);
    audits = au || [];
  } catch {}
  return {
    user_id: userId,
    name: (prof as any)?.full_name || ((prof as any)?.email || '').split('@')[0] || 'Trader',
    points, level: levelFor(points), contributions, activity: days, verified, certificates, audits,
  };
}

// Página pública de una academia por su código: datos + módulos (con lecciones
// gratis marcadas) + niveles activos. No expone contenido de pago.
export async function publicAcademy(code: string) {
  const { data: m } = await supabaseAdmin.from('mentors').select('user_id,code,academy_name,tagline,about,active,cover_url,logo_url,socials,intro_video_url,pitch,membership_price_cents,membership_currency,membership_interval').eq('code', code).maybeSingle();
  if (!m || !(m as any).active) return null;
  const mentorId = (m as any).user_id;
  const [{ data: prof }, content, { data: prods }, { data: enr }] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name').eq('id', mentorId).maybeSingle(),
    getContent(mentorId, true),
    supabaseAdmin.from('academy_products').select('*').eq('mentor_id', mentorId).eq('active', true).order('position'),
    supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('status', 'active'),
  ]);
  const modules = (content as any[]).map((mod: any) => ({
    id: mod.id, title: mod.title, description: mod.description || '',
    lessons: mod.lessons.map((l: any) => ({ id: l.id, title: l.title, is_free: !!l.is_free })),
    freeCount: mod.lessons.filter((l: any) => l.is_free).length,
  }));
  return {
    code: (m as any).code, academy_name: (m as any).academy_name, tagline: (m as any).tagline || '',
    about: (m as any).about || '', mentor_name: (prof as any)?.full_name || 'Mentor',
    cover_url: (m as any).cover_url || null, logo_url: (m as any).logo_url || null, socials: (m as any).socials || {}, intro_video_url: (m as any).intro_video_url || null, pitch: (m as any).pitch || '',
    membership_price_cents: (m as any).membership_price_cents || 0, membership_currency: (m as any).membership_currency || 'usd', membership_interval: (m as any).membership_interval || 'month',
    students: (enr || []).length, modules, products: (prods || []) as any[],
  };
}
