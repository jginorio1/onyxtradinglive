import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidTz, normHHMM, DEFAULT_TZ, DEFAULT_CHECKIN, DEFAULT_CHECKOUT } from '@/lib/routine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · zona y horas de check-in/out del trader (con defaults si aún no las fijó).
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
    const { data: p } = await supabaseAdmin.from('profiles').select('tz,checkin_at,checkout_at').eq('id', user.id).maybeSingle();
    return NextResponse.json({
      tz: (p as any)?.tz || '',
      checkin_at: (p as any)?.checkin_at || DEFAULT_CHECKIN,
      checkout_at: (p as any)?.checkout_at || DEFAULT_CHECKOUT,
      detected: false,
    });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}

// POST · guarda zona y/o horas. Dos usos:
//   { tz }                          → auto-captura silenciosa de la zona al entrar (solo si falta)
//   { checkin_at, checkout_at, tz } → el trader elige sus horas (onboarding / Avisos)
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));

    const patch: any = {};
    if (b.tz && isValidTz(String(b.tz))) {
      // Auto-captura: solo fija la zona si el perfil aún no tiene una, para no pisar
      // una que el trader haya elegido a propósito. `force:true` la actualiza siempre.
      if (b.force) patch.tz = String(b.tz);
      else {
        const { data: cur } = await supabaseAdmin.from('profiles').select('tz').eq('id', user.id).maybeSingle();
        if (!(cur as any)?.tz) patch.tz = String(b.tz);
      }
    }
    if (b.checkin_at != null) { const v = normHHMM(b.checkin_at); if (v) patch.checkin_at = v; }
    if (b.checkout_at != null) { const v = normHHMM(b.checkout_at); if (v) patch.checkout_at = v; }

    if (Object.keys(patch).length) {
      const r = await supabaseAdmin.from('profiles').update(patch).eq('id', user.id);
      if (r.error) return NextResponse.json({ error: r.error.message, code: 'no_column' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, saved: patch });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
