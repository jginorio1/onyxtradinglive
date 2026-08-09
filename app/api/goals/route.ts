import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Metas de profit del trader (semanal / mensual / anual).
// Se guardan en el perfil (servidor), no en el navegador, para que persistan
// entre dispositivos y no se pierdan al limpiar caché o cambiar de versión.
// ============================================================

const clean = (v: any) => Math.max(0, Math.min(100000000, Math.round(Number(v) || 0)));

export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data } = await supabaseAdmin.from('profiles').select('goal_week,goal_month,goal_year').eq('id', user.id).maybeSingle();
  return NextResponse.json({
    week: Number((data as any)?.goal_week || 0),
    month: Number((data as any)?.goal_month || 0),
    year: Number((data as any)?.goal_year || 0),
  });
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
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
