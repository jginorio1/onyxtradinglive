import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPush } from '@/lib/push';

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

// Notifica a UN usuario (respeta su preferencia).
export async function pushUser(userId: string, title: string, body: string, url: string, kind?: Kind) {
  try { if (kind && !(await wants(userId, kind))) return; await sendPush(userId, { title, body, url }); } catch { /* nunca romper */ }
}

// Notifica a TODOS los alumnos activos (que lo quieran). excludeId opcional.
export async function pushStudents(mentorId: string, title: string, body: string, url: string, kind: Kind, excludeId?: string) {
  try {
    const { data: enr } = await supabaseAdmin.from('academy_enrollments').select('student_id').eq('mentor_id', mentorId).eq('status', 'active');
    let ids = (enr || []).map((e: any) => e.student_id).filter((id: string) => id !== excludeId);
    if (!ids.length) return;
    const { data: prefs } = await supabaseAdmin.from('profiles').select('id,academy_push_prefs').in('id', ids);
    const off = new Set((prefs || []).filter((p: any) => (p.academy_push_prefs || {})[kind] === false).map((p: any) => p.id));
    ids = ids.filter((id: string) => !off.has(id));
    await Promise.all(ids.map((id: string) => sendPush(id, { title, body, url })));
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
  await pushStudents(mentorId, `📣 ${name}`, (body || '').slice(0, 120) || 'Nuevo anuncio', academyUrl(mentorId), 'announcements');
}
// Mensaje privado nuevo → al destinatario.
export async function pushDm(mentorId: string, fromId: string, toId: string, body: string) {
  const from = await nameOf(fromId);
  await pushUser(toId, `💬 ${from}`, (body || '').slice(0, 120) || 'Te envió un mensaje', academyUrl(mentorId, '&open=chat'), 'messages');
}
// Logro aprobado → al alumno. Nuevo logro pendiente → al mentor.
export async function pushWinApproved(mentorId: string, studentId: string) {
  const name = await acadName(mentorId);
  await pushUser(studentId, '🏆 ¡Logro publicado!', `Tu logro ya está en el muro de ${name}.`, academyUrl(mentorId, '&open=logros'), 'wins');
}
export async function pushWinPending(mentorId: string, studentId: string) {
  const who = await nameOf(studentId);
  await pushUser(mentorId, '🏆 Logro por aprobar', `${who} subió un logro. Revísalo.`, academyUrl(mentorId, '&open=logros'), 'wins');
}
// Clase en vivo próxima → a todos los alumnos.
export async function pushClassSoon(mentorId: string, title: string, joinUrl?: string) {
  await pushStudents(mentorId, '🔴 Clase en vivo pronto', `"${title}" empieza pronto. ¡Entra!`, joinUrl || academyUrl(mentorId, '&open=calendar'), 'classes');
}
