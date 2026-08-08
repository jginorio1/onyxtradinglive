import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { resourceStats } from '@/lib/resources';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · uso de recursos de la app (BD, storage, latencia, errores, IA, usuarios).
export async function GET() {
  const { ok } = await requirePerm('diag', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const t0 = Date.now();
  const stats = await resourceStats();
  const serverMs = Date.now() - t0;
  return NextResponse.json({ ...stats, latency: { ...stats.latency, serverMs } });
}
