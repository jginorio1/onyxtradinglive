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

    // Guardian: cuántas cuentas lo tienen activo, y cuántas reportan ahora mismo
    const { data: cfgs } = await supabaseAdmin.from('manager_configs')
      .select('account_id').eq('enabled', true);
    const guardianOn = (cfgs || []).length;

    let eaLive = 0;
    if (guardianOn) {
      const ids = (cfgs || []).map((c: any) => c.account_id);
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('last_sync_at').in('id', ids);
      eaLive = (accs || []).filter((a: any) => a.last_sync_at && (now - new Date(a.last_sync_at).getTime()) < 120000).length;
    }

    // Telegram: cuántos usuarios lo tienen vinculado
    const { count: tgLinked } = await supabaseAdmin.from('profiles')
      .select('*', { count: 'exact', head: true }).not('telegram_chat_id', 'is', null);

    // Bloqueos que ha ejecutado el Guardian en total
    const { count: blocks } = await supabaseAdmin.from('manager_events')
      .select('*', { count: 'exact', head: true }).eq('kind', 'blocked');

    return NextResponse.json({
      guardian: { active: true, accounts: guardianOn, eaLive, blocks: blocks || 0 },
      telegram: { active: telegramEnabled(), linked: tgLinked || 0 },
      reports: { active: false },   // informes automáticos: aún pendiente
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
