import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mergeConfig } from '@/lib/manager';

// ============================================================
// Mi plan y hábitos. El plan lo escribe el trader (cualquier estilo); el Guardian
// impone las reglas duras en el EA. Aquí medimos la ADHERENCIA: hábitos diarios +
// disciplina real (según las operaciones) y una racha. La IA lo repasa.
//
// La pérdida diaria máxima y el máximo de operaciones/día NO se guardan aquí como
// una copia: se LEEN del Guardian (manager_configs) para que nunca se
// desincronicen. Aquí solo vive lo que es del trader (estilo, riesgo objetivo,
// sesiones, pares, meta, reglas y hábitos, incluidos los propios).
// ============================================================

export type CustomHabit = { id: string; label: string };

export type Plan = {
  style: string;             // day | scalper | swing | funded | crypto | custom
  risk_per_trade: number;    // % del balance (objetivo propio; el Guardian no lo aplica)
  max_daily_loss_pct: number;// espejo del Guardian (se recalcula al leer)
  max_trades_day: number;    // espejo del Guardian (se recalcula al leer)
  sessions: string[];        // asia | london | ny
  pairs: string;             // texto libre (los del trader)
  goal: string;              // objetivo, en palabras del trader
  rules: string[];           // reglas propias (texto libre)
  habits: string[];          // claves de hábitos predefinidos que quiere seguir
  custom_habits: CustomHabit[]; // hábitos propios que el trader escribe
  scope: 'primary' | 'all';  // el plan mide UNA cuenta principal, o TODAS (sin duplicar copias)
  primary_account_id: string | null; // cuál es la cuenta principal (para scope=primary)
};

// Hábitos disponibles (claves estables; las etiquetas bilingües viven en la UI).
export const HABIT_KEYS = ['reviewed_calendar', 'defined_risk', 'followed_plan', 'journaled', 'stopped_at_limit', 'no_revenge', 'respected_sessions'];

export const DEFAULT_PLAN: Plan = {
  style: 'day', risk_per_trade: 1, max_daily_loss_pct: 3, max_trades_day: 3,
  sessions: ['london', 'ny'], pairs: '', goal: '', rules: [],
  habits: ['reviewed_calendar', 'defined_risk', 'followed_plan', 'journaled', 'no_revenge'],
  custom_habits: [],
  scope: 'primary',
  primary_account_id: null,
};

// Todas las claves de hábito activas hoy: predefinidos elegidos + propios.
export function planHabitIds(plan: Plan): string[] {
  return [...(plan.habits || []), ...((plan.custom_habits || []).map((h) => h.id))];
}

// ---- Guardian: estado por cuenta (con tipo y rol de copy) + regla más estricta ----
export type CopyRole = 'master' | 'slave' | null;
export type GAccount = {
  id: string; name: string; login: any;
  acc_type: string | null;         // challenge | funded | own | demo
  copy_role: CopyRole;             // master (envía copias) | slave (recibe) | null
  daily_loss_pct: number | null;   // pérdida diaria máx (%) que aplica el Guardian, o null
  max_trades_day: number | null;   // máx ops/día que aplica el Guardian (>0), o null
  limits_on: boolean;
};
export type GuardianWarning = { account_id: string; name: string; kind: 'slave_no_limit' };
export type GuardianSummary = {
  hasAccounts: boolean;
  linked: boolean;
  daily_loss_pct: number | null;   // la más estricta (menor) entre las cuentas
  max_trades_day: number | null;   // el más estricto (menor >0)
  accounts: GAccount[];
  warnings: GuardianWarning[];
};

export async function guardianSummary(userId: string): Promise<GuardianSummary> {
  const [{ data: accs }, { data: cfgs }, { data: links }] = await Promise.all([
    supabaseAdmin.from('trading_accounts').select('id,login,nickname,broker,acc_type').eq('user_id', userId).order('created_at', { ascending: true }),
    supabaseAdmin.from('manager_configs').select('account_id,enabled,config').eq('user_id', userId),
    supabaseAdmin.from('copy_links').select('master_account_id,slave_account_id,enabled').eq('owner_id', userId),
  ]);
  const byAcc: Record<string, any> = {};
  (cfgs || []).forEach((c: any) => { byAcc[c.account_id] = c; });
  const masters = new Set<string>(); const slaves = new Set<string>();
  (links || []).forEach((l: any) => { if (l.enabled) { masters.add(l.master_account_id); slaves.add(l.slave_account_id); } });

  const accounts: GAccount[] = (accs || []).map((a: any) => {
    const c = byAcc[a.id];
    const cfg = mergeConfig(c?.config);
    const limitsOn = !!(c?.enabled && cfg.limits.on);
    const dl = limitsOn && cfg.limits.daily_loss_pct && cfg.limits.daily_loss > 0 ? Number(cfg.limits.daily_loss) : null;
    const mt = !!(c?.enabled && cfg.plan.on) && cfg.plan.max_trades_day > 0 ? Number(cfg.plan.max_trades_day) : null;
    const role: CopyRole = slaves.has(a.id) ? 'slave' : (masters.has(a.id) ? 'master' : null);
    return { id: a.id, name: a.nickname || a.broker || ('#' + a.login), login: a.login, acc_type: a.acc_type || null, copy_role: role, daily_loss_pct: dl, max_trades_day: mt, limits_on: limitsOn };
  });

  // Aviso: cuentas esclavas (reciben copias) sin pérdida diaria máx configurada.
  const warnings: GuardianWarning[] = accounts
    .filter((a) => a.copy_role === 'slave' && a.daily_loss_pct == null)
    .map((a) => ({ account_id: a.id, name: a.name, kind: 'slave_no_limit' as const }));

  const dls = accounts.map((a) => a.daily_loss_pct).filter((n): n is number => n != null);
  const mts = accounts.map((a) => a.max_trades_day).filter((n): n is number => n != null);
  return {
    hasAccounts: accounts.length > 0,
    linked: dls.length > 0 || mts.length > 0,
    daily_loss_pct: dls.length ? Math.min(...dls) : null,
    max_trades_day: mts.length ? Math.min(...mts) : null,
    accounts,
    warnings,
  };
}

// ---- Alcance: qué cuentas mide el plan (deduplicando el copy) + umbral de ops ----
// - scope 'primary': una sola cuenta principal (la elegida, o auto: master → no-esclava → primera).
// - scope 'all': todas MENOS las esclavas activas (sus operaciones son espejo del master).
export function resolveMeasured(plan: Plan, summary: GuardianSummary): { ids: string[]; threshold: number; primaryId: string | null } {
  const accounts = summary.accounts;
  let ids: string[]; let primaryId: string | null = null;
  if (plan.scope === 'all') {
    ids = accounts.filter((a) => a.copy_role !== 'slave').map((a) => a.id);
  } else {
    let primary = accounts.find((a) => a.id === plan.primary_account_id)
      || accounts.find((a) => a.copy_role === 'master')
      || accounts.find((a) => a.copy_role !== 'slave')
      || accounts[0];
    primaryId = primary ? primary.id : null;
    ids = primary ? [primary.id] : [];
  }
  const mts = accounts.filter((a) => ids.includes(a.id)).map((a) => a.max_trades_day).filter((n): n is number => n != null);
  const threshold = mts.length ? Math.min(...mts) : (plan.max_trades_day || 0);
  return { ids, threshold, primaryId };
}

const DAY = 864e5;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export async function getPlan(userId: string): Promise<Plan> {
  const { data } = await supabaseAdmin.from('trading_plans').select('data').eq('user_id', userId).maybeSingle();
  const plan: Plan = { ...DEFAULT_PLAN, ...((data as any)?.data || {}) };
  if (!Array.isArray(plan.custom_habits)) plan.custom_habits = [];
  // La pérdida diaria y el máx de operaciones son del Guardian: los leemos de ahí
  // para que el plan muestre SIEMPRE el número real que se aplica en la cuenta.
  try {
    const g = await guardianSummary(userId);
    if (g.daily_loss_pct != null) plan.max_daily_loss_pct = g.daily_loss_pct;
    if (g.max_trades_day != null) plan.max_trades_day = g.max_trades_day;
  } catch { /* si el Guardian no está, se quedan los del plan */ }
  return plan;
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
    custom_habits: Array.isArray(plan.custom_habits)
      ? plan.custom_habits
          .map((h: any) => ({ id: sanitizeHabitId(h?.id) || sanitizeHabitId(h?.label), label: String(h?.label ?? '').trim().slice(0, 80) }))
          .filter((h: CustomHabit) => h.id && h.label)
          .slice(0, 12)
      : cur.custom_habits,
    scope: plan.scope === 'all' || plan.scope === 'primary' ? plan.scope : cur.scope,
    primary_account_id: plan.primary_account_id === undefined ? cur.primary_account_id : (plan.primary_account_id ? String(plan.primary_account_id) : null),
  };
  await supabaseAdmin.from('trading_plans').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() });
  return next;
}
function clamp(n: number, lo: number, hi: number) { return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; }
// id estable para un hábito propio (a partir de su texto): 'c_' + slug corto.
function sanitizeHabitId(v: any): string {
  const base = String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return base ? 'c_' + base : '';
}

// ---- Aplicar al Guardian: escribe pérdida diaria y máx ops en las cuentas del
// ALCANCE elegido, para que el número del plan sea el que de verdad se aplica. Solo
// toca esos dos campos; el resto de la config del Guardian se conserva. ----
export type ApplyTarget = { mode: 'all' | 'account' | 'type'; accountId?: string; accType?: string };
export async function applyGuardian(userId: string, dailyLossPct: number, maxTrades: number, target: ApplyTarget = { mode: 'all' }): Promise<{ updated: string[] }> {
  const dl = clamp(Number(dailyLossPct), 0, 100);
  const mt = clamp(Math.round(Number(maxTrades)), 0, 500);
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id,acc_type').eq('user_id', userId);
  let ids = (accs || []).map((a: any) => a.id);
  if (target.mode === 'account' && target.accountId) {
    ids = ids.filter((id: string) => id === target.accountId);
  } else if (target.mode === 'type' && target.accType) {
    const okIds = new Set((accs || []).filter((a: any) => (a.acc_type || '') === target.accType).map((a: any) => a.id));
    ids = ids.filter((id: string) => okIds.has(id));
  }
  if (!ids.length) return { updated: [] };
  const { data: cfgs } = await supabaseAdmin.from('manager_configs').select('account_id,version,config,enabled,units').eq('user_id', userId);
  const byAcc: Record<string, any> = {}; (cfgs || []).forEach((c: any) => { byAcc[c.account_id] = c; });

  const updated: string[] = [];
  for (const accId of ids) {
    const row = byAcc[accId];
    const cfg = mergeConfig(row?.config);
    // Pérdida diaria máx (%) → limits
    cfg.limits.on = dl > 0 ? true : cfg.limits.on;
    cfg.limits.daily_loss = dl;
    cfg.limits.daily_loss_pct = true;
    if (!cfg.limits.base) cfg.limits.base = 'day_start_balance';
    if (cfg.limits.reset_hour == null) cfg.limits.reset_hour = 0;
    // Máx operaciones/día → plan
    cfg.plan.max_trades_day = mt;
    if (mt > 0) cfg.plan.on = true;
    await supabaseAdmin.from('manager_configs').upsert({
      user_id: userId, account_id: accId,
      enabled: row?.enabled ?? true,
      units: row?.units || 'pips',
      config: cfg,
      version: Number(row?.version || 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id' });
    updated.push(accId);
  }
  return { updated };
}

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
  const habitIds = planHabitIds(plan);
  const enabled = habitIds.length || 1;

  // --- Check-ins de los últimos 14 días ---
  const from = dayStr(new Date(Date.now() - 14 * DAY));
  const { data: checks } = await supabaseAdmin.from('plan_checkins').select('day,items').eq('user_id', userId).gte('day', from).order('day', { ascending: false });
  const byDay: Record<string, number> = {};   // completion 0..1 por día
  for (const c of (checks || []) as any[]) {
    const items = c.items || {};
    const done = habitIds.filter((h) => items[h]).length;
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
  // Medimos SOLO las cuentas del alcance (una principal o todas sin las esclavas),
  // así el copy no cuenta la misma decisión varias veces. El umbral de ops sale de
  // esas mismas cuentas del Guardian.
  let tradeDiscipline = 1, overtradingDays = 0, winRateRespect: number | null = null, winRateBroken: number | null = null, tradingDays = 0;
  const summary = await guardianSummary(userId);
  const { ids, threshold } = resolveMeasured(plan, summary);
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
    if (tradingDays && threshold > 0) {
      let respected = 0, rW = 0, rN = 0, bW = 0, bN = 0;
      for (const k of dayKeys) {
        const { n, wins } = perDay[k];
        if (n <= threshold) { respected++; rW += wins; rN += n; }
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
    ? `You are Onyx AI, a trading discipline coach. Read the trader's PLAN and their real BEHAVIOR and write a short, warm, concrete review.

WRITE IT WITH THIS EXACT STRUCTURE — four sections, each starting with the emoji + title shown, then ONE short sentence (max two) under it:

✅ What's working
🚩 Where you break your rules
🧠 The pattern
🎯 Your move for tomorrow

Hard rules for formatting:
- Use PLAIN TEXT only. NEVER use *, **, #, -, •, backticks or any markdown. No bold markup — the app renders the emoji headers.
- Keep each section to one or two short sentences. Use the real numbers.
- Be direct but encouraging, human, no jargon.
- NEVER predict the market, give signals or promise profits. No greeting, no sign-off.`
    : `Eres Onyx AI, un coach de disciplina de trading. Lee el PLAN del trader y su CONDUCTA real y escribe un repaso corto, cálido y concreto.

ESCRÍBELO CON ESTA ESTRUCTURA EXACTA — cuatro secciones, cada una empieza con el emoji + título mostrado, y debajo UNA frase corta (máx dos):

✅ Lo que funciona
🚩 Dónde rompes tus reglas
🧠 El patrón
🎯 Tu acción para mañana

Reglas estrictas de formato:
- Usa SOLO TEXTO PLANO. NUNCA uses *, **, #, -, •, comillas invertidas ni markdown. Nada de negritas con símbolos — la app ya resalta los títulos con emoji.
- Cada sección: una o dos frases cortas. Usa los números reales.
- Directo pero motivador, humano, sin tecnicismos.
- NUNCA predigas el mercado, des señales ni prometas ganancias. Sin saludo ni despedida.`)
    + `\n\n=== ${lang === 'en' ? 'PLAN AND BEHAVIOR' : 'PLAN Y CONDUCTA'} ===\n${ctx}`;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 500, system, messages: [{ role: 'user', content: lang === 'en' ? 'Review my discipline.' : 'Repasa mi disciplina.' }] }),
    });
    if (!r.ok) return lang === 'en' ? 'Could not review right now.' : 'No pude repasar ahora mismo.';
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('coach', data)).catch(() => {});
    const raw = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    // Defensa: quita cualquier markdown que se le escape al modelo (**, #, viñetas -/•).
    const clean = raw
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/[*`]/g, '')
      .replace(/^#{1,6}\s*/gm, '').replace(/^\s*[-•]\s+/gm, '').trim();
    return clean || (lang === 'en' ? 'No review available.' : 'Sin repaso disponible.');
  } catch { return lang === 'en' ? 'Could not review right now.' : 'No pude repasar ahora mismo.'; }
}
