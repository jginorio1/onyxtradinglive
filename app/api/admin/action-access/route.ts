import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canUserAction, effectivePerms, USER_ACTIONS } from '@/lib/perms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ¿Quién puede ejecutar una acción sensible sobre un cliente?
// Devuelve si YO puedo (canDo) y la lista del equipo que SÍ puede (para pedir
// ayuda o mandarle un DM desde el expediente). Lo usa el candado de permisos.
export async function GET(req: Request) {
  const { isAdmin, role, perms, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const action = String(new URL(req.url).searchParams.get('action') || '');
  const valid = new Set(USER_ACTIONS.map((a) => a.id));
  if (!valid.has(action)) return NextResponse.json({ error: 'acción inválida' }, { status: 400 });

  const canDo = canUserAction(role, perms, action);

  // Barre el equipo (admins) y calcula quién tiene la acción concedida.
  let who: { id: string; name: string; job_title: string }[] = [];
  try {
    const { data: team } = await supabaseAdmin.from('profiles')
      .select('id,email,full_name,job_title,role,perms').eq('is_admin', true);
    who = (team || [])
      .filter((p: any) => p.id !== user?.id)
      .filter((p: any) => {
        const r = p.role as string | null;
        if (r === 'owner') return true;
        return canUserAction(r, effectivePerms(r, p.perms || {}), action);
      })
      .map((p: any) => ({
        id: p.id,
        name: p.full_name || (p.email || '').split('@')[0],
        job_title: p.job_title || '',
      }))
      .slice(0, 20);
  } catch { /* si falla, devolvemos lista vacía */ }

  // Puestos distintos que pueden (para el texto "tal puesto tiene acceso").
  const titles = Array.from(new Set(who.map((w) => w.job_title).filter(Boolean)));
  return NextResponse.json({ canDo, who, titles });
}
