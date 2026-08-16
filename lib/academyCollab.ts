import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEnrolled } from '@/lib/academy';

// ============================================================
// Colaboradores de la academia: el mentor asigna rol (etiqueta) y permisos.
// Permisos ENFORCED (el colaborador solo actúa dentro de la comunidad):
//   wins      → aprobar/rechazar/verificar logros
//   moderate  → moderar el muro: reportes, ocultar/borrar, mutear/expulsar
//   announce  → publicar y fijar anuncios (con push a todos)
//   message   → chatear con alumnos
//   members   → gestionar alumnos de la comunidad (renombrar, banear, expulsar)
// El mentor siempre tiene todos. Se conservan claves antiguas por compat.
// ============================================================
const PERM_KEYS = ['wins', 'moderate', 'announce', 'message', 'members'];
const nameOf = (p: any) => p?.full_name || (p?.email || '').split('@')[0] || 'Colaborador';

// Normaliza permisos leyendo también el esquema viejo (moderate→wins, post→announce).
function normPerms(p: any) {
  p = p || {};
  return {
    wins: !!(p.wins ?? p.moderate),          // antes "moderate" cubría los logros
    moderate: !!p.moderate,
    announce: !!(p.announce ?? p.post),      // antes "post"
    message: !!p.message,
    members: !!p.members,
  };
}

export async function listCollaborators(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_collaborators').select('*').eq('mentor_id', mentorId).order('created_at');
  const rows = (data || []) as any[];
  const ids = rows.map((r) => r.user_id);
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids) : { data: [] } as any;
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ user_id: r.user_id, name: nameOf(pmap.get(r.user_id)), role: r.role, perms: r.perms || {} }));
}

// Mapa user_id → rol (para pintar la etiqueta en miembros/posts). Incluye "Mentor".
export async function roleMap(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_collaborators').select('user_id,role').eq('mentor_id', mentorId);
  const map: Record<string, string> = { [mentorId]: 'Mentor' };
  (data || []).forEach((r: any) => { map[r.user_id] = r.role || 'Colaborador'; });
  return map;
}

export async function addCollaborator(mentorId: string, userId: string, role: string, perms: any) {
  // Solo un miembro inscrito puede ser colaborador (y no el propio mentor).
  if (userId === mentorId || !(await isEnrolled(mentorId, userId))) return { ok: false, error: 'no_member' };
  const p: any = {}; for (const k of PERM_KEYS) p[k] = !!perms?.[k];
  await supabaseAdmin.from('academy_collaborators').upsert({ mentor_id: mentorId, user_id: userId, role: String(role || 'Colaborador').slice(0, 40), perms: p }, { onConflict: 'mentor_id,user_id' });
  return { ok: true };
}
export async function removeCollaborator(mentorId: string, userId: string) {
  await supabaseAdmin.from('academy_collaborators').delete().eq('mentor_id', mentorId).eq('user_id', userId);
  return { ok: true };
}

// Permisos efectivos de un usuario en una academia (el mentor = todos).
export async function permsFor(mentorId: string, userId: string) {
  if (mentorId === userId) return { isMentor: true, isCollab: true, role: 'Mentor', wins: true, moderate: true, announce: true, message: true, members: true };
  const { data } = await supabaseAdmin.from('academy_collaborators').select('role,perms').eq('mentor_id', mentorId).eq('user_id', userId).maybeSingle();
  if (!data) return { isMentor: false, isCollab: false, role: null, wins: false, moderate: false, announce: false, message: false, members: false };
  return { isMentor: false, isCollab: true, role: (data as any).role || 'Colaborador', ...normPerms((data as any).perms) };
}
export async function isStaff(mentorId: string, userId: string) {
  if (mentorId === userId) return true;
  const { data } = await supabaseAdmin.from('academy_collaborators').select('user_id').eq('mentor_id', mentorId).eq('user_id', userId).maybeSingle();
  return !!data;
}
// IDs del equipo (mentor + colaboradores) — para el chat privado.
export async function staffIds(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_collaborators').select('user_id').eq('mentor_id', mentorId);
  return [mentorId, ...(data || []).map((r: any) => r.user_id)];
}
