import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guardamos el PIN en app_settings (clave 'beta'). Nunca viaja al cliente.
type Beta = { pin: string };
const B0: Beta = { pin: '' };

const COOKIE = 'onyx_beta';
const TTL = 60 * 60 * 2; // 2 horas

// GET · ¿hay PIN configurado? (para el panel del Owner). No devuelve el PIN.
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await getSetting<Beta>('beta', B0);
  const active = cookies().get(COOKIE)?.value === '1';
  return NextResponse.json({ hasPin: !!b.pin, active });
}

// POST · el visitante entra al Modo beta con el PIN (o sale con {off:true}).
// No requiere ser admin: cualquiera con el PIN puede ver la beta.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  if (body.off) {
    cookies().set(COOKIE, '', { path: '/', maxAge: 0 });
    return NextResponse.json({ ok: true, active: false });
  }

  const b = await getSetting<Beta>('beta', B0);
  if (!b.pin) return NextResponse.json({ error: 'El Modo beta no tiene PIN configurado.' }, { status: 400 });

  const pin = String(body.pin || '').trim();
  if (pin !== b.pin) return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });

  cookies().set(COOKIE, '1', { path: '/', maxAge: TTL, httpOnly: true, sameSite: 'lax', secure: true });
  return NextResponse.json({ ok: true, active: true });
}

// PATCH · el Owner fija o cambia el PIN (6 dígitos). Vacío = desactiva el Modo beta.
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede cambiar el PIN.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin || '').trim();
  if (pin && !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'El PIN debe tener 6 dígitos.' }, { status: 400 });
  }
  await saveSetting('beta', { pin });
  return NextResponse.json({ ok: true, hasPin: !!pin });
}
