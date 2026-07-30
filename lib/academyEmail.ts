import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';

// ============================================================
// Campañas de email del mentor + automatizaciones de ciclo de vida.
// Reutiliza el mailer de Onyx (Resend). Envía "de parte de" la academia.
// ============================================================
const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
const unsubUrl = (email: string) => `${SITE}/unsub?e=${encodeURIComponent(email)}`;

async function studentsWithEmail(mentorId: string) {
  const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('status', 'active');
  const ids = (enr || []).map((e: any) => e.student_id);
  if (!ids.length) return [] as any[];
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,email,full_name').in('id', ids);
  return (profs || []).filter((p: any) => p.email).map((p: any) => ({ id: p.id, email: p.email, name: p.full_name || (p.email || '').split('@')[0] }));
}
async function emailFor(userId: string) {
  const { data: p } = await supabaseAdmin.from('profiles').select('id,email,full_name').eq('id', userId).maybeSingle();
  if (!p || !(p as any).email) return null;
  return { id: (p as any).id, email: (p as any).email, name: (p as any).full_name || ((p as any).email || '').split('@')[0] };
}

// Público de una campaña: all | active | inactive | expiring.
export async function audienceList(mentorId: string, audience: string) {
  const all = await studentsWithEmail(mentorId);
  if (audience === 'all' || !all.length) return all;
  const ids = all.map((s) => s.id);
  if (audience === 'expiring') {
    const soon = new Date(Date.now() + 5 * 864e5).toISOString();
    const { data } = await supabaseAdmin.from('academy_memberships').select('student_id').eq('mentor_id', mentorId).eq('status', 'active').gte('current_period_end', new Date().toISOString()).lte('current_period_end', soon);
    const set = new Set((data || []).map((r: any) => r.student_id));
    return all.filter((s) => set.has(s.id));
  }
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabaseAdmin.from('academy_posts').select('author_id').eq('mentor_id', mentorId).gte('created_at', since).in('author_id', ids),
    supabaseAdmin.from('academy_comments').select('author_id').gte('created_at', since).in('author_id', ids),
  ]);
  const act = new Set<string>([...(posts || []).map((p: any) => p.author_id), ...(comments || []).map((c: any) => c.author_id)]);
  if (audience === 'active') return all.filter((s) => act.has(s.id));
  if (audience === 'inactive') return all.filter((s) => !act.has(s.id));
  return all;
}
export async function audienceCounts(mentorId: string) {
  const [a, ac, ina, ex] = await Promise.all([
    audienceList(mentorId, 'all'), audienceList(mentorId, 'active'), audienceList(mentorId, 'inactive'), audienceList(mentorId, 'expiring'),
  ]);
  return { all: a.length, active: ac.length, inactive: ina.length, expiring: ex.length };
}

function footer(m: any) { return `\n\n—\n${m?.academy_name || 'Onyx Academy'} · ${SITE}/academia/${m?.code || ''}`; }

// Envía una campaña ya creada.
export async function sendCampaign(campaignId: string) {
  const { data: c } = await supabaseAdmin.from('academy_emails').select('*').eq('id', campaignId).maybeSingle();
  if (!c || (c as any).status === 'sent') return { ok: false, sent: 0 };
  await supabaseAdmin.from('academy_emails').update({ status: 'sending' }).eq('id', campaignId);
  const { data: m } = await supabaseAdmin.from('mentors').select('academy_name,code').eq('user_id', (c as any).mentor_id).maybeSingle();
  const list = await audienceList((c as any).mentor_id, (c as any).audience);
  let sent = 0;
  for (const s of list) {
    const ok = await sendEmail(s.email, (c as any).subject, (c as any).body + footer(m), { kind: 'academy_campaign', userId: s.id, unsub: unsubUrl(s.email) });
    if (ok) sent++;
  }
  await supabaseAdmin.from('academy_emails').update({ status: 'sent', sent_count: sent }).eq('id', campaignId);
  return { ok: true, sent };
}

// Envía las campañas programadas cuya hora ya pasó.
export async function runDueCampaigns() {
  const { data } = await supabaseAdmin.from('academy_emails').select('id').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString()).limit(30);
  let n = 0; for (const c of (data || []) as any[]) { await sendCampaign(c.id); n++; }
  return n;
}

// Registra un envío automático una sola vez (dedup). Devuelve true si tocaba enviar.
async function once(mentorId: string, studentId: string, kind: string, ref: string) {
  const { error } = await supabaseAdmin.from('academy_email_log').insert({ mentor_id: mentorId, student_id: studentId, kind, ref });
  return !error;
}

// Plantillas por defecto de los correos automáticos (editables por el mentor).
export function defaultAutomations(lang: 'es' | 'en' = 'es') {
  if (lang === 'en') return {
    welcome: { enabled: false, subject: 'Welcome to {academy}!', body: 'Hi {name},\n\nGreat to have you in {academy}. Come in, introduce yourself in the community and start with the "Start here" classroom.\n\nEnter: {join}' },
    class_reminder: { enabled: false, lead_min: 60, subject: 'Live class soon: {class}', body: 'Hi {name},\n\nYour live class "{class}" starts soon.\nJoin: {classlink}' },
    expiring: { enabled: false, days_before: 3, subject: 'Your {academy} membership is about to renew', body: 'Hi {name},\n\nYour {academy} membership renews soon. If you want to keep access to the community, classrooms and live classes, you don\'t need to do anything; it renews automatically.' },
  } as any;
  return {
    welcome: { enabled: false, subject: '¡Bienvenido a {academy}!', body: 'Hola {name},\n\nQué bueno tenerte en {academy}. Entra, preséntate en la comunidad y empieza por el aula "Empieza aquí".\n\nEntrar: {join}' },
    class_reminder: { enabled: false, lead_min: 60, subject: 'Clase en vivo pronto: {class}', body: 'Hola {name},\n\nTu clase en vivo "{class}" empieza pronto.\nEntrar: {classlink}' },
    expiring: { enabled: false, days_before: 3, subject: 'Tu membresía de {academy} está por vencer', body: 'Hola {name},\n\nTu membresía de {academy} se renueva pronto. Si quieres seguir con acceso a la comunidad, las aulas y las clases en vivo, no tienes que hacer nada; se renovará automáticamente.' },
  } as any;
}
// Fusiona plantillas guardadas con las por defecto (compatibilidad con email_auto viejo).
export function mergeAutomations(saved: any, legacy?: any, lang: 'es' | 'en' = 'es') {
  const def = defaultAutomations(lang);
  const out: any = {};
  for (const k of Object.keys(def)) {
    const s = (saved && saved[k]) || {};
    out[k] = { ...def[k], ...s };
    // Compatibilidad: si venía del toggle viejo email_auto.
    if (legacy && legacy[k] && s.enabled === undefined) out[k].enabled = !!legacy[k];
  }
  return out;
}
function fill(t: string, vars: Record<string, string>) {
  return (t || '').replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? '');
}

// Automatizaciones de ciclo de vida (las corre el cron).
export async function runAutomations() {
  const { data: mentors } = await supabaseAdmin.from('mentors').select('user_id,academy_name,code,email_auto,email_templates').eq('active', true);
  let sent = 0;
  for (const m of (mentors || []) as any[]) {
    const t = mergeAutomations(m.email_templates, m.email_auto);
    const join = `${SITE}/dashboard/academy?join=${m.code}`;
    const base = { academy: m.academy_name || 'Onyx Academy', join };
    // Bienvenida (inscritos en las últimas 48h)
    if (t.welcome.enabled) {
      const since = new Date(Date.now() - 2 * 864e5).toISOString();
      const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', m.user_id).eq('status', 'active').gte('joined_at', since);
      for (const e of (enr || []) as any[]) {
        if (await once(m.user_id, e.student_id, 'welcome', '')) {
          const s = await emailFor(e.student_id);
          if (s) { const v = { ...base, name: s.name }; await sendEmail(s.email, fill(t.welcome.subject, v), fill(t.welcome.body, v) + footer(m), { kind: 'academy_welcome', userId: s.id, unsub: unsubUrl(s.email) }); sent++; }
        }
      }
    }
    // Recordatorio de clase en vivo (empieza en < lead_min)
    if (t.class_reminder.enabled) {
      const now = Date.now();
      const lead = Math.max(5, Math.min(1440, Number(t.class_reminder.lead_min) || 60));
      const { data: evs } = await supabaseAdmin.from('academy_events').select('id,title,starts_at,join_url').eq('mentor_id', m.user_id).gte('starts_at', new Date(now).toISOString()).lte('starts_at', new Date(now + lead * 60000).toISOString());
      for (const ev of (evs || []) as any[]) {
        const list = await studentsWithEmail(m.user_id);
        for (const s of list) {
          if (await once(m.user_id, s.id, 'class_reminder', ev.id)) {
            const v = { ...base, name: s.name, class: ev.title, classlink: ev.join_url || join };
            await sendEmail(s.email, fill(t.class_reminder.subject, v), fill(t.class_reminder.body, v) + footer(m), { kind: 'academy_class', userId: s.id, unsub: unsubUrl(s.email) }); sent++;
          }
        }
      }
    }
    // Membresía por vencer (en <= days_before días)
    if (t.expiring.enabled) {
      const days = Math.max(1, Math.min(30, Number(t.expiring.days_before) || 3));
      const soon = new Date(Date.now() + days * 864e5).toISOString();
      const { data: ms } = await supabaseAdmin.from('academy_memberships').select('student_id,current_period_end').eq('mentor_id', m.user_id).eq('status', 'active').gte('current_period_end', new Date().toISOString()).lte('current_period_end', soon);
      for (const mm of (ms || []) as any[]) {
        const ref = (mm.current_period_end || '').slice(0, 10);
        if (await once(m.user_id, mm.student_id, 'expiring', ref)) {
          const s = await emailFor(mm.student_id);
          if (s) { const v = { ...base, name: s.name }; await sendEmail(s.email, fill(t.expiring.subject, v), fill(t.expiring.body, v) + footer(m), { kind: 'academy_expiring', userId: s.id, unsub: unsubUrl(s.email) }); sent++; }
        }
      }
    }
  }
  return sent;
}
