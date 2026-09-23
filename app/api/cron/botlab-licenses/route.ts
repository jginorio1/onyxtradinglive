import { NextResponse } from 'next/server';
import { expireLapsedLicenses } from '@/lib/botLicense';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Vence las licencias de renta cuya vigencia ya pasó (USDT mensual o cualquier
// suscripción no renovada). Los robots de pago único NO tienen vigencia, así que
// nunca se tocan. Protegido con CRON_SECRET.
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
    const expired = await expireLapsedLicenses();
    return NextResponse.json({ ok: true, expired });
  } catch (e: any) {
    await logError('botlab_licenses_cron', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
