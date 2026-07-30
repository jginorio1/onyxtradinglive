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
    supabaseAdmin.from('mentors').select('academy_name').eq('user_id', (c as any).mentor_id).maybeSingle(),
  ]);
  return { code: (c as any).code, title: (c as any).title, issued_at: (c as any).issued_at, student: nameOf(st), academy: (mentor as any)?.academy_name || 'Onyx Academy' };
}
export async function myCertificates(studentId: string) {
  const { data } = await supabaseAdmin.from('academy_certificates').select('code,title,issued_at,mentor_id').eq('student_id', studentId).order('issued_at', { ascending: false });
  return (data || []) as any[];
}

// ---- Afiliados del mentor (tracking + libro, sin auto-pago) ----
export async function recordReferral(mentorId: string, referrerId: string, referredId: string) {
  if (!referrerId || referrerId === referredId) return;
  // El referidor debe ser miembro de la comunidad (o el mentor).
  const isMember = referrerId === mentorId || (await supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('student_id', referrerId).eq('status', 'active').maybeSingle()).data;
  if (!isMember) return;
  await supabaseAdmin.from('academy_referrals').insert({ mentor_id: mentorId, referrer_id: referrerId, referred_id: referredId }).select('id').maybeSingle();
}
// Al pagar el referido, acredita la recompensa al referidor (una vez).
export async function creditReferral(mentorId: string, referredId: string) {
  const { data: r } = await supabaseAdmin.from('academy_referrals').select('id,paid').eq('mentor_id', mentorId).eq('referred_id', referredId).maybeSingle();
  if (!r || (r as any).paid) return;
  const { data: m } = await supabaseAdmin.from('mentors').select('affiliate_reward_cents').eq('user_id', mentorId).maybeSingle();
  const reward = (m as any)?.affiliate_reward_cents || 0;
  await supabaseAdmin.from('academy_referrals').update({ paid: true, reward_cents: reward }).eq('id', (r as any).id);
}
export async function myReferralStats(userId: string, mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_referrals').select('paid,reward_cents').eq('mentor_id', mentorId).eq('referrer_id', userId);
  const total = (data || []).length;
  const paid = (data || []).filter((r: any) => r.paid).length;
  const earned = (data || []).reduce((s: number, r: any) => s + (r.reward_cents || 0), 0);
  return { total, paid, earnedCents: earned };
}
export async function affiliateLedger(mentorId: string) {
  const { data: refs } = await supabaseAdmin.from('academy_referrals').select('referrer_id,referred_id,paid,reward_cents,created_at').eq('mentor_id', mentorId).order('created_at', { ascending: false }).limit(300);
  const ids = Array.from(new Set([...(refs || []).map((r: any) => r.referrer_id), ...(refs || []).map((r: any) => r.referred_id)]));
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids) : { data: [] } as any;
  const map = new Map((profs || []).map((p: any) => [p.id, nameOf(p)]));
  // Agrupado por referidor.
  const byRef: Record<string, { name: string; total: number; paid: number; earned: number }> = {};
  for (const r of (refs || []) as any[]) {
    const k = r.referrer_id; (byRef[k] ||= { name: map.get(k) || 'Trader', total: 0, paid: 0, earned: 0 });
    byRef[k].total++; if (r.paid) { byRef[k].paid++; byRef[k].earned += r.reward_cents || 0; }
  }
  return Object.entries(byRef).map(([user_id, v]) => ({ user_id, ...v })).sort((a, b) => b.paid - a.paid || b.total - a.total);
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
