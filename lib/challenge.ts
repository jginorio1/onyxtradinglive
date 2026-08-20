import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mergeConfig } from '@/lib/manager';

// ============================================================
// "Mi reto": marcador en vivo de las reglas de prop firm.
// SOLO MIDE (no bloquea; el bloqueo es de Onyx Guardian → limits).
//
// Reglas de pérdida (diaria/total) → se leen de config.limits.
// Objetivo / días mínimos / consistencia / fin de semana → de config.challenge.
// Todo es una estimación honesta: depende de que el trader cargue bien las
// reglas de SU contrato. Nunca es la norma oficial de la firma.
// ============================================================

export type RuleStatus = 'ok' | 'watch' | 'breach' | 'na';
export type ChallengeRule = {
  key: string;
  status: RuleStatus;
  es: string; en: string;      // etiqueta
  valEs: string; valEn: string; // valor legible
  pct: number;                  // 0..100 para la barra
};
export type Scoreboard = {
  accountId: string;
  login: any;
  name: string;
  firm: string;
  verdict: 'on_track' | 'watch' | 'breach';
  rules: ChallengeRule[];
  closest?: { es: string; en: string };
  lines: string[];             // resumen compacto en inglés para el panel del EA
};

const m2 = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

// Núcleo puro: dados los números, arma el marcador.
export function computeChallenge(input: {
  accountId: string; login: any; name: string;
  initial: number; equity: number; balance: number;
  dayStartBalance: number; dayStartEquity: number;
  cfg: any;
  daysTraded: number; bestDayProfit: number; totalProfit: number;
  safetyPct: number;
}): Scoreboard {
  const { cfg } = input;
  const lim = cfg.limits || {};
  const ch = cfg.challenge || {};
  const initial = input.initial || input.balance || 0;
  const equity = input.equity || input.balance || 0;
  const base = lim.base === 'initial_balance' ? initial
    : lim.base === 'day_start_equity' ? (input.dayStartEquity || equity)
    : (input.dayStartBalance || input.balance || initial);
  const safety = Math.max(0, Math.min(90, input.safetyPct ?? 20)) / 100;

  const rules: ChallengeRule[] = [];
  const near: { pct: number; es: string; en: string }[] = [];

  // --- Pérdida diaria ---
  const dlMoney = lim.daily_loss ? (lim.daily_loss_pct ? base * lim.daily_loss / 100 : lim.daily_loss) : 0;
  if (dlMoney > 0) {
    const dayPL = equity - (input.dayStartBalance || input.balance || initial);
    const used = Math.max(0, -dayPL);
    const remaining = dlMoney - used;
    const frac = Math.max(0, remaining / dlMoney);            // colchón que queda (1 = intacto)
    const status: RuleStatus = remaining <= 0 ? 'breach' : frac <= safety ? 'watch' : 'ok';
    rules.push({
      key: 'daily_loss', status,
      es: 'Pérdida diaria', en: 'Daily loss',
      valEs: `quedan ${m2(Math.max(0, remaining))} de ${m2(dlMoney)}`,
      valEn: `${m2(Math.max(0, remaining))} left of ${m2(dlMoney)}`,
      pct: Math.round((used / dlMoney) * 100),
    });
    near.push({ pct: frac, es: 'pérdida diaria', en: 'daily loss' });
  }

  // --- Pérdida máxima total ---
  const tlMoney = lim.total_loss ? (lim.total_loss_pct ? initial * lim.total_loss / 100 : lim.total_loss) : 0;
  if (tlMoney > 0) {
    const floor = initial - tlMoney;
    const buffer = equity - floor;
    const frac = Math.max(0, buffer / tlMoney);
    const status: RuleStatus = buffer <= 0 ? 'breach' : frac <= safety ? 'watch' : 'ok';
    rules.push({
      key: 'total_loss', status,
      es: 'Pérdida máxima total', en: 'Max total loss',
      valEs: `quedan ${m2(Math.max(0, buffer))} antes de ${m2(floor)}`,
      valEn: `${m2(Math.max(0, buffer))} left before ${m2(floor)}`,
      pct: Math.round((1 - frac) * 100),
    });
    near.push({ pct: frac, es: 'pérdida máxima', en: 'max loss' });
  }

  // --- Objetivo de ganancia ---
  const tgMoney = ch.profit_target ? (ch.profit_target_pct ? initial * ch.profit_target / 100 : ch.profit_target) : 0;
  const profit = equity - initial;
  if (tgMoney > 0) {
    const progress = Math.max(0, Math.min(1, profit / tgMoney));
    const status: RuleStatus = profit >= tgMoney ? 'ok' : 'na';
    rules.push({
      key: 'target', status,
      es: 'Objetivo de ganancia', en: 'Profit target',
      valEs: `${m2(Math.max(0, profit))} de ${m2(tgMoney)} · ${Math.round(progress * 100)}%`,
      valEn: `${m2(Math.max(0, profit))} of ${m2(tgMoney)} · ${Math.round(progress * 100)}%`,
      pct: Math.round(progress * 100),
    });
  }

  // --- Días mínimos ---
  if (ch.min_days > 0) {
    const done = input.daysTraded;
    const status: RuleStatus = done >= ch.min_days ? 'ok' : 'na';
    rules.push({
      key: 'min_days', status,
      es: 'Días operados', en: 'Trading days',
      valEs: `${done} de ${ch.min_days} mínimos`, valEn: `${done} of ${ch.min_days} min`,
      pct: Math.round(Math.min(1, done / ch.min_days) * 100),
    });
  }

  // --- Consistencia ---
  if (ch.consistency > 0) {
    if (profit > 0 && input.bestDayProfit > 0) {
      const share = Math.round((input.bestDayProfit / profit) * 100);
      const status: RuleStatus = share > ch.consistency ? 'watch' : 'ok';
      rules.push({
        key: 'consistency', status,
        es: 'Consistencia', en: 'Consistency',
        valEs: `mejor día ${share}% · máx ${ch.consistency}%`, valEn: `best day ${share}% · max ${ch.consistency}%`,
        pct: Math.round(Math.min(1, share / ch.consistency) * 100),
      });
    } else {
      rules.push({ key: 'consistency', status: 'na', es: 'Consistencia', en: 'Consistency', valEs: `máx ${ch.consistency}%`, valEn: `max ${ch.consistency}%`, pct: 0 });
    }
  }

  // --- Fin de semana (informativa) ---
  if (ch.no_weekend_hold) {
    rules.push({ key: 'weekend', status: 'ok', es: 'Sin posiciones el finde', en: 'Flat on weekend', valEs: 'debes cerrar el viernes', valEn: 'close before weekend', pct: 0 });
  }

  const verdict: Scoreboard['verdict'] =
    rules.some((r) => r.status === 'breach') ? 'breach'
    : rules.some((r) => r.status === 'watch') ? 'watch'
    : 'on_track';

  near.sort((a, b) => a.pct - b.pct);
  const closest = near[0] ? { es: near[0].es, en: near[0].en } : undefined;

  // Resumen compacto para el panel del EA (inglés, idioma por defecto de la EA)
  const lines = rules.filter((r) => r.status !== 'na').map((r) => `${r.en}: ${r.valEn}`);

  return { accountId: input.accountId, login: input.login, name: input.name, firm: ch.firm || 'custom', verdict, rules, closest, lines };
}

// Trae los datos de una cuenta y calcula su marcador. null si no aplica.
export async function loadChallenge(userId: string, accountId: string): Promise<Scoreboard | null> {
  const { data: acc } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname,balance,equity,acc_size').eq('id', accountId).eq('user_id', userId).maybeSingle();
  if (!acc) return null;

  const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('config').eq('account_id', accountId).maybeSingle();
  const cfg = mergeConfig(cfgRow?.config);
  if (!cfg.challenge?.on) return null;

  const { data: st } = await supabaseAdmin.from('manager_state')
    .select('day_start_balance,day_start_equity,initial_balance').eq('account_id', accountId).maybeSingle();

  const initial = Number(st?.initial_balance || acc.acc_size || acc.balance || 0);

  // Trades cerrados para días operados, mejor día y ganancia total
  const { data: trades } = await supabaseAdmin.from('trades')
    .select('net_profit,close_time').eq('account_id', accountId).not('close_time', 'is', null).limit(5000);
  const byDay: Record<string, number> = {};
  let totalProfit = 0;
  (trades || []).forEach((t: any) => {
    const np = Number(t.net_profit || 0);
    totalProfit += np;
    const d = new Date(t.close_time).toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + np;
  });
  const daysTraded = Object.keys(byDay).length;
  const bestDayProfit = Object.values(byDay).reduce((mx, v) => Math.max(mx, v), 0);

  return computeChallenge({
    accountId: acc.id, login: acc.login, name: acc.nickname || String(acc.login),
    initial, equity: Number(acc.equity ?? acc.balance ?? 0), balance: Number(acc.balance ?? 0),
    dayStartBalance: Number(st?.day_start_balance ?? acc.balance ?? 0),
    dayStartEquity: Number(st?.day_start_equity ?? acc.equity ?? acc.balance ?? 0),
    cfg, daysTraded, bestDayProfit, totalProfit,
    safetyPct: Number(cfg.limits?.safety_margin ?? 20),
  });
}

// Marcadores de todas las cuentas del usuario que tengan el reto encendido.
export async function loadAllChallenges(userId: string): Promise<Scoreboard[]> {
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', userId).order('created_at', { ascending: true });
  const out: Scoreboard[] = [];
  for (const a of (accs || [])) {
    const sb = await loadChallenge(userId, (a as any).id);
    if (sb) out.push(sb);
  }
  return out;
}
