import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Score — motor DETERMINISTA para calificar a un trader (copy marketplace).
// Cuatro pilares con pesos; la disciplina y el riesgo pesan MÁS que el retorno
// bruto, para premiar al trader sostenible y no al que apuesta. Los tiers se
// deciden con puertas duras (muestra mínima, drawdown, profit factor…), no con
// IA, para que nadie pueda "gamear" el ranking. Nunca predice el mercado.
// ============================================================

export type Tier = 'none' | 'silver' | 'gold' | 'diamond';
export type Pillars = { discipline: number; risk: number; performance: number; consistency: number };
export type ScoreStats = { trades: number; tradingDays: number; winRate: number; pf: number; rr: number; expectancy: number; maxDDpct: number; net: number };
export type ScoreResult = { score: number; tier: Tier; pillars: Pillars; stats: ScoreStats; reasons: string[]; flags: string[] };

const clamp = (x: number, a = 0, b = 100) => Math.max(a, Math.min(b, x));
const round = (x: number) => Math.round(x);
const r2 = (x: number) => Math.round(x * 100) / 100;

// Interpolación lineal por tramos: points = [[x,y]...] con x ascendente.
function ramp(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]; const [x1, y1] = points[i];
    if (x <= x1) { const tt = x1 === x0 ? 0 : (x - x0) / (x1 - x0); return y0 + tt * (y1 - y0); }
  }
  return points[points.length - 1][1];
}

// Puertas por tier (además del score). verified se exige para gold/diamond.
export const TIER_GATES = {
  silver:  { score: 60, trades: 20,  days: 20,  pf: 0,   maxDD: 15, verified: false },
  gold:    { score: 75, trades: 60,  days: 60,  pf: 1.3, maxDD: 12, verified: true },
  diamond: { score: 88, trades: 150, days: 120, pf: 1.5, maxDD: 10, verified: true },
} as const;

function tierFor(score: number, s: ScoreStats, verified: boolean, blockDiamond = false): { tier: Tier; reasons: string[] } {
  const order: Tier[] = ['diamond', 'gold', 'silver'];
  for (const tier of order) {
    if (tier === 'diamond' && blockDiamond) continue;   // regla de consistencia: un día no puede pesar demasiado
    const g = (TIER_GATES as any)[tier];
    if (score >= g.score && s.trades >= g.trades && s.tradingDays >= g.days && s.pf >= g.pf && s.maxDDpct <= g.maxDD && (!g.verified || verified)) {
      return { tier, reasons: [] };
    }
  }
  // ¿Qué falta para Silver? (para el panel del trader)
  const g = TIER_GATES.silver; const reasons: string[] = [];
  if (score < g.score) reasons.push(`score ${round(score)}/${g.score}`);
  if (s.trades < g.trades) reasons.push(`${s.trades}/${g.trades} ops`);
  if (s.tradingDays < g.days) reasons.push(`${s.tradingDays}/${g.days} días`);
  if (s.maxDDpct > g.maxDD) reasons.push(`drawdown ${r2(s.maxDDpct)}% > ${g.maxDD}%`);
  return { tier: 'none', reasons };
}

// Anti-gaming: detecta patrones peligrosos que un score "bonito" podría esconder.
//  · single_day   → un solo día concentra demasiada de la ganancia (suerte, no proceso).
//  · martingale   → win rate altísimo con R:R ínfimo (típico de martingala/grid).
//  · huge_loss    → la peor pérdida es enorme frente a la ganancia media.
//  · small_sample → muestra insuficiente para confiar.
export function riskFlags(stats: ScoreStats, g: { maxDayShare: number; biggestLossRatio: number }): string[] {
  const flags: string[] = [];
  if (g.maxDayShare > 0.4) flags.push('single_day');
  if (stats.winRate >= 80 && stats.rr > 0 && stats.rr < 0.4) flags.push('martingale');
  if (g.biggestLossRatio >= 3) flags.push('huge_loss');
  if (stats.trades < 20) flags.push('small_sample');
  return flags;
}

// Score puro a partir de KPIs + adherencia. Separado del IO para poder testear.
export function scoreFrom(stats: ScoreStats, adh: { adherence: number; gradeScore: number | null; docRatio: number; hasPlan: boolean; breaks: number }, guards: { maxDayShare?: number; flags?: string[] } = {}): { score: number; pillars: Pillars } {
  const flags = guards.flags || [];
  // Disciplina (30%): ¿sigue su plan? ¿califica sus trades? ¿tiene plan escrito?
  const discipline = clamp(100 * (0.5 * adh.adherence + 0.3 * (adh.gradeScore ?? 0.5) + 0.2 * adh.docRatio) + (adh.hasPlan ? 8 : 0));
  // Riesgo (25%): drawdown bajo manda; penaliza roturas de reglas documentadas.
  const riskBase = ramp(stats.maxDDpct, [[0, 100], [5, 90], [10, 70], [15, 45], [20, 20], [30, 0]]);
  const risk = clamp(riskBase - Math.min(20, adh.breaks * 2));
  // Rendimiento (25%): profit factor + R:R, ajustado (no retorno bruto). Si pierde, se limita.
  const perfPf = ramp(stats.pf, [[0.8, 20], [1.0, 45], [1.3, 68], [1.5, 82], [2.0, 95], [3, 100]]);
  const perfRr = ramp(stats.rr, [[0.5, 30], [1, 55], [1.5, 75], [2, 90], [3, 100]]);
  let performance = clamp(0.6 * perfPf + 0.4 * perfRr);
  if (stats.expectancy < 0) performance = Math.min(performance, 40);
  // Consistencia (20%): días operados + muestra. Recompensa la constancia.
  const consDays = ramp(stats.tradingDays, [[0, 0], [20, 45], [60, 75], [120, 92], [200, 100]]);
  const consN = ramp(stats.trades, [[0, 0], [20, 45], [60, 75], [150, 92], [300, 100]]);
  let consistency = clamp(0.5 * consDays + 0.5 * consN);

  // Anti-gaming: castiga los patrones peligrosos para que el ranking no premie
  // suerte ni martingala. Un día dominante hunde la consistencia; martingala y
  // pérdida atroz limitan el rendimiento.
  const share = guards.maxDayShare ?? 0;
  if (share > 0.4) consistency = Math.min(consistency, 45);
  else if (share > 0.3) consistency = Math.min(consistency, 65);
  if (flags.includes('martingale') || flags.includes('huge_loss')) performance = Math.min(performance, 55);

  const score = round(0.30 * discipline + 0.25 * risk + 0.25 * performance + 0.20 * consistency);
  return { score, pillars: { discipline: round(discipline), risk: round(risk), performance: round(performance), consistency: round(consistency) } };
}

// Calcula el Onyx Score de UNA cuenta (últimos ~180 días). Lee trades + diario +
// plan del trader. Tolerante: si algo falta, no rompe (score bajo).
export async function computeScoreForAccount(userId: string, accountId: string, opts: { verified?: boolean } = {}): Promise<ScoreResult> {
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const [accR, trR, jR, pR] = await Promise.all([
    supabaseAdmin.from('trading_accounts').select('balance').eq('id', accountId).eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('trades').select('net_profit,close_time').eq('account_id', accountId).gte('close_time', since).order('close_time', { ascending: true }).limit(50000),
    supabaseAdmin.from('trade_journal').select('grade,plan_followed,error_tags').eq('user_id', userId),
    supabaseAdmin.from('trading_plans').select('data').eq('user_id', userId).maybeSingle(),
  ]);
  const balance = Number((accR.data as any)?.balance) || 0;
  const rows = ((trR.data || []) as any[]).filter((t) => t.close_time);

  let net = 0, wins = 0, losses = 0, gw = 0, gl = 0, eq = 0, peak = 0, maxDD = 0, biggestLoss = 0;
  const days = new Set<string>();
  const byDay: Record<string, number> = {};   // net por día (regla de consistencia)
  for (const t of rows) {
    const p = Number(t.net_profit) || 0; net += p; eq += p;
    if (eq > peak) peak = eq; if (peak - eq > maxDD) maxDD = peak - eq;
    if (p > 0) { wins++; gw += p; } else if (p < 0) { losses++; gl += Math.abs(p); if (p < biggestLoss) biggestLoss = p; }
    const d = String(t.close_time).slice(0, 10);
    days.add(d); byDay[d] = (byDay[d] || 0) + p;
  }
  const n = rows.length;
  const winRate = wins + losses ? wins / (wins + losses) : 0;
  const pf = gl ? gw / gl : (gw > 0 ? 3 : 0);
  const avgWin = wins ? gw / wins : 0, avgLoss = losses ? gl / losses : 0;
  const rr = avgLoss ? avgWin / avgLoss : 0;
  const expectancy = n ? net / n : 0;
  const maxDDpct = balance > 0 ? (maxDD / balance) * 100 : (peak > 0 ? (maxDD / peak) * 100 : 0);
  const stats: ScoreStats = { trades: n, tradingDays: days.size, winRate: Math.round(winRate * 100), pf: r2(pf), rr: r2(rr), expectancy: r2(expectancy), maxDDpct: r2(maxDDpct), net: r2(net) };

  // Concentración: ¿un solo día aporta demasiada de la ganancia total positiva?
  const posDays = Object.values(byDay).filter((v) => v > 0);
  const totalPos = posDays.reduce((s, v) => s + v, 0);
  const maxDayShare = totalPos > 0 ? Math.max(...posDays, 0) / totalPos : 0;
  const biggestLossRatio = avgWin > 0 ? Math.abs(biggestLoss) / avgWin : 0;
  const flags = riskFlags(stats, { maxDayShare, biggestLossRatio });

  // Adherencia desde el diario del trader.
  const j = (jR.data || []) as any[];
  const documented = j.filter((e) => e.plan_followed || e.grade);
  const planRated = j.filter((e) => ['yes', 'partial', 'no'].includes(e.plan_followed));
  const planYes = planRated.filter((e) => e.plan_followed === 'yes').length;
  const partial = planRated.filter((e) => e.plan_followed === 'partial').length;
  const adherence = planRated.length ? (planYes + 0.5 * partial) / planRated.length : (documented.length ? 0.5 : 0);
  const graded = j.filter((e) => e.grade);
  const gmap: any = { A: 1, B: 0.6, C: 0.25 };
  const gradeScore = graded.length ? graded.reduce((s, e) => s + (gmap[e.grade] || 0), 0) / graded.length : null;
  const breaks = j.reduce((s, e) => s + ((Array.isArray(e.error_tags) && e.error_tags.length) ? 1 : 0), 0);
  const docRatio = n ? Math.min(1, documented.length / Math.max(1, Math.min(n, 50))) : 0;
  const hasPlan = !!((pR.data as any)?.data);

  const { score, pillars } = scoreFrom(stats, { adherence, gradeScore, docRatio, hasPlan, breaks }, { maxDayShare, flags });
  const { tier, reasons } = tierFor(score, stats, !!opts.verified, maxDayShare > 0.3);
  return { score, tier, pillars, stats, reasons, flags };
}

// Etiqueta pública del tier.
export function tierLabel(t: Tier, lang: 'es' | 'en' = 'es'): string {
  const map: Record<Tier, string> = { none: lang === 'es' ? 'En evaluación' : 'In review', silver: 'Onyx Silver', gold: 'Onyx Gold', diamond: 'Onyx Diamond' };
  return map[t] || map.none;
}
