import { NextResponse } from 'next/server';
import { applyDueRewards } from '@/lib/memberReferral';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Aplica el crédito (Stripe customer balance) de las recompensas de referido que
// ya superaron su ventana anti-reembolso. Protegido con CRON_SECRET.
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
    const r = await applyDueRewards();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('member_rewards_cron', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
