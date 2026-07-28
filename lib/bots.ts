import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Módulo de bots. Agrupa las operaciones por magic number (el EA que las
// abrió) y calcula KPIs por estrategia, incluidas métricas avanzadas que miran
// los traders algorítmicos (Sharpe, Sortino, Calmar/MAR, SQN, payoff, duración
// del drawdown, exposición…), separando "En pruebas" de "En vivo".
// ============================================================

export type BotCriteria = { minDays: number; minTrades: number; pf: number; maxDD: number };
export const DEFAULT_CRITERIA: BotCriteria = { minDays: 30, minTrades: 100, pf: 1.3, maxDD: 10 };
export type BotBacktest = { pf?: number; winRate?: number; maxDD?: number; note?: string };

const isLiveAcc = (accType: string | null | undefined) => (accType || 'own') !== 'demo';
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const monthKey = (ms: number) => new Date(ms).toISOString().slice(0, 7);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

function mean(a: number[]) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
function std(a: number[]) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }
function downsideStd(a: number[]) { if (a.length < 2) return 0; const neg = a.map((x) => Math.min(0, x) ** 2); return Math.sqrt(neg.reduce((s, x) => s + x, 0) / (a.length - 1)); }

function drawdown(nets: number[]): { dd: number; ddPct: number } {
  let peak = 0, cum = 0, dd = 0, ddPct = 0;
  for (const n of nets) { cum += n; if (cum > peak) peak = cum; const d = peak - cum; if (d > dd) { dd = d; ddPct = peak > 0 ? (d / peak) * 100 : 0; } }
  return { dd, ddPct };
}

// Duración máxima "bajo el agua" (días entre un pico y su recuperación).
function ddDurationDays(pts: { t: number; cum: number }[]): number {
  if (pts.length < 2) return 0;
  let peak = -Infinity, peakT = pts[0].t, maxMs = 0, underFrom: number | null = null;
  for (const p of pts) {
    if (p.cum >= peak) { peak = p.cum; if (underFrom != null) { maxMs = Math.max(maxMs, p.t - underFrom); underFrom = null; } peakT = p.t; }
    else if (underFrom == null) underFrom = peakT;
  }
  if (underFrom != null) maxMs = Math.max(maxMs, pts[pts.length - 1].t - underFrom);
  return Math.round(maxMs / 86400000);
}

function spark(cumNets: number[], points = 24): number[] {
  if (cumNets.length <= points) return cumNets;
  const out: number[] = []; const step = (cumNets.length - 1) / (points - 1);
  for (let i = 0; i < points; i++) out.push(cumNets[Math.round(i * step)]);
  return out;
}

export async function loadBots(userId: string) {
  const { data: accs } = await supabaseAdmin
    .from('trading_accounts').select('id,acc_type,last_sync_at,nickname,login').eq('user_id', userId);
  const accList = accs || [];
  if (!accList.length) return { bots: [], hasData: false };
  const accById: Record<string, any> = {}; accList.forEach((a: any) => { accById[a.id] = a; });
  const accIds = accList.map((a: any) => a.id);

  const { data: trades, error } = await supabaseAdmin
    .from('trades').select('account_id,magic,ea_comment,net_profit,open_time,close_time')
    .in('account_id', accIds).not('magic', 'is', null).neq('magic', 0)
    .order('close_time', { ascending: true }).limit(30000);
  if (error) return { bots: [], hasData: false, needsMigration: true };

  const { data: opens } = await supabaseAdmin
    .from('open_positions').select('magic').in('account_id', accIds).not('magic', 'is', null).neq('magic', 0);
  const running = new Set((opens || []).map((o: any) => Number(o.magic)));

  const { data: cfgRows } = await supabaseAdmin.from('bots').select('magic,name,mode,criteria,backtest').eq('user_id', userId);
  const cfgByMagic: Record<string, any> = {};
  (cfgRows || []).forEach((c: any) => { cfgByMagic[String(c.magic)] = c; });

  const groups: Record<string, any[]> = {};
  (trades || []).forEach((t: any) => { const m = String(t.magic); (groups[m] = groups[m] || []).push(t); });

  const bots = Object.entries(groups).map(([magic, list]) => {
    const nets = list.map((t) => Number(t.net_profit || 0));
    const n = nets.length;
    const net = nets.reduce((s, x) => s + x, 0);
    const winsArr = nets.filter((x) => x > 0), lossArr = nets.filter((x) => x < 0);
    const wins = winsArr.length;
    const grossWin = winsArr.reduce((s, x) => s + x, 0), grossLoss = Math.abs(lossArr.reduce((s, x) => s + x, 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 99 : 0);
    const winRate = n ? (wins / n) * 100 : 0;
    const expectancy = n ? net / n : 0;
    const avgWin = wins ? grossWin / wins : 0;
    const avgLoss = lossArr.length ? grossLoss / lossArr.length : 0;
    const payoff = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 99 : 0);

    let cum = 0; const cumNets = nets.map((x) => (cum += x));
    const { dd, ddPct } = drawdown(nets);
    const recovery = dd > 0 ? net / dd : 0;

    // tiempos
    const closeMs = list.map((t) => new Date(t.close_time).getTime());
    const first = Math.min(...closeMs), last = Math.max(...closeMs);
    const days = Math.max(1, Math.round((last - first) / 86400000));
    const years = Math.max(days / 365, 1 / 365);
    const annualNet = net / years;
    const tradesPerDay = n / days;

    // Sharpe / Sortino a partir de retornos diarios (P&L por día, anualizado)
    const byDay: Record<string, number> = {};
    list.forEach((t, i) => { const k = dayKey(closeMs[i]); byDay[k] = (byDay[k] || 0) + nets[i]; });
    const daily: number[] = [];
    for (let d = new Date(dayKey(first)).getTime(); d <= last; d += 86400000) daily.push(byDay[dayKey(d)] || 0);
    const dMean = mean(daily), dStd = std(daily), dDown = downsideStd(daily);
    const sharpe = dStd > 0 ? (dMean / dStd) * Math.sqrt(252) : 0;
    const sortino = dDown > 0 ? (dMean / dDown) * Math.sqrt(252) : 0;

    // SQN (Van Tharp), tope 100 operaciones
    const tStd = std(nets), tMean = mean(nets);
    const sqn = tStd > 0 ? (tMean / tStd) * Math.sqrt(Math.min(n, 100)) : 0;

    // MAR / Calmar: retorno anualizado sobre drawdown
    const mar = dd > 0 ? annualNet / dd : 0;

    // duración del drawdown + máx pérdidas seguidas
    const ptsTC = list.map((t, i) => ({ t: closeMs[i], cum: cumNets[i] }));
    const ddDur = ddDurationDays(ptsTC);
    let curLoss = 0, maxLoss = 0; nets.forEach((x) => { if (x < 0) { curLoss++; maxLoss = Math.max(maxLoss, curLoss); } else curLoss = 0; });

    // % meses positivos
    const byMonth: Record<string, number> = {};
    list.forEach((t, i) => { const k = monthKey(closeMs[i]); byMonth[k] = (byMonth[k] || 0) + nets[i]; });
    const months = Object.values(byMonth); const monthsPos = months.length ? (months.filter((x) => x > 0).length / months.length) * 100 : 0;

    // exposición (% de tiempo con posición abierta) y hold medio
    let holdMs = 0; list.forEach((t, i) => { const o = new Date(t.open_time).getTime(); if (o && closeMs[i] > o) holdMs += closeMs[i] - o; });
    const spanMs = Math.max(1, last - first);
    const exposure = Math.min(100, (holdMs / spanMs) * 100);
    const avgHoldH = n ? (holdMs / n) / 3600000 : 0;

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

    // Vivo vs backtest esperado (si el usuario lo cargó): alarma de sobreajuste
    const bt: BotBacktest | null = cfg.backtest && (cfg.backtest.pf || cfg.backtest.winRate || cfg.backtest.maxDD) ? cfg.backtest : null;
    let divergence: any = null;
    if (bt && n >= 20) {
      const ratio = bt.pf ? pf / bt.pf : 1;
      const status = ratio < 0.7 ? 'diverge' : ratio < 0.9 ? 'watch' : 'ok';
      divergence = {
        status,
        pfLive: r2(pf), pfExp: bt.pf ? r2(bt.pf) : null,
        winLive: Math.round(winRate), winExp: bt.winRate ? Math.round(bt.winRate) : null,
        ddLive: r1(ddPct), ddExp: bt.maxDD ? r1(bt.maxDD) : null,
        deltaPct: bt.pf ? Math.round((ratio - 1) * 100) : null,
      };
    }

    const name = cfg.name || (list.find((t) => t.ea_comment)?.ea_comment) || `Bot #${magic}`;

    return {
      magic: Number(magic), name, mode,
      net: Math.round(net), trades: n, winRate: Math.round(winRate),
      pf: r2(pf), expectancy: r2(expectancy), dd: Math.round(dd), ddPct: r1(ddPct),
      recovery: r1(recovery), days, tradesPerDay: r1(tradesPerDay),
      running: running.has(Number(magic)), lastTrade: new Date(last).toISOString(),
      spark: spark(cumNets).map((x) => Math.round(x)),
      criteria, checks, passed, total: checks.length,
      backtest: bt, divergence,
      // métricas avanzadas
      metrics: {
        sharpe: r2(sharpe), sortino: r2(sortino), mar: r2(mar), payoff: r2(payoff), sqn: r2(sqn),
        ddDur, maxConsecLoss: maxLoss, monthsPos: Math.round(monthsPos),
        exposure: Math.round(exposure), avgHoldH: r1(avgHoldH), annualNet: Math.round(annualNet),
        avgWin: Math.round(avgWin), avgLoss: Math.round(avgLoss),
      },
    };
  }).sort((a, b) => b.net - a.net);

  return { bots, hasData: true };
}

// Correlación de Pearson entre dos vectores del mismo largo.
function pearson(a: number[], b: number[]): number {
  const n = a.length; if (n < 3) return 0;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  const den = Math.sqrt(da * db);
  return den > 0 ? Math.max(-1, Math.min(1, num / den)) : 0;
}

// Portafolio de los bots EN VIVO: matriz de correlación (retornos diarios) y
// curva combinada. Ayuda a ver diversificación real (dos bots muy correlados
// no diversifican; bajan juntos).
export async function loadPortfolio(userId: string) {
  const r = await loadBots(userId);
  const live = (r.bots || []).filter((b: any) => b.mode === 'live').slice(0, 10);
  if (live.length < 1) return { bots: [], matrix: [], curve: [], hasData: r.hasData };

  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', userId);
  const accIds = (accs || []).map((a: any) => a.id);
  const magics = live.map((b: any) => b.magic);
  const { data: trades } = await supabaseAdmin
    .from('trades').select('magic,net_profit,close_time')
    .in('account_id', accIds).in('magic', magics)
    .order('close_time', { ascending: true }).limit(30000);

  // día → { magic: net }
  const daysSet = new Set<string>();
  const byMagicDay: Record<string, Record<string, number>> = {};
  magics.forEach((m: number) => { byMagicDay[m] = {}; });
  (trades || []).forEach((t: any) => {
    const k = dayKey(new Date(t.close_time).getTime());
    daysSet.add(k);
    byMagicDay[t.magic][k] = (byMagicDay[t.magic][k] || 0) + Number(t.net_profit || 0);
  });
  const days = Array.from(daysSet).sort();

  const vectors = magics.map((m: number) => days.map((d) => byMagicDay[m][d] || 0));
  const matrix = magics.map((_m: number, i: number) => magics.map((_n: number, j: number) => i === j ? 1 : Math.round(pearson(vectors[i], vectors[j]) * 100) / 100));

  // curva combinada (suma de todos los bots en vivo)
  let cum = 0;
  const curve = days.map((d) => { cum += magics.reduce((s: number, m: number) => s + (byMagicDay[m][d] || 0), 0); return Math.round(cum); });

  return {
    bots: live.map((b: any) => ({ magic: b.magic, name: b.name, net: b.net })),
    matrix, curve: spark(curve, 40), hasData: true,
  };
}
