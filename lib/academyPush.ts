import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitNotif } from '@/lib/emitNotif';

// ============================================================
// Notificaciones push de la academia. Reutiliza el web-push de Onyx (VAPID).
// Si el push no está configurado, sendPush no hace nada (no rompe el flujo).
// El deep-link abre la academia del mentor.
// ============================================================
function academyUrl(mentorId: string, extra = '') { return `/dashboard/academy?m=${mentorId}${extra}`; }

// ¿El usuario quiere este tipo de push? Clave ausente = sí.
type Kind = 'announcements' | 'messages' | 'classes' | 'wins';
async function wants(userId: string, kind: Kind) {
  try {
    const { data } = await supabaseAdmin.from('profiles').select('academy_push_prefs').eq('id', userId).maybeSingle();
    const p = (data as any)?.academy_push_prefs || {};
    return p[kind] !== false;
  } catch { return true; }
}

// Notifica a UN usuario por el catálogo editable en Admin (tipo `key`). El texto
// dinámico va como {name}/{body}; respeta la preferencia de academia del alumno.
async function pushUser(userId: string, key: string, vars: Record<string, string>, url: string, kind?: Kind) {
  try { if (kind && !(await wants(userId, kind))) return; await emitNotif(userId, key, { vars, url, ignorePlan: true }); } catch { /* nunca romper */ }
}

// Notifica a TODOS los alumnos activos (que lo quieran). excludeId opcional.
async function pushStudents(mentorId: string, key: string, vars: Record<string, string>, url: string, kind: Kind, excludeId?: string) {
  try {
    const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('status', 'active');
    let ids = (enr || []).map((e: any) => e.student_id).filter((id: string) => id !== excludeId);
    if (!ids.length) return;
    const { data: prefs } = await supabaseAdmin.from('profiles').select('id,academy_push_prefs').in('id', ids);
    const off = new Set((prefs || []).filter((p: any) => (p.academy_push_prefs || {})[kind] === false).map((p: any) => p.id));
    ids = ids.filter((id: string) => !off.has(id));
    await Promise.all(ids.map((id: string) => emitNotif(id, key, { vars, url, ignorePlan: true })));
  } catch { /* silencioso */ }
}

// ---- Disparadores concretos ----
const acadName = async (mentorId: string) => {
  const { data } = await supabaseAdmin.from('mentors').select('academy_name').eq('user_id', mentorId).maybeSingle();
  return (data as any)?.academy_name || 'Onyx Academy';
};
const nameOf = async (userId: string) => {
  const { data } = await supabaseAdmin.from('profiles').select('full_name,email').eq('id', userId).maybeSingle();
  return (data as any)?.full_name || ((data as any)?.email || '').split('@')[0] || 'Alguien';
};

// Anuncio fijado del mentor → a todos los alumnos.
export async function pushAnnouncement(mentorId: string, body: string) {
  const name = await acadName(mentorId);
  await pushStudents(mentorId, 'academy_announcement', { name, body: (body || '').slice(0, 120) || 'Nuevo anuncio' }, academyUrl(mentorId), 'announcements');
}
// Mensaje privado nuevo → al destinatario.
export async function pushDm(mentorId: string, fromId: string, toId: string, body: string) {
  const from = await nameOf(fromId);
  await pushUser(toId, 'academy_dm', { name: from, body: (body || '').slice(0, 120) || 'Te envió un mensaje' }, academyUrl(mentorId, '&open=chat'), 'messages');
}
// Logro aprobado → al alumno. Nuevo logro pendiente → al mentor.
export async function pushWinApproved(mentorId: string, studentId: string) {
  const name = await acadName(mentorId);
  await pushUser(studentId, 'academy_win', { body: `Tu logro ya está en el muro de ${name}.` }, academyUrl(mentorId, '&open=logros'), 'wins');
}
export async function pushWinPending(mentorId: string, studentId: string) {
  const who = await nameOf(studentId);
  await pushUser(mentorId, 'academy_win', { body: `${who} subió un logro. Revísalo.` }, academyUrl(mentorId, '&open=logros'), 'wins');
}
// Clase en vivo próxima → a todos los alumnos.
export async function pushClassSoon(mentorId: string, title: string, joinUrl?: string) {
  await pushStudents(mentorId, 'academy_class', { body: `"${title}" empieza pronto. ¡Entra!` }, joinUrl || academyUrl(mentorId, '&open=calendar'), 'classes');
}
