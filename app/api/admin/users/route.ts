import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista de usuarios con nº de cuentas y última sincronización
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false });
  const { data: accts } = await supabaseAdmin.from('trading_accounts').select('user_id,last_sync_at');

  const byUser: Record<string, { accounts: number; lastSync: string | null }> = {};
  (accts || []).forEach((a: any) => {
    const u = byUser[a.user_id] || { accounts: 0, lastSync: null };
    u.accounts++;
    if (a.last_sync_at && (!u.lastSync || a.last_sync_at > u.lastSync)) u.lastSync = a.last_sync_at;
    byUser[a.user_id] = u;
  });

  const users = (profiles || []).map((p: any) => ({
    ...p,
    accounts: byUser[p.id]?.accounts || 0,
    lastSync: byUser[p.id]?.lastSync || null,
  }));

  return NextResponse.json({ users });
}

// PATCH · acciones: plan | ban | unban | admin
export async function PATCH(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { id, action, value } = await req.json();
  if (!id || !action) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });

  try {
    if (action === 'plan') {
      await supabaseAdmin.from('profiles').update({ plan: value }).eq('id', id);
    } else if (action === 'ban') {
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      await supabaseAdmin.from('profiles').update({ banned: true }).eq('id', id);
    } else if (action === 'unban') {
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' });
      await supabaseAdmin.from('profiles').update({ banned: false }).eq('id', id);
    } else if (action === 'admin') {
      await supabaseAdmin.from('profiles').update({ is_admin: !!value }).eq('id', id);
    } else {
      return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
    }
    await logAdmin(user.email, action, id, { value });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · borra el usuario y (en cascada) todos sus datos
export async function DELETE(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  if (id === user.id) return NextResponse.json({ error: 'no puedes borrarte a ti mismo' }, { status: 400 });

  try {
    // Borrar el usuario de Auth elimina en cascada profiles/api_keys/trading_accounts/trades.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    await logAdmin(user.email, 'delete_user', id, {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
