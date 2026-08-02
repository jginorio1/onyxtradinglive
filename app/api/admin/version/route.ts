import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { appVersion, promote, setVersion } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await appVersion());
}

// action: 'promote' | 'set'
export async function POST(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const _p = await requirePerm('diag', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.action === 'promote') return NextResponse.json(await promote());
  if (b.action === 'set') {
    const patch: any = {};
    if (typeof b.beta === 'string') patch.beta = b.beta.trim();
    if (typeof b.production === 'string') patch.production = b.production.trim();
    if (typeof b.stable === 'string') patch.stable = b.stable.trim();
    if (b.notes && typeof b.notes === 'object') patch.notes = b.notes;
    return NextResponse.json(await setVersion(patch));
  }
  return NextResponse.json({ error: 'accion desconocida' }, { status: 400 });
}
