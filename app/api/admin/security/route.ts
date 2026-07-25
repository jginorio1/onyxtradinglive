import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdmin, requirePerm } from '@/lib/admin';
import { LOCK_COOKIE, IDLE_MIN, userHasPin, setPin, verifyPin, getStore } from '@/lib/adminSecurity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · estado de seguridad del admin actual. Para el Owner, además la lista
// de miembros que ya tienen PIN (para gestionarlos desde la pestaña Equipo).
export async function GET() {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const hasPin = await userHasPin(user.id);
  const locked = cookies().get(LOCK_COOKIE)?.value === '1';
  const isOwner = (await requirePerm('ajustes', 'manage')).ok;
  let managed: string[] | undefined;
  if (isOwner) managed = Object.keys((await getStore()).users);
  return NextResponse.json({ hasPin, locked, idleMin: IDLE_MIN, managed });
}

// PATCH · fija o cambia un PIN (6 dígitos; vacío = quitar).
//   sin userId  → cambia el PIN propio (cualquier admin)
//   con userId  → el Owner asigna/quita el PIN de un miembro del equipo
export async function PATCH(req: Request) {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const pin = String(b.pin || '').trim();
  if (pin && !/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'El PIN debe tener 6 dígitos.' }, { status: 400 });

  const targetId = b.userId && String(b.userId) !== user.id ? String(b.userId) : user.id;
  if (targetId !== user.id) {
    const { ok } = await requirePerm('ajustes', 'manage'); // solo el Owner asigna a otros
    if (!ok) return NextResponse.json({ error: 'Solo el Owner puede asignar PIN a otros.' }, { status: 403 });
  }
  // PIN propio = definitivo; PIN asignado por el Owner = provisional (a cambiar).
  await setPin(targetId, pin, targetId !== user.id);
  return NextResponse.json({ ok: true, hasPin: !!pin });
}

// POST · bloquear o desbloquear el panel.
//   { action: 'lock' }            → marca la cookie (lo llama el temporizador de inactividad)
//   { action: 'unlock', pin }     → verifica el PIN y quita la cookie
export async function POST(req: Request) {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'lock') {
    // Solo bloqueamos a quien tenga PIN (si no, no podría reentrar).
    if (!(await userHasPin(user.id))) return NextResponse.json({ ok: true, skipped: true });
    cookies().set(LOCK_COOKIE, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: true });
    return NextResponse.json({ ok: true, locked: true });
  }

  if (b.action === 'unlock') {
    const r = await verifyPin(user.id, String(b.pin || '').trim());
    if (r === 'ok') {
      cookies().set(LOCK_COOKIE, '', { path: '/', maxAge: 0 });
      return NextResponse.json({ ok: true });
    }
    if (r === 'locked') return NextResponse.json({ error: 'Demasiados intentos.', forceLogout: true }, { status: 423 });
    if (r === 'nopin') { cookies().set(LOCK_COOKIE, '', { path: '/', maxAge: 0 }); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
  }

  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
