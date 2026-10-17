import { NextResponse } from 'next/server';
import { monthlyAccountChargeAll } from '@/lib/usage';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Cobro mensual de CUENTAS EXTRA del plan gratis (pago por uso). Cobra del saldo
// una vez por mes por cada cuenta que exceda el incluido gratis. Idempotente por
// (usuario, periodo). Córrelo el día 1 de cada mes (Vercel Cron). CRON_SECRET.
// ============================================================
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
    const r = await monthlyAccountChargeAll();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_usage_accounts', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
