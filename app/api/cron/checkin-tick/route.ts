import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitNotif, loadNotifConfig } from '@/lib/emitNotif';
import { wallClock, timeReached, DEFAULT_TZ, DEFAULT_CHECKIN, DEFAULT_CHECKOUT } from '@/lib/routine';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Check-in (mañana) y Check-out (noche) en la HORA LOCAL de cada trader.
// Corre cada 15 min: a cada usuario con plan le envía su recordatorio cuando su reloj
// local ya pasó la hora que eligió y aún no se le mandó hoy (dedup por día local en
// profiles.checkin_sent_on / checkout_sent_on). Si ya hizo el check-in hoy, no molesta.
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
    const planIds = Array.from(new Set((plans || []).map((p: any) => p.user_id).filter(Boolean)));
    if (!planIds.length) return NextResponse.json({ ok: true, checkin: 0, checkout: 0 });

    // Perfiles con su zona, horas y último envío + idioma.
    const { data: profs } = await supabaseAdmin.from('profiles')
      .select('id,lang,tz,checkin_at,checkout_at,checkin_sent_on,checkout_sent_on')
      .in('id', planIds);

    // Quién ya hizo check-in hoy (se guarda por día UTC; cubrimos UTC de hoy y ayer
    // para no molestar a quien ya lo marcó, sin importar su desfase horario).
    const now = new Date();
    const utcToday = now.toISOString().slice(0, 10);
    const utcYday = new Date(now.getTime() - 864e5).toISOString().slice(0, 10);
    const doneSet = new Set<string>();
    try {
      const { data: done } = await supabaseAdmin.from('plan_checkins').select('user_id,day').in('user_id', planIds).gte('day', utcYday);
      (done || []).forEach((d: any) => { if (d.day === utcToday || d.day === utcYday) doneSet.add(d.user_id); });
    } catch {}

    const cfg = await loadNotifConfig();
    let ci = 0, co = 0;
    for (const p of (profs || []) as any[]) {
      const tz = p.tz || DEFAULT_TZ;
      const { hhmm, date: localToday } = wallClock(tz, now);
      const lang = p.lang === 'en' ? 'en' : 'es';
      const checkinAt = p.checkin_at || DEFAULT_CHECKIN;
      const checkoutAt = p.checkout_at || DEFAULT_CHECKOUT;
      const didToday = doneSet.has(p.id);

      // Check-in de la mañana
      if (p.checkin_sent_on !== localToday && timeReached(hhmm, checkinAt) && !didToday) {
        try { await emitNotif(p.id, 'checkin', { lang, cfg }); } catch {}
        try { await supabaseAdmin.from('profiles').update({ checkin_sent_on: localToday }).eq('id', p.id); } catch {}
        ci++;
      }
      // Check-out de la noche
      if (p.checkout_sent_on !== localToday && timeReached(hhmm, checkoutAt) && !didToday) {
        try { await emitNotif(p.id, 'checkin_evening', { lang, cfg }); } catch {}
        try { await supabaseAdmin.from('profiles').update({ checkout_sent_on: localToday }).eq('id', p.id); } catch {}
        co++;
      }
    }
    return NextResponse.json({ ok: true, checkin: ci, checkout: co });
  } catch (e: any) {
    await logError('checkin_tick', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
