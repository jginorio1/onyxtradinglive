import { NextResponse } from 'next/server';
import { autoPayPayrollDue } from '@/lib/payrollPayout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cron diario: si la nómina está en automático y hoy es el día de pago, arma la
// nómina del mes y paga por Stripe a quienes se pueda. Protegido por CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const url = new URL(req.url);
    if (auth !== `Bearer ${secret}` && url.searchParams.get('key') !== secret) {
      return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    }
  }
  try {
    const r = await autoPayPayrollDue();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
