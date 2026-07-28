import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdmin, requirePerm } from '@/lib/admin';
import { SEEN_COOKIE, IDLE_MIN, userHasPin, setPin, verifyPin, getStore, serverLocked } from '@/lib/adminSecurity';

const SEEN_TTL = 60 * 60 * 8; // la cookie vive 8h; lo que bloquea es su antigüedad
function touch(fresh = true) {
  const t = fresh ? Date.now() : Date.now() - (IDLE_MIN * 60 * 1000) - 60000; // fresco o "viejo" (bloquea ya)
  cookies().set(SEEN_COOKIE, String(t), { path: '/', maxAge: SEEN_TTL, httpOnly: true, sameSite: 'lax', secure: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · estado de seguridad del admin actual. Para el Owner, además la lista
// de miembros que ya tienen PIN (para gestionarlos desde la pestaña Equipo).
export async function GET() {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const hasPin = await userHasPin(user.id);
  const locked = hasPin && serverLocked();
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

// POST · mantener viva la sesión, bloquear o desbloquear el panel.
//   { action: 'ping' }            → renueva la marca de actividad (lo llama el cliente en cada actividad real)
//   { action: 'lock' }            → bloquea ahora mismo (marca la actividad como vieja)
//   { action: 'unlock', pin }     → verifica el PIN y deja la marca fresca
export async function POST(req: Request) {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'ping') {
    // Solo tiene sentido para quien tenga PIN (si no, no hay bloqueo).
    if (!(await userHasPin(user.id))) return NextResponse.json({ ok: true, skipped: true });
    touch(true);
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'lock') {
    if (!(await userHasPin(user.id))) return NextResponse.json({ ok: true, skipped: true });
    touch(false); // marca vieja → bloqueado en el próximo render
    return NextResponse.json({ ok: true, locked: true });
  }

  if (b.action === 'unlock') {
    const r = await verifyPin(user.id, String(b.pin || '').trim());
    if (r === 'ok') { touch(true); return NextResponse.json({ ok: true }); }
    if (r === 'locked') return NextResponse.json({ error: 'Demasiados intentos.', forceLogout: true }, { status: 423 });
    if (r === 'nopin') { touch(true); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
  }

  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
