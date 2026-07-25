import { NextResponse } from 'next/server';
import { getAdmin, requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ROLES } from '@/lib/perms';
import { makeTempPin, setPin } from '@/lib/adminSecurity';
import { sendEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const clean = (v: any) => ['none', 'view', 'manage'].includes(v);

// GET · lista del equipo con rol, permisos, disponibilidad y última actividad
export async function GET() {
  try {
    const { ok } = await requirePerm('equipo', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const { data } = await supabaseAdmin.from('profiles')
      .select('id,email,role,is_admin,perms,available,last_active')
      .eq('is_admin', true).order('created_at', { ascending: true });
    return NextResponse.json({ team: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// POST · invitar/dar acceso por email (equipo: gestionar)
export async function POST(req: Request) {
  try {
    const { ok, user } = await requirePerm('equipo', 'manage');
    if (!ok) return NextResponse.json({ error: 'Solo quien gestiona el equipo puede añadir miembros.' }, { status: 403 });

    const b = await req.json();
    const email = String(b.email || '').trim().toLowerCase();
    const role = ROLES.includes(b.role) && b.role !== 'owner' ? b.role : 'support';
    if (!email) return NextResponse.json({ error: 'falta email' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!prof) return NextResponse.json({ error: 'No existe un usuario con ese email. Primero debe registrarse en la app.' }, { status: 404 });

    await supabaseAdmin.from('profiles').update({ is_admin: true, role, perms: {} }).eq('id', prof.id);
    await logAdmin(user?.email || '', 'team_add', email, { role });

    // PIN temporal de bloqueo: se genera, se guarda como provisional y se
    // envía por correo. El empleado deberá cambiarlo al entrar al panel.
    const tempPin = makeTempPin();
    await setPin(prof.id, tempPin, true);
    const emailed = await sendEmail(
      email,
      'Tu acceso de administrador · Onyx Trading Live',
      `Hola,\n\nTe han dado acceso al panel de Onyx Trading Live como "${role}".\n\n`
      + `Tu PIN temporal de bloqueo es: ${tempPin}\n\n`
      + `Entra al panel en https://www.onyxtradinglive.com/admin con tu cuenta. `
      + `La primera vez te pedirá cambiar este PIN por uno que solo tú sepas.\n\n`
      + `El PIN protege el panel: tras unos minutos de inactividad se bloquea y se reentra con él.\n\n`
      + `— Onyx Trading Live`,
    );
    return NextResponse.json({ ok: true, tempPin, emailed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// PATCH · cambiar rol/permisos (equipo: gestionar) · o mi propia disponibilidad
export async function PATCH(req: Request) {
  try {
    const me = await getAdmin();
    if (!me.isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json();

    // Disponibilidad propia: cualquier miembro puede marcarse Disponible/Ausente
    if (b.available !== undefined && !b.id) {
      await supabaseAdmin.from('profiles').update({ available: !!b.available, last_active: new Date().toISOString() }).eq('id', me.user.id);
      return NextResponse.json({ ok: true });
    }

    // Cambiar rol/permisos de un miembro: requiere gestionar equipo
    const { ok } = await requirePerm('equipo', 'manage');
    if (!ok) return NextResponse.json({ error: 'Solo quien gestiona el equipo puede cambiar roles.' }, { status: 403 });
    const patch: any = {};
    if (b.role && ROLES.includes(b.role) && b.role !== 'owner') patch.role = b.role;
    if (b.perms && typeof b.perms === 'object') {
      const p: any = {};
      for (const k of Object.keys(b.perms)) if (clean(b.perms[k])) p[k] = b.perms[k];
      patch.perms = p;
    }
    if (!Object.keys(patch).length || !b.id) return NextResponse.json({ error: 'nada que cambiar' }, { status: 400 });

    // No se puede degradar a un Owner
    const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', b.id).maybeSingle();
    if (target?.role === 'owner') return NextResponse.json({ error: 'No se puede modificar a un Owner.' }, { status: 400 });

    await supabaseAdmin.from('profiles').update(patch).eq('id', b.id);
    await logAdmin(me.user?.email || '', 'team_update', b.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// DELETE · quitar acceso (equipo: gestionar)
export async function DELETE(req: Request) {
  try {
    const { ok, user } = await requirePerm('equipo', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (id === user.id) return NextResponse.json({ error: 'No puedes quitarte a ti mismo.' }, { status: 400 });
    const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', id).maybeSingle();
    if (target?.role === 'owner') return NextResponse.json({ error: 'No se puede quitar a un Owner.' }, { status: 400 });
    await supabaseAdmin.from('profiles').update({ is_admin: false, role: null, perms: {}, available: false }).eq('id', id);
    await logAdmin(user?.email || '', 'team_remove', id, {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
