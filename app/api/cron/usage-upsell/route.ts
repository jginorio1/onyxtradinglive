import { NextResponse } from 'next/server';
import { usageUpsellSweep } from '@/lib/usage';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Aviso "un plan te sale más barato" para usuarios del plan gratis que este mes
// ya gastaron por uso más de lo que costaría el plan más barato. Envía push +
// campana (plantilla 'usage_upsell' en Admin → Notificaciones) y email (plantilla
// 'usage_upsell' en Admin → Correos). Idempotente por mes. Córrelo a mitad de mes
// (Vercel Cron). Protegido con CRON_SECRET.
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
    const r = await usageUpsellSweep();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_usage_upsell', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
