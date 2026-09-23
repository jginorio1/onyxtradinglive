import { NextResponse } from 'next/server';
import { runAmbassadorOutreach } from '@/lib/ambassadorOutreach';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron del auto-reclutamiento de embajadores. Protegido con CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const r = await runAmbassadorOutreach();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_amb_outreach', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
