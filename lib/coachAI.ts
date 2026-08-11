import { ONYX_BRIEF, brandBrief } from '@/lib/supportAI';

// ============================================================
// AI de cara al trader. Tres usos, todos reusando el cerebro de Onyx:
//  · weeklyReview  → repaso honesto del rendimiento (coach), sin predicciones.
//  · analyzeStatement → 3 hallazgos de un reporte pegado (imán de leads público).
//  · parseRules → extrae los números de las reglas de una prop firm.
// LÍNEA ROJA: nunca predice el mercado, da señales ni promete ganancias.
// ============================================================

import type { Lang } from './navText';
import { aiLangDirective, enBase, LANG_NAME , dictFor } from '@/lib/i18n';

// Llamada base: contenido como texto o como bloques (imagen/PDF).
async function aiRaw(system: string, content: any, maxTokens: number, beta?: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const headers: any = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    if (beta) headers['anthropic-beta'] = beta;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('coach', d)).catch(() => {});
    return (d?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; }
}
async function ai(system: string, user: string, maxTokens = 700): Promise<string | null> {
  return aiRaw(system, user.slice(0, 6000), maxTokens);
}

const NO_ADVICE = {
  es: 'Reglas: analiza SOLO el pasado del trader. NUNCA predigas el mercado, ni des señales, ni prometas ganancias, ni digas qué operar. Habla de disciplina, hábitos y gestión de riesgo.',
  en: 'Rules: analyze ONLY the trader\'s past. NEVER predict the market, give signals, promise profits or say what to trade. Talk about discipline, habits and risk management.',
};

// ---- Coach: repaso del rendimiento ----
// Resumen ENRIQUECIDO: además del P&L lleva el rango de fechas analizado, los
// días operados, operaciones por día, expectancy, ratio R:R y drawdown, para
// que el coach juzgue con contexto (y no confunda volumen con disciplina).
export type CoachSummary = {
  net: number; trades: number; winRate: number; pf: number;
  avgWin: number; avgLoss: number; maxLossStreak: number; biggestLoss: number;
  bestPair?: string; worstPair?: string; bestSession?: string; worstDay?: string; bestHour?: string;
  from?: string; to?: string; days?: number; tradingDays?: number; perDay?: number;
  expectancy?: number; rr?: number; maxDrawdown?: number; periodLabel?: string;
  // Alcance analizado + contexto real (para no inventar cifras).
  scope?: string; isPortfolio?: boolean; balance?: number; dailyLossRule?: number;
  breakevenRR?: number; smallSample?: boolean;
  // Adherencia al plan del trader ("Mi plan y hábitos"), si lo tiene configurado.
  plan?: {
    hasPlan: boolean; style?: string; maxTradesDay?: number; maxDailyLossPct?: number;
    sessions?: string; rules?: string[]; goal?: string;
    overLimitDays?: number; maxTradesInADay?: number; followedMaxTrades?: boolean;
    adherence?: number; habitCheckinRate?: number; streak?: number;
    winRateRespectingLimit?: number; winRateBreakingLimit?: number;
  };
  // Plan del trader y qué incluye cada feature (para adaptar el consejo al plan).
  planTier?: string; planIncludes?: string[]; planMissing?: string[];
  // Progreso hacia "Mis metas de ganancia" (semana/mes/año), si las tiene.
  goals?: {
    note?: string;
    week?: { target: number; net: number; pct: number };
    month?: { target: number; net: number; pct: number };
    year?: { target: number; net: number; pct: number };
  };
};
export async function weeklyReview(s: CoachSummary, lang: Lang): Promise<{ ok: boolean; text?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  // Reglas de análisis honesto: el coach da un VEREDICTO primero (¿gana o pierde
  // en este período?) y NUNCA felicita por el volumen de operaciones.
  const RUBRIC_EN = `SCORING RUBRIC (use these facts, don't invent):
- OPEN by naming what was analyzed: the account name, or "the full portfolio (N accounts)" from the "scope" field, plus the period.
- Profit Factor < 1.0 OR net < 0 → the trader is LOSING money in this scope/period. Say it plainly and kindly; do NOT open with praise.
- Never praise the NUMBER of trades. High volume without an edge is a risk, not an achievement. If perDay is high, treat it as possible over-trading, not discipline.
- Win rate alone means nothing without R:R. The MINIMUM R:R needed to break even at THIS win rate is given as "breakevenRR" — quote THAT number (do not invent a generic 1.5). Compare it with the actual rr = avgWin/avgLoss.
- Root cause, not symptoms: if drawdown and a losing streak come from the same problem (no risk cap / negative expectancy), name the root cause; don't list them as two independent leaks.
- Concrete numbers must be grounded: if "dailyLossRule" is given, use the firm's daily limit; else if "balance" is given, suggest ~1-2% of balance as a daily stop. Never invent round numbers with no basis.
- If "smallSample" is true, add a short caveat that the sample is small and results could be variance.
- PLAN ADHERENCE: if "plan.hasPlan" is true, add ONE line saying clearly whether they are FOLLOWING their plan or not. If followedMaxTrades is false (overLimitDays > 0), say they broke their own max-trades rule (e.g. "your plan is X trades/day but you did Y on Z day(s)"). Use winRateRespectingLimit vs winRateBreakingLimit to show discipline pays. Mention habit check-in rate/streak if low. If plan.hasPlan is absent, do NOT mention any plan.
- PROFIT GOALS: if "goals" is present, add ONE short line on progress toward their own profit goal(s): quote the pct (e.g. "you're at 40% of your monthly goal") or, if net is negative, say they're below/away from the goal. Don't invent goals; only comment on the periods provided.
- PLAN-AWARE ADVICE: the trader is on the "planTier" plan. "planIncludes" lists what their plan already gives them and exactly what each feature does — recommend actions using ONLY those features (e.g. suggest turning on the news blackout / partial closes in Onyx Guardian only if manager is included). NEVER tell them to use a feature that is not in planIncludes. "planMissing" lists features their plan lacks; you may mention at most ONE of them briefly IF it would genuinely fix a leak you found (e.g. a losing trader without Onyx Guardian), framed as "a higher plan unlocks…", with no hard sell.`;
  const RUBRIC_ES = `CRITERIO DE PUNTUACIÓN (usa estos hechos, no inventes):
- EMPIEZA nombrando qué se analizó: el nombre de la cuenta, o "el portafolio completo (N cuentas)" según el campo "scope", más el período.
- Profit Factor < 1.0 O net < 0 → el trader ESTÁ PERDIENDO dinero en este alcance/período. Dilo claro y con amabilidad; NO empieces con un elogio.
- Nunca felicites por el NÚMERO de operaciones. Mucho volumen sin ventaja es riesgo, no un logro. Si perDay es alto, trátalo como posible sobreoperación, no como disciplina.
- El win rate solo no significa nada sin el R:R. El R:R MÍNIMO para no perder a este win rate viene en "breakevenRR" — cita ESE número (no inventes un 1.5 genérico). Compáralo con el rr real = avgWin/avgLoss.
- Causa raíz, no síntomas: si el drawdown y la racha de pérdidas salen del mismo problema (sin freno de riesgo / expectancy negativa), nombra la causa raíz; no los cuentes como dos fugas independientes.
- Las cifras concretas deben estar fundadas: si viene "dailyLossRule", usa el límite diario de la firma; si no, si viene "balance", sugiere ~1-2% del balance como freno diario. Nunca inventes números redondos sin base.
- Si "smallSample" es true, añade un matiz corto de que la muestra es pequeña y el resultado puede ser varianza.
- ADHERENCIA AL PLAN: si "plan.hasPlan" es true, añade UNA línea diciendo claramente si ESTÁ SIGUIENDO su plan o no. Si followedMaxTrades es false (overLimitDays > 0), dile que rompió su propia regla de máximo de operaciones (p. ej. "tu plan son X operaciones/día pero hiciste Y en Z día(s)"). Usa winRateRespectingLimit vs winRateBreakingLimit para mostrar que la disciplina paga. Menciona la racha/cumplimiento de hábitos si son bajos. Si "plan.hasPlan" no está presente, NO menciones ningún plan.
- LENGUAJE: escribe siempre la palabra completa "operaciones" (u "operación" en singular). NUNCA uses la abreviatura "ops" ni "op".
- METAS DE GANANCIA: si viene "goals", añade UNA línea corta sobre el progreso hacia su(s) meta(s) de ganancia: cita el pct (p. ej. "vas al 40% de tu meta mensual") o, si el neto es negativo, di que está por debajo/lejos de la meta. No inventes metas; comenta solo los períodos que vengan.
- CONSEJO SEGÚN EL PLAN: el trader está en el plan "planTier". "planIncludes" lista lo que su plan ya le da y qué hace cada feature — recomienda acciones usando SOLO esas features (p. ej. sugiérele activar el bloqueo por noticias / cierres parciales del Onyx Guardian solo si tiene manager). NUNCA le digas que use una feature que no esté en planIncludes. "planMissing" lista lo que su plan NO tiene; puedes mencionar como MUCHO UNA, brevemente, SOLO si de verdad arreglaría una fuga que detectaste (p. ej. un trader que pierde sin Onyx Guardian), en plan "un plan superior desbloquea…", sin vender con presión.`;
  const system = (enBase(lang)
    ? `You are Onyx Coach, a calm, honest trading-performance coach. Read the trader's stats and write a short review (max ~170 words) in plain language, in this order: (1) name the scope (account or full portfolio) and give an honest verdict of THIS period (making or losing money, with dates and number of days/trades), (2) the 1-2 biggest leaks with the numbers, (3) one concrete habit to fix next. Direct but supportive, never harsh. A couple of tasteful emojis, short paragraphs.\n\n${RUBRIC_EN}\n\n${NO_ADVICE.en}`
    : `Eres Onyx Coach, un coach de rendimiento de trading, tranquilo y honesto. Lee las estadísticas del trader y escribe un repaso corto (máx ~170 palabras) en lenguaje claro, en este orden: (1) nombra el alcance (la cuenta o el portafolio completo) y da un veredicto honesto de ESTE período (gana o pierde dinero, con las fechas y el número de días/operaciones), (2) la 1-2 fugas más grandes con los números, (3) un hábito concreto para corregir. Directo pero de apoyo, nunca duro. Un par de emojis con criterio y párrafos cortos.\n\n${RUBRIC_ES}\n\n${NO_ADVICE.es}`)
    + `\n\n=== ${enBase(lang) ? 'ONYX KNOWLEDGE' : 'CONOCIMIENTO DE ONYX'} ===\n${await brandBrief(lang)}` + aiLangDirective(lang);
  const user = JSON.stringify(s);
  const text = await ai(system, (enBase(lang) ? 'Stats: ' : 'Estadísticas: ') + user, 600);
  return text ? { ok: true, text } : { ok: false, reason: 'error' };
}

// Repaso DETERMINISTA (sin IA): red de seguridad para que la cápsula del Coach
// SIEMPRE muestre algo útil, aunque la IA esté caída, sin clave o el endpoint
// tarde. Usa exactamente los mismos números que le pasaríamos a la IA.
export function fallbackReview(s: CoachSummary, lang: Lang): string {
  const en = enBase(lang);
  const money = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const L = <T,>(a: T, b: T) => (en ? b : a);
  const out: string[] = [];
  const scope = s.scope ? s.scope + ' · ' : '';
  out.push(`**${L('Repaso Onyx', 'Onyx review')}: ${scope}${s.periodLabel || ''}${s.trades ? ` · ${s.trades} ${L('operaciones', 'trades')}` : ''}${s.tradingDays ? ` · ${s.tradingDays} ${L('días', 'days')}` : ''}** 📊`);
  const losing = (s.pf > 0 && s.pf < 1) || s.net < 0;
  out.push(losing
    ? `${L('Veredicto', 'Verdict')}: ${L('estás perdiendo en este período', 'you are losing money this period')}. PF ${s.pf}, ${L('neto', 'net')} ${money(s.net)}. ${s.perDay ? `${s.perDay}/${L('día', 'day')}.` : ''}`
    : `${L('Veredicto', 'Verdict')}: ${L('período positivo', 'positive period')} (${L('neto', 'net')} ${money(s.net)}, PF ${s.pf}). ${L('Mantén la disciplina', 'Keep the discipline')}.`);
  if (s.breakevenRR && s.rr != null) out.push(`R:R ${s.rr} · ${L('para no perder a tu win rate necesitas', 'to break even at your win rate you need')} ~${s.breakevenRR}:1 (${L('win rate', 'win rate')} ${s.winRate}%).`);
  if (s.expectancy != null) out.push(`${L('Expectancy', 'Expectancy')}: ${money(s.expectancy)}/${L('operación', 'trade')}. ${L('Racha máx. de pérdidas', 'Max losing streak')}: ${s.maxLossStreak}. ${L('Drawdown', 'Drawdown')}: ${money(-(s.maxDrawdown || 0))}.`);
  if (s.plan?.hasPlan) {
    if (s.plan.followedMaxTrades === false) out.push(`⚠ ${L('No seguiste tu plan', "You didn't follow your plan")}: ${s.plan.maxTradesDay} ${L('operaciones/día máx, pero pasaste el límite en', 'trades/day max, but you went over on')} ${s.plan.overLimitDays} ${L('día(s)', 'day(s)')} (${L('máx', 'peak')} ${s.plan.maxTradesInADay}).`);
    else if (s.plan.followedMaxTrades === true) out.push(`✓ ${L('Respetaste tu máx de operaciones', 'You respected your max trades')} (${s.plan.maxTradesDay}/${L('día', 'day')}).`);
    if (s.plan.winRateRespectingLimit != null && s.plan.winRateBreakingLimit != null) out.push(`${L('Win rate respetando el límite', 'Win rate within limit')}: ${s.plan.winRateRespectingLimit}% · ${L('rompiéndolo', 'breaking it')}: ${s.plan.winRateBreakingLimit}%.`);
    if (s.plan.habitCheckinRate != null) out.push(`${L('Cumplimiento de hábitos', 'Habit check-ins')}: ${s.plan.habitCheckinRate}%${s.plan.streak ? ` · ${L('racha', 'streak')} ${s.plan.streak}` : ''}.`);
  }
  const g = s.goals;
  if (g) {
    const gl: string[] = [];
    if (g.week) gl.push(`${L('semana', 'week')} ${g.week.pct}%`);
    if (g.month) gl.push(`${L('mes', 'month')} ${g.month.pct}%`);
    if (g.year) gl.push(`${L('año', 'year')} ${g.year.pct}%`);
    if (gl.length) out.push(`🎯 ${L('Metas', 'Goals')}: ${gl.join(' · ')}.`);
  }
  out.push(losing
    ? `${L('Hábito', 'Habit')}: ${L('menos volumen y setups con R:R ≥ tu punto de equilibrio; usa un freno de pérdida diaria', 'trade less and only take setups with R:R ≥ your break-even; use a daily loss stop')}. 💪`
    : `${L('Hábito', 'Habit')}: ${L('repite lo que funciona y no subas el riesgo', 'repeat what works and don\'t raise risk')}. 💪`);
  return out.join('\n\n');
}

// ---- Imán de leads: analiza un reporte pegado ----
export async function analyzeStatement(text: string, lang: Lang): Promise<{ ok: boolean; findings?: string[]; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  if (!text || text.trim().length < 30) return { ok: false, reason: 'short' };
  const system = (enBase(lang)
    ? `You are Onyx AI analyzing a trader's pasted MT4/MT5 statement or trade list. Return EXACTLY 3 short, specific, useful findings about their trading (patterns, risk, best/worst pairs or hours, over-trading, win rate reality). If the data is thin, infer what you honestly can and say what more Onyx would show once connected. ${NO_ADVICE.en}`
    : `Eres Onyx AI analizando el reporte de MT4/MT5 o lista de operaciones que pegó un trader. Devuelve EXACTAMENTE 3 hallazgos cortos, específicos y útiles sobre su trading (patrones, riesgo, mejores/peores pares u horas, sobreoperar, la realidad de su win rate). Si los datos son pocos, infiere lo que puedas con honestidad y di qué más mostraría Onyx al conectarse. ${NO_ADVICE.es}`)
    + `\n\nDevuelve SOLO un JSON: {"findings":["...","...","..."]}` + aiLangDirective(lang);
  const raw = await ai(system, text, 600);
  if (!raw) return { ok: false, reason: 'error' };
  try {
    const j = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
    const f = (j.findings || []).map((x: any) => String(x)).slice(0, 3);
    if (!f.length) return { ok: false, reason: 'empty' };
    return { ok: true, findings: f };
  } catch { return { ok: false, reason: 'parse' }; }
}

// ---- Lector de recibos de gasto ----
export type Receipt = { category?: string; amount?: number; provider?: string; firm?: string; acc_size?: number; phase?: string; refundable?: boolean; recovered?: number; recurring?: boolean };
export type ReceiptInput = { text?: string; file?: { media_type: string; data: string } };
export async function parseReceipt(input: string | ReceiptInput, lang: Lang): Promise<{ ok: boolean; data?: Receipt; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const inp: ReceiptInput = typeof input === 'string' ? { text: input } : (input || {});
  if (!inp.file && (!inp.text || inp.text.trim().length < 10)) return { ok: false, reason: 'short' };
  const system = `You extract ONE trading expense from a receipt (a purchase email, bank charge, invoice PDF, subscription receipt or a photo of one, any language). Return ONLY a JSON object, omitting any field you can't determine:
{"category":"funding|vps|software|data|internet|journal|education|fees|other","amount":number,"provider":"vendor or firm name","firm":"prop firm name if it's a funded-account challenge","acc_size":number,"phase":"p1|p2|funded|reset","refundable":true|false,"recurring":true|false,"recovered":number}
Rules: a prop-firm challenge fee → category "funding" and set firm, acc_size, phase, and refundable if it says the fee is refundable. A monthly subscription → recurring true. Do not invent values.`;

  let raw: string | null;
  if (inp.file) {
    const instr = enBase(lang) ? 'Extract the expense from this receipt.' : 'Extrae el gasto de este recibo.';
    const isPdf = inp.file.media_type === 'application/pdf';
    const block = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: inp.file.data } }
      : { type: 'image', source: { type: 'base64', media_type: inp.file.media_type, data: inp.file.data } };
    const content: any[] = [block, { type: 'text', text: instr + (inp.text ? `\n${inp.text}` : '') }];
    raw = await aiRaw(system, content, 400, isPdf ? 'pdfs-2024-09-25' : undefined);
  } else {
    raw = await ai(system, inp.text || '', 400);
  }
  if (!raw) return { ok: false, reason: 'error' };
  try {
    const j = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
    const CATS = ['funding', 'vps', 'software', 'data', 'internet', 'journal', 'education', 'fees', 'other'];
    const num = (v: any) => (v === undefined || v === null || isNaN(Number(v)) ? undefined : Number(v));
    const data: Receipt = {
      category: CATS.includes(j.category) ? j.category : undefined,
      amount: num(j.amount), provider: j.provider ? String(j.provider).slice(0, 60) : undefined,
      firm: j.firm ? String(j.firm).slice(0, 40) : undefined, acc_size: num(j.acc_size),
      phase: ['p1', 'p2', 'funded', 'reset'].includes(j.phase) ? j.phase : undefined,
      refundable: typeof j.refundable === 'boolean' ? j.refundable : undefined,
      recovered: num(j.recovered), recurring: typeof j.recurring === 'boolean' ? j.recurring : undefined,
    };
    if (data.amount === undefined && !data.provider && !data.firm) return { ok: false, reason: 'empty' };
    return { ok: true, data };
  } catch { return { ok: false, reason: 'parse' }; }
}

// ---- Coach de gasto: lectura honesta del dinero ----
export async function spendingReview(summary: any, lang: Lang): Promise<{ ok: boolean; text?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const system = (enBase(lang)
    ? `You are Onyx Coach reviewing a trader's MONEY (not their trades). Read the spending summary and write a short, honest read (max ~140 words) in plain language: where the money goes, whether prop-firm challenge spending is paying off (ROI), and one concrete money habit. Be supportive, never harsh, a couple of tasteful emojis. ${NO_ADVICE.en}`
    : `Eres Onyx Coach revisando el DINERO del trader (no sus operaciones). Lee el resumen de gastos y escribe una lectura corta y honesta (máx ~140 palabras) en lenguaje claro: dónde se va el dinero, si el gasto en retos de prop firm se está pagando (ROI), y un hábito concreto de dinero. De apoyo, nunca duro, un par de emojis con criterio. ${NO_ADVICE.es}`) + aiLangDirective(lang);
  const text = await ai(system, JSON.stringify(summary), 500);
  return text ? { ok: true, text } : { ok: false, reason: 'error' };
}

// ---- Lector de reglas de prop firm (texto pegado, foto o PDF del contrato) ----
export type Rules = { profit_target?: number; profit_target_pct?: boolean; daily_loss?: number; daily_loss_pct?: boolean; total_loss?: number; total_loss_pct?: boolean; min_days?: number; max_days?: number; consistency?: number; firm?: string; phase?: string; weekend_flat?: boolean };
export type RulesInput = { text?: string; file?: { media_type: string; data: string } };
export async function parseRules(input: string | RulesInput, lang: Lang): Promise<{ ok: boolean; rules?: Rules; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const inp: RulesInput = typeof input === 'string' ? { text: input } : (input || {});
  if (!inp.file && (!inp.text || inp.text.trim().length < 15)) return { ok: false, reason: 'short' };
  const system = `You extract prop-firm challenge rules from text, a contract PDF or a photo/screenshot (any language). Return ONLY a JSON object with the values you find, omitting any you cannot determine:
{"firm":"name if stated","phase":"p1|p2|funded","profit_target":number,"profit_target_pct":true|false,"daily_loss":number,"daily_loss_pct":true|false,"total_loss":number,"total_loss_pct":true|false,"min_days":number,"max_days":number,"consistency":number,"weekend_flat":true|false}
Rules: percentages → the number without % and the _pct flag true (e.g. "5% daily" → daily_loss:5, daily_loss_pct:true). Money amounts → the number and _pct false. "phase": phase 1 → "p1", phase 2 → "p2", already funded/live → "funded". "consistency" is the max % of total profit allowed from a single day, if mentioned. "weekend_flat" true if it says no positions may be held over the weekend. Do not invent values.`;

  let raw: string | null;
  if (inp.file) {
    const instr = enBase(lang) ? 'Extract the prop-firm challenge rules from this contract.' : 'Extrae las reglas del reto de prop firm de este contrato.';
    const isPdf = inp.file.media_type === 'application/pdf';
    const block = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: inp.file.data } }
      : { type: 'image', source: { type: 'base64', media_type: inp.file.media_type, data: inp.file.data } };
    const content: any[] = [block, { type: 'text', text: instr + (inp.text ? `\n${inp.text}` : '') }];
    raw = await aiRaw(system, content, 500, isPdf ? 'pdfs-2024-09-25' : undefined);
  } else {
    raw = await aiRaw(system, (inp.text || '').slice(0, 30000), 500);
  }
  if (!raw) return { ok: false, reason: 'error' };
  try {
    // La IA a veces envuelve el JSON en texto ("Aquí están las reglas: {...}").
    // Extraemos el objeto entre la primera { y la última } para no fallar por eso.
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}');
    const j = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned);
    const num = (v: any) => (v === undefined || v === null || isNaN(Number(v)) ? undefined : Number(v));
    const rules: Rules = {
      firm: j.firm ? String(j.firm).slice(0, 40) : undefined,
      phase: ['p1', 'p2', 'funded'].includes(j.phase) ? j.phase : undefined,
      profit_target: num(j.profit_target), profit_target_pct: typeof j.profit_target_pct === 'boolean' ? j.profit_target_pct : undefined,
      daily_loss: num(j.daily_loss), daily_loss_pct: typeof j.daily_loss_pct === 'boolean' ? j.daily_loss_pct : undefined,
      total_loss: num(j.total_loss), total_loss_pct: typeof j.total_loss_pct === 'boolean' ? j.total_loss_pct : undefined,
      min_days: num(j.min_days), max_days: num(j.max_days), consistency: num(j.consistency),
      weekend_flat: typeof j.weekend_flat === 'boolean' ? j.weekend_flat : undefined,
    };
    const has = Object.values(rules).some((v) => v !== undefined);
    if (!has) return { ok: false, reason: 'empty' };
    return { ok: true, rules };
  } catch { return { ok: false, reason: 'parse' }; }
}
