import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista de administradores
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const { data } = await supabaseAdmin.from('profiles').select('id,email,role,is_admin').eq('is_admin', true).order('created_at', { ascending: true });
    return NextResponse.json({ team: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// POST · dar acceso admin por email (solo owner)
export async function POST(req: Request) {
  try {
    const { isAdmin, role, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    if (role !== 'owner') return NextResponse.json({ error: 'Solo el Owner puede gestionar el equipo.' }, { status: 403 });

    const b = await req.json();
    const email = String(b.email || '').trim().toLowerCase();
    const newRole = ['admin', 'support', 'owner'].includes(b.role) ? b.role : 'admin';
    if (!email) return NextResponse.json({ error: 'falta email' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!prof) return NextResponse.json({ error: 'No existe un usuario con ese email. Primero debe registrarse en la app.' }, { status: 404 });

    const { error } = await supabaseAdmin.from('profiles').update({ is_admin: true, role: newRole }).eq('id', prof.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(user?.email || '', 'team_add', email, { role: newRole });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// PATCH · cambiar rol (solo owner)
export async function PATCH(req: Request) {
  try {
    const { isAdmin, role, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    if (role !== 'owner') return NextResponse.json({ error: 'Solo el Owner puede cambiar roles.' }, { status: 403 });
    const b = await req.json();
    const newRole = ['admin', 'support', 'owner'].includes(b.role) ? b.role : 'admin';
    const { error } = await supabaseAdmin.from('profiles').update({ role: newRole }).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(user?.email || '', 'team_role', b.id, { role: newRole });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// DELETE · quitar acceso admin (solo owner)
export async function DELETE(req: Request) {
  try {
    const { isAdmin, role, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    if (role !== 'owner') return NextResponse.json({ error: 'Solo el Owner puede quitar administradores.' }, { status: 403 });
    const { id } = await req.json();
    if (id === user.id) return NextResponse.json({ error: 'No puedes quitarte a ti mismo.' }, { status: 400 });
    const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', id).maybeSingle();
    if (target?.role === 'owner') return NextResponse.json({ error: 'No se puede quitar a un Owner.' }, { status: 400 });
    const { error } = await supabaseAdmin.from('profiles').update({ is_admin: false, role: null }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(user?.email || '', 'team_remove', id, {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
