import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · confirma con PIN el salto al entorno de BETA. El PIN vive en el
// servidor (BETA_SWITCH_PIN). Si no está configurado, no bloquea (solo avisa).
// Esto NO es seguridad fuerte (las dos URLs son públicas): es una fricción
// deliberada para no entrar a pruebas por accidente.
export async function POST(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const pin = String(b.pin || '');
  const expected = process.env.BETA_SWITCH_PIN || '';
  if (!expected) return NextResponse.json({ ok: true, note: 'no_pin_set' });
  if (pin !== expected) return NextResponse.json({ ok: false, error: 'PIN incorrecto' }, { status: 401 });
  return NextResponse.json({ ok: true });
}
