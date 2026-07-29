import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Mi plan y hábitos. El plan lo escribe el trader (cualquier estilo); el Guardian
// impone las reglas duras en el EA. Aquí medimos la ADHERENCIA: hábitos diarios +
// disciplina real (según las operaciones) y una racha. La IA lo repasa.
// ============================================================

export type Plan = {
  style: string;             // day | scalper | swing | funded | crypto | custom
  risk_per_trade: number;    // % del balance
  max_daily_loss_pct: number;
  max_trades_day: number;    // 0 = sin límite
  sessions: string[];        // asia | london | ny
  pairs: string;             // texto libre (los del trader)
  goal: string;              // objetivo, en palabras del trader
  rules: string[];           // reglas propias (texto libre)
  habits: string[];          // claves de hábitos que quiere seguir
};

// Hábitos disponibles (claves estables; las etiquetas bilingües viven en la UI).
export const HABIT_KEYS = ['reviewed_calendar', 'defined_risk', 'followed_plan', 'journaled', 'stopped_at_limit', 'no_revenge', 'respected_sessions'];

export const DEFAULT_PLAN: Plan = {
  style: 'day', risk_per_trade: 1, max_daily_loss_pct: 3, max_trades_day: 3,
  sessions: ['london', 'ny'], pairs: '', goal: '', rules: [],
  habits: ['reviewed_calendar', 'defined_risk', 'followed_plan', 'journaled', 'no_revenge'],
};

const DAY = 864e5;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export async function getPlan(userId: string): Promise<Plan> {
  const { data } = await supabaseAdmin.from('trading_plans').select('data').eq('user_id', userId).maybeSingle();
  return { ...DEFAULT_PLAN, ...((data as any)?.data || {}) };
}
export async function savePlan(userId: string, plan: Partial<Plan>) {
  const cur = await getPlan(userId);
  const next: Plan = {
    style: String(plan.style ?? cur.style).slice(0, 20),
    risk_per_trade: clamp(Number(plan.risk_per_trade ?? cur.risk_per_trade), 0, 100),
    max_daily_loss_pct: clamp(Number(plan.max_daily_loss_pct ?? cur.max_daily_loss_pct), 0, 100),
    max_trades_day: clamp(Math.round(Number(plan.max_trades_day ?? cur.max_trades_day)), 0, 500),
    sessions: Array.isArray(plan.sessions) ? plan.sessions.slice(0, 5) : cur.sessions,
    pairs: String(plan.pairs ?? cur.pairs).slice(0, 300),
    goal: String(plan.goal ?? cur.goal).slice(0, 400),
    rules: Array.isArray(plan.rules) ? plan.rules.map((r) => String(r).slice(0, 160)).slice(0, 15) : cur.rules,
    habits: Array.isArray(plan.habits) ? plan.habits.filter((h) => HABIT_KEYS.includes(h)) : cur.habits,
  };
  await supabaseAdmin.from('trading_plans').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() });
  return next;
}
function clamp(n: number, lo: number, hi: number) { return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; }

export async function getCheckin(userId: string, day = dayStr(new Date())) {
  const { data } = await supabaseAdmin.from('plan_checkins').select('items,note').eq('user_id', userId).eq('day', day).maybeSingle();
  return { items: (data as any)?.items || {}, note: (data as any)?.note || '' };
}
export async function saveCheckin(userId: string, items: Record<string, boolean>, note = '') {
  const day = dayStr(new Date());
  await supabaseAdmin.from('plan_checkins').upsert({ user_id: userId, day, items, note: String(note).slice(0, 500), created_at: new Date().toISOString() });
}

async function accountIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', userId);
  return (data || []).map((a: any) => a.id);
}

export type PlanStats = {
  adherence: number; streak: number; checkinRate: number; tradeDiscipline: number;
  overtradingDays: number; winRateRespect: number | null; winRateBroken: number | null; days: number;
};

// Calcula racha y adherencia. Mezcla el cumplimiento de hábitos (check-ins) con la
// disciplina real de las operaciones (respetar el máximo de operaciones por día).
export async function computeStats(userId: string, plan: Plan): Promise<PlanStats> {
  const enabled = plan.habits.length || 1;

  // --- Check-ins de los últimos 14 días ---
  const from = dayStr(new Date(Date.now() - 14 * DAY));
  const { data: checks } = await supabaseAdmin.from('plan_checkins').select('day,items').eq('user_id', userId).gte('day', from).order('day', { ascending: false });
  const byDay: Record<string, number> = {};   // completion 0..1 por día
  for (const c of (checks || []) as any[]) {
    const items = c.items || {};
    const done = plan.habits.filter((h) => items[h]).length;
    byDay[c.day] = done / enabled;
  }
  const vals = Object.values(byDay);
  const checkinRate = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  // Racha: días consecutivos (desde hoy o ayer) con check-in "bueno" (≥80%).
  let streak = 0;
  const today = new Date();
  const todayDone = (byDay[dayStr(today)] || 0) >= 0.8;
  let cursor = new Date(today);
  if (!todayDone) cursor = new Date(today.getTime() - DAY); // si hoy aún no, cuenta desde ayer
  for (let i = 0; i < 60; i++) {
    const key = dayStr(cursor);
    if ((byDay[key] || 0) >= 0.8) { streak++; cursor = new Date(cursor.getTime() - DAY); }
    else break;
  }

  // --- Disciplina real por operaciones (últimos 21 días) ---
  let tradeDiscipline = 1, overtradingDays = 0, winRateRespect: number | null = null, winRateBroken: number | null = null, tradingDays = 0;
  const ids = await accountIds(userId);
  if (ids.length) {
    const since = new Date(Date.now() - 21 * DAY).toISOString();
    const { data: trades } = await supabaseAdmin.from('trades').select('net_profit,close_time').in('account_id', ids).gte('close_time', since).limit(20000);
    const perDay: Record<string, { n: number; wins: number }> = {};
    for (const t of (trades || []) as any[]) {
      if (!t.close_time) continue;
      const d = String(t.close_time).slice(0, 10);
      (perDay[d] ||= { n: 0, wins: 0 });
      perDay[d].n++; if (Number(t.net_profit) > 0) perDay[d].wins++;
    }
    const dayKeys = Object.keys(perDay);
    tradingDays = dayKeys.length;
    if (tradingDays && plan.max_trades_day > 0) {
      let respected = 0, rW = 0, rN = 0, bW = 0, bN = 0;
      for (const k of dayKeys) {
        const { n, wins } = perDay[k];
        if (n <= plan.max_trades_day) { respected++; rW += wins; rN += n; }
        else { overtradingDays++; bW += wins; bN += n; }
      }
      tradeDiscipline = respected / tradingDays;
      winRateRespect = rN ? Math.round((rW / rN) * 100) : null;
      winRateBroken = bN ? Math.round((bW / bN) * 100) : null;
    }
  }

  const adherence = Math.round((checkinRate * 0.6 + tradeDiscipline * 0.4) * 100);
  return { adherence, streak, checkinRate: Math.round(checkinRate * 100), tradeDiscipline: Math.round(tradeDiscipline * 100), overtradingDays, winRateRespect, winRateBroken, days: tradingDays };
}

// Repaso de Onyx AI: cruza el plan con la conducta real y da coaching breve.
export async function planReview(plan: Plan, stats: PlanStats, lang: 'es' | 'en'): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return lang === 'en' ? '⚠️ AI not configured: ANTHROPIC_API_KEY missing in Vercel.' : '⚠️ IA no configurada: falta ANTHROPIC_API_KEY en Vercel.';
  const ctx = `Estilo: ${plan.style} · Riesgo/op: ${plan.risk_per_trade}% · Pérdida diaria máx: ${plan.max_daily_loss_pct}% · Máx ops/día: ${plan.max_trades_day || '—'} · Sesiones: ${plan.sessions.join(', ') || '—'}\n`
    + `Reglas propias: ${plan.rules.join(' | ') || '—'}\nObjetivo: ${plan.goal || '—'}\n`
    + `ADHERENCIA: ${stats.adherence}% · Racha: ${stats.streak} días · Cumplimiento de hábitos: ${stats.checkinRate}% · Disciplina en operaciones: ${stats.tradeDiscipline}% · Días de sobre-operar: ${stats.overtradingDays}\n`
    + `Win rate cuando respetó el límite: ${stats.winRateRespect ?? '—'}% · cuando lo rompió: ${stats.winRateBroken ?? '—'}%`;
  const system = (lang === 'en'
    ? `You are Onyx AI, a trading discipline coach. Read the trader's PLAN and their real BEHAVIOR below and give a short, concrete review (max 5 short bullet points): what they're doing well, where they break their own rules, and one action for tomorrow. Be direct and encouraging. Use the numbers. NEVER predict the market, give signals or promise profits. No sign-off.`
    : `Eres Onyx AI, un coach de disciplina de trading. Lee el PLAN del trader y su CONDUCTA real de abajo y da un repaso corto y concreto (máx 5 viñetas cortas): qué hace bien, dónde rompe sus propias reglas, y una acción para mañana. Sé directo y motivador. Usa los números. NUNCA predigas el mercado, des señales ni prometas ganancias. Sin despedida.`)
    + `\n\n=== ${lang === 'en' ? 'PLAN AND BEHAVIOR' : 'PLAN Y CONDUCTA'} ===\n${ctx}`;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 500, system, messages: [{ role: 'user', content: lang === 'en' ? 'Review my discipline.' : 'Repasa mi disciplina.' }] }),
    });
    if (!r.ok) return lang === 'en' ? 'Could not review right now.' : 'No pude repasar ahora mismo.';
    const data = await r.json();
    return (data?.content || []).map((c: any) => c.text || '').join('\n').trim() || (lang === 'en' ? 'No review available.' : 'Sin repaso disponible.');
  } catch { return lang === 'en' ? 'Could not review right now.' : 'No pude repasar ahora mismo.'; }
}
