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

    // Operaciones totales analizadas (para la cifra del landing)
    const { count: tradesTotal } = await supabaseAdmin.from('trades')
      .select('*', { count: 'exact', head: true });

    // Base editable de las cifras del landing (lo que el admin fija a mano).
    // La cifra que se muestra = base + real, y sube en vivo con el uso.
    let lbase: any = { trades_base: 0, blocks_base: 0, accounts_base: 0, bots_built_base: 0, platforms: 4, readonly: 100, reviews: [], bot_ops_base: 0, bot_strat_base: 0, bot_traders_base: 0, bot_platforms: 3 };
    try {
      const { data: ls } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_stats').maybeSingle();
      if (ls?.value) lbase = {
        trades_base: Number(ls.value.trades_base || 0),
        blocks_base: Number(ls.value.blocks_base || 0),
        accounts_base: Number(ls.value.accounts_base || 0),
        bots_built_base: Number(ls.value.bots_built_base || 0),
        platforms: ls.value.platforms != null ? Number(ls.value.platforms) : 4,
        readonly: ls.value.readonly != null ? Number(ls.value.readonly) : 100,
        reviews: Array.isArray(ls.value.reviews) ? ls.value.reviews : [],
        bot_ops_base: Number(ls.value.bot_ops_base || 0),
        bot_strat_base: Number(ls.value.bot_strat_base || 0),
        bot_traders_base: Number(ls.value.bot_traders_base || 0),
        bot_platforms: ls.value.bot_platforms != null ? Number(ls.value.bot_platforms) : 3,
      };
    } catch {}
    // Robots construidos en el Constructor (para la cifra del landing).
    let realBotsBuilt = 0;
    try { const { count } = await supabaseAdmin.from('bots_built').select('*', { count: 'exact', head: true }); realBotsBuilt = Number(count || 0); } catch {}

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
      landing: { ...lbase, realTrades: tradesTotal || 0, realBlocks: blocks || 0, realAccounts: connected, realBotsBuilt },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// Guardar la base de las cifras del landing (Operaciones, Frenos, Cuentas).
// La cifra pública = base + real. Sirve para arrancar sin ceros y para destacar.
export async function PATCH(req: Request) {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('modulos', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json();
    // Conserva las claves existentes (ej. copied_base) y solo actualiza lo enviado.
    let cur: any = {};
    try { const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_stats').maybeSingle(); cur = data?.value || {}; } catch {}
    // Reseñas del landing: solo si vienen en el body. Se saneen a 6 máx.
    let reviews = Array.isArray(cur.reviews) ? cur.reviews : [];
    if (Array.isArray(b.reviews)) {
      reviews = b.reviews.slice(0, 6).map((r: any) => ({
        name: String(r?.name || '').slice(0, 60),
        result: String(r?.result || '').slice(0, 60),
        text: String(r?.text || '').slice(0, 280),
        stars: Math.max(1, Math.min(5, Math.round(Number(r?.stars) || 5))),
      })).filter((r: any) => r.name && r.text);
    }
    const value = {
      ...cur,
      trades_base: Math.max(0, Math.round(Number(b.trades_base) || 0)),
      blocks_base: Math.max(0, Math.round(Number(b.blocks_base) || 0)),
      accounts_base: Math.max(0, Math.round(Number(b.accounts_base) || 0)),
      bots_built_base: Math.max(0, Math.round(Number(b.bots_built_base) || 0)),
      platforms: Math.max(0, Math.round(Number(b.platforms != null ? b.platforms : 4))),
      readonly: Math.max(0, Math.min(100, Math.round(Number(b.readonly != null ? b.readonly : 100)))),
      reviews,
      bot_ops_base: Math.max(0, Math.round(Number(b.bot_ops_base) || 0)),
      bot_strat_base: Math.max(0, Math.round(Number(b.bot_strat_base) || 0)),
      bot_traders_base: Math.max(0, Math.round(Number(b.bot_traders_base) || 0)),
      bot_platforms: Math.max(0, Math.round(Number(b.bot_platforms != null ? b.bot_platforms : 3))),
    };
    await supabaseAdmin.from('app_settings').upsert({ key: 'landing_stats', value, updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
