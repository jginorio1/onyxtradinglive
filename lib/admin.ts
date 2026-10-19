import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { effectivePerms, meets, permMeets, canUserAction, type PermLevel } from '@/lib/perms';
import { serverLocked, has2faOk } from '@/lib/adminSecurity';

// ¿La sesión superó el 2FA (AAL2) en este dispositivo? Si el usuario tiene un
// factor activo pero no lo verificó en esta sesión, currentLevel es aal1 y hay
// que exigir el código antes de dejar tocar nada sensible del backend. Un código
// de respaldo válido (cookie firmada) también cuenta como 2FA satisfecho.
async function needs2FA(sb: ReturnType<typeof createSupabaseServer>, userId: string): Promise<boolean> {
  if (has2faOk(userId)) return false;
  try {
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
  } catch { return false; }  // ante un fallo transitorio no cortamos el panel
}

// Devuelve el usuario actual, si es administrador, su rol y sus permisos efectivos.
// Es admin si su email está en ADMIN_EMAILS  O  si tiene profiles.is_admin = true.
export async function getAdmin() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, isAdmin: false, role: null, perms: {} as Record<string, PermLevel> };

  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const isEnvOwner = envAdmins.includes((user.email || '').toLowerCase());

  const { data } = await supabaseAdmin.from('profiles').select('is_admin,role,perms').eq('id', user.id).maybeSingle();
  const isAdmin = isEnvOwner || !!data?.is_admin;
  // rol: el de la BD; si viene de ADMIN_EMAILS se considera owner
  const role: 'owner' | 'admin' | 'support' | 'marketing' | null =
    (isEnvOwner ? 'owner' : (data?.role as any)) || (data?.is_admin ? 'admin' : null);
  const perms = effectivePerms(role, (data as any)?.perms);
  return { user, isAdmin, role, perms };
}

// Comprueba si el admin actual cumple un permiso de área. Owner siempre pasa.
// Además exige, en el backend (no solo en la pantalla): (1) que el panel NO esté
// bloqueado por inactividad, y (2) que la sesión haya superado el 2FA (AAL2).
// Devuelve `reason` para que la ruta pueda distinguir el motivo si quiere.
export async function requirePerm(area: string, need: PermLevel = 'view') {
  const a = await getAdmin();
  let ok = a.isAdmin && (a.role === 'owner' || permMeets(a.perms, area, need));
  let reason: '' | 'locked' | '2fa' = '';
  if (ok) {
    if (serverLocked()) { ok = false; reason = 'locked'; }          // bloqueo por inactividad
    else if (await needs2FA(createSupabaseServer(), a.user.id)) { ok = false; reason = '2fa'; }  // 2FA no verificado
  }
  return { ...a, ok, reason };
}

// Comprueba un permiso FINO de acción sobre un usuario (plan, pin, ban, admin,
// delete, edit). Owner siempre pasa. Aplica también el bloqueo por inactividad y
// el 2FA, igual que requirePerm. La entrada de "ver usuarios" se chequea aparte.
export async function requireUserAction(action: string) {
  const a = await getAdmin();
  let ok = a.isAdmin && canUserAction(a.role, a.perms, action);
  let reason: '' | 'locked' | '2fa' = '';
  if (ok) {
    if (serverLocked()) { ok = false; reason = 'locked'; }
    else if (await needs2FA(createSupabaseServer(), a.user.id)) { ok = false; reason = '2fa'; }
  }
  return { ...a, ok, reason };
}

// Contexto del request para la auditoría: IP y dispositivo (user-agent). Se saca
// de las cabeceras estándar de Vercel/Next. Úsalo con logAdmin(..., reqCtx(req)).
export function reqCtx(req?: Request, area?: string): { ip?: string; ua?: string; area?: string } {
  try {
    const h = req?.headers;
    const ip = (h?.get('x-forwarded-for') || '').split(',')[0].trim() || h?.get('x-real-ip') || undefined;
    const ua = h?.get('user-agent') || undefined;
    return { ip: ip ? String(ip).slice(0, 60) : undefined, ua: ua ? String(ua).slice(0, 300) : undefined, area };
  } catch { return { area }; }
}

// Guarda una acción del admin para auditoría (nunca lanza error). El 5º argumento
// opcional añade IP/dispositivo/área (usa reqCtx(req)). Insert tolerante: si las
// columnas nuevas aún no existen (SQL sin correr), reintenta sin ellas.
export async function logAdmin(adminEmail: string, action: string, target: string, meta: any = {}, ctx?: { ip?: string; ua?: string; area?: string }) {
  try {
    const row: any = { admin_email: adminEmail, action, target, meta };
    if (ctx?.ip) row.ip = ctx.ip;
    if (ctx?.ua) row.user_agent = ctx.ua;
    if (ctx?.area) row.area = ctx.area;
    const r = await supabaseAdmin.from('admin_log').insert(row);
    if (r.error && (ctx?.ip || ctx?.ua || ctx?.area)) {
      // columnas nuevas inexistentes: guardar al menos lo básico
      await supabaseAdmin.from('admin_log').insert({ admin_email: adminEmail, action, target, meta });
    }
  } catch { /* silencioso */ }
}
