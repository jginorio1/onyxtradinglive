import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { visitorStats } from '@/lib/visitors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · estadísticas de visitantes (datos reales) para Admin → SEO.
// ?days=1|7|30  (1 = últimas 24h / "hoy").
export async function GET(req: Request) {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const days = [1, 7, 30].includes(Number(new URL(req.url).searchParams.get('days'))) ? Number(new URL(req.url).searchParams.get('days')) : 1;
  try {
    return NextResponse.json(await visitorStats(days));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', notReady: true }, { status: 200 });
  }
}
