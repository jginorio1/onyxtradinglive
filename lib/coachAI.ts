import { ONYX_BRIEF } from '@/lib/supportAI';

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
export type CoachSummary = {
  net: number; trades: number; winRate: number; pf: number;
  avgWin: number; avgLoss: number; maxLossStreak: number; biggestLoss: number;
  bestPair?: string; worstPair?: string; bestSession?: string; worstDay?: string; bestHour?: string;
};
export async function weeklyReview(s: CoachSummary, lang: Lang): Promise<{ ok: boolean; text?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const system = (enBase(lang)
    ? `You are Onyx Coach, a calm, honest trading-performance coach. Read the trader's stats below and write a short review (max ~160 words) in plain language: what they did well, the 1-2 biggest leaks, and one concrete habit to fix next. Be direct but supportive, never harsh. Use a couple of tasteful emojis and short paragraphs. ${NO_ADVICE.en}`
    : `Eres Onyx Coach, un coach de rendimiento de trading, tranquilo y honesto. Lee las estadísticas del trader y escribe un repaso corto (máx ~160 palabras) en lenguaje claro: qué hizo bien, la 1-2 fugas más grandes, y un hábito concreto para corregir. Directo pero de apoyo, nunca duro. Usa un par de emojis con criterio y párrafos cortos. ${NO_ADVICE.es}`)
    + `\n\n=== ${enBase(lang) ? 'ONYX KNOWLEDGE' : 'CONOCIMIENTO DE ONYX'} ===\n${dictFor(ONYX_BRIEF, lang)}` + aiLangDirective(lang);
  const user = JSON.stringify(s);
  const text = await ai(system, (enBase(lang) ? 'Stats: ' : 'Estadísticas: ') + user, 600);
  return text ? { ok: true, text } : { ok: false, reason: 'error' };
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

// ---- Lector de reglas de prop firm ----
export type Rules = { profit_target?: number; profit_target_pct?: boolean; daily_loss?: number; daily_loss_pct?: boolean; total_loss?: number; total_loss_pct?: boolean; min_days?: number; max_days?: number; consistency?: number; firm?: string };
export async function parseRules(text: string, lang: Lang): Promise<{ ok: boolean; rules?: Rules; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  if (!text || text.trim().length < 15) return { ok: false, reason: 'short' };
  const system = `You extract prop-firm challenge rules from pasted text (any language). Return ONLY a JSON object with the numbers you find, omitting any you cannot determine:
{"firm":"name if stated","profit_target":number,"profit_target_pct":true|false,"daily_loss":number,"daily_loss_pct":true|false,"total_loss":number,"total_loss_pct":true|false,"min_days":number,"max_days":number,"consistency":number}
Rules: percentages → the number without % and the _pct flag true (e.g. "5% daily" → daily_loss:5, daily_loss_pct:true). Money amounts → the number and _pct false. "consistency" is the max % of total profit allowed from a single day, if mentioned. Do not invent values.`;
  const raw = await ai(system, text, 400);
  if (!raw) return { ok: false, reason: 'error' };
  try {
    const j = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
    const num = (v: any) => (v === undefined || v === null || isNaN(Number(v)) ? undefined : Number(v));
    const rules: Rules = {
      firm: j.firm ? String(j.firm).slice(0, 40) : undefined,
      profit_target: num(j.profit_target), profit_target_pct: typeof j.profit_target_pct === 'boolean' ? j.profit_target_pct : undefined,
      daily_loss: num(j.daily_loss), daily_loss_pct: typeof j.daily_loss_pct === 'boolean' ? j.daily_loss_pct : undefined,
      total_loss: num(j.total_loss), total_loss_pct: typeof j.total_loss_pct === 'boolean' ? j.total_loss_pct : undefined,
      min_days: num(j.min_days), max_days: num(j.max_days), consistency: num(j.consistency),
    };
    const has = Object.values(rules).some((v) => v !== undefined);
    if (!has) return { ok: false, reason: 'empty' };
    return { ok: true, rules };
  } catch { return { ok: false, reason: 'parse' }; }
}
