import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guarda (o limpia) el plan que el usuario quería comprar, atado a su cuenta.
// Tolerante: si la columna aún no existe (SQL sin correr), no rompe nada.
// body: { plan?: string, annual?: boolean, clear?: boolean }
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    if (b?.clear) {
      try { await supabaseAdmin.from('profiles').update({ pending_plan: null }).eq('id', user.id); } catch {}
      return NextResponse.json({ ok: true, cleared: true });
    }
    const plan = String(b?.plan || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
    if (!plan || plan === 'free') return NextResponse.json({ ok: false });
    try {
      await supabaseAdmin.from('profiles').update({ pending_plan: plan, pending_plan_annual: !!b?.annual }).eq('id', user.id);
    } catch { /* columna aún no creada: se ignora, el flujo por URL sigue funcionando */ }
    return NextResponse.json({ ok: true, plan });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
