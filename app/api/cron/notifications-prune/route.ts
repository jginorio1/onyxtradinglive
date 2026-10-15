import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Limpieza de la campanita: una vez que el trader YA LA VIO (read_at puesto),
// la notificación desaparece sola a las ~24 h. Así la bandeja se mantiene limpia
// sin riesgo de perder algo por un toque accidental (tiene un día de margen).
// Además borra las MUY viejas sin leer (90 días) para no acumular basura.
// Corre cada hora (vercel.json). Protegido con CRON_SECRET.
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
    const now = Date.now();
    const read24h = new Date(now - 24 * 3600 * 1000).toISOString();
    const old90d = new Date(now - 90 * 864e5).toISOString();

    // Leídas con más de 24 h → fuera.
    let readDeleted = 0;
    try {
      const { data } = await supabaseAdmin.from('notifications')
        .delete().not('read_at', 'is', null).lt('read_at', read24h).select('id');
      readDeleted = (data || []).length;
    } catch (e) { await logError('notifications_prune_read', e); }

    // Sin leer pero muy viejas (90 días) → fuera también.
    let oldDeleted = 0;
    try {
      const { data } = await supabaseAdmin.from('notifications')
        .delete().is('read_at', null).lt('created_at', old90d).select('id');
      oldDeleted = (data || []).length;
    } catch (e) { await logError('notifications_prune_old', e); }

    return NextResponse.json({ ok: true, readDeleted, oldDeleted });
  } catch (e: any) {
    await logError('notifications_prune', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
