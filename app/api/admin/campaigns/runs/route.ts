import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { campaignRuns } from '@/lib/campaigns';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET ?key=newsletter · historial de envíos automáticos (IA) de una campaña,
// con destinatarios + aperturas + clics por envío.
export async function GET(req: Request) {
  const p = await requirePerm('campanas', 'view');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const key = new URL(req.url).searchParams.get('key') || '';
    if (!key) return NextResponse.json({ runs: [] });
    const runs = await campaignRuns(key, 12);
    return NextResponse.json({ runs });
  } catch (e: any) {
    await logError('campaigns_runs', e);
    return NextResponse.json({ error: e?.message || 'error', runs: [] }, { status: 500 });
  }
}
