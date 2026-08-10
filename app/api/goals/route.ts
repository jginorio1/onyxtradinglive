import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Metas de profit del trader (semanal / mensual / anual).
// Se guardan en el perfil (servidor), no en el navegador, para que persistan
// entre dispositivos y no se pierdan al limpiar caché o cambiar de versión.
// El trader las fija y las puede actualizar cuando quiera.
// ============================================================

const clean = (v: any) => Math.max(0, Math.min(100000000, Math.round(Number(v) || 0)));

async function readGoals(userId: string) {
  const { data } = await supabaseAdmin.from('profiles').select('goal_week,goal_month,goal_year').eq('id', userId).maybeSingle();
  return {
    week: Number((data as any)?.goal_week || 0),
    month: Number((data as any)?.goal_month || 0),
    year: Number((data as any)?.goal_year || 0),
  };
}

export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  try {
    return NextResponse.json(await readGoals(user.id));
  } catch (e: any) {
    await logError('goals_get', e);
    return NextResponse.json({ week: 0, month: 0, year: 0 });
  }
}

export async function PATCH(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const b = await req.json().catch(() => ({} as any));
  const patch: any = {};
  if (b.week !== undefined) patch.goal_week = clean(b.week);
  if (b.month !== undefined) patch.goal_month = clean(b.month);
  if (b.year !== undefined) patch.goal_year = clean(b.year);
  if (!Object.keys(patch).length) return NextResponse.json({ ok: true, ...(await readGoals(user.id).catch(() => ({ week: 0, month: 0, year: 0 }))) });

  try {
    // 1) Intento normal: actualizar la fila del perfil y confirmar cuántas cambió.
    const { data: rows, error: upErr } = await supabaseAdmin
      .from('profiles').update(patch).eq('id', user.id).select('id');
    if (upErr) throw upErr;

    // 2) Si no había fila de perfil aún, la creamos (upsert) para no perder las metas.
    if (!rows || rows.length === 0) {
      const { error: insErr } = await supabaseAdmin
        .from('profiles').upsert({ id: user.id, ...patch }, { onConflict: 'id' });
      if (insErr) throw insErr;
    }

    // 3) Releemos y devolvemos lo realmente guardado, para que el cliente confíe en el servidor.
    const saved = await readGoals(user.id);
    return NextResponse.json({ ok: true, ...saved });
  } catch (e: any) {
    await logError('goals_patch', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
