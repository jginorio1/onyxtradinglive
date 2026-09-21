import { NextResponse } from 'next/server';
import { autoPaySalesDue } from '@/lib/salesPayout';
import { salesSettings } from '@/lib/sales';
import { assignLeadsRoundRobin, autoPromoteAll } from '@/lib/salesGrowth';
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
    // Motor de crecimiento: reparte leads y asciende si el dueño lo activó.
    const s = await salesSettings();
    let assigned = 0, promoted = 0;
    if (s.auto_assign_leads === true) { try { assigned = (await assignLeadsRoundRobin(300)).assigned; } catch {} }
    if (s.auto_promote === true) { try { promoted = (await autoPromoteAll()).promoted; } catch {} }
    return NextResponse.json({ ok: true, ...r, assigned, promoted });
  } catch (e: any) {
    await logError('cron_sales_payouts', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
