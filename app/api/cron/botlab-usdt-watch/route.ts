import { NextResponse } from 'next/server';
import { watchUsdtAll } from '@/lib/chainWatch';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Verifica pagos de USDT (Ethereum/ERC20) en la cadena y confirma solos los que
// llegaron a tu wallet. Se puede llamar seguido (cada pocos minutos). CRON_SECRET.
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
    const r = await watchUsdtAll();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('botlab_usdt_watch_cron', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
