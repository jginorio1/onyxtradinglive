import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitNotif, loadNotifConfig } from '@/lib/emitNotif';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Recordatorio diario del check-in de "Mi plan y hábitos": a quien usa el plan y
// aún NO ha hecho el check-in de hoy, para no perder la racha. Campana + Telegram
// (si lo tiene vinculado). Protegido con CRON_SECRET.
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
    const { data: plans } = await supabaseAdmin.from('trading_plans').select('user_id');
    const planIds = (plans || []).map((p: any) => p.user_id);
    if (!planIds.length) return NextResponse.json({ ok: true, sent: 0 });

    const today = new Date().toISOString().slice(0, 10);
    const { data: done } = await supabaseAdmin.from('plan_checkins').select('user_id').eq('day', today).in('user_id', planIds);
    const doneSet = new Set((done || []).map((d: any) => d.user_id));
    const pending = planIds.filter((id: string) => !doneSet.has(id));
    if (!pending.length) return NextResponse.json({ ok: true, sent: 0 });

    // Idioma de cada uno para el aviso.
    const { data: profs } = await supabaseAdmin.from('profiles').select('id,lang').in('id', pending);
    const langOf: Record<string, string> = {};
    (profs || []).forEach((p: any) => { langOf[p.id] = p.lang === 'es' ? 'es' : 'en'; });

    // Config de notificaciones (textos + canales que dejó el dueño), una vez.
    const cfg = await loadNotifConfig();
    let sent = 0;
    for (const uid of pending) {
      await emitNotif(uid, 'checkin', { lang: langOf[uid], cfg });
      sent++;
    }
    return NextResponse.json({ ok: true, sent });
  } catch (e: any) {
    await logError('checkin_reminder', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
