import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ⛔️ DESACTIVADO. Este cron viejo mandaba el check-in a TODOS a una hora fija,
// sin respetar la hora local que cada trader configuró. Fue reemplazado por
// /api/cron/checkin-tick, que corre cada 15 min y envía a cada usuario a su hora
// local (checkin_at / checkout_at), con dedup por día.
//
// Lo dejamos como no-op para que, si algún programador externo todavía llama a
// esta URL (p. ej. cron-job.org), NO vuelva a mandar un recordatorio duplicado.
// No borramos la ruta para no romper ese programador: simplemente ya no envía nada.
export async function GET() {
  return NextResponse.json({ ok: true, sent: 0, disabled: true, use: '/api/cron/checkin-tick' });
}
