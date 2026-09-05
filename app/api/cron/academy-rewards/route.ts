import { NextResponse } from 'next/server';
import { releaseDueRewards } from '@/lib/academyReferral';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Vence la ventana de espera de las recompensas de referido (pending→available) y,
// en riel A (crédito), aplica el saldo al referidor. Protegido con CRON_SECRET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    const r = await releaseDueRewards();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('academy_rewards_cron', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
