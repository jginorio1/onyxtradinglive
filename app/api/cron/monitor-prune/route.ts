import { NextResponse } from 'next/server';
import { pruneActivity } from '@/lib/monitor';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Retención del historial de monitoreo: borra a diario el detalle fino más viejo
// que MONITOR_RETENTION_DAYS (por defecto 90). Protegido con CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const days = Number(process.env.MONITOR_RETENTION_DAYS || 90);
    const deleted = await pruneActivity(days);
    return NextResponse.json({ ok: true, deleted, days });
  } catch (e: any) {
    await logError('cron_monitor_prune', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
