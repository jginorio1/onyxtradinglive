import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { off, zone } · guarda el desfase horario del trader (min, local = UTC + off)
// y, si el trader NO ha fijado su zona a mano (tz_manual = false), auto-sincroniza
// su nombre IANA (ej. 'America/Puerto_Rico'). Lo llama la app al entrar. Silencioso:
// si no hay sesión o falta la columna, no pasa nada (cae en la zona por defecto).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 200 });

    const b = await req.json().catch(() => ({} as any));
    const off = Number(b.off);
    if (!Number.isFinite(off) || off < -840 || off > 840) return NextResponse.json({ ok: false }, { status: 200 });

    const upd: any = { tz_offset_min: Math.round(off) };

    // Zona IANA del navegador: solo la aceptamos si es válida y razonable.
    const zone = String(b.zone || '').trim().slice(0, 64);
    const validZone = zone && /^[A-Za-z]+\/[A-Za-z0-9_+\-\/]+$/.test(zone);
    if (validZone) {
      // Auto-sincroniza SOLO si el trader nunca la eligió a mano. Leemos la bandera;
      // si la columna aún no existe, el catch la trata como "no manual".
      let manual = false;
      try {
        const { data } = await supabaseAdmin.from('profiles').select('tz_manual').eq('id', user.id).maybeSingle();
        manual = !!(data as any)?.tz_manual;
      } catch { /* columna tz_manual aún sin crear → tratamos como no manual */ }
      if (!manual) upd.timezone = zone;
    }

    try { await supabaseAdmin.from('profiles').update(upd).eq('id', user.id); } catch { /* columnas aún sin crear */ }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 200 }); }
}
