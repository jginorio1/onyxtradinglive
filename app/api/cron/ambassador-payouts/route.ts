import { NextResponse } from 'next/server';
import { autoPayoutDue } from '@/lib/ambassadorPayout';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron · paga solo el saldo maduro de los embajadores (Stripe/crédito), respetando
// retención, mínimo, verificación de Stripe, on_hold y el freno global.
// Protegido con CRON_SECRET (header de Vercel o ?key=).
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
    const r = await autoPayoutDue();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_ambassador_payouts', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
