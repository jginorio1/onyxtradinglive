import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeDaySnapshot } from '@/lib/tradingPlan';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

// Guarda la foto del cumplimiento del plan del día ANTERIOR (ya cerrado) para
// tener historial estable (mapa de 30 días, adherencia del mes). Protegido con
// CRON_SECRET. Idempotente: si se re-ejecuta, actualiza la misma fila.
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    // Se puede pasar ?day=YYYY-MM-DD; por defecto, ayer (UTC).
    const q = new URL(req.url).searchParams.get('day');
    const day = q || new Date(Date.now() - 864e5).toISOString().slice(0, 10);

    const { data: plans } = await supabaseAdmin.from('trading_plans').select('user_id');
    const ids = (plans || []).map((p: any) => p.user_id);
    let saved = 0;
    for (const uid of ids) {
      try {
        const snap = await computeDaySnapshot(uid, day);
        await supabaseAdmin.from('plan_daily').upsert({ user_id: uid, day, ...snap }, { onConflict: 'user_id,day' });
        saved++;
      } catch { /* un usuario que falle no frena el resto */ }
    }
    return NextResponse.json({ ok: true, day, users: ids.length, saved });
  } catch (e: any) {
    await logError('plan_daily', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
