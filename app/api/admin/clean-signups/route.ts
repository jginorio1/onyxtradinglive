import { NextResponse } from 'next/server';
import { getAdmin, logAdmin, requirePerm } from '@/lib/admin';
import { cleanUnconfirmed } from '@/lib/cleanSignups';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DAYS = 7;

// GET · cuántas cuentas sin confirmar (>7 días) hay para limpiar
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const p = await requirePerm('usuarios', 'view'); if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const { count } = await cleanUnconfirmed(DAYS, true);
  return NextResponse.json({ count, days: DAYS });
}

// POST · borrarlas
export async function POST() {
  const a = await getAdmin();
  if (!a.isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const p = await requirePerm('usuarios', 'manage'); if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const { deleted } = await cleanUnconfirmed(DAYS, false);
  await logAdmin(a.user?.email || '', 'clean_signups', String(deleted), { days: DAYS });
  return NextResponse.json({ ok: true, deleted });
}
