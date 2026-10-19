import { NextResponse } from 'next/server';
import { requirePerm, logAdmin, reqCtx } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PATCH · guardar el perfil de equipo (puesto, país, idiomas). Lo controla el
// ADMIN: solo dueño/admin pueden editar (la suya o la de cualquier empleado
// pasando { id }). Un empleado normal NO puede editar su propia ficha.
// { id?, job_title?, country?, languages? }
export async function PATCH(req: Request) {
  // Se puede entrar por el chat de equipo (perm 'chat') o por Admin → Equipo
  // (perm 'equipo'). Basta tener acceso de lectura a cualquiera de las dos.
  let g = await requirePerm('equipo', 'view');
  if (!g.ok) g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  // Solo dueño/admin controlan las fichas del equipo.
  if (g.role !== 'owner' && g.role !== 'admin') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const target = b.id && b.id !== g.user.id ? String(b.id) : g.user.id;

    const patch: any = {};
    if (b.job_title !== undefined) patch.job_title = String(b.job_title || '').slice(0, 60) || null;
    if (b.country !== undefined) patch.country = String(b.country || '').slice(0, 60) || null;
    if (b.languages !== undefined) patch.languages = String(b.languages || '').slice(0, 120) || null;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada que guardar' }, { status: 400 });

    // Leemos los valores actuales para registrar el antes→después en la auditoría.
    const { data: before } = await supabaseAdmin.from('profiles').select('email,job_title,country,languages').eq('id', target).maybeSingle();
    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', target);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auditoría: qué campos cambió y de qué valor a qué valor.
    try {
      const changed: any = {};
      for (const k of ['job_title', 'country', 'languages']) {
        if (patch[k] !== undefined && String((before as any)?.[k] || '') !== String(patch[k] || '')) {
          changed[k] = { from: (before as any)?.[k] || '—', to: patch[k] || '—' };
        }
      }
      if (Object.keys(changed).length) {
        await logAdmin(g.user?.email || '', 'team_profile', target, { email: (before as any)?.email || target, ...changed }, reqCtx(req, 'equipo'));
      }
    } catch { /* la auditoría nunca bloquea */ }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
