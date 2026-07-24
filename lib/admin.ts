import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { effectivePerms, meets, type PermLevel } from '@/lib/perms';

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
export async function requirePerm(area: string, need: PermLevel = 'view') {
  const a = await getAdmin();
  const ok = a.isAdmin && (a.role === 'owner' || meets(a.perms[area], need));
  return { ...a, ok };
}

// Guarda una acción del admin para auditoría (nunca lanza error).
export async function logAdmin(adminEmail: string, action: string, target: string, meta: any = {}) {
  try {
    await supabaseAdmin.from('admin_log').insert({ admin_email: adminEmail, action, target, meta });
  } catch { /* silencioso */ }
}
