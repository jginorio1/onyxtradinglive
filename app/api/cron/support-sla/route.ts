import { NextResponse } from 'next/server';
import { runSupportSla } from '@/lib/supportSla';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// SLA de soporte (cada 15 min). Recordatorio + auto-cierre al cliente inactivo,
// y aviso + marca de vencido cuando el equipo tarda en responder.
// Protegido con CRON_SECRET (igual que el resto de crons).
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
    const dry = new URL(req.url).searchParams.get('dry') === '1';
    const r = await runSupportSla(dry);
    return NextResponse.json({ ok: true, dry, ...r });
  } catch (e: any) {
    await logError('support_sla', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
