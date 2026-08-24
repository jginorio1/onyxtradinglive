import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { off } · guarda el desfase horario del trader (min, local = UTC + off).
// Lo llama la app al entrar. Silencioso: si no hay sesión o falta la columna,
// no pasa nada (el reporte cae en la zona por defecto).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 200 });

    const b = await req.json().catch(() => ({} as any));
    const off = Number(b.off);
    if (!Number.isFinite(off) || off < -840 || off > 840) return NextResponse.json({ ok: false }, { status: 200 });

    try { await supabaseAdmin.from('profiles').update({ tz_offset_min: Math.round(off) }).eq('id', user.id); } catch { /* columna aún sin crear */ }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 200 }); }
}
