import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { telegramEnabled } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Estado real de los módulos, para la pestaña Módulos del panel.
// Sin adornos: son los números que necesitas para gestionar de verdad.
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('modulos', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const now = Date.now();
    const isLive = (ts: any) => ts && (now - new Date(ts).getTime()) < 120000;

    // Todas las cuentas conectadas, y cuántas reportan ahora mismo (no solo las del Guardian)
    const { data: allAccs } = await supabaseAdmin.from('trading_accounts').select('last_sync_at');
    const connected = (allAccs || []).length;
    const liveNow = (allAccs || []).filter((a: any) => isLive(a.last_sync_at)).length;

    // Guardian: cuántas cuentas lo tienen activado en su config, y cuántas de esas reportan ahora
    const { data: cfgs } = await supabaseAdmin.from('manager_configs')
      .select('account_id').eq('enabled', true);
    const guardianOn = (cfgs || []).length;

    let eaLive = 0;
    if (guardianOn) {
      const ids = (cfgs || []).map((c: any) => c.account_id);
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('last_sync_at').in('id', ids);
      eaLive = (accs || []).filter((a: any) => isLive(a.last_sync_at)).length;
    }

    // Telegram: cuántos usuarios lo tienen vinculado
    const { count: tgLinked } = await supabaseAdmin.from('profiles')
      .select('*', { count: 'exact', head: true }).not('telegram_chat_id', 'is', null);

    // Bloqueos que ha ejecutado el Guardian en total
    const { count: blocks } = await supabaseAdmin.from('manager_events')
      .select('*', { count: 'exact', head: true }).eq('kind', 'blocked');

    // Métricas del registro de envíos (tolerante: 0 si telegram_log aún no existe)
    const since7d = new Date(now - 7 * 86400000).toISOString();
    const logCount = async (q: (t: any) => any): Promise<number> => {
      try { const { count } = await q(supabaseAdmin.from('telegram_log').select('*', { count: 'exact', head: true })); return count || 0; }
      catch { return 0; }
    };
    const tgSent7d = await logCount((t) => t.gte('created_at', since7d));
    const tgFailed7d = await logCount((t) => t.eq('ok', false).gte('created_at', since7d));
    const tgStatus = await logCount((t) => t.eq('kind', 'status'));
    const weeklySent = await logCount((t) => t.eq('kind', 'weekly'));

    // Elegibles para el informe semanal (tienen Telegram y el aviso semanal encendido)
    let weeklyEligible = 0;
    try {
      const { count } = await supabaseAdmin.from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('telegram_chat_id', 'is', null).eq('tg_weekly', true);
      weeklyEligible = count || 0;
    } catch {}

    return NextResponse.json({
      guardian: { active: true, connected, liveNow, accounts: guardianOn, eaLive, blocks: blocks || 0 },
      telegram: { active: telegramEnabled(), linked: tgLinked || 0, sent7d: tgSent7d, status: tgStatus, failed7d: tgFailed7d },
      reports: { active: true, sent: weeklySent, eligible: weeklyEligible },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
