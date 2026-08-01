import { NextResponse } from 'next/server';
import { cleanUnconfirmed } from '@/lib/cleanSignups';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Borra a diario las cuentas sin confirmar de más de 7 días (bots / abandonadas).
// Protegido con CRON_SECRET, igual que los demás cron.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const days = Number(new URL(req.url).searchParams.get('days')) || 7;
  const r = await cleanUnconfirmed(days, false);
  return NextResponse.json({ ok: true, ...r });
}
