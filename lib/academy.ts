import { supabaseAdmin } from '@/lib/supabaseAdmin';
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
  if (b.id) { await supabaseAdmin.from('academy_modules').update({ title: String(b.title || '').slice(0, 120), description: b.description ? String(b.description).slice(0, 500) : null, position: Number(b.position) || 0, published: b.published !== false }).eq('id', b.id).eq('mentor_id', mentorId); return { id: b.id }; }
  const { data } = await supabaseAdmin.from('academy_modules').insert({ mentor_id: mentorId, title: String(b.title || 'Módulo').slice(0, 120), description: b.description ? String(b.description).slice(0, 500) : null, position: Number(b.position) || 0 }).select('id').single();
  return data as any;
}
export async function deleteModule(mentorId: string, id: string) {
  await supabaseAdmin.from('academy_modules').delete().eq('id', id).eq('mentor_id', mentorId);
}
export async function saveLesson(mentorId: string, b: any) {
  const row: any = {
    title: String(b.title || 'Lección').slice(0, 160),
    video_url: b.video_url ? String(b.video_url).slice(0, 500) : null,
    content: b.content ? String(b.content).slice(0, 8000) : null,
    resources: Array.isArray(b.resources) ? b.resources.slice(0, 20).map((r: any) => ({ label: String(r.label || '').slice(0, 80), url: String(r.url || '').slice(0, 400) })) : [],
    position: Number(b.position) || 0,
    is_free: !!b.is_free,
    published: b.published !== false,
  };
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

// ---- Comunidad ----
export async function listPosts(mentorId: string) {
  const { data: posts } = await supabaseAdmin.from('academy_posts').select('*').eq('mentor_id', mentorId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  const list = posts || [];
  const authorIds = Array.from(new Set(list.map((p: any) => p.author_id)));
  const { data: profs } = authorIds.length ? await supabaseAdmin.from('profiles').select('id,full_name').in('id', authorIds) : { data: [] } as any;
  const nameOf: Record<string, string> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p.full_name || 'Trader'; });
  const postIds = list.map((p: any) => p.id);
  const { data: comments } = postIds.length ? await supabaseAdmin.from('academy_comments').select('*').in('post_id', postIds).order('created_at') : { data: [] } as any;
  const cIds = Array.from(new Set((comments || []).map((c: any) => c.author_id)));
  if (cIds.length) { const { data: cp } = await supabaseAdmin.from('profiles').select('id,full_name').in('id', cIds); (cp || []).forEach((p: any) => { nameOf[p.id] = nameOf[p.id] || p.full_name || 'Trader'; }); }
  const byPost: Record<string, any[]> = {}; (comments || []).forEach((c: any) => { (byPost[c.post_id] ||= []).push({ ...c, author_name: nameOf[c.author_id] || 'Trader' }); });
  return list.map((p: any) => ({ ...p, author_name: nameOf[p.author_id] || 'Trader', comments: byPost[p.id] || [] }));
}
export async function addPost(mentorId: string, authorId: string, body: string, pinned = false) {
  const { data } = await supabaseAdmin.from('academy_posts').insert({ mentor_id: mentorId, author_id: authorId, body: String(body || '').slice(0, 4000), pinned }).select('id').single();
  return data as any;
}
export async function addComment(postId: string, authorId: string, body: string) {
  await supabaseAdmin.from('academy_comments').insert({ post_id: postId, author_id: authorId, body: String(body || '').slice(0, 2000) });
}
export async function deletePost(mentorId: string, id: string) {
  await supabaseAdmin.from('academy_posts').delete().eq('id', id).eq('mentor_id', mentorId);
}
