import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { compSettings, saveCompSettings } from '@/lib/compTrial';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Ajustes de la prueba de pago: días de antelación del email/popup (default 5).
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await compSettings());
}

export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner.' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  await saveCompSettings(Number(b?.warnDays) || 5);
  return NextResponse.json({ ok: true, ...(await compSettings()) });
}
