import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Limpieza de registros basura: cuentas creadas hace más de N días que
// NUNCA confirmaron su correo. Son casi siempre bots o registros abandonados.
// Borrar el usuario de auth arrastra su perfil (FK on delete cascade).
//
// dryRun=true solo cuenta (para mostrar en Admin); false borra.
// ============================================================
export async function cleanUnconfirmed(days = 7, dryRun = false): Promise<{ count: number; deleted: number }> {
  const cutoff = Date.now() - days * 864e5;
  const victims: string[] = [];

  for (let page = 1; page <= 50; page++) {   // hasta 50k usuarios; de sobra
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      const confirmed = (u as any).email_confirmed_at || (u as any).confirmed_at;
      const created = u.created_at ? new Date(u.created_at).getTime() : Date.now();
      if (!confirmed && created < cutoff) victims.push(u.id);
    }
    if (data.users.length < 1000) break;
  }

  let deleted = 0;
  if (!dryRun) {
    for (const id of victims) {
      try { await supabaseAdmin.auth.admin.deleteUser(id); deleted++; } catch { /* sigue con el resto */ }
    }
  }
  return { count: victims.length, deleted };
}
