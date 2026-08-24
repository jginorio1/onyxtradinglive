import { getSetting, saveSetting } from '@/lib/settings';

// ============================================================
// Configuración del REPORTE de rendimiento por Telegram (editable en Admin).
// Se entrega a cada trader a SU hora local (usamos su desfase horario), así
// todos lo reciben, por ejemplo, el sábado a las 5pm de su reloj.
// ============================================================

export type ReportConfig = {
  enabled: boolean;
  day: number;          // 0=domingo … 6=sábado (día LOCAL del envío semanal)
  hour: number;         // 0-23, hora LOCAL del trader
  monthly: boolean;     // además, el día 1 del mes
  attachImage: boolean;
  attachPdf: boolean;
  attachCsv: boolean;
  defaultTzMin: number; // desfase por defecto (min) si no conocemos el del trader. UTC-3 = -180
  title_es: string; title_en: string;
  body_es: string; body_en: string;
};

export const REPORT_DEFAULT: ReportConfig = {
  enabled: true,
  day: 6,               // sábado
  hour: 17,             // 5pm local
  monthly: true,
  attachImage: true,
  attachPdf: true,
  attachCsv: true,
  defaultTzMin: -180,   // UTC-3 (mercado latino) como respaldo
  title_es: '📊 Tu reporte {cadencia}',
  title_en: '📊 Your {cadencia} report',
  body_es: 'Resultado neto: {neto}\nOperaciones: {ops} · Aciertos: {winrate}%\nProfit factor: {pf}\nMejor par: {mejor_par}',
  body_en: 'Net result: {neto}\nTrades: {ops} · Win rate: {winrate}%\nProfit factor: {pf}\nBest pair: {mejor_par}',
};

const n = (v: any, lo: number, hi: number, d: number) => {
  const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d;
};
const s = (v: any, d: string) => (typeof v === 'string' && v.trim() ? v : d);

export function normalizeReportConfig(raw: any): ReportConfig {
  const d = REPORT_DEFAULT;
  return {
    enabled: raw?.enabled !== false,
    day: n(raw?.day, 0, 6, d.day),
    hour: n(raw?.hour, 0, 23, d.hour),
    monthly: raw?.monthly !== false,
    attachImage: raw?.attachImage !== false,
    attachPdf: raw?.attachPdf !== false,
    attachCsv: raw?.attachCsv !== false,
    defaultTzMin: n(raw?.defaultTzMin, -840, 840, d.defaultTzMin),
    title_es: s(raw?.title_es, d.title_es), title_en: s(raw?.title_en, d.title_en),
    body_es: s(raw?.body_es, d.body_es), body_en: s(raw?.body_en, d.body_en),
  };
}

export async function reportConfig(): Promise<ReportConfig> {
  return normalizeReportConfig(await getSetting('tg_report_config', REPORT_DEFAULT));
}
export async function saveReportConfig(raw: any): Promise<ReportConfig> {
  const cfg = normalizeReportConfig(raw);
  await saveSetting('tg_report_config', cfg);
  return cfg;
}

// Rellena las variables de una plantilla con los datos del reporte.
export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_m, k) => (vars[k] != null ? vars[k] : `{${k}}`));
}
