import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { userTradeStats } from '@/lib/academy';
import { auditStudent } from '@/lib/academyAI';
import crypto from 'crypto';

// ============================================================
// Onyx Academy · certificados, afiliados del mentor y auditoría AI del alumno.
// ============================================================

const nameOf = (p: any) => p?.full_name || (p?.email || '').split('@')[0] || 'Trader';

// ---- Certificados ----
export async function courseCompleted(studentId: string, mentorId: string, moduleId: string) {
  const { data: lessons } = await supabaseAdmin.from('academy_lessons').select('id').eq('mentor_id', mentorId).eq('module_id', moduleId);
  const ids = (lessons || []).map((l: any) => l.id);
  if (!ids.length) return false;
  const { data: prog } = await supabaseAdmin.from('lesson_progress').select('lesson_id').eq('student_id', studentId).in('lesson_id', ids);
  return (prog || []).length >= ids.length;
}
export async function issueCertificate(studentId: string, mentorId: string, moduleId: string) {
  if (!(await courseCompleted(studentId, mentorId, moduleId))) return { ok: false, error: 'not_completed' };
  const { data: existing } = await supabaseAdmin.from('academy_certificates').select('code').eq('mentor_id', mentorId).eq('student_id', studentId).eq('kind', 'course').eq('module_id', moduleId).maybeSingle();
  if (existing) return { ok: true, code: (existing as any).code };
  const { data: mod } = await supabaseAdmin.from('academy_modules').select('title').eq('id', moduleId).maybeSingle();
  const code = 'C' + crypto.randomBytes(5).toString('hex').toUpperCase();
  await supabaseAdmin.from('academy_certificates').insert({ mentor_id: mentorId, student_id: studentId, kind: 'course', module_id: moduleId, title: (mod as any)?.title || 'Curso', code });
  return { ok: true, code };
}
export async function certByCode(code: string) {
  const { data: c } = await supabaseAdmin.from('academy_certificates').select('*').eq('code', code).maybeSingle();
  if (!c) return null;
  const [{ data: st }, { data: mentor }] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name,email').eq('id', (c as any).student_id).maybeSingle(),
    supabaseAdmin.from('mentors').select('academy_name,logo_url').eq('user_id', (c as any).mentor_id).maybeSingle(),
  ]);
  return { code: (c as any).code, title: (c as any).title, issued_at: (c as any).issued_at, student: nameOf(st), academy: (mentor as any)?.academy_name || 'Onyx Academy', logo_url: (mentor as any)?.logo_url || null };
}
export async function myCertificates(studentId: string) {
  const { data } = await supabaseAdmin.from('academy_certificates').select('code,title,issued_at,mentor_id').eq('student_id', studentId).order('issued_at', { ascending: false });
  return (data || []) as any[];
}

// ---- Afiliados del mentor · ATRIBUCIÓN (quién trajo a quién) ----
// El dinero (recompensas, estados, pagos) vive en lib/academyReferral.ts.
export async function recordReferral(mentorId: string, referrerId: string, referredId: string) {
  if (!referrerId || referrerId === referredId) return;
  // El referidor debe ser miembro de la comunidad (o el mentor).
  const isMember = referrerId === mentorId || (await supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('student_id', referrerId).eq('status', 'active').maybeSingle()).data;
  if (!isMember) return;
  await supabaseAdmin.from('academy_referrals').upsert({ mentor_id: mentorId, referrer_id: referrerId, referred_id: referredId }, { onConflict: 'mentor_id,referred_id', ignoreDuplicates: true }).select('id').maybeSingle();
}

// ---- Auditoría AI del alumno ----
export async function generateAudit(mentorId: string, studentId: string, period: '30d' | '90d', lang: 'es' | 'en') {
  const days = period === '90d' ? 90 : 30;
  const st = await userTradeStats(studentId, days);
  if (st.trades < 5) return { ok: false, error: 'no_data' };
  const { data: prof } = await supabaseAdmin.from('profiles').select('full_name,email').eq('id', studentId).maybeSingle();
  const text = await auditStudent(nameOf(prof), st, period, lang);
  if (!text) return { ok: false, error: 'ai_error' };
  const { data } = await supabaseAdmin.from('academy_audits').insert({ mentor_id: mentorId, student_id: studentId, period, metrics: st, text }).select('id').single();
  return { ok: true, id: (data as any)?.id, text, metrics: st };
}
export async function listAudits(studentId: string, mentorId?: string) {
  let q = supabaseAdmin.from('academy_audits').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(20);
  if (mentorId) q = q.eq('mentor_id', mentorId);
  const { data } = await q;
  return (data || []) as any[];
}
