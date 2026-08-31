import { NextResponse } from 'next/server';
import { getAdmin, logAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { grantComp, revokeComp } from '@/lib/compTrial';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista de usuarios con nº de cuentas y última sincronización
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('usuarios', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false });
  const { data: accts } = await supabaseAdmin.from('trading_accounts').select('user_id,last_sync_at');

  const byUser: Record<string, { accounts: number; lastSync: string | null }> = {};
  (accts || []).forEach((a: any) => {
    const u = byUser[a.user_id] || { accounts: 0, lastSync: null };
    u.accounts++;
    if (a.last_sync_at && (!u.lastSync || a.last_sync_at > u.lastSync)) u.lastSync = a.last_sync_at;
    byUser[a.user_id] = u;
  });

  // Confirmación de email: vive en Auth (auth.users), no en profiles.
  const confirmed: Record<string, boolean> = {};
  try {
    for (let page = 1; page <= 20; page++) {
      const { data: au } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      const list = au?.users || [];
      for (const u of list) confirmed[u.id] = !!(u.email_confirmed_at || (u as any).confirmed_at);
      if (list.length < 1000) break;
    }
  } catch { /* si Auth no responde, no marcamos a nadie como sin confirmar */ }

  const users = (profiles || []).map((p: any) => ({
    ...p,
    accounts: byUser[p.id]?.accounts || 0,
    lastSync: byUser[p.id]?.lastSync || null,
    email_confirmed: confirmed[p.id] !== false, // desconocido → se asume confirmado
  }));

  return NextResponse.json({ users });
}

// PATCH · acciones: plan | ban | unban | admin
export async function PATCH(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('usuarios', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { id, action, value, note } = await req.json();
  if (!action) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });

  // Calcula si un cambio de plan es subida o bajada según el precio mensual.
  async function planDir(from: string, to: string) {
    const { data: pr } = await supabaseAdmin.from('plans').select('id,price_month').in('id', [from, to]);
    const pm: any = Object.fromEntries((pr || []).map((p: any) => [p.id, Number(p.price_month) || 0]));
    return (pm[to] || 0) > (pm[from] || 0) ? 'up' : (pm[to] || 0) < (pm[from] || 0) ? 'down' : '';
  }

  try {
    // Cambiar MI PROPIO plan (para pruebas). No hace falta id: lo saca de la sesion.
    if (action === 'self_plan') {
      const { data: prof0 } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      const from = (prof0 as any)?.plan || 'free';
      const { error: upErr } = await supabaseAdmin.from('profiles')
        .upsert({ id: user.id, email: user.email, plan: value }, { onConflict: 'id' });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      const { data: check } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      if (check?.plan !== value) return NextResponse.json({ error: 'No se guardo el plan.' }, { status: 500 });
      await logAdmin(user.email, 'self_plan', user.email, { from, to: value, dir: await planDir(from, value), note: note || null });
      return NextResponse.json({ ok: true, plan: value });
    }

    // Reenviar confirmación a TODOS los sin confirmar (no necesita id).
    if (action === 'resend_confirm_all') {
      const targets: string[] = [];
      for (let page = 1; page <= 20; page++) {
        const { data: au } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        const list = au?.users || [];
        for (const u of list) { if (!(u.email_confirmed_at || (u as any).confirmed_at) && u.email && !(u as any).banned_until) targets.push(u.email); }
        if (list.length < 1000) break;
      }
      let sent = 0;
      for (const em of targets) {
        try { const { error } = await (supabaseAdmin.auth as any).resend({ type: 'signup', email: em }); if (!error) sent++; } catch { /* rate limit u otro: seguimos */ }
        await new Promise((r) => setTimeout(r, 120)); // pequeña pausa para no chocar con el rate limit
      }
      await logAdmin(user.email, 'resend_confirm_all', user.email, { total: targets.length, sent });
      return NextResponse.json({ ok: true, sent, total: targets.length });
    }

    if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

    // Email del usuario objetivo, para que el log diga a QUIÉN afectó (no solo el id).
    const { data: tprof } = await supabaseAdmin.from('profiles').select('email,plan').eq('id', id).maybeSingle();
    const email = (tprof as any)?.email || '';
    const meta: any = { value, email, note: note || null };

    if (action === 'plan') {
      const from = (tprof as any)?.plan || 'free';
      await supabaseAdmin.from('profiles').update({ plan: value }).eq('id', id);
      meta.from = from; meta.to = value; meta.dir = await planDir(from, value);
    } else if (action === 'comp_grant') {
      // Prueba de pago (cortesía) por N días, sin tarjeta.
      const g = await grantComp(id, value?.plan, value?.days);
      meta.plan = g.plan; meta.days = g.days; meta.until = g.until;
    } else if (action === 'comp_revoke') {
      await revokeComp(id);
    } else if (action === 'ban') {
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      await supabaseAdmin.from('profiles').update({ banned: true }).eq('id', id);
    } else if (action === 'unban') {
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' });
      await supabaseAdmin.from('profiles').update({ banned: false }).eq('id', id);
    } else if (action === 'admin') {
      await supabaseAdmin.from('profiles').update({ is_admin: !!value }).eq('id', id);
    } else if (action === 'name') {
      const nn = String(value || '').trim().slice(0, 80);
      await supabaseAdmin.from('profiles').update({ full_name: nn || null }).eq('id', id);
      meta.name = nn;
    } else if (action === 'resend_confirm') {
      if (!email) return NextResponse.json({ error: 'sin correo' }, { status: 400 });
      // Reenvía el correo de confirmación de registro (usa el SMTP de Supabase).
      const { error: rErr } = await (supabaseAdmin.auth as any).resend({ type: 'signup', email });
      if (rErr) return NextResponse.json({ error: rErr.message || 'no se pudo reenviar' }, { status: 500 });
    } else {
      return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
    }
    await logAdmin(user.email, action, id, meta);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · borra el usuario y (en cascada) todos sus datos
export async function DELETE(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('usuarios', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { id, note } = await req.json();
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  if (id === user.id) return NextResponse.json({ error: 'no puedes borrarte a ti mismo' }, { status: 400 });

  try {
    // Guardamos el email ANTES de borrar, para que el log diga a quién se eliminó.
    const { data: tprof } = await supabaseAdmin.from('profiles').select('email').eq('id', id).maybeSingle();
    // Borrar el usuario de Auth elimina en cascada profiles/api_keys/trading_accounts/trades.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    await logAdmin(user.email, 'delete_user', id, { email: (tprof as any)?.email || '', note: note || null });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
