import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { robustnessRun, compareBacktest, type Trade, type Grid } from '@/lib/robustness';
import { robustnessAudit } from '@/lib/factoryAI';

// ============================================================
// Onyx Bot Factory · Fase 1
//  · Nombre automático ÚNICO no editable.
//  · Validación de calidad de los datos de backtest (veredicto server-side).
//  · Constructor de robots solo-admin.
// ============================================================

// -------- Nombre automático único --------
// Nombres clave (constelaciones + aves rapaces) para robots memorables.
const CODENAMES = [
  'Falcon', 'Orion', 'Vega', 'Atlas', 'Nova', 'Lyra', 'Draco', 'Corvus', 'Hydra', 'Phoenix',
  'Sirius', 'Altair', 'Rigel', 'Pollux', 'Cygnus', 'Aquila', 'Perseus', 'Titan', 'Kraken', 'Osprey',
  'Halcón', 'Cobra', 'Lynx', 'Raven', 'Vulcan', 'Nebula', 'Comet', 'Pulsar', 'Quasar', 'Zephyr',
];

// Genera un nombre único ONYX-<Codename>-<###>. El secuencial global garantiza
// que nunca se repita; se verifica contra la base por si acaso.
export async function genUniqueName(): Promise<{ name: string; codename: string; seq: number }> {
  const { data } = await supabaseAdmin.from('factory_bots').select('seq').order('seq', { ascending: false }).limit(1);
  let seq = (((data || [])[0] as any)?.seq || 0) + 1;
  for (let i = 0; i < 50; i++) {
    const codename = CODENAMES[(seq - 1) % CODENAMES.length];
    const name = `ONYX-${codename}-${String(seq).padStart(3, '0')}`;
    const { data: hit } = await supabaseAdmin.from('factory_bots').select('id').eq('name', name).maybeSingle();
    if (!hit) return { name, codename, seq };
    seq++;
  }
  // Respaldo improbable: sufijo aleatorio.
  const codename = CODENAMES[Math.floor(Math.random() * CODENAMES.length)];
  return { name: `ONYX-${codename}-${Date.now().toString().slice(-5)}`, codename, seq };
}

// -------- Validación de calidad de datos --------
// El cliente parsea el archivo y calcula estas métricas crudas; el veredicto
// (score + checks) se decide AQUÍ, en el servidor, para que sea confiable.
export type DataMetrics = {
  rows: number;            // nº de filas de datos leídas
  parsed: boolean;         // se pudo interpretar el formato
  fromMs?: number;         // primer timestamp (ms)
  toMs?: number;           // último timestamp (ms)
  outOfOrder?: number;     // filas fuera de orden cronológico
  duplicates?: number;     // timestamps repetidos
  gaps?: number;           // huecos intra-mercado sospechosos
  hasTicks?: boolean;      // true = bid/ask (ticks reales), false = solo OHLC
  spreadAvgPts?: number;   // spread medio en puntos (si hay ticks)
  spreadZero?: number;     // nº de ticks con spread 0 (sospechoso)
  anomalies?: number;      // saltos de precio imposibles
  truncated?: boolean;     // se leyó una muestra (archivo enorme)
};
export type QCheck = { key: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string };
export type QResult = { score: number; verdict: 'apta' | 'reservas' | 'rechazada'; checks: QCheck[]; years: number; hasTicks: boolean };

const MIN_YEARS = 3;       // histórico ideal
const MIN_ROWS = 5000;     // muestra mínima creíble

export function validateMetrics(m: DataMetrics): QResult {
  const checks: QCheck[] = [];
  const push = (key: string, label: string, status: QCheck['status'], detail: string) => checks.push({ key, label, status, detail });
  const years = m.fromMs && m.toMs ? Math.max(0, (m.toMs - m.fromMs) / (365.25 * 86400000)) : 0;
  const yearsTxt = years >= 0.1 ? years.toFixed(1) + ' años' : '—';

  // No se pudo leer → rechazada de inmediato.
  if (!m.parsed || !m.rows) {
    push('parse', 'Lectura del archivo', 'fail', 'No se pudo interpretar el formato (usa CSV de MT4/MT5 con fecha, hora y precios).');
    return { score: 0, verdict: 'rechazada', checks, years: 0, hasTicks: false };
  }

  // 1) Cobertura / tamaño de muestra.
  if (m.rows >= MIN_ROWS * 20) push('rows', 'Cobertura de datos', 'pass', `${m.rows.toLocaleString('en-US')} filas${m.truncated ? ' (muestra)' : ''}`);
  else if (m.rows >= MIN_ROWS) push('rows', 'Cobertura de datos', 'warn', `${m.rows.toLocaleString('en-US')} filas · algo escaso`);
  else push('rows', 'Cobertura de datos', 'fail', `Solo ${m.rows.toLocaleString('en-US')} filas · insuficiente`);

  // 2) Ticks reales vs solo barras (el requisito de "todos los ticks").
  if (m.hasTicks) push('ticks', 'Ticks reales', 'pass', `bid/ask presentes · spread medio ${Math.round(m.spreadAvgPts || 0)} pts`);
  else push('ticks', 'Ticks reales', 'warn', 'Son barras OHLC, no ticks reales · el modelado es menos fiel');

  // 3) Historial suficiente.
  if (years >= MIN_YEARS) push('years', 'Historial', 'pass', `${yearsTxt} ≥ mínimo ${MIN_YEARS}`);
  else if (years >= 1) push('years', 'Historial', 'warn', `${yearsTxt} · poco para validar regímenes`);
  else push('years', 'Historial', 'fail', `${yearsTxt} · muy corto`);

  // 4) Cronología.
  const oo = m.outOfOrder || 0;
  if (oo === 0) push('chrono', 'Cronología', 'pass', 'Orden temporal correcto');
  else if (oo <= Math.max(5, m.rows * 0.0005)) push('chrono', 'Cronología', 'warn', `${oo} filas fuera de orden`);
  else push('chrono', 'Cronología', 'fail', `${oo} filas desordenadas · datos corruptos`);

  // 5) Duplicados.
  const dup = m.duplicates || 0;
  if (dup === 0) push('dupes', 'Duplicados', 'pass', 'Sin timestamps repetidos');
  else if (dup <= m.rows * 0.001) push('dupes', 'Duplicados', 'warn', `${dup} repetidos`);
  else push('dupes', 'Duplicados', 'fail', `${dup} repetidos · limpia el archivo`);

  // 6) Huecos de mercado.
  const gaps = m.gaps || 0;
  if (gaps <= 10) push('gaps', 'Huecos de mercado', 'pass', `${gaps} huecos · normal`);
  else if (gaps <= 60) push('gaps', 'Huecos de mercado', 'warn', `${gaps} huecos · revisa festivos/feed`);
  else push('gaps', 'Huecos de mercado', 'fail', `${gaps} huecos · faltan datos`);

  // 7) Spread (si hay ticks).
  if (m.hasTicks) {
    const z = m.spreadZero || 0;
    if (z === 0 && (m.spreadAvgPts || 0) > 0) push('spread', 'Spread realista', 'pass', `medio ${Math.round(m.spreadAvgPts || 0)} pts · nunca 0`);
    else push('spread', 'Spread realista', 'warn', `${z} ticks con spread 0 · optimista`);
  }

  // 8) Precios anómalos.
  const an = m.anomalies || 0;
  if (an === 0) push('anom', 'Sin precios anómalos', 'pass', '0 saltos imposibles');
  else if (an <= 5) push('anom', 'Sin precios anómalos', 'warn', `${an} saltos raros`);
  else push('anom', 'Sin precios anómalos', 'fail', `${an} saltos imposibles · datos sucios`);

  // Puntuación: parte de 100 y descuenta por warn/fail.
  let score = 100;
  for (const c of checks) score -= c.status === 'fail' ? 26 : c.status === 'warn' ? 9 : 0;
  score = Math.max(0, Math.min(100, score));

  const hasFail = checks.some((c) => c.status === 'fail');
  // Sin ticks reales nunca pasa de "reservas" (no cumple "todos los ticks").
  const capNoTicks = !m.hasTicks;
  let verdict: QResult['verdict'];
  if (hasFail || score < 55) verdict = 'rechazada';
  else if (score >= 80 && !capNoTicks) verdict = 'apta';
  else verdict = 'reservas';

  return { score, verdict, checks, years: Number(years.toFixed(2)), hasTicks: !!m.hasTicks };
}

// Guarda un dataset ya validado.
export async function saveDataset(o: { userId: string; symbol: string; timeframe: string; filename: string; metrics: DataMetrics }) {
  const q = validateMetrics(o.metrics);
  const { data, error } = await supabaseAdmin.from('factory_datasets').insert({
    symbol: (o.symbol || '').slice(0, 30) || null,
    timeframe: (o.timeframe || '').slice(0, 12) || null,
    filename: (o.filename || '').slice(0, 160) || null,
    years: q.years,
    from_date: o.metrics.fromMs ? new Date(o.metrics.fromMs).toISOString() : null,
    to_date: o.metrics.toMs ? new Date(o.metrics.toMs).toISOString() : null,
    rows: o.metrics.rows || 0,
    has_ticks: !!o.metrics.hasTicks,
    quality_score: q.score,
    verdict: q.verdict,
    checks: q.checks,
    metrics: o.metrics,
    created_by: o.userId,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return { dataset: data, quality: q };
}

export async function listDatasets(limit = 40) {
  const { data } = await supabaseAdmin.from('factory_datasets').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data || []) as any[];
}

// -------- Constructor de robots --------
export async function createBot(o: { userId: string; platform: string; symbol: string; timeframe: string; strategy?: any; datasetId?: string | null }) {
  const platform = o.platform === 'mt4' ? 'mt4' : 'mt5';
  // El robot debe apoyarse en datos aptos (o con reservas), nunca rechazados.
  if (o.datasetId) {
    const { data: ds } = await supabaseAdmin.from('factory_datasets').select('verdict').eq('id', o.datasetId).maybeSingle();
    if (ds && (ds as any).verdict === 'rechazada') throw new Error('Esos datos fueron rechazados por calidad. Sube un dataset apto antes de crear el robot.');
  }
  const { name, codename, seq } = await genUniqueName();
  const { data, error } = await supabaseAdmin.from('factory_bots').insert({
    name, codename, seq, platform,
    symbol: (o.symbol || '').slice(0, 30) || null,
    timeframe: (o.timeframe || '').slice(0, 12) || null,
    strategy: o.strategy || {},
    dataset_id: o.datasetId || null,
    stage: 'genesis', status: 'draft', health: 'green',
    created_by: o.userId,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listBots(limit = 100) {
  const { data } = await supabaseAdmin.from('factory_bots').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data || []) as any[];
}

export async function deleteBot(id: string) {
  await supabaseAdmin.from('factory_bots').delete().eq('id', id);
  return { ok: true };
}

// ============================================================
// Laboratorio de robustez (Fase 2)
// ============================================================

// Ejecuta el laboratorio sobre las operaciones de un backtest, guarda la corrida
// y refleja el resultado en el robot. Llama a Claude para la interpretación.
export async function runLab(o: { userId: string; botId: string; trades: Trade[]; grid?: Grid; paramCount?: number; lang?: 'es' | 'en' }) {
  if (!o.trades || o.trades.length < 20) throw new Error('Sube al menos 20 operaciones cerradas del backtest.');
  const { data: bot } = await supabaseAdmin.from('factory_bots').select('*').eq('id', o.botId).maybeSingle();
  if (!bot) throw new Error('Robot no encontrado.');
  const r = robustnessRun(o.trades, { grid: o.grid, paramCount: o.paramCount });
  let ai: { audit: string; mutations: string[] } | null = null;
  try { ai = await robustnessAudit(bot, r, o.lang || 'es'); } catch { ai = null; }

  const { data: run, error } = await supabaseAdmin.from('factory_labruns').insert({
    bot_id: o.botId, trades: r.trades, net: r.net, pf: r.pf, maxdd: r.maxdd,
    is_pf: r.isPf, oos_pf: r.oosPf, oos_retention: r.retention, wfo_consistency: r.wfoConsistency,
    mc_loss_prob: r.mc.lossProb, mc_median_dd: r.mc.medianDD, mc_p95_dd: r.mc.p95DD,
    sensitivity: r.sensitivity, param_count: r.paramCount, robustness_score: r.score, verdict: r.verdict,
    flags: r.flags, charts: r.charts, expected: r.expected, ai_audit: ai?.audit || null, mutations: ai?.mutations || [],
    created_by: o.userId,
  }).select('*').single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from('factory_bots').update({
    robustness_score: r.score, robustness_verdict: r.verdict, stage: 'lab', lab_at: new Date().toISOString(),
  }).eq('id', o.botId);

  return { run, robustness: r, ai };
}

export async function listLabRuns(botId: string, limit = 10) {
  const { data } = await supabaseAdmin.from('factory_labruns').select('*').eq('bot_id', botId).order('created_at', { ascending: false }).limit(limit);
  return (data || []) as any[];
}

// Compara los KPIs del laboratorio con el backtest REAL de MetaTrader.
export async function compareBt(o: { runId: string; botId: string; mt: any }) {
  const { data: run } = await supabaseAdmin.from('factory_labruns').select('id,expected').eq('id', o.runId).maybeSingle();
  if (!run) throw new Error('Corrida no encontrada.');
  const cmp = compareBacktest((run as any).expected || {}, o.mt || {});
  await supabaseAdmin.from('factory_labruns').update({ mt_backtest: o.mt, divergence: cmp.divergence }).eq('id', o.runId);
  await supabaseAdmin.from('factory_bots').update({ bt_divergence: cmp.divergence }).eq('id', o.botId);
  return cmp;
}

// Compuerta: pasa el robot a demo si es robusto/moderado y el backtest de
// MetaTrader se parece al esperado (divergencia baja).
export async function advanceToDemo(botId: string) {
  const { data: bot } = await supabaseAdmin.from('factory_bots').select('robustness_verdict,bt_divergence').eq('id', botId).maybeSingle();
  if (!bot) throw new Error('Robot no encontrado.');
  const b = bot as any;
  if (b.robustness_verdict === 'fragil' || b.robustness_verdict == null) throw new Error('El robot debe pasar el laboratorio (robusto o moderado) antes de ir a demo.');
  if (b.bt_divergence == null) throw new Error('Primero compara con el backtest de MetaTrader.');
  if (b.bt_divergence > 25) throw new Error('El backtest de MetaTrader no se parece lo suficiente al esperado (divergencia alta). Revisa antes de pasar a demo.');
  await supabaseAdmin.from('factory_bots').update({ demo_ready: true, stage: 'demo' }).eq('id', botId);
  return { ok: true };
}

export async function factoryStats() {
  const [{ count: bots }, { count: datasets }] = await Promise.all([
    supabaseAdmin.from('factory_bots').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('factory_datasets').select('*', { count: 'exact', head: true }),
  ]);
  return { bots: bots || 0, datasets: datasets || 0 };
}
