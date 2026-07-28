import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Módulo de bots. Agrupa las operaciones por magic number (el EA que las
// abrió) y calcula KPIs por estrategia, separando "En pruebas" (demo/forward)
// de "En vivo" (real/fondeo). Todo se apoya en las operaciones que ya sincroniza
// el Guardian; lo único nuevo es la etiqueta magic por operación.
// ============================================================

export type BotCriteria = { minDays: number; minTrades: number; pf: number; maxDD: number };
export const DEFAULT_CRITERIA: BotCriteria = { minDays: 30, minTrades: 100, pf: 1.3, maxDD: 10 };

const isLiveAcc = (accType: string | null | undefined) => (accType || 'own') !== 'demo';

// Drawdown máximo (en dinero y en % del pico) de una curva de net acumulado.
function drawdown(nets: number[]): { dd: number; ddPct: number } {
  let peak = 0, cum = 0, dd = 0, ddPct = 0;
  for (const n of nets) {
    cum += n;
    if (cum > peak) peak = cum;
    const d = peak - cum;
    if (d > dd) { dd = d; ddPct = peak > 0 ? (d / peak) * 100 : 0; }
  }
  return { dd, ddPct };
}

function spark(cumNets: number[], points = 24): number[] {
  if (cumNets.length <= points) return cumNets;
  const out: number[] = [];
  const step = (cumNets.length - 1) / (points - 1);
  for (let i = 0; i < points; i++) out.push(cumNets[Math.round(i * step)]);
  return out;
}

export async function loadBots(userId: string) {
  const { data: accs } = await supabaseAdmin
    .from('trading_accounts')
    .select('id,acc_type,last_sync_at,nickname,login')
    .eq('user_id', userId);
  const accList = accs || [];
  if (!accList.length) return { bots: [], hasData: false };
  const accById: Record<string, any> = {};
  accList.forEach((a: any) => { accById[a.id] = a; });
  const accIds = accList.map((a: any) => a.id);

  // Operaciones etiquetadas con un bot (magic != null y != 0)
  const { data: trades, error } = await supabaseAdmin
    .from('trades')
    .select('account_id,magic,ea_comment,net_profit,close_time')
    .in('account_id', accIds)
    .not('magic', 'is', null)
    .neq('magic', 0)
    .order('close_time', { ascending: true })
    .limit(30000);
  // Si la columna magic no existe todavía (bots.sql sin correr), devolvemos vacío.
  if (error) return { bots: [], hasData: false, needsMigration: true };

  // Posiciones abiertas por bot → saber cuáles están corriendo ahora
  const { data: opens } = await supabaseAdmin
    .from('open_positions').select('magic').in('account_id', accIds).not('magic', 'is', null).neq('magic', 0);
  const running = new Set((opens || []).map((o: any) => Number(o.magic)));

  // Config por bot (nombre, modo, criterios)
  const { data: cfgRows } = await supabaseAdmin.from('bots').select('magic,name,mode,criteria').eq('user_id', userId);
  const cfgByMagic: Record<string, any> = {};
  (cfgRows || []).forEach((c: any) => { cfgByMagic[String(c.magic)] = c; });

  // Agrupar por magic
  const groups: Record<string, any[]> = {};
  (trades || []).forEach((t: any) => {
    const m = String(t.magic);
    (groups[m] = groups[m] || []).push(t);
  });

  const bots = Object.entries(groups).map(([magic, list]) => {
    const nets = list.map((t) => Number(t.net_profit || 0));
    const n = nets.length;
    const net = nets.reduce((s, x) => s + x, 0);
    const wins = nets.filter((x) => x > 0).length;
    const grossWin = nets.filter((x) => x > 0).reduce((s, x) => s + x, 0);
    const grossLoss = Math.abs(nets.filter((x) => x < 0).reduce((s, x) => s + x, 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 99 : 0);
    const winRate = n ? (wins / n) * 100 : 0;
    const expectancy = n ? net / n : 0;
    let cum = 0; const cumNets = nets.map((x) => (cum += x));
    const { dd, ddPct } = drawdown(nets);
    const recovery = dd > 0 ? net / dd : 0;

    const times = list.map((t) => new Date(t.close_time).getTime()).filter(Boolean);
    const first = times.length ? Math.min(...times) : Date.now();
    const last = times.length ? Math.max(...times) : Date.now();
    const days = Math.max(1, Math.round((last - first) / 86400000));
    const tradesPerDay = n / days;

    // ¿en vivo? override manual, o auto: vivo si alguna operación es de cuenta real
    const cfg = cfgByMagic[magic] || {};
    const anyLive = list.some((t) => isLiveAcc(accById[t.account_id]?.acc_type));
    const mode: 'testing' | 'live' = cfg.mode === 'live' ? 'live' : cfg.mode === 'testing' ? 'testing' : (anyLive ? 'live' : 'testing');

    const criteria: BotCriteria = { ...DEFAULT_CRITERIA, ...(cfg.criteria || {}) };
    const checks = [
      { k: 'minDays', ok: days >= criteria.minDays },
      { k: 'minTrades', ok: n >= criteria.minTrades },
      { k: 'pf', ok: pf >= criteria.pf },
      { k: 'maxDD', ok: ddPct <= criteria.maxDD },
    ];
    const passed = checks.filter((c) => c.ok).length;

    const name = cfg.name || (list.find((t) => t.ea_comment)?.ea_comment) || `Bot #${magic}`;

    return {
      magic: Number(magic), name, mode,
      net: Math.round(net), trades: n, winRate: Math.round(winRate),
      pf: Math.round(pf * 100) / 100, expectancy: Math.round(expectancy * 100) / 100,
      dd: Math.round(dd), ddPct: Math.round(ddPct * 10) / 10, recovery: Math.round(recovery * 10) / 10,
      days, tradesPerDay: Math.round(tradesPerDay * 10) / 10,
      running: running.has(Number(magic)),
      lastTrade: new Date(last).toISOString(),
      spark: spark(cumNets).map((x) => Math.round(x)),
      criteria, checks, passed, total: checks.length,
    };
  }).sort((a, b) => b.net - a.net);

  return { bots, hasData: true };
}
