import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { appVersion, promote, rollback, setVersion } from '@/lib/appVersion';
import { verifyPin, userHasPin } from '@/lib/adminSecurity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await appVersion());
}

// action: 'promote' | 'rollback' | 'set'
// promote/rollback exigen PIN de seguridad (si el usuario tiene PIN configurado).
export async function POST(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const _p = await requirePerm('diag', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const by = user?.email || 'admin';
  const note = String(b.note || '').slice(0, 400);

  // 'set' (editar notas/beta) no pide PIN.
  if (b.action === 'set') {
    const patch: any = {};
    if (typeof b.beta === 'string') patch.beta = b.beta.trim();
    if (b.notes && typeof b.notes === 'object') patch.notes = b.notes;
    return NextResponse.json(await setVersion(patch, by));
  }

  // promote / rollback → verificar PIN si existe uno configurado.
  if (b.action === 'promote' || b.action === 'rollback') {
    const hasPin = await userHasPin(user.id);
    if (hasPin) {
      const res = await verifyPin(user.id, String(b.pin || ''));
      if (res === 'locked') return NextResponse.json({ error: 'PIN bloqueado por intentos fallidos. Espera un momento.' }, { status: 423 });
      if (res !== 'ok') return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }
    if (b.action === 'promote') return NextResponse.json(await promote(by, note));
    return NextResponse.json(await rollback(by, note));
  }

  return NextResponse.json({ error: 'accion desconocida' }, { status: 400 });
}
