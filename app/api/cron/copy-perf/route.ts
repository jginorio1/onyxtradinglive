import { NextResponse } from 'next/server';
import { runPerformanceFees } from '@/lib/copyPerf';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron MENSUAL · cobra la comisión por rendimiento (high-water mark) de todas
// las copias activas. Protegido con CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const r = await runPerformanceFees();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_copy_perf', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
