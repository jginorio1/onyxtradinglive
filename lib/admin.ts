import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Devuelve el usuario actual y si es administrador.
// Es admin si su email está en ADMIN_EMAILS  O  si tiene profiles.is_admin = true.
export async function getAdmin() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, isAdmin: false };

  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const isEnvOwner = envAdmins.includes((user.email || '').toLowerCase());

  const { data } = await supabaseAdmin.from('profiles').select('is_admin,role').eq('id', user.id).maybeSingle();
  const isAdmin = isEnvOwner || !!data?.is_admin;
  // rol: el de la BD; si viene de ADMIN_EMAILS se considera owner
  const role: 'owner' | 'admin' | 'support' | null = (data?.role as any) || (isEnvOwner ? 'owner' : (data?.is_admin ? 'admin' : null));
  return { user, isAdmin, role };
}

// Guarda una acción del admin para auditoría (nunca lanza error).
export async function logAdmin(adminEmail: string, action: string, target: string, meta: any = {}) {
  try {
    await supabaseAdmin.from('admin_log').insert({ admin_email: adminEmail, action, target, meta });
  } catch { /* silencioso */ }
}
