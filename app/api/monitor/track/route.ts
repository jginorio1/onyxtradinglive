import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logActivity } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Beacon de monitoreo — SOLO usuarios con sesión (traders y empleados). Cada
// cambio de pantalla/acción se registra en el historial (activity_events). La
// presencia "en vivo" NO pasa por aquí: va por Realtime desde el navegador.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new NextResponse(null, { status: 204 });   // anónimos ya los cuenta /api/track

    const b = await req.json().catch(() => ({} as any));
    const path = String(b.path || '/').split('?')[0].slice(0, 200);
    if (/^\/api\//.test(path)) return new NextResponse(null, { status: 204 });

    // Perfil: nombre + si es del equipo (empleado) o trader.
    const { data: p } = await supabaseAdmin.from('profiles').select('full_name,is_admin,role').eq('id', user.id).maybeSingle();
    const role = (p?.is_admin || p?.role) ? 'employee' : 'trader';
    const country = headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry') || '';

    await logActivity({
      actor_id: user.id,
      actor_email: user.email,
      actor_name: (p?.full_name as any) || user.email,
      actor_role: role,
      kind: String(b.kind || 'page').slice(0, 40),
      path,
      label: b.label ? String(b.label).slice(0, 200) : null,
      country,
      meta: b.meta || {},
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
