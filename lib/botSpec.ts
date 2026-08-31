// ============================================================
// Constructor de bots — modelo de la "receta" (spec) + generadores.
// Cada valor de salida/objetivo lleva su UNIDAD ($, %, pips o RR) donde aplica.
// De aquí salen: resumen legible, archivo .set de MT5 (valor + unidad) y el EA.
// ============================================================

export type Platform = 'mt5' | 'mt4' | 'ctrader';

export type BotSpec = {
  // General
  name: string; platform: Platform; symbol: string; magic: number; tf: string; botLang: string;
  // Entrada
  entryTrigger: string; microSwing: number; trendMode: number; trendTF: string;
  // Parámetros del gatillo (según entryTrigger): medias, RSI, Donchian, hora fija.
  maFast: number; maSlow: number; rsiPeriod: number; rsiOS: number; rsiOB: number; donchN: number; entryHour: number;
  allowLongs: boolean; allowShorts: boolean; maxTradesPerDay: number;
  signalFromH: number; signalFromM: number; signalToH: number; signalToM: number;
  // Varias ventanas/sesiones de operación (hora del servidor). El bot busca entradas
  // si la hora cae dentro de CUALQUIER ventana. signalFrom/To arriba = espejo de la 1ª.
  windows: { fh: number; fm: number; th: number; tm: number }[];
  // Días en que opera (bitmask sobre DayOfWeek 0=Dom..6=Sáb). Default Lun-Vie = 62.
  tradeDays: number;
  // Riesgo (valor + unidad: pct | money)
  riskVal: number; riskUnit: string; maxLots: number;
  // Stop loss (valor + unidad: pips | atr | pct)
  slVal: number; slUnit: string;
  // TP1 parcial (valor + unidad: rr | pips | pct | money) + % que cierra
  tp1Val: number; tp1Unit: string; partialPct: number;
  // Runner / TP final (valor + unidad: rr | pips | pct | money | structure)
  runnerVal: number; runnerUnit: string;
  // Trailing (valor + unidad: atr | pips | pct) + time-stop + BE
  useTrail: boolean; trailVal: number; trailUnit: string; timeStopBars: number; beOffsetR: number;
  // Cap de pérdida diaria (valor + unidad: pct | money)
  dailyLossVal: number; dailyLossUnit: string;
  // Objetivo de ganancia diaria (valor + unidad: pct | money). 0 = off
  dailyProfitVal: number; dailyProfitUnit: string;
  // Reglas de fondeo
  firmName: string; ddType: number; firmDailyLimitPct: number; firmTotalLimitPct: number;
  // Frenos del bot
  acctSoftStopPct: number; acctDailyStopPct: number; acctMaxDDPct: number;
  // Objetivo de cuenta (fase)
  accountMode: number; initBalance: number; targetP1: number; targetP2: number;
  // Horario / cierre
  useDayClose: boolean; forceCloseHourNY: number; forceCloseMinNY: number; noWeekend: boolean; serverGmt: number;
  // Noticias
  useNewsFilter: boolean; newsCurrencies: string; newsImpact: string; newsBefore: number; newsAfter: number;
};

export const DEFAULT_SPEC: BotSpec = {
  name: 'Mi bot', platform: 'mt5', symbol: 'XAUUSD', magic: 991000, tf: 'M5', botLang: 'es',
  entryTrigger: 'breakout_swing', microSwing: 2, trendMode: 1, trendTF: 'H1', allowLongs: true, allowShorts: true,
  maFast: 12, maSlow: 50, rsiPeriod: 14, rsiOS: 30, rsiOB: 70, donchN: 20, entryHour: 9,
  maxTradesPerDay: 20, signalFromH: 8, signalFromM: 0, signalToH: 20, signalToM: 0, windows: [{ fh: 8, fm: 0, th: 20, tm: 0 }], tradeDays: 62,
  riskVal: 0.2, riskUnit: 'pct', maxLots: 50,
  slVal: 0.5, slUnit: 'atr',
  tp1Val: 1.0, tp1Unit: 'rr', partialPct: 50,
  runnerVal: 3.0, runnerUnit: 'rr',
  useTrail: true, trailVal: 1.5, trailUnit: 'atr', timeStopBars: 12, beOffsetR: 0,
  dailyLossVal: 1.5, dailyLossUnit: 'pct',
  dailyProfitVal: 0, dailyProfitUnit: 'pct',
  firmName: 'FTMO', ddType: 1, firmDailyLimitPct: 5, firmTotalLimitPct: 10,
  acctSoftStopPct: 2, acctDailyStopPct: 3, acctMaxDDPct: 8,
  accountMode: 0, initBalance: 0, targetP1: 10, targetP2: 5,
  useDayClose: true, forceCloseHourNY: 20, forceCloseMinNY: 30, noWeekend: true, serverGmt: 3,
  useNewsFilter: true, newsCurrencies: 'USD', newsImpact: 'high', newsBefore: 15, newsAfter: 15,
};

// MISMO set de unidades en toda la zona de salidas (SL, TP, runner, trailing).
export const EXIT_UNITS = ['pips', 'rr', 'pct', 'money', 'atr'];
export const UNITS = {
  risk: ['pct', 'money'],
  sl: EXIT_UNITS, tp: EXIT_UNITS, runner: EXIT_UNITS, trail: EXIT_UNITS,
  acct: ['pct', 'money'],
};
// Código entero unificado de la unidad de salida para el .set / EA.
const codeRisk = (u: string) => (u === 'money' ? 1 : 0);       // risk/acct: pct=0, money=1
const codeU = (u: string) => ({ pips: 0, rr: 1, pct: 2, money: 3, atr: 4 } as any)[u] ?? 0;
const codeSL = codeU, codeTP = codeU, codeRun = codeU, codeTrail = codeU;

const num = (v: any, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const oneOf = (v: any, list: string[], d: string) => (list.includes(v) ? v : d);

export function cleanSpec(inp: any): BotSpec {
  const s: BotSpec = { ...DEFAULT_SPEC, ...(inp || {}) };
  s.name = String(inp?.name || 'Mi bot').slice(0, 40).trim() || 'Mi bot';
  s.platform = (['mt5', 'mt4', 'ctrader'].includes(inp?.platform) ? inp.platform : 'mt5');
  s.botLang = inp?.botLang === 'en' ? 'en' : 'es';
  s.symbol = String(inp?.symbol || 'XAUUSD').slice(0, 80).trim();
  s.magic = clamp(Math.round(num(inp?.magic, 991000)), 1, 2147483000);
  s.tf = String(inp?.tf || 'M5'); s.trendTF = String(inp?.trendTF || 'H1');
  s.entryTrigger = String(inp?.entryTrigger || 'breakout_swing');
  s.microSwing = clamp(Math.round(num(inp?.microSwing, 2)), 1, 10);
  // Parámetros del gatillo (saneados con topes razonables).
  s.maFast = clamp(Math.round(num(inp?.maFast, 12)), 1, 500);
  s.maSlow = clamp(Math.round(num(inp?.maSlow, 50)), 2, 1000);
  s.rsiPeriod = clamp(Math.round(num(inp?.rsiPeriod, 14)), 2, 200);
  s.rsiOS = clamp(Math.round(num(inp?.rsiOS, 30)), 1, 49);
  s.rsiOB = clamp(Math.round(num(inp?.rsiOB, 70)), 51, 99);
  s.donchN = clamp(Math.round(num(inp?.donchN, 20)), 2, 500);
  s.entryHour = clamp(Math.round(num(inp?.entryHour, 9)), 0, 23);
  s.trendMode = clamp(Math.round(num(inp?.trendMode, 1)), 0, 2);
  s.maxTradesPerDay = clamp(Math.round(num(inp?.maxTradesPerDay, 20)), 0, 500);
  s.signalFromH = clamp(Math.round(num(inp?.signalFromH, 8)), 0, 23); s.signalFromM = clamp(Math.round(num(inp?.signalFromM, 0)), 0, 59);
  s.signalToH = clamp(Math.round(num(inp?.signalToH, 20)), 0, 23); s.signalToM = clamp(Math.round(num(inp?.signalToM, 0)), 0, 59);
  s.tradeDays = clamp(Math.round(num(inp?.tradeDays, 62)), 0, 127) || 62;   // días operables (bitmask); nunca 0 (sería nunca operar)
  // Ventanas de operación: lista de {fh,fm,th,tm} saneada. Si no vienen, se arma una
  // desde signalFrom/To (compatibilidad). Máx. 6 ventanas. La 1ª se refleja en signal*.
  const rawW = Array.isArray(inp?.windows) ? inp.windows : [];
  let wins = rawW.slice(0, 6).map((w: any) => ({
    fh: clamp(Math.round(num(w?.fh, 8)), 0, 23), fm: clamp(Math.round(num(w?.fm, 0)), 0, 59),
    th: clamp(Math.round(num(w?.th, 20)), 0, 23), tm: clamp(Math.round(num(w?.tm, 0)), 0, 59),
  }));
  if (!wins.length) wins = [{ fh: s.signalFromH, fm: s.signalFromM, th: s.signalToH, tm: s.signalToM }];
  s.windows = wins;
  // La 1ª ventana alimenta signal* para lectores antiguos (resumen, guía).
  s.signalFromH = wins[0].fh; s.signalFromM = wins[0].fm; s.signalToH = wins[0].th; s.signalToM = wins[0].tm;
  // Riesgo: si es %, tope duro 5%.
  s.riskUnit = oneOf(inp?.riskUnit, UNITS.risk, 'pct');
  s.riskVal = s.riskUnit === 'pct' ? clamp(num(inp?.riskVal, 0.2), 0.01, 5) : clamp(num(inp?.riskVal, 100), 0.01, 1e7);
  s.maxLots = clamp(num(inp?.maxLots, 50), 0.01, 10000);
  s.slUnit = oneOf(inp?.slUnit, UNITS.sl, 'atr'); s.slVal = clamp(num(inp?.slVal, 0.5), 0.01, 100000);
  s.tp1Unit = oneOf(inp?.tp1Unit, UNITS.tp, 'rr'); s.tp1Val = clamp(num(inp?.tp1Val, 1), 0.01, 1e6); s.partialPct = clamp(num(inp?.partialPct, 50), 0, 100);
  s.runnerUnit = oneOf(inp?.runnerUnit, UNITS.runner, 'rr'); s.runnerVal = clamp(num(inp?.runnerVal, 3), 0.01, 1e6);
  s.useTrail = inp?.useTrail !== false; s.trailUnit = oneOf(inp?.trailUnit, UNITS.trail, 'atr'); s.trailVal = clamp(num(inp?.trailVal, 1.5), 0.01, 1e6);
  s.timeStopBars = clamp(Math.round(num(inp?.timeStopBars, 12)), 0, 500); s.beOffsetR = clamp(num(inp?.beOffsetR, 0), -5, 5);
  s.dailyLossUnit = oneOf(inp?.dailyLossUnit, UNITS.acct, 'pct'); s.dailyLossVal = clamp(num(inp?.dailyLossVal, 1.5), 0, 1e7);
  s.dailyProfitUnit = oneOf(inp?.dailyProfitUnit, UNITS.acct, 'pct'); s.dailyProfitVal = clamp(num(inp?.dailyProfitVal, 0), 0, 1e7);
  s.firmName = String(inp?.firmName || 'FTMO').slice(0, 40);
  s.ddType = clamp(Math.round(num(inp?.ddType, 1)), 0, 2);
  s.firmDailyLimitPct = clamp(num(inp?.firmDailyLimitPct, 5), 0, 100); s.firmTotalLimitPct = clamp(num(inp?.firmTotalLimitPct, 10), 0, 100);
  s.acctSoftStopPct = clamp(num(inp?.acctSoftStopPct, 2), 0, 100); s.acctDailyStopPct = clamp(num(inp?.acctDailyStopPct, 3), 0, 100); s.acctMaxDDPct = clamp(num(inp?.acctMaxDDPct, 8), 0, 100);
  s.accountMode = clamp(Math.round(num(inp?.accountMode, 0)), 0, 2); s.initBalance = clamp(num(inp?.initBalance, 0), 0, 1e9);
  s.targetP1 = clamp(num(inp?.targetP1, 10), 0, 100); s.targetP2 = clamp(num(inp?.targetP2, 5), 0, 100);
  s.forceCloseHourNY = clamp(Math.round(num(inp?.forceCloseHourNY, 20)), 0, 23); s.forceCloseMinNY = clamp(Math.round(num(inp?.forceCloseMinNY, 30)), 0, 59);
  s.newsCurrencies = String(inp?.newsCurrencies || 'USD').slice(0, 40).toUpperCase();
  s.newsImpact = oneOf(inp?.newsImpact, ['high', 'med', 'all'], 'high');
  s.newsBefore = clamp(Math.round(num(inp?.newsBefore, 15)), 0, 240); s.newsAfter = clamp(Math.round(num(inp?.newsAfter, 15)), 0, 240);
  s.serverGmt = clamp(Math.round(num(inp?.serverGmt, 3)), -12, 14);
  s.allowLongs = inp?.allowLongs !== false; s.allowShorts = inp?.allowShorts !== false;
  s.useDayClose = inp?.useDayClose !== false; s.noWeekend = inp?.noWeekend !== false; s.useNewsFilter = inp?.useNewsFilter !== false;
  return s;
}

// Todas las temporalidades MT5, de 1 minuto a 1 mes (valores ENUM_TIMEFRAMES).
const TF_ENUM: Record<string, number> = {
  M1: 1, M2: 2, M3: 3, M4: 4, M5: 5, M6: 6, M10: 10, M12: 12, M15: 15, M20: 20, M30: 30,
  H1: 16385, H2: 16386, H3: 16387, H4: 16388, H6: 16390, H8: 16392, H12: 16396,
  D1: 16408, W1: 32769, MN1: 49153,
};
const tfEnum = (tf: string) => TF_ENUM[tf] ?? 5;
// [código, etiqueta ES, etiqueta EN] — para menús bilingües.
export const TF_LIST3: [string, string, string][] = [
  ['M1', '1 min', '1 min'], ['M2', '2 min', '2 min'], ['M3', '3 min', '3 min'], ['M4', '4 min', '4 min'], ['M5', '5 min', '5 min'], ['M6', '6 min', '6 min'],
  ['M10', '10 min', '10 min'], ['M12', '12 min', '12 min'], ['M15', '15 min', '15 min'], ['M20', '20 min', '20 min'], ['M30', '30 min', '30 min'],
  ['H1', '1 h', '1 h'], ['H2', '2 h', '2 h'], ['H3', '3 h', '3 h'], ['H4', '4 h', '4 h'], ['H6', '6 h', '6 h'], ['H8', '8 h', '8 h'], ['H12', '12 h', '12 h'],
  ['D1', '1 día', '1 day'], ['W1', '1 semana', '1 week'], ['MN1', '1 mes', '1 month'],
];
export const tfOptions = (en: boolean): [string, string][] => TF_LIST3.map(([v, es, e]) => [v, en ? e : es]);
// Símbolos comunes (con alias por broker) para sugerir en el menú del instrumento.
export const SYMBOL_HINTS = ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'US2000', 'USOIL', 'BTCUSD', 'ETHUSD'];
const bl = (v: boolean) => (v ? 'true' : 'false');

export function toSetFile(s: BotSpec): string {
  const L: string[] = [`; ${s.name} — Onyx Bot Builder`];
  const P = (k: string, v: any) => L.push(`${k}=${v}`);
  P('InpSymbol', s.symbol); P('InpMagic', s.magic); P('InpComment', s.name); P('InpTF', tfEnum(s.tf));
  P('InpEntry', { breakout_swing: 0, ma_cross: 1, rsi: 2, donchian: 3, time: 4 }[s.entryTrigger] ?? 1);
  P('InpMAfast', s.maFast); P('InpMAslow', s.maSlow); P('InpRSIperiod', s.rsiPeriod); P('InpRSIos', s.rsiOS); P('InpRSIob', s.rsiOB); P('InpDonchN', s.donchN); P('InpEntryHour', s.entryHour);
  P('InpMicroSwing', s.microSwing); P('InpTrendMode', s.trendMode); P('InpTrendTF', tfEnum(s.trendTF));
  P('InpAllowLongs', bl(s.allowLongs)); P('InpAllowShorts', bl(s.allowShorts)); P('InpMaxTradesPerDay', s.maxTradesPerDay);
  P('InpSignalFromH', s.signalFromH); P('InpSignalFromM', s.signalFromM); P('InpSignalToH', s.signalToH); P('InpSignalToM', s.signalToM);
  // Ventanas como "fMin-tMin,fMin-tMin" en minutos del servidor (varias sesiones).
  P('InpWindows', (s.windows || []).map((w) => `${w.fh * 60 + w.fm}-${w.th * 60 + w.tm}`).join(','));
  P('InpTradeDays', s.tradeDays);
  P('InpRiskUnit', codeRisk(s.riskUnit)); P('InpRiskValue', s.riskVal); P('InpMaxLots', s.maxLots);
  P('InpSLUnit', codeSL(s.slUnit)); P('InpSLValue', s.slVal);
  P('InpTP1Unit', codeTP(s.tp1Unit)); P('InpTP1Value', s.tp1Val); P('InpPartialPct', s.partialPct);
  P('InpRunnerUnit', codeRun(s.runnerUnit)); P('InpRunnerValue', s.runnerVal);
  P('InpUseTrail', bl(s.useTrail)); P('InpTrailUnit', codeTrail(s.trailUnit)); P('InpTrailValue', s.trailVal);
  P('InpBEOffsetR', s.beOffsetR); P('InpTimeStopBars', s.timeStopBars);
  P('InpDailyLossUnit', codeRisk(s.dailyLossUnit)); P('InpDailyLossValue', s.dailyLossVal);
  P('InpDailyProfitUnit', codeRisk(s.dailyProfitUnit)); P('InpDailyProfitValue', s.dailyProfitVal);
  P('InpFirmName', s.firmName); P('InpDDType', s.ddType); P('InpFirmTotalLimitPct', s.firmTotalLimitPct);
  P('InpAcctSoftStopPct', s.acctSoftStopPct); P('InpAcctDailyStopPct', s.acctDailyStopPct); P('InpAcctMaxDDPct', s.acctMaxDDPct);
  P('InpAccountMode', s.accountMode); P('InpInitBalance', s.initBalance); P('InpTargetP1', s.targetP1); P('InpTargetP2', s.targetP2);
  P('InpUseDayClose', bl(s.useDayClose)); P('InpForceCloseHourNY', s.forceCloseHourNY); P('InpForceCloseMinNY', s.forceCloseMinNY); P('InpNoWeekend', bl(s.noWeekend));
  P('InpUseNews', bl(s.useNewsFilter)); P('InpNewsCur', s.newsCurrencies); P('InpNewsImpact', { high: 0, med: 1, all: 2 }[s.newsImpact] ?? 0); P('InpNewsBefore', s.newsBefore); P('InpNewsAfter', s.newsAfter);
  return L.join('\r\n') + '\r\n';
}

// Etiqueta corta de una unidad.
export function unitLabel(u: string, en = false): string {
  const M: Record<string, [string, string]> = { pct: ['%', '%'], money: ['$', '$'], pips: ['pips', 'pips'], atr: ['× ATR', '× ATR'], rr: ['R', 'R'], structure: [en ? 'structure' : 'estructura', 'structure'] };
  return (M[u] || [u, u])[en ? 1 : 0];
}
const TRIG: Record<string, [string, string]> = {
  breakout_swing: ['Ruptura de swing + pullback', 'Swing breakout + pullback'], ma_cross: ['Cruce de medias', 'MA cross'],
  rsi: ['RSI', 'RSI'], donchian: ['Donchian', 'Donchian'], time: ['Hora fija', 'Fixed time'],
};
const TREND = [['Media', 'MA'], ['Estructura', 'Structure'], ['Donchian', 'Donchian']];
const MODE = [['Fase 1', 'Phase 1'], ['Fase 2', 'Phase 2'], ['Real', 'Real']];
const DD = [['Trailing', 'Trailing'], ['Estático', 'Static'], ['Trailing→BE', 'Trailing→BE']];

export function summarize(s: BotSpec, en = false): string {
  const p = (a: string, b2: string) => (en ? b2 : a);
  const u = (x: string) => unitLabel(x, en);
  const tg = s.accountMode === 0 ? s.targetP1 : s.accountMode === 1 ? s.targetP2 : 0;
  return [
    `${s.name} · ${s.platform.toUpperCase()} · ${s.symbol}`,
    p('— Entrada: ', '— Entry: ') + (TRIG[s.entryTrigger]?.[en ? 1 : 0] || s.entryTrigger) + ` (${p('sesgo', 'bias')} ${TREND[s.trendMode][en ? 1 : 0]} ${s.trendTF})`,
    p('— Riesgo: ', '— Risk: ') + `${s.riskVal} ${u(s.riskUnit)}/op`,
    p('— Stop loss: ', '— Stop loss: ') + `${s.slVal} ${u(s.slUnit)}`,
    p('— TP1: ', '— TP1: ') + `${s.tp1Val} ${u(s.tp1Unit)} (${s.partialPct}%)  ·  ${p('runner', 'runner')} ${s.runnerUnit === 'structure' ? u('structure') : s.runnerVal + ' ' + u(s.runnerUnit)}  ·  ${p('trailing', 'trailing')} ${s.useTrail ? s.trailVal + ' ' + u(s.trailUnit) : 'off'}`,
    p('— Cap diario: ', '— Daily cap: ') + `${s.dailyLossVal} ${u(s.dailyLossUnit)}` + (s.dailyProfitVal > 0 ? p(`  ·  objetivo diario ${s.dailyProfitVal} ${u(s.dailyProfitUnit)}`, `  ·  daily target ${s.dailyProfitVal} ${u(s.dailyProfitUnit)}`) : ''),
    p('— Fondeo: ', '— Firm: ') + `${s.firmName} · DD ${DD[s.ddType][en ? 1 : 0]} · ${s.firmTotalLimitPct}% ${p('total', 'total')}`,
    p('— Frenos: ', '— Brakes: ') + `${p('suave', 'soft')} ${s.acctSoftStopPct}% · ${p('duro', 'hard')} ${s.acctDailyStopPct}% · ${p('total', 'total')} ${s.acctMaxDDPct}%`,
    p('— Cuenta: ', '— Account: ') + `${MODE[s.accountMode][en ? 1 : 0]}${tg ? ` · ${p('objetivo', 'target')} +${tg}%` : ''}`,
    p('— Horario: ', '— Hours: ') + `${pad(s.signalFromH)}:${pad(s.signalFromM)}–${pad(s.signalToH)}:${pad(s.signalToM)}${s.noWeekend ? p(' · sin fin de semana', ' · no weekend') : ''}`,
    p('— Magic ', '— Magic ') + `${s.magic} · ${p('reporta a Onyx', 'reports to Onyx')}`,
  ].join('\n');
}
function pad(n: number) { return String(n).padStart(2, '0'); }
