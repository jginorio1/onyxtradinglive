import { NextResponse } from 'next/server';
import { autoPaySalesDue } from '@/lib/salesPayout';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Pago automático a la red de ventas: paga a quien ya maduró y supera el mínimo,
// respetando los frenos. Protegido con CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const r = await autoPaySalesDue();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_sales_payouts', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
