import { NextResponse } from 'next/server';
import { runAlerts } from '@/lib/monitorAlerts';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cron de alertas del Command Center (cada ~15 min). Protegido con CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const r = await runAlerts();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_monitor_alerts', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
