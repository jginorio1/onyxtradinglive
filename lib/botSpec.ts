// ============================================================
// Constructor de bots — modelo de la "receta" (spec) + generadores.
// El trader llena campos (incluido el NOMBRE del bot) agrupados como en un EA:
// general, entrada, salidas, riesgo, reglas de fondeo, frenos, objetivo, horario,
// noticias. De aqui salen: un resumen legible y un archivo .set de MT5 con todos
// los inputs configurados (para cargar en el EA base). El código del EA genérico
// se genera aparte, con pruebas (fase 2).
// ============================================================

export type Platform = 'mt5' | 'mt4' | 'ctrader';

export type BotSpec = {
  // General
  name: string;
  platform: Platform;
  symbol: string;
  magic: number;
  tf: string;                 // M1 M5 M15 M30 H1 H4 D1
  // Entrada
  entryTrigger: string;       // breakout_swing | ma_cross | rsi | donchian | time  (catálogo)
  microSwing: number;
  trendMode: number;          // 0 media · 1 estructura · 2 donchian
  trendTF: string;
  allowLongs: boolean;
  allowShorts: boolean;
  maxTradesPerDay: number;
  signalFromH: number; signalFromM: number; signalToH: number; signalToM: number;
  // Salidas
  slBufferATR: number;
  tp1R: number; partialPct: number;
  tpMode: number;             // 0 R fijo · 1 estructura
  runnerMaxR: number;
  useTrail: boolean; trailATRcoef: number;
  timeStopBars: number;
  // Riesgo
  riskPct: number; maxLots: number; dailyLossCapPct: number;
  // Reglas de fondeo (prop firm)
  firmName: string; ddType: number; firmDailyLimitPct: number; firmTotalLimitPct: number;
  // Frenos del bot (opcional)
  acctSoftStopPct: number; acctDailyStopPct: number; acctMaxDDPct: number;
  // Objetivo de cuenta
  accountMode: number;        // 0 F1 · 1 F2 · 2 Real
  initBalance: number; targetP1: number; targetP2: number;
  // Horario / cierre
  useDayClose: boolean; forceCloseHourNY: number; forceCloseMinNY: number; noWeekend: boolean;
  // Noticias
  useNewsFilter: boolean; newsCurrencies: string;
};

export const DEFAULT_SPEC: BotSpec = {
  name: 'Mi bot', platform: 'mt5', symbol: 'XAUUSD', magic: 991000, tf: 'M5',
  entryTrigger: 'breakout_swing', microSwing: 2, trendMode: 1, trendTF: 'H1', allowLongs: true, allowShorts: true,
  maxTradesPerDay: 20, signalFromH: 8, signalFromM: 0, signalToH: 20, signalToM: 0,
  slBufferATR: 0.5, tp1R: 1.0, partialPct: 50, tpMode: 1, runnerMaxR: 3.0, useTrail: true, trailATRcoef: 1.5, timeStopBars: 12,
  riskPct: 0.2, maxLots: 50, dailyLossCapPct: 1.5,
  firmName: 'FTMO', ddType: 1, firmDailyLimitPct: 5, firmTotalLimitPct: 10,
  acctSoftStopPct: 2, acctDailyStopPct: 3, acctMaxDDPct: 8,
  accountMode: 0, initBalance: 0, targetP1: 10, targetP2: 5,
  useDayClose: true, forceCloseHourNY: 20, forceCloseMinNY: 30, noWeekend: true,
  useNewsFilter: true, newsCurrencies: 'USD',
};

const num = (v: any, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Normaliza + acota lo que llega del formulario (nunca deja valores peligrosos).
export function cleanSpec(inp: any): BotSpec {
  const s: BotSpec = { ...DEFAULT_SPEC, ...(inp || {}) };
  s.name = String(inp?.name || 'Mi bot').slice(0, 40).trim() || 'Mi bot';
  s.platform = (['mt5', 'mt4', 'ctrader'].includes(inp?.platform) ? inp.platform : 'mt5');
  s.symbol = String(inp?.symbol || 'XAUUSD').slice(0, 80).trim();
  s.magic = clamp(Math.round(num(inp?.magic, 991000)), 1, 2147483000);
  s.tf = String(inp?.tf || 'M5');
  s.trendTF = String(inp?.trendTF || 'H1');
  s.entryTrigger = String(inp?.entryTrigger || 'breakout_swing');
  s.microSwing = clamp(Math.round(num(inp?.microSwing, 2)), 1, 10);
  s.trendMode = clamp(Math.round(num(inp?.trendMode, 1)), 0, 2);
  s.maxTradesPerDay = clamp(Math.round(num(inp?.maxTradesPerDay, 20)), 0, 500);
  s.signalFromH = clamp(Math.round(num(inp?.signalFromH, 8)), 0, 23); s.signalFromM = clamp(Math.round(num(inp?.signalFromM, 0)), 0, 59);
  s.signalToH = clamp(Math.round(num(inp?.signalToH, 20)), 0, 23); s.signalToM = clamp(Math.round(num(inp?.signalToM, 0)), 0, 59);
  s.slBufferATR = clamp(num(inp?.slBufferATR, 0.5), 0, 10);
  s.tp1R = clamp(num(inp?.tp1R, 1), 0.1, 20); s.partialPct = clamp(num(inp?.partialPct, 50), 0, 100);
  s.tpMode = clamp(Math.round(num(inp?.tpMode, 1)), 0, 1);
  s.runnerMaxR = clamp(num(inp?.runnerMaxR, 3), 0.5, 50); s.trailATRcoef = clamp(num(inp?.trailATRcoef, 1.5), 0.1, 20);
  s.timeStopBars = clamp(Math.round(num(inp?.timeStopBars, 12)), 0, 500);
  // Riesgo: TOPE DURO de seguridad — nunca más de 5% por operación desde el constructor.
  s.riskPct = clamp(num(inp?.riskPct, 0.2), 0.01, 5);
  s.maxLots = clamp(num(inp?.maxLots, 50), 0.01, 10000);
  s.dailyLossCapPct = clamp(num(inp?.dailyLossCapPct, 1.5), 0, 100);
  s.firmName = String(inp?.firmName || 'FTMO').slice(0, 40);
  s.ddType = clamp(Math.round(num(inp?.ddType, 1)), 0, 2);
  s.firmDailyLimitPct = clamp(num(inp?.firmDailyLimitPct, 5), 0, 100);
  s.firmTotalLimitPct = clamp(num(inp?.firmTotalLimitPct, 10), 0, 100);
  s.acctSoftStopPct = clamp(num(inp?.acctSoftStopPct, 2), 0, 100);
  s.acctDailyStopPct = clamp(num(inp?.acctDailyStopPct, 3), 0, 100);
  s.acctMaxDDPct = clamp(num(inp?.acctMaxDDPct, 8), 0, 100);
  s.accountMode = clamp(Math.round(num(inp?.accountMode, 0)), 0, 2);
  s.initBalance = clamp(num(inp?.initBalance, 0), 0, 1e9);
  s.targetP1 = clamp(num(inp?.targetP1, 10), 0, 100); s.targetP2 = clamp(num(inp?.targetP2, 5), 0, 100);
  s.forceCloseHourNY = clamp(Math.round(num(inp?.forceCloseHourNY, 20)), 0, 23); s.forceCloseMinNY = clamp(Math.round(num(inp?.forceCloseMinNY, 30)), 0, 59);
  s.newsCurrencies = String(inp?.newsCurrencies || 'USD').slice(0, 40).toUpperCase();
  s.allowLongs = inp?.allowLongs !== false; s.allowShorts = inp?.allowShorts !== false;
  s.useTrail = inp?.useTrail !== false; s.useDayClose = inp?.useDayClose !== false;
  s.noWeekend = inp?.noWeekend !== false; s.useNewsFilter = inp?.useNewsFilter !== false;
  return s;
}

// Valor entero de la temporalidad para el .set de MT5 (ENUM_TIMEFRAMES).
const TF_ENUM: Record<string, number> = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 16385, H4: 16388, D1: 16408 };
const tfEnum = (tf: string) => TF_ENUM[tf] ?? 5;
const b = (v: boolean) => (v ? 'true' : 'false');

// Archivo .set de MT5: cada línea InpNombre=valor. Los nombres coinciden con los
// inputs del EA base para que se carguen directo (Cargar en la pestaña Parámetros).
export function toSetFile(s: BotSpec): string {
  const L: string[] = [];
  L.push(`; ${s.name} — generado por Onyx Bot Builder`);
  L.push(`InpSymbol=${s.symbol}`);
  L.push(`InpMagic=${s.magic}`);
  L.push(`InpComment=${s.name}`);
  L.push(`InpTF=${tfEnum(s.tf)}`);
  L.push(`InpRiskPct=${s.riskPct}`);
  L.push(`InpMaxLots=${s.maxLots}`);
  L.push(`InpDailyLossCapPct=${s.dailyLossCapPct}`);
  L.push(`InpFirmName=${s.firmName}`);
  L.push(`InpDDType=${s.ddType}`);
  L.push(`InpFirmDailyLimitPct=${s.firmDailyLimitPct}`);
  L.push(`InpFirmTotalLimitPct=${s.firmTotalLimitPct}`);
  L.push(`InpAcctSoftStopPct=${s.acctSoftStopPct}`);
  L.push(`InpAcctDailyStopPct=${s.acctDailyStopPct}`);
  L.push(`InpAcctMaxDDPct=${s.acctMaxDDPct}`);
  L.push(`InpSysMagicMin=${s.magic}`);
  L.push(`InpSysMagicMax=${s.magic + 99}`);
  L.push(`InpAccountMode=${s.accountMode}`);
  L.push(`InpInitBalance=${s.initBalance}`);
  L.push(`InpTargetP1=${s.targetP1}`);
  L.push(`InpTargetP2=${s.targetP2}`);
  L.push(`InpMicroSwing=${s.microSwing}`);
  L.push(`InpMaxTradesPerDay=${s.maxTradesPerDay}`);
  L.push(`InpSignalFromH=${s.signalFromH}`);
  L.push(`InpSignalFromM=${s.signalFromM}`);
  L.push(`InpSignalToH=${s.signalToH}`);
  L.push(`InpSignalToM=${s.signalToM}`);
  L.push(`InpAllowLongs=${b(s.allowLongs)}`);
  L.push(`InpAllowShorts=${b(s.allowShorts)}`);
  L.push(`InpTrendMode=${s.trendMode}`);
  L.push(`InpTrendTF=${tfEnum(s.trendTF)}`);
  L.push(`InpSLBufferATR=${s.slBufferATR}`);
  L.push(`InpTP1_R=${s.tp1R}`);
  L.push(`InpPartialPct=${s.partialPct}`);
  L.push(`InpTPMode=${s.tpMode}`);
  L.push(`InpRunnerMaxR=${s.runnerMaxR}`);
  L.push(`InpUseTrail=${b(s.useTrail)}`);
  L.push(`InpTrail_ATRcoef=${s.trailATRcoef}`);
  L.push(`InpTimeStopBars=${s.timeStopBars}`);
  L.push(`InpUseDayClose=${b(s.useDayClose)}`);
  L.push(`InpForceCloseHourNY=${s.forceCloseHourNY}`);
  L.push(`InpForceCloseMinNY=${s.forceCloseMinNY}`);
  L.push(`InpNoWeekend=${b(s.noWeekend)}`);
  L.push(`InpUseNewsFilter=${b(s.useNewsFilter)}`);
  L.push(`InpNewsCurrencies=${s.newsCurrencies}`);
  return L.join('\r\n') + '\r\n';
}

const TRIG: Record<string, [string, string]> = {
  breakout_swing: ['Ruptura de swing menor + pullback', 'Minor swing breakout + pullback'],
  ma_cross: ['Cruce de medias', 'Moving-average cross'],
  rsi: ['RSI (sobrecompra/sobreventa)', 'RSI (overbought/oversold)'],
  donchian: ['Ruptura de canal Donchian', 'Donchian channel breakout'],
  time: ['Entrada por hora fija', 'Fixed-time entry'],
};
const TREND = [['Media', 'Moving average'], ['Estructura (HH/HL)', 'Structure (HH/HL)'], ['Donchian', 'Donchian']];
const MODE = [['Fase 1 (reto)', 'Phase 1 (challenge)'], ['Fase 2 (verificación)', 'Phase 2 (verification)'], ['Real (fondeada)', 'Real (funded)']];
const DD = [['Trailing (desde el pico)', 'Trailing (from peak)'], ['Estático (desde balance inicial)', 'Static (from initial balance)'], ['Trailing hasta BE, luego fijo', 'Trailing to BE, then fixed']];

// Resumen legible del bot para confirmar antes de generar.
export function summarize(s: BotSpec, en = false): string {
  const p = (a: string, b2: string) => (en ? b2 : a);
  const tg = s.accountMode === 0 ? s.targetP1 : s.accountMode === 1 ? s.targetP2 : 0;
  return [
    `${s.name} · ${s.platform.toUpperCase()} · ${s.symbol}`,
    p('— Entrada: ', '— Entry: ') + (TRIG[s.entryTrigger]?.[en ? 1 : 0] || s.entryTrigger) + p(` (sesgo ${TREND[s.trendMode][en ? 1 : 0]} en ${s.trendTF})`, ` (bias ${TREND[s.trendMode][en ? 1 : 0]} on ${s.trendTF})`),
    p(`— Dirección: `, `— Direction: `) + [s.allowLongs && p('largos', 'longs'), s.allowShorts && p('cortos', 'shorts')].filter(Boolean).join(' + '),
    p(`— Salida: SL estructura −${s.slBufferATR}·ATR · TP1 ${s.tp1R}R (${s.partialPct}%) · runner ${s.tpMode === 1 ? p('estructura', 'structure') : s.runnerMaxR + 'R'} · trailing ${s.useTrail ? p('ON', 'ON') + ` ${s.trailATRcoef}·ATR` : 'off'}`, `— Exit: SL structure −${s.slBufferATR}·ATR · TP1 ${s.tp1R}R (${s.partialPct}%) · runner ${s.tpMode === 1 ? 'structure' : s.runnerMaxR + 'R'} · trailing ${s.useTrail ? 'ON ' + s.trailATRcoef + '·ATR' : 'off'}`),
    p(`— Riesgo: ${s.riskPct}%/op · cap diario ${s.dailyLossCapPct}% · máx ${s.maxTradesPerDay || '∞'} ops/día`, `— Risk: ${s.riskPct}%/trade · daily cap ${s.dailyLossCapPct}% · max ${s.maxTradesPerDay || '∞'} trades/day`),
    p(`— Fondeo: ${s.firmName} · DD ${DD[s.ddType][0]} · límites ${s.firmDailyLimitPct}% día / ${s.firmTotalLimitPct}% total`, `— Firm: ${s.firmName} · DD ${DD[s.ddType][1]} · limits ${s.firmDailyLimitPct}% day / ${s.firmTotalLimitPct}% total`),
    p(`— Frenos del bot: suave ${s.acctSoftStopPct}% · duro ${s.acctDailyStopPct}% día · total ${s.acctMaxDDPct}%`, `— Bot brakes: soft ${s.acctSoftStopPct}% · hard ${s.acctDailyStopPct}% day · total ${s.acctMaxDDPct}%`),
    p(`— Cuenta: ${MODE[s.accountMode][0]}${tg ? ` · objetivo +${tg}%` : ''}${s.initBalance ? ` · inicial $${s.initBalance}` : ''}`, `— Account: ${MODE[s.accountMode][1]}${tg ? ` · target +${tg}%` : ''}${s.initBalance ? ` · initial $${s.initBalance}` : ''}`),
    p(`— Horario: ${pad(s.signalFromH)}:${pad(s.signalFromM)}–${pad(s.signalToH)}:${pad(s.signalToM)}${s.useDayClose ? ` · cierra ${pad(s.forceCloseHourNY)}:${pad(s.forceCloseMinNY)}` : ''}${s.noWeekend ? p(' · sin fin de semana', ' · no weekend') : ''}`, `— Hours: ${pad(s.signalFromH)}:${pad(s.signalFromM)}–${pad(s.signalToH)}:${pad(s.signalToM)}${s.useDayClose ? ` · close ${pad(s.forceCloseHourNY)}:${pad(s.forceCloseMinNY)}` : ''}${s.noWeekend ? ' · no weekend' : ''}`),
    p(`— Noticias: ${s.useNewsFilter ? `frena en ${s.newsCurrencies} (alto impacto)` : 'off'}`, `— News: ${s.useNewsFilter ? `pause on ${s.newsCurrencies} (high impact)` : 'off'}`),
    p(`— Magic ${s.magic} · reporta a Onyx via tu conector`, `— Magic ${s.magic} · reports to Onyx via your connector`),
  ].join('\n');
}
function pad(n: number) { return String(n).padStart(2, '0'); }
