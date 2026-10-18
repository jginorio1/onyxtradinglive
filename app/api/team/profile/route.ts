import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PATCH · guardar el perfil de equipo (puesto, país, idiomas). Por defecto edita
// el MÍO; el dueño puede editar a otro pasando { id }. Campos bilingües libres.
// { id?, job_title?, country?, languages? }
export async function PATCH(req: Request) {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const target = b.id && b.id !== g.user.id ? String(b.id) : g.user.id;
    // Editar a OTRO empleado solo lo permite el dueño.
    if (target !== g.user.id && g.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const patch: any = {};
    if (b.job_title !== undefined) patch.job_title = String(b.job_title || '').slice(0, 60) || null;
    if (b.country !== undefined) patch.country = String(b.country || '').slice(0, 60) || null;
    if (b.languages !== undefined) patch.languages = String(b.languages || '').slice(0, 120) || null;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada que guardar' }, { status: 400 });

    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', target);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
