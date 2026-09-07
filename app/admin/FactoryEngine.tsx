'use client';
import { useMemo, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { BLOCKS, sampleCandidates, enrichSpec } from '@/lib/stratgen';
import { parseBars, parseBarsStreaming, runBacktest, inferPip, type Bar, type Spec, type Costs } from '@/lib/backtest';
import { evolve, evaluate, type Survivor } from '@/lib/evolve';
import { genMt5, genMt4 } from '@/lib/mqlgen';
import { barsFromColumnar, fetchColumnar, type ColumnarBars } from '@/lib/dataAnalyzer';
import { mcSuite } from '@/lib/montecarlo';
import { walkForwardMatrix } from '@/lib/walkforward';
import { optimize, specFromCell, type OptResult, type OptAxis } from '@/lib/optimizer';
import { buildPortfolio, type PortMember, type PortResult } from '@/lib/portfolio';
import { buildReport, type FullReport } from '@/lib/report';
import { onyxScore, type OnyxScore } from '@/lib/score';
import { ProgressBar, ProgressBarIndeterminate } from './ProgressBar';
import { Help } from './HelpTip';

// Explicación de cada campo (qué es + qué poner), bilingüe. Se muestra en el ⓘ.
function tip(es: boolean, k: string): string {
  const T: Record<string, [string, string]> = {
    spreadPips: ['Coste que cobra tu broker en cada operación. Pon el real: FX ≈ 1, oro ≈ 20–30, índices varía.', 'Broker cost per trade. Use your real spread: FX ≈ 1, gold ≈ 20–30, indices vary.'],
    slippagePips: ['Cuánto se desliza el precio al entrar y salir. Pon 0.2 – 0.5.', 'Price slippage on entry/exit. Use 0.2 – 0.5.'],
    commission: ['Comisión de ida y vuelta por lote. Pon la de tu cuenta, o 0 si no cobran.', 'Round-trip commission per lot. Use your account’s, or 0 if none.'],
    moneyPerPip: ['Cuánto vale un pip con 1 lote. Pon 10 en la mayoría de pares FX.', 'Value of 1 pip with 1 lot. Use 10 for most FX pairs.'],
    dir: ['Si el robot opera compras, ventas o ambas. Deja “ambos” salvo que quieras sesgo.', 'Whether the robot trades long, short or both. Keep “both” unless you want a bias.'],
    capital: ['Capital con el que se simula la cuenta. Pon el de tu cuenta o reto: 10.000 / 100.000.', 'Starting capital for the simulation. Use your account or challenge size: 10,000 / 100,000.'],
    mm: ['Cómo se calcula el lote de cada operación. Recomendado: % de riesgo sobre equity.', 'How each trade’s lot is sized. Recommended: % risk on equity.'],
    riskPct: ['Cuánto arriesgas del equity en cada operación. Pon 0.5 – 1 %.', 'How much of equity you risk per trade. Use 0.5 – 1 %.'],
    riskMoney: ['Dinero fijo que arriesgas en cada operación. Pon lo que aguante tu cuenta.', 'Fixed money risked per trade. Use what your account can take.'],
    lot: ['Lote fijo en cada operación (sin ajuste). Pon 0.01 – 1 según tu cuenta.', 'Fixed lot per trade (no sizing). Use 0.01 – 1 depending on your account.'],
    atrMult: ['Distancia del stop según la volatilidad (solo modo ATR). Pon 1.5 – 2.', 'Stop distance based on volatility (ATR mode only). Use 1.5 – 2.'],
    pyramid: ['Sumar posiciones a favor si el precio avanza. Pon 0, o 1–2 para tendencias.', 'Add positions in your favor as price advances. Use 0, or 1–2 for trends.'],
    ddType: ['Cómo mide la caída que revienta la cuenta. Trailing = como una prop firm.', 'How the account-blowing drawdown is measured. Trailing = like a prop firm.'],
    maxDDpct: ['Pérdida máxima antes de reventar y descartar el robot. Pon 8 – 10 %.', 'Max loss before blowing up and discarding the robot. Use 8 – 10 %.'],
    chTarget: ['Meta de ganancia del reto. Pon la de tu firma (8–10 %), o 0 si no aplica.', 'Challenge profit goal. Use your firm’s (8–10 %), or 0 if not used.'],
    chDailyLoss: ['Límite de pérdida en un solo día. Pon 5 %, o 0 si no aplica.', 'Loss limit in a single day. Use 5 %, or 0 if not used.'],
    chMinDays: ['Días con operaciones exigidos para pasar. Pon los de tu firma (3–5), o 0.', 'Trading days required to pass. Use your firm’s (3–5), or 0.'],
    n: ['Cuántas estrategias distintas genera y prueba. 1.500 normal, hasta 5.000 para exprimir.', 'How many different strategies it generates and tests. 1,500 normal, up to 5,000 to squeeze.'],
    keepN: ['Tope de robots supervivientes que guarda. 8–50, hasta 500 si generas muchos candidatos.', 'Cap of surviving robots kept. 8–50, up to 500 if you generate many candidates.'],
    minPf: ['Profit factor mínimo (ganado ÷ perdido). Pon 1.2 – 1.4.', 'Minimum profit factor (won ÷ lost). Use 1.2 – 1.4.'],
    maxDd: ['Drawdown máximo permitido, en %. Pon 20 – 25.', 'Max allowed drawdown, %. Use 20 – 25.'],
    minTr: ['Mínimo de operaciones para que sea fiable. Pon 30 – 100.', 'Minimum trades to be reliable. Use 30 – 100.'],
    mcMaxLoss: ['Probabilidad máxima de perder al barajar las operaciones (Monte Carlo). Pon 30 – 35.', 'Max probability of losing when shuffling trades (Monte Carlo). Use 30 – 35.'],
    wfMinStab: ['Qué tan estable debe ser fuera de muestra (walk-forward). Pon 55.', 'How stable it must be out-of-sample (walk-forward). Use 55.'],
    blocks: ['Los ingredientes que la fábrica mezcla. Marca 3–5 indicadores y varias entradas/TP/SL.', 'The ingredients the factory mixes. Pick 3–5 indicators and several entries/TP/SL.'],
    maxTradesDay: ['Máximo de operaciones nuevas por día. Pon 0 para sin límite, o 1–3 para no sobre-operar.', 'Max new trades per day. Use 0 for no limit, or 1–3 to avoid over-trading.'],
    hourRange: ['Solo entra dentro de esta franja horaria (UTC). Útil para operar solo la sesión buena. Deja vacío para todo el día.', 'Only enter within this hour window (UTC). Good for trading only the strong session. Leave empty for all day.'],
    exitFri: ['Cierra todo el viernes a la hora indicada, para no cargar riesgo el fin de semana.', 'Close everything on Friday at the given hour, to avoid weekend risk.'],
    slLimit: ['Acota el stop entre un mínimo y un máximo en pips. Descarta stops absurdos. 0 = sin límite.', 'Clamp the stop between a min and max in pips. Kills absurd stops. 0 = no limit.'],
    tpLimit: ['Acota el take profit entre un mínimo y un máximo en pips. 0 = sin límite.', 'Clamp the take profit between a min and max in pips. 0 = no limit.'],
    oos: ['% del FINAL de los datos que el robot nunca ve al construir (fuera de muestra). Si ahí no gana, está sobre-ajustado. 20–30% recomendado.', '% of the END of the data the robot never sees while building (out-of-sample). If it doesn’t profit there, it’s overfit. 20–30% recommended.'],
  };
  const v = T[k]; return v ? (es ? v[0] : v[1]) : '';
}

// ============================================================
// Onyx Bot Factory · Fase 5 — Motor (backtest + evolución + databank + portafolio)
// Corre en el navegador: simula cada estrategia sobre tus barras con costes
// reales, evoluciona las mejores, arma portafolio de baja correlación, exporta
// el EA y envía las buenas al laboratorio de robustez.
// ============================================================

// Paleta FRESCA "Laguna" (teal · aqua · lima · coral) — sin púrpura ni verde apagado.
const VIOLET = '#0fb8a6' /*teal · chips/acentos*/, GREEN = '#5bd11e' /*lima · éxito*/, AMBER = '#EF9F27', RED = '#E24B4A', BLUE = '#2ee6c5' /*aqua*/, AQUA = '#2ee6c5', LIME = '#8ee63f', CORAL = '#ff8a5c', SKY = '#38bdf8';
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 };
const inp: any = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }
function autoChip(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 99, background: `color-mix(in srgb,${c} 15%,transparent)`, color: c, border: `1px solid color-mix(in srgb,${c} 32%,transparent)` }; }
// Costes típicos por instrumento — para no tener que buscarlos en MetaTrader.
// spread en pips, comisión $/lote por lado, $/pip a 1 lote. Ajustables luego.
function instrDefaults(sym: string): { spreadPips: number; commission: number; moneyPerPip: number } {
  const s = (sym || '').toUpperCase();
  if (/XAU|GOLD/.test(s)) return { spreadPips: 2.5, commission: 3.5, moneyPerPip: 10 };
  if (/XAG|SILVER/.test(s)) return { spreadPips: 3, commission: 3.5, moneyPerPip: 50 };
  if (/US30|DOW|DJ30|WS30/.test(s)) return { spreadPips: 3, commission: 0, moneyPerPip: 1 };
  if (/NAS|US100|NDX|USTEC/.test(s)) return { spreadPips: 2, commission: 0, moneyPerPip: 1 };
  if (/SPX|US500|SP500/.test(s)) return { spreadPips: 1.5, commission: 0, moneyPerPip: 1 };
  if (/GER|DAX|DE40|GER40/.test(s)) return { spreadPips: 2, commission: 0, moneyPerPip: 1 };
  if (/BTC/.test(s)) return { spreadPips: 30, commission: 0, moneyPerPip: 1 };
  if (/ETH/.test(s)) return { spreadPips: 10, commission: 0, moneyPerPip: 1 };
  if (/OIL|WTI|BRENT|USOIL|UKOIL/.test(s)) return { spreadPips: 3, commission: 0, moneyPerPip: 10 };
  if (/JPY$/.test(s)) return { spreadPips: 1.2, commission: 3.5, moneyPerPip: 9 };
  return { spreadPips: 1.0, commission: 3.5, moneyPerPip: 10 }; // Forex mayores por defecto
}

// Monitor de generación EN VIVO (estilo StrategyQuant): contadores + motivos de
// rechazo + diagnóstico. Los datos llegan del Web Worker mientras trabaja.
function GenMonitor({ s, es, evo }: { s: any; es: boolean; evo: any }) {
  const rej = s.rej || {};
  const totalRej = (rej.fewtrades || 0) + (rej.ddhigh || 0) + (rej.oosneg || 0) + (rej.noedge || 0) + (rej.onyxlow || 0);
  const gen = s.generated || 0;
  const accPct = gen ? (100 * (s.accepted || 0) / gen) : 0;
  const secs = Math.floor((s.elapsedMs || 0) / 1000);
  const mmss = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  const perMin = secs > 0 ? Math.round((gen / secs) * 60) : 0;
  const reasons: [string, string, number, string][] = [
    ['fewtrades', es ? 'Muy pocas operaciones' : 'Too few trades', rej.fewtrades || 0, '#3aa0ff'],
    ['oosneg', es ? 'OOS negativo' : 'OOS negative', rej.oosneg || 0, CORAL],
    ['ddhigh', es ? 'Drawdown alto' : 'High drawdown', rej.ddhigh || 0, AMBER],
    ['noedge', es ? 'Sin ventaja' : 'No edge', rej.noedge || 0, '#8a94a6'],
    ['onyxlow', es ? 'Onyx bajo el umbral' : 'Onyx below min', rej.onyxlow || 0, VIOLET],
  ];
  reasons.sort((a, b) => b[2] - a[2]);
  const top1 = reasons[0];
  const st = (l: string, v: any, c?: string) => <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px' }}><div className="muted" style={{ fontSize: 10.5 }}>{l}</div><div style={{ fontSize: 18, fontWeight: 800, marginTop: 1, color: c || 'var(--tx)' }}>{v}</div></div>;
  // Diagnóstico automático según el motivo dominante.
  const advice = () => {
    if (!totalRej) return '';
    const k = top1[0], p = Math.round(100 * top1[2] / totalRej);
    const m: Record<string, string> = {
      fewtrades: es ? `El ${p}% se cae por pocas operaciones → baja el "mín. operaciones", alarga la sesión (usa "all") o TP/SL más ajustados para operar más.` : `${p}% fail for too few trades → lower "min trades", widen the session ("all"), or tighter TP/SL to trade more.`,
      oosneg: es ? `El ${p}% pierde fuera de muestra → prueba una receta de bloques más simple, TP/SL más amplios, o una temporalidad mayor (menos ruido).` : `${p}% lose out-of-sample → try a simpler block recipe, wider TP/SL, or a higher timeframe (less noise).`,
      ddhigh: es ? `El ${p}% tiene drawdown alto → sube el "DD máx %" permitido o reduce el riesgo por operación.` : `${p}% have high drawdown → raise the allowed "Max DD %" or lower risk per trade.`,
      noedge: es ? `El ${p}% no tiene ventaja → cambia la familia de bloques o revisa que los costes no estén exagerados.` : `${p}% have no edge → change the block family or check costs aren't too high.`,
      onyxlow: es ? `El ${p}% pasa los filtros pero no llega al Onyx mínimo → baja un poco el Onyx mínimo o genera más para tener de dónde elegir.` : `${p}% pass filters but miss the min Onyx → lower the min Onyx slightly or generate more.`,
    };
    return m[k] || '';
  };
  return (
    <div style={{ marginTop: 12, background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', border: `1px solid color-mix(in srgb,${GREEN} 25%,var(--line))` }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8, marginBottom: 12 }}>
        {st(es ? 'Generadas' : 'Generated', gen.toLocaleString('en-US'))}
        {st(es ? 'Aceptadas' : 'Accepted', (s.accepted || 0).toLocaleString('en-US') + ' · ' + accPct.toFixed(2) + '%', GREEN)}
        {st(es ? 'Rechazadas' : 'Rejected', (100 - accPct).toFixed(2) + '%', RED)}
        {st(es ? 'Velocidad' : 'Speed', perMin.toLocaleString('en-US') + '/min')}
        {st(es ? 'Tiempo' : 'Time', mmss)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{es ? 'Por qué se rechazan' : 'Why rejected'}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {reasons.map(([k, l, v, c]) => { const p = totalRej ? Math.round(100 * v / totalRej) : 0; return (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}><span>{l}</span><span className="muted">{p}%</span></div>
                <div style={{ height: 7, background: 'var(--card)', borderRadius: 20 }}><div style={{ width: p + '%', height: '100%', background: c, borderRadius: 20 }} /></div>
              </div>
            ); })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{es ? 'Mejor fitness (evolución)' : 'Best fitness (evolution)'}</div>
          {evo?.history?.length ? <EvoChart history={evo.history} /> : <div className="muted" style={{ fontSize: 11.5 }}>{es ? '(solo en modo evolución)' : '(evolution mode only)'}</div>}
          {advice() && <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, background: `color-mix(in srgb,${VIOLET} 8%,var(--card))`, border: `1px solid color-mix(in srgb,${VIOLET} 30%,var(--line))`, borderRadius: 10, padding: '9px 11px' }}><b style={{ color: VIOLET }}>💡 {es ? '¿Por qué no salen buenas?' : 'Why no good ones?'}</b> {advice()}</div>}
        </div>
      </div>
    </div>
  );
}

function methodCard(active: boolean, c: string): any { return { flex: 1, minWidth: 220, textAlign: 'left', cursor: 'pointer', padding: '11px 13px', borderRadius: 12, background: active ? `color-mix(in srgb,${c} 14%,var(--bg2))` : 'var(--bg2)', border: `2px solid ${active ? c : 'var(--line)'}`, color: 'var(--tx)' }; }

// Recetas de bloques por familia: en vez de marcar TODOS los bloques (espacio
// enorme y ruidoso → casi todo basura), cada preset elige un conjunto coherente
// con más tasa de acierto. El usuario puede afinar luego en "Bloques a combinar".
const BLOCK_PRESETS: { key: string; es: string; en: string; cfg: Record<string, string[]> }[] = [
  { key: 'tendencia', es: 'Tendencia', en: 'Trend', cfg: { indicators: ['ema', 'macd'], entry: ['cross_up', 'cross_dn'], exit: ['opp_signal', 'indicator'], sessions: ['london', 'ny', 'overlap'], tp: ['atr2', 'atr3', '60'], sl: ['atr15', '50'], be: ['off', 'be20'], trailing: ['t_atr', 'off'] } },
  { key: 'ruptura', es: 'Ruptura', en: 'Breakout', cfg: { indicators: ['bb', 'atr'], entry: ['breakout', 'pullback'], exit: ['fixed', 'opp_signal'], sessions: ['london', 'ny'], tp: ['60', 'atr3'], sl: ['30', 'atr15'], be: ['be20'], trailing: ['t30', 'off'] } },
  { key: 'reversion', es: 'Reversión', en: 'Reversion', cfg: { indicators: ['rsi', 'bb'], entry: ['pullback', 'cross_up', 'cross_dn'], exit: ['opp_signal', 'fixed'], sessions: ['ny', 'overlap', 'all'], tp: ['40', '60'], sl: ['30', '50'], be: ['off'], trailing: ['off'] } },
  { key: 'scalping', es: 'Scalping', en: 'Scalping', cfg: { indicators: ['ema', 'rsi'], entry: ['cross_up', 'cross_dn'], exit: ['fixed'], sessions: ['london', 'overlap'], tp: ['40'], sl: ['30'], be: ['be20'], trailing: ['t30'] } },
  { key: 'todo', es: 'Todo (amplio)', en: 'All (wide)', cfg: { indicators: ['ema', 'rsi', 'macd', 'bb'], entry: ['cross_up', 'cross_dn', 'breakout', 'pullback'], exit: ['opp_signal', 'fixed', 'indicator'], sessions: ['london', 'ny', 'overlap', 'all'], tp: ['40', '60', 'atr2', 'atr3'], sl: ['30', '50', 'atr15'], be: ['off', 'be20'], trailing: ['off', 't30', 't_atr'] } },
];
// Agrega barras a una temporalidad más gruesa (p.ej. M1 → M15) para que la búsqueda
// no congele la pestaña con datasets enormes. Bucketea por tiempo (OHLC correcto).
function aggregateBars(bars: Bar[], targetMin: number): Bar[] {
  if (!bars.length) return bars;
  const bucket = targetMin * 60000;
  const out: Bar[] = [];
  let curKey = -1, o = 0, h = 0, l = 0, c = 0, t = 0;
  for (const b of bars) {
    const k = Math.floor(b.t / bucket);
    if (k !== curKey) { if (curKey !== -1) out.push({ t, o, h, l, c } as Bar); curKey = k; t = k * bucket; o = b.o; h = b.h; l = b.l; c = b.c; }
    else { if (b.h > h) h = b.h; if (b.l < l) l = b.l; c = b.c; }
  }
  if (curKey !== -1) out.push({ t, o, h, l, c } as Bar);
  return out;
}
function download(name: string, text: string, mime: string) { const b = new Blob([text], { type: mime }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
// Etiqueta legible de temporalidad: de H1 en adelante NO usa minutos (M60→H1, M240→H4, M1440→D1…).
function tfLbl(min: number): string {
  if (min < 60) return 'M' + min;
  if (min < 1440) { const h = min / 60; return 'H' + (Number.isInteger(h) ? h : h.toFixed(1)); }
  if (min < 10080) return 'D' + Math.round(min / 1440);
  if (min < 43200) return 'W' + Math.round(min / 10080);
  return 'MN' + Math.round(min / 43200);
}

type Row = { spec: Spec; net: number; pf: number; dd: number; n: number; win: number; exp: number };

// Adivina el instrumento desde el nombre del archivo (Dukascopy/StrategyQuant
// empiezan por el símbolo: EURUSD_..., XAUUSD_..., USA500IDXUSD_...).
function guessSymbol(name: string): string {
  const base = (name || '').replace(/\.[^.]+$/, '');
  const m = base.match(/^[A-Za-z][A-Za-z0-9.]{1,15}/);
  const s = (m ? m[0] : '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const map: Record<string, string> = { USA500IDXUSD: 'US500', USATECHIDXUSD: 'NAS100', USA30IDXUSD: 'US30', DEUIDXEUR: 'GER40', GBRIDXGBP: 'UK100', JPNIDXJPY: 'JP225', FRAIDXEUR: 'FRA40', AUSIDXAUD: 'AUS200', LIGHTCMDUSD: 'USOIL', BRENTCMDUSD: 'UKOIL' };
  return map[s] || s;
}

function daily(trades: { t: number; profit: number }[]): Record<string, number> { const o: Record<string, number> = {}; for (const t of trades) { const d = new Date(t.t).toISOString().slice(0, 10); o[d] = (o[d] || 0) + t.profit; } return o; }
function pearson(a: number[], b: number[]) { const n = a.length; if (n < 5) return 0; const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n; let nu = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; nu += x * y; da += x * x; db += y * y; } const de = Math.sqrt(da * db); return de > 0 ? nu / de : 0; }

export default function FactoryEngine({ es, canManage, post, reload, datasets = [], blocks = [] }: any) {
  // Mapa de bloques personalizados (Claude) → regla DSL, para que el motor los ejecute.
  const blockMap = useMemo(() => { const m: any = {}; for (const b of (blocks as any[])) if (b?.block_id && b?.dsl) m[b.block_id] = b.dsl; return m; }, [blocks]);
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [barsName, setBarsName] = useState('');
  const [reading, setReading] = useState(false);
  const [prog, setProg] = useState(0);
  const [tfMin, setTfMin] = useState(15);
  const [dsId, setDsId] = useState('');
  const usableDs = (datasets as any[]).filter((d) => d.verdict !== 'rechazada' && d.bars_url);
  const libDs = (datasets as any[]).filter((d) => d.verdict !== 'rechazada'); // incluye los sin barras (para mostrarlos marcados)

  // Carga barras desde la biblioteca (sin volver a subir el archivo).
  // tfOverride: cuando el usuario acaba de tocar «Search resolution», el estado
  // de React todavía no cambió, así que pasamos el valor NUEVO aquí directo para
  // que la temporalidad del motor se sincronice al instante (sin ir 1 clic atrás).
  async function loadFromLibrary(id: string, tfOverride?: 'auto' | 5 | 15 | 30 | 60 | 240) {
    const effSearchTf = tfOverride !== undefined ? tfOverride : searchTf;
    setDsId(id); if (!id) return;
    const ds = (datasets as any[]).find((d) => d.id === id);
    if (!ds?.bars_url) { toastErr(es ? 'Ese dataset no tiene barras guardadas. Vuelve a guardarlo en la Puerta 0.' : 'That dataset has no saved bars. Re-save it in Gate 0.'); return; }
    setReading(true); setProg(0); setBars(null); setBarsName((ds.symbol || 'dataset') + ' · biblioteca');
    try {
      setProg(0.6);
      const col = await fetchColumnar(ds.bars_url);   // descomprime gzip si hace falta
      let b = barsFromColumnar(col); setProg(0.85);
      if (b.length < 100) { toastErr(es ? 'El dataset guardado tiene muy pocas barras.' : 'Saved dataset has too few bars.'); }
      // Datasets enormes (M1 de muchos años = millones de barras) congelan la pestaña al
      // backtestear miles de veces. Los agregamos a una TF más gruesa para la búsqueda,
      // apuntando a ~250k barras. La fidelidad para buscar sigue siendo alta.
      const srcTf = col.tf || 1;
      let workTf = srcTf;
      if (effSearchTf !== 'auto') {
        // El usuario fijó la resolución (M5 fino / M15 / M30). Se agrega a esa TF.
        workTf = Math.max(srcTf, effSearchTf as number);
        if (workTf > srcTf) b = aggregateBars(b, workTf);
      } else if (b.length > 400000) {
        // Auto: agrega para ~250k barras (rápido y sin congelar) — normalmente M15.
        const std = [1, 5, 15, 30, 60, 240, 1440];
        const target = Math.ceil((b.length / 250000) * srcTf);
        workTf = std.find((x) => x >= target) || 1440;
        if (workTf > srcTf) { b = aggregateBars(b, workTf); }
      }
      setProg(1);
      setBars(b);
      if (ds.symbol) setMeta((mt) => ({ ...mt, symbol: ds.symbol, tf: tfLbl(workTf) }));
      // Costes por defecto realistas según el instrumento (no tienes que buscarlos en MT).
      // Los puedes afinar en Ajustes avanzados. Si el dataset trae ticks reales con spread
      // detectado, se usa ese en vez del típico.
      if (ds.symbol) {
        const dflt = instrDefaults(ds.symbol);
        const hasTk = ds.data_kind === 'ticks' || ds.has_ticks;
        const tkSpread = hasTk && ds.spread_avg_pts != null ? Math.round(Number(ds.spread_avg_pts) * 10) / 10 : null;
        setCosts((c) => ({ ...c, spreadPips: tkSpread != null && tkSpread > 0 ? tkSpread : dflt.spreadPips, commission: dflt.commission, moneyPerPip: dflt.moneyPerPip }));
      }
      toast(workTf > srcTf
        ? (es ? `Cargado y convertido a ${tfLbl(workTf)} para buscar rápido (${b.length.toLocaleString('en-US')} barras)` : `Loaded and converted to ${tfLbl(workTf)} for fast search (${b.length.toLocaleString('en-US')} bars)`)
        : (es ? 'Datos cargados desde la biblioteca' : 'Data loaded from library'));
    } catch (e: any) { toastErr(es ? 'No se pudieron cargar las barras guardadas.' : 'Could not load saved bars.'); }
    finally { setReading(false); setProg(0); }
  }
  const [costs, setCosts] = useState<Costs>({ spreadPips: 1.2, slippagePips: 0.3, commission: 3.5, moneyPerPip: 10, lot: 1, pip: 0, capital: 10000, mm: 'risk_pct', riskPct: 1, riskMoney: 100, ddType: 'trailing', maxDDpct: 10 });
  const [dir, setDir] = useState<'both' | 'long' | 'short'>('both'); // dirección del robot
  const [cfg, setCfg] = useState<Record<string, string[]>>({ indicators: ['ema', 'rsi', 'macd', 'bb'], entry: ['cross_up', 'cross_dn', 'breakout', 'pullback'], exit: ['opp_signal', 'fixed', 'indicator'], sessions: ['london', 'ny', 'overlap', 'all'], tp: ['40', '60', 'atr2', 'atr3'], sl: ['30', '50', 'atr15'], be: ['off', 'be20'], trailing: ['off', 't30', 't_atr'] });
  const [n, setN] = useState(1500);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [minPf, setMinPf] = useState(1.2);
  const [maxDd, setMaxDd] = useState(25);
  const [minTr, setMinTr] = useState(30);
  const [evo, setEvo] = useState<{ best: Survivor[]; history: number[] } | null>(null);
  const [sel, setSel] = useState<Spec | null>(null);
  const [meta, setMeta] = useState({ platform: 'mt5', symbol: 'XAUUSD', tf: 'M15' });
  const [auto, setAuto] = useState(false);
  const [autoMode, setAutoMode] = useState<'random' | 'evolve'>('evolve'); // aleatorio rápido vs evolución inteligente
  const [minScore, setMinScore] = useState(75); // Onyx Robustness Score mínimo (anti-sobreajuste)
  const [searchTf, setSearchTf] = useState<'auto' | 5 | 15 | 30 | 60 | 240>('auto'); // resolución de la búsqueda
  const [useAi, setUseAi] = useState(true);      // la IA (Claude) audita cada robot final
  const [autoMsg, setAutoMsg] = useState('');
  const [keepN, setKeepN] = useState(8);
  const [autoDone, setAutoDone] = useState<{ created: number; scanned: number; survivors: number; avg?: number } | null>(null);
  const [autoStats, setAutoStats] = useState<any>(null); // monitor de generación en vivo
  const [advOpen, setAdvOpen] = useState(false); // pliega todo lo avanzado del Motor
  const [aiObj, setAiObj] = useState(''); const [aiBusy, setAiBusy] = useState(false); const [aiRes, setAiRes] = useState<any>(null); // asistente IA de config

  // Aplica la configuración que sugiere la IA a los ajustes del Motor.
  function applyAdvisor(cfgAI: any) {
    setCosts((c) => ({ ...c, spreadPips: cfgAI.costs?.spreadPips ?? c.spreadPips, commission: cfgAI.costs?.commission ?? c.commission, riskPct: cfgAI.costs?.riskPct ?? c.riskPct, mm: 'risk_pct',
      chTarget: cfgAI.challenge?.target || 0, chDailyLoss: cfgAI.challenge?.dailyLoss || 0, chMinDays: cfgAI.challenge?.minDays || 0,
      maxDDpct: cfgAI.challenge?.maxDD || c.maxDDpct, ddType: cfgAI.challenge?.maxDD ? 'trailing' : c.ddType }));
    if (cfgAI.oosPct) setOosPct(cfgAI.oosPct);
    if (cfgAI.evo) setEvoCfg((e) => ({ ...e, gens: cfgAI.evo.gens || e.gens, pop: cfgAI.evo.pop || e.pop, mut: cfgAI.evo.mut || e.mut }));
    const pre = BLOCK_PRESETS.find((p) => p.key === cfgAI.blockPreset); if (pre) setCfg(pre.cfg);
    toast(es ? 'Configuración aplicada por la IA — revísala abajo' : 'AI config applied — review below');
  }
  async function runAdvisor() {
    if (!aiObj.trim()) { toastErr(es ? 'Escribe tu objetivo (ej. pasar FTMO 100k en oro).' : 'Enter your objective.'); return; }
    setAiBusy(true); setAiRes(null);
    try {
      const yrs = bars ? (bars[bars.length - 1].t - bars[0].t) / (365.25 * 86400000) : undefined;
      const j = await post({ action: 'engine_advisor', objective: aiObj, symbol: meta.symbol, timeframe: meta.tf, years: yrs, lang: es ? 'es' : 'en' });
      setAiRes(j); applyAdvisor(j.cfg);
    } catch (e: any) { toastErr(e?.message); } finally { setAiBusy(false); }
  }
  // Receta encadenada (build → backtest → IS/OOS → Monte Carlo → walk-forward → rechazar).
  const [recipe, setRecipe] = useState({ minPf: 1.2, maxDd: 25, minTr: 30, mcMaxLoss: 35, wfMinStab: 55 });
  const [oosPct, setOosPct] = useState(30); // % del final reservado como fuera de muestra (OOS)
  const [evoCfg, setEvoCfg] = useState({ gens: 10, pop: 60, mut: 0.25, restart: 6 }); // parámetros de evolución
  const [recRun, setRecRun] = useState(false);
  const [recMsg, setRecMsg] = useState('');
  const [recFunnel, setRecFunnel] = useState<any>(null);
  const [recBest, setRecBest] = useState<any>(null);
  const [recSending, setRecSending] = useState(false);
  // Optimizador de parámetros (búsqueda de meseta).
  const [optBusy, setOptBusy] = useState(false);
  const [optRes, setOptRes] = useState<OptResult | null>(null);
  // Portafolio multi-símbolo (correr un spec contra varios datasets de la biblioteca).
  const [msIds, setMsIds] = useState<string[]>([]);
  const [msBusy, setMsBusy] = useState(false);
  const [msMsg, setMsMsg] = useState('');
  const [msRes, setMsRes] = useState<PortResult | null>(null);

  // Optimiza la estrategia seleccionada barriendo período/TP/SL y elige la MESETA.
  async function runOptimize(base: Spec) {
    if (!bars) { toastErr(es ? 'Carga las barras primero.' : 'Load bars first.'); return; }
    setOptBusy(true); setOptRes(null);
    try {
      await new Promise((r) => setTimeout(r, 20));
      const res = optimize(bars, enrichSpec({ ...base, dir }, blockMap) as Spec, costs);
      setOptRes(res);
      if (!res.plateau || res.plateau.score <= 0) toast(es ? 'No se halló una meseta rentable con esos rangos.' : 'No profitable plateau found in those ranges.');
      else toast(es ? 'Meseta encontrada' : 'Plateau found');
    } catch (e: any) { toastErr('Optimize: ' + (e?.message || e)); }
    finally { setOptBusy(false); }
  }

  // Corre la estrategia seleccionada contra varios datasets y arma la cartera con correlación.
  async function runMultiSymbol(base: Spec) {
    const chosen = (datasets as any[]).filter((d) => msIds.includes(d.id) && d.bars_url);
    if (chosen.length < 2) { toastErr(es ? 'Elige al menos 2 datasets con barras guardadas.' : 'Pick at least 2 datasets with saved bars.'); return; }
    setMsBusy(true); setMsRes(null); setMsMsg(es ? 'Cargando datasets…' : 'Loading datasets…');
    try {
      const members: PortMember[] = [];
      for (const ds of chosen) {
        setMsMsg((es ? 'Backtest ' : 'Backtest ') + (ds.symbol || ds.id));
        const col = await fetchColumnar(ds.bars_url);
        const b = barsFromColumnar(col);
        if (b.length < 100) continue;
        members.push({ name: (ds.symbol || 'DS') + ' M' + (col.tf || '?'), dataset: ds.id, bars: b, spec: enrichSpec({ ...base, dir }, blockMap) as Spec });
        await new Promise((r2) => setTimeout(r2, 10));
      }
      if (members.length < 2) { toastErr(es ? 'No hubo suficientes datasets válidos.' : 'Not enough valid datasets.'); return; }
      const res = buildPortfolio(members, costs);
      setMsRes(res); setMsMsg('');
      toast(es ? 'Portafolio calculado' : 'Portfolio computed');
    } catch (e: any) { toastErr('Portfolio: ' + (e?.message || e)); setMsMsg(''); }
    finally { setMsBusy(false); }
  }

  const toggle = (bk: string, id: string) => setCfg((c) => { const cur = c[bk] || []; return { ...c, [bk]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }; });
  const pip = bars ? (costs.pip || inferPip(bars[Math.floor(bars.length / 2)].c)) : 0;

  const filtered = useMemo(() => (rows || []).filter((r) => r.pf >= minPf && r.dd <= maxDd && r.n >= minTr).sort((a, b) => b.net - a.net), [rows, minPf, maxDd, minTr]);

  // Veredicto del reto para la estrategia seleccionada (si hay reglas activas).
  const chOn = (costs.chTarget || 0) > 0 || (costs.chDailyLoss || 0) > 0 || (costs.chMinDays || 0) > 0;
  const selChallenge = useMemo(() => {
    if (!sel || !bars || !chOn) return null;
    try { return runBacktest(bars, enrichSpec({ ...sel, dir }, blockMap) as Spec, costs).challenge || null; } catch { return null; }
  }, [sel, bars, chOn, costs, dir, blockMap]);

  // Reporte completo estilo StrategyQuant de la estrategia seleccionada.
  const selReport = useMemo<FullReport | null>(() => {
    if (!sel || !bars) return null;
    try { const m = runBacktest(bars, enrichSpec({ ...sel, dir }, blockMap) as Spec, costs); return buildReport(m.trades, costs.capital || 10000, oosPct); } catch { return null; }
  }, [sel, bars, costs, dir, blockMap, oosPct]);

  // Onyx Robustness Score de la estrategia seleccionada (anti-sobreajuste).
  const selScore = useMemo<OnyxScore | null>(() => {
    if (!sel || !bars) return null;
    try { return onyxScore(bars, enrichSpec({ ...sel, dir }, blockMap) as Spec, costs, oosPct || 30); } catch { return null; }
  }, [sel, bars, costs, dir, blockMap, oosPct]);

  async function runBatch() {
    if (!bars) { toastErr(es ? 'Sube las barras primero.' : 'Upload bars first.'); return; }
    if (n < 1) { toastErr(es ? 'Escribe cuántas estrategias probar.' : 'Enter how many strategies to test.'); return; }
    setBusy(true); setRows(null); setEvo(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const cands = (sampleCandidates(cfg, n) as Spec[]).map((c) => ({ ...c, dir }));
      const out: Row[] = [];
      for (const c of cands) { const spec = enrichSpec(c, blockMap); const m = runBacktest(bars, spec, costs); if (m.n > 0 && !m.blown) out.push({ spec, net: m.net, pf: m.pf, dd: m.maxddPct, n: m.n, win: m.winRate, exp: m.expectancy }); }
      setRows(out);
      toast(es ? `${out.length} estrategias backtesteadas` : `${out.length} strategies backtested`);
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }
  async function runEvolve() {
    if (!bars) { toastErr(es ? 'Sube las barras primero.' : 'Upload bars first.'); return; }
    setBusy(true); await new Promise((r) => setTimeout(r, 30));
    try { const r = evolve(bars, costs, { pop: evoCfg.pop, gens: evoCfg.gens, keep: 12, mut: evoCfg.mut, restart: evoCfg.restart, oosPct }); setEvo({ best: r.best, history: r.history }); toast(es ? `Evolución: ${r.evaluated} evaluaciones` : `Evolution: ${r.evaluated} evals`); }
    catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  // Portafolio: elige de mayor a menor neto añadiendo solo baja correlación.
  const portfolio = useMemo(() => {
    if (!bars || !filtered.length) return null;
    const top = filtered.slice(0, 30).map((r) => ({ r, d: daily(runBacktest(bars, r.spec, costs).trades) }));
    const days = Array.from(new Set(top.flatMap((t) => Object.keys(t.d)))).sort();
    const vec = (d: Record<string, number>) => days.map((x) => d[x] || 0);
    const chosen: typeof top = [];
    for (const t of top) { if (chosen.every((c) => Math.abs(pearson(vec(c.d), vec(t.d))) < 0.6)) chosen.push(t); if (chosen.length >= 6) break; }
    const net = chosen.reduce((s, c) => s + c.r.net, 0);
    return { chosen: chosen.map((c) => c.r), net };
  }, [filtered, bars, costs]);

  async function sendToLab(spec: Spec) {
    if (!bars) return; setBusy(true);
    try {
      const trades = runBacktest(bars, spec, costs).trades;
      if (trades.length < 20) throw new Error(es ? 'Muy pocas operaciones para el laboratorio.' : 'Too few trades for the lab.');
      const j = await post({ action: 'bot_create', platform: meta.platform, symbol: meta.symbol, timeframe: meta.tf, strategy: { family: 'generada', gen: spec } });
      await post({ action: 'lab_run', botId: j.bot?.id, trades, paramCount: 6, lang: es ? 'es' : 'en' });
      toast((es ? 'Enviado al laboratorio: ' : 'Sent to lab: ') + (j.bot?.name || ''));
      if (reload) reload();
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  // AUTOPILOTO: genera → backtestea → filtra por robustez (IS/OOS) → crea solos
  // los robots que sobreviven y los envía al laboratorio. Sin CSV, un botón.
  async function autopilot() {
    if (!bars) { toastErr(es ? 'Sube los datos primero.' : 'Upload data first.'); return; }
    if (!meta.symbol) { toastErr(es ? 'Falta el símbolo (se rellena al subir los datos).' : 'Missing symbol.'); return; }
    if (n < 1) { toastErr(es ? 'Escribe cuántas estrategias generar.' : 'Enter how many strategies to generate.'); return; }
    setAuto(true); setAutoDone(null); setAutoStats(null); setAutoMsg(es ? 'Preparando (segundo plano)…' : 'Preparing (background)…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      // ══ TODO EL CÁLCULO PESADO CORRE EN UN WEB WORKER (hilo aparte) ══
      // La página ya NO se congela nunca: aquí solo mandamos los datos y
      // recibimos el progreso y los finalistas. Puede correr millones.
      const result = await new Promise<any>((resolve, reject) => {
        let worker: Worker;
        try { worker = new Worker(new URL('./factoryWorker.ts', import.meta.url)); }
        catch (err) { reject(err); return; }
        worker.onmessage = (ev: MessageEvent) => {
          const m = ev.data || {};
          if (m.type === 'progress') setAutoMsg(m.msg);
          else if (m.type === 'stats') setAutoStats(m);
          else if (m.type === 'evo') setEvo({ best: m.best, history: m.history });
          else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
          else if (m.type === 'done') { worker.terminate(); resolve(m); }
        };
        worker.onerror = (er: any) => { worker.terminate(); reject(new Error(er?.message || 'worker error')); };
        worker.postMessage({ bars, costs, cfg, dir, n, autoMode, keepN, minScore, evoCfg: { mut: evoCfg.mut, restart: evoCfg.restart }, oosPct: oosPct || 30, maxDd, minTr, blockMap });
      });
      const finalists: { spec: Spec; score: number; grade: string; cx: number }[] = result.finalists || [];
      const scanned = result.scanned || 0;
      const passedGate = result.survivors || 0;

      // ══ LOTE (batch): abre la ficha de esta corrida para trazabilidad ══
      // Cada robot que creemos abajo llevará este batch_id/batch_no, así sabes
      // exactamente de qué corrida (dataset, resolución, receta, MM…) salió.
      let batchId: string | null = null, batchNo: number | null = null;
      try {
        const recipe = BLOCK_PRESETS.find((p) => JSON.stringify(p.cfg) === JSON.stringify(cfg))?.key || 'custom';
        const bj = await post({ action: 'batch_create', info: {
          datasetName: barsName || meta.symbol, symbol: meta.symbol, timeframe: meta.tf, searchTf: searchTf,
          mode: autoMode, recipe, oosPct: oosPct || 30, riskPct: costs.riskPct, nRequested: n,
          config: { blocks: cfg, costs, oosPct: oosPct || 30, evo: evoCfg, minScore, keepN, dir, useAi },
        } });
        batchId = bj?.batch?.id || null; batchNo = bj?.batch?.batch_no ?? null;
      } catch { /* si falta factory_v12.sql, seguimos sin lote */ }

      let created = 0;
      const createdBots: { id: string; spec: Spec; searchScore: number }[] = [];
      for (let i = 0; i < finalists.length; i++) {
        setAutoMsg((useAi ? (es ? '🧠 IA auditando robot ' : '🧠 AI auditing robot ') : (es ? 'Creando robot ' : 'Creating robot ')) + (i + 1) + '/' + finalists.length + ' · Onyx ' + finalists[i].grade + (batchNo ? ' · lote #' + batchNo : ''));
        const trades = runBacktest(bars, finalists[i].spec, costs).trades;
        if (trades.length < 20) continue;
        const j = await post({ action: 'bot_create', platform: meta.platform, symbol: meta.symbol, timeframe: meta.tf, batchId, batchNo, strategy: { family: 'autopiloto', gen: finalists[i].spec, onyx: finalists[i].score, grade: finalists[i].grade } });
        await post({ action: 'lab_run', botId: j.bot?.id, trades, paramCount: finalists[i].cx, noAi: !useAi, lang: es ? 'es' : 'en' });
        if (j.bot?.id) createdBots.push({ id: j.bot.id, spec: finalists[i].spec, searchScore: finalists[i].score });
        created++;
      }
      const avgGrade = finalists.length ? finalists.reduce((s, f) => s + f.score, 0) / finalists.length : 0;
      setAutoDone({ created, scanned, survivors: passedGate, avg: Math.round(avgGrade) });
      // Cierra la ficha del lote con los conteos reales.
      if (batchId) { try { await post({ action: 'batch_update', id: batchId, patch: { generated: scanned, accepted: passedGate, created, avg_score: Math.round(avgGrade), aiAudited: useAi } }); } catch { /* opcional */ } }
      toast((es ? 'Autopiloto: ' : 'Autopilot: ') + created + (es ? ' robots limpios creados' : ' clean robots created'));
      if (reload) reload();

      // ══ COLA DE VALIDACIÓN FINA AUTOMÁTICA (segundo plano) — estilo StrategyQuant, mejorado ══
      // La BÚSQUEDA corre en la resolución de trabajo (la que elegiste arriba, p.ej. H1) para ir
      // rápido. Pero el VEREDICTO final se toma sobre los datos MÁS FINOS que tengas guardados
      // (M1 hoy; ticks reales cuando los subas). Cada robot se re-backtestea ahí y, además de
      // archivarse por carpeta según su grado fino, guardamos la DIVERGENCIA búsqueda→fino:
      // cuánto se degrada al pasar a la resolución real. Divergencia baja = robusto de verdad;
      // divergencia alta = sobreajustado a la temporalidad de búsqueda. Esa señal es la mejora
      // sobre StrategyQuant. Corre uno a uno con pausas para no congelar. Solo finalistas (pocos).
      const dsForM1 = (datasets as any[]).find((d) => d.id === dsId && d.bars_url);
      if (dsForM1 && createdBots.length) {
        try {
          const isTicks = dsForM1.data_kind === 'ticks' || dsForM1.has_ticks; // etiqueta correcta
          setAutoMsg(es ? 'Cargando datos finos para validar…' : 'Loading fine data to validate…');
          await new Promise((r) => setTimeout(r, 10));
          const colM1 = await fetchColumnar(dsForM1.bars_url);
          const barsM1 = barsFromColumnar(colM1);
          const fineTf = colM1.tf || 1;                                 // resolución REAL del dato fino
          const fineLabel = isTicks ? 'ticks' : 'M' + fineTf;           // no asumimos M1 a ciegas
          if (barsM1.length >= 500) {
            for (let i = 0; i < createdBots.length; i++) {
              setAutoMsg((es ? `🔬 Validando en ${fineLabel} y archivando ` : `🔬 Validating on ${fineLabel} & filing `) + (i + 1) + '/' + createdBots.length + '…');
              await new Promise((r) => setTimeout(r, 0));
              try {
                const sc = onyxScore(barsM1, enrichSpec({ ...createdBots[i].spec, dir }, blockMap) as Spec, costs, oosPct || 30);
                // Divergencia = cuánto cae el score de la búsqueda al dato fino (0 = idéntico).
                const divergence = Math.max(0, Math.round((createdBots[i].searchScore || 0) - sc.score));
                await post({ action: 'bot_validate_fine', botId: createdBots[i].id, fineScore: sc.score, fineGrade: sc.grade, fineBars: barsM1.length, fineTf: fineLabel, divergence });
              } catch { /* uno que rompa no detiene la cola */ }
            }
            toast(es ? `Validación en ${fineLabel} terminada · robots archivados por carpeta` : `Validation on ${fineLabel} done · robots filed by folder`);
            if (reload) reload();
          }
        } catch { /* si no se pudo cargar el dato fino, quedan "sin validar" */ }
      }
    } catch (e: any) { toastErr(e?.message); } finally { setAuto(false); setAutoMsg(''); }
  }

  // RECETA ENCADENADA: build → backtest → IS/OOS → Monte Carlo (8 tipos) →
  // walk-forward matrix → sobreviven solo los que pasan TODAS las compuertas.
  async function runRecipe() {
    if (!bars) { toastErr(es ? 'Carga los datos primero.' : 'Load data first.'); return; }
    setRecRun(true); setRecFunnel(null); setRecBest(null); setRecMsg(es ? 'Generando…' : 'Generating…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const cands = (sampleCandidates(cfg, n) as Spec[]).map((c) => ({ ...c, dir }));
      const oosOn = oosPct > 0; const cut = Math.floor(bars.length * (1 - Math.max(0, Math.min(50, oosPct)) / 100)); const oosB = oosOn ? bars.slice(cut) : [];
      let bt = 0, mc = 0, wf = 0; const survivors: any[] = [];
      for (let i = 0; i < cands.length; i++) {
        const spec = enrichSpec(cands[i], blockMap);
        const m = runBacktest(bars, spec, costs);
        if (m.blown) continue; // reventó la cuenta (límite de drawdown) → descartar
        if (m.challenge && !m.challenge.pass) continue; // no pasa el reto prop firm → descartar
        if (!(m.pf >= recipe.minPf && m.maxddPct <= recipe.maxDd && m.n >= recipe.minTr)) continue;
        bt++;
        if (oosOn) { const oos = runBacktest(oosB, spec, costs); if (!(oos.n >= 8 && oos.pf >= 1 && oos.net > 0)) continue; } // OOS obligatorio: debe GANAR fuera de muestra
        const suite = mcSuite(m.trades.map((t) => t.profit), { runs: 250, maxLossProb: recipe.mcMaxLoss });
        if (!suite.pass) continue; mc++;
        const wfm = walkForwardMatrix(bars, spec, costs, { folds: 5 });
        if (wfm.stability < recipe.wfMinStab) continue; wf++;
        survivors.push({ spec, m, mc: suite, wf: wfm });
        if (i % 25 === 0) { setRecMsg((es ? 'Filtrando ' : 'Filtering ') + i + '/' + cands.length + ' · ' + (es ? 'sobreviven ' : 'survive ') + survivors.length); await new Promise((r) => setTimeout(r, 0)); }
      }
      survivors.sort((a, b) => b.m.net - a.m.net);
      const top = survivors.slice(0, Math.max(1, keepN));
      setRecFunnel({ scanned: cands.length, bt, mc, wf, survivors: top });
      setRecBest(top[0] || null);
      toast((es ? 'Receta: ' : 'Recipe: ') + top.length + (es ? ' supervivientes' : ' survivors'));
    } catch (e: any) { toastErr(e?.message); } finally { setRecRun(false); setRecMsg(''); }
  }
  async function sendRecipe() {
    if (!recFunnel?.survivors?.length) return;
    setRecSending(true);
    try {
      let created = 0;
      for (const s of recFunnel.survivors) {
        const trades = runBacktest(bars!, s.spec, costs).trades;
        if (trades.length < 20) continue;
        const j = await post({ action: 'bot_create', platform: meta.platform, symbol: meta.symbol, timeframe: meta.tf, strategy: { family: 'receta', gen: s.spec } });
        await post({ action: 'lab_run', botId: j.bot?.id, trades, paramCount: 6, noAi: true });
        created++;
      }
      toast((es ? 'Enviados al laboratorio: ' : 'Sent to lab: ') + created);
      if (reload) reload();
    } catch (e: any) { toastErr(e?.message); } finally { setRecSending(false); }
  }
  function wfColor(pf: number) { return pf >= 1.3 ? GREEN : pf >= 1.1 ? '#7bd44a' : pf >= 1 ? AMBER : pf > 0 ? '#e08a3c' : RED; }

  const specLabel = (s: Spec) => `${s.ind1}${s.ind2 ? '+' + s.ind2 : ''} · ${s.entry} · TP ${s.tp}/SL ${s.sl}`;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ══════════ MODO AUTOMÁTICO · UN CLIC ══════════ */}
      <div style={{ ...card, borderColor: `color-mix(in srgb,${GREEN} 55%,var(--line))`, background: `linear-gradient(160deg, color-mix(in srgb,${GREEN} 12%,var(--card)), var(--card) 65%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,' + GREEN + ',' + AQUA + ')', color: '#04201d', fontSize: 22 }}>🤖</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{es ? 'Modo automático · un clic' : 'Automatic mode · one click'}</h3>
            <p className="muted" style={{ fontSize: 12.5, margin: '3px 0 0' }}>{es ? 'Elige tus datos y pulsa Ejecutar. El sistema genera miles de estrategias, las prueba, descarta las malas y deja en el Databank solo las robustas. No tocas nada más.' : 'Pick your data and press Run. The system generates thousands of strategies, tests them, discards the bad ones and leaves only the robust ones in the Databank.'}</p>
          </div>
        </div>

        {/* Paso 1: dataset (de aquí salen instrumento y timeframe, solos) */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{es ? '1 · Tus datos' : '1 · Your data'}</div>
          <select value={dsId} onChange={(e) => loadFromLibrary(e.target.value)} disabled={reading} style={{ ...inp, width: '100%', maxWidth: 460 }}>
            <option value="">{libDs.length ? (es ? '— elige un dataset de tu biblioteca —' : '— pick a dataset from your library —') : (es ? '— aún no hay datos (súbelos en Puerta 0) —' : '— no data yet (upload in Gate 0) —')}</option>
            {libDs.map((d: any) => <option key={d.id} value={d.id} disabled={!d.bars_url}>{d.symbol} · {(d.from_year || '')}–{(d.to_year || '')} · {d.data_kind === 'ticks' || d.has_ticks ? 'ticks' : 'bars'} · {d.quality_score}%{d.bars_url ? '' : (es ? ' · ⚠ sin barras (re-guarda en Puerta 0)' : ' · ⚠ no bars (re-save in Gate 0)')}</option>)}
          </select>
          {libDs.some((d: any) => !d.bars_url) && <div className="muted" style={{ fontSize: 11, marginTop: 6, color: AMBER }}>{es ? '⚠ Los datasets marcados "sin barras" se guardaron antes del arreglo de subida. Ve a Puerta 0, vuelve a analizar ese archivo y pulsa "Guardar en biblioteca" — quedará listo para el motor.' : '⚠ Datasets marked "no bars" were saved before the upload fix. Go to Gate 0, re-analyze that file and press "Save to library" — it will be engine-ready.'}</div>}
          {reading && <div style={{ marginTop: 10 }}><ProgressBar p={prog} label={es ? 'Cargando datos…' : 'Loading data…'} /></div>}
          {/* Instrumento + timeframe autodetectados: se VEN aquí */}
          {bars && !reading && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={autoChip(VIOLET)}>🏷 {es ? 'Instrumento' : 'Instrument'}: <b>{meta.symbol || '—'}</b></span>
              <span style={autoChip('var(--brand)')}>⏱ {es ? 'Temporalidad' : 'Timeframe'}: <b>{meta.tf || '—'}</b></span>
              <span style={autoChip('var(--brand)')}>📅 {new Date(bars[0].t).toISOString().slice(0, 10)} → {new Date(bars[bars.length - 1].t).toISOString().slice(0, 10)}</span>
              <span style={autoChip(LIME)}>{bars.length.toLocaleString('en-US')} {es ? 'barras' : 'bars'}</span>
            </div>
          )}
          {bars && !reading && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{es ? 'El instrumento y la temporalidad salen del dataset — por eso el generador no los pregunta.' : 'Instrument and timeframe come from the dataset — that’s why the generator doesn’t ask for them.'}</div>}
          {/* Resolución de la búsqueda: más fino = menos sorpresas al validar en M1, pero más lento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Resolución de la búsqueda' : 'Search resolution'}<Help text={es ? 'A más fino (M5), el backtest de la búsqueda se parece más al de M1 real → menos robots que se caen al validar. Pero es más lento. Auto elige M15 para datasets enormes.' : 'Finer (M5) makes the search backtest closer to real M1 → fewer robots that collapse on validation. But slower. Auto picks M15 for huge datasets.'} /></span>
            {([['auto', es ? 'Auto' : 'Auto'], [5, 'M5 · fino'], [15, 'M15 · rápido'], [30, 'M30'], [60, 'H1'], [240, 'H4 · ligero']] as [any, string][]).map(([v, l]) => (
              <button key={String(v)} onClick={() => { setSearchTf(v); if (dsId) loadFromLibrary(dsId, v); }} style={{ ...btn(searchTf === v ? GREEN : '#8a94a6'), padding: '5px 11px', fontSize: 12 }}>{l}</button>
            ))}
          </div>
          {searchTf === 5 && <div className="muted" style={{ fontSize: 11, marginTop: 5, color: AMBER }}>{es ? '⚠ M5 es más fino y fiel, pero la búsqueda tarda ~3× más. Mantén la pestaña abierta.' : '⚠ M5 is finer and more faithful, but the search takes ~3× longer. Keep the tab open.'}</div>}
        </div>

        {/* Paso 2: método (evolución vs aleatorio) */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{es ? '2 · Método de búsqueda' : '2 · Search method'}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setAutoMode('evolve')} style={{ ...methodCard(autoMode === 'evolve', GREEN) }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>🧬 {es ? 'Evolución (inteligente)' : 'Evolution (smart)'}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{es ? 'Muta y cruza las mejores durante varias generaciones. Explora MILLONES de combinaciones con pocos backtests. Recomendado.' : 'Mutates and crosses the best over generations. Explores MILLIONS of combos with few backtests. Recommended.'}</div>
            </button>
            <button onClick={() => setAutoMode('random')} style={{ ...methodCard(autoMode === 'random', BLUE) }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>🎲 {es ? 'Aleatorio (rápido)' : 'Random (fast)'}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{es ? 'Prueba N estrategias al azar. Simple y directo, pero no aprende de las buenas.' : 'Tests N random strategies. Simple and direct, but doesn’t learn from the good ones.'}</div>
            </button>
          </div>
        </div>

        {/* Paso 2b: receta de bloques (qué combinar) — clave para que no salgan malas */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{es ? '2b · Qué bloques combinar (receta)' : '2b · Which blocks to combine (recipe)'}<Help text={es ? 'No marques TODOS los bloques: el espacio se vuelve enorme y ruidoso y casi todo sale malo. Elige una receta coherente con tu instrumento/temporalidad — más tasa de acierto. Afínala en “Bloques a combinar” (avanzado).' : 'Do NOT select ALL blocks: the space becomes huge and noisy and most come out bad. Pick a recipe that fits your instrument/timeframe — higher hit rate. Fine-tune in “Blocks to combine” (advanced).'} /></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BLOCK_PRESETS.map((p) => { const on = JSON.stringify(cfg) === JSON.stringify(p.cfg); return (
              <button key={p.key} onClick={() => setCfg(p.cfg)} style={{ ...btn(on ? GREEN : '#8a94a6'), padding: '7px 13px', fontSize: 12.5, fontWeight: 800 }}>{es ? p.es : p.en}</button>
            ); })}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{es ? 'Consejo: para empezar usa una familia (no “Todo”). “Todo” explora más pero saca más basura.' : 'Tip: start with one family (not “All”). “All” explores more but yields more junk.'}</div>
        </div>

        {/* Paso 3: cuánto escanear / cuánto guardar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{autoMode === 'evolve' ? (es ? '3 · Esfuerzo de evolución' : '3 · Evolution effort') : (es ? '3 · Cuántas probar' : '3 · How many to test')}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label><div className="muted" style={{ fontSize: 11.5, marginBottom: 3 }}>{es ? 'Estrategias a escanear' : 'Strategies to scan'}<Help text={tip(es, 'n')} /></div>
              <input type="number" value={n || ''} step={500} placeholder={es ? 'cantidad' : 'amount'} onChange={(e) => setN(Math.max(0, Math.floor(Number(e.target.value) || 0)))} style={{ ...inp, width: 130 }} /></label>
            <label><div className="muted" style={{ fontSize: 11.5, marginBottom: 3 }}>{es ? 'Robots a guardar' : 'Robots to keep'}<Help text={tip(es, 'keepN')} /></div>
              <input type="number" value={keepN} min={1} max={500} onChange={(e) => setKeepN(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} style={{ ...inp, width: 110 }} /></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[[2000, es ? 'Rápido' : 'Fast'], [8000, es ? 'Normal' : 'Normal'], [20000, es ? 'Profundo' : 'Deep'], [50000, es ? 'Masivo' : 'Massive'], [100000, es ? 'Extremo' : 'Extreme']].map(([v, l]) => (
                <button key={v as number} onClick={() => setN(v as number)} style={{ ...btn(n === v ? GREEN : '#8a94a6'), padding: '7px 12px', fontSize: 12 }}>{l as string}</button>
              ))}
              <span style={{ fontSize: 11, alignSelf: 'center', color: LIME, fontWeight: 700 }}>{es ? '· sin límite' : '· no cap'}</span>
            </div>
          </div>
          {n > 30000 && <div style={{ fontSize: 11.5, marginTop: 6, color: AMBER, fontWeight: 700 }}>⚠ {es ? `${n.toLocaleString('en-US')} corre en tu navegador: puede tardar mucho o quedarse sin memoria. Deja la pestaña abierta y en primer plano; si se corta, baja la cantidad. (Para millones sin navegador hará falta el motor en la nube.)` : `${n.toLocaleString('en-US')} runs in your browser: may be slow or run out of memory. Keep the tab open and in front; if it stops, lower the amount. (Millions without a browser needs the cloud engine.)`}</div>}
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{autoMode === 'evolve' ? (es ? '🧬 En evolución este número es el PRESUPUESTO: a más presupuesto, más generaciones y población, y más a fondo explora ese espacio de millones de combinaciones (haciendo solo unos miles de backtests). Corre en tu navegador; mantén la pestaña abierta.' : '🧬 In evolution this number is the BUDGET: more budget = more generations/population, exploring that space of millions of combos deeper (with only a few thousand backtests). Runs in your browser; keep the tab open.') : (es ? 'Más estrategias = más posibilidades pero tarda más (corre en tu navegador; mantén la pestaña abierta).' : 'More strategies = more chances but slower (runs in your browser; keep the tab open).')}</div>
        </div>

        {/* Paso 4: calidad + IA (anti-sobreajuste) */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{es ? '4 · Calidad e IA (anti-sobreajuste)' : '4 · Quality & AI (anti-overfit)'}</div>
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${GREEN} 22%,var(--line))` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12, minWidth: 150 }}>{es ? 'Onyx Score mínimo' : 'Min Onyx Score'}<Help text={es ? 'Cada finalista recibe un Onyx Robustness Score (0–100) que mide consistencia dentro/fuera de muestra, Monte Carlo, drawdown y simplicidad. Solo se guardan los que llegan a este mínimo → filtra los sobre-optimizados. 65≈B, 80≈A.' : 'Each finalist gets an Onyx Robustness Score (0–100) measuring in/out-of-sample consistency, Monte Carlo, drawdown and simplicity. Only those reaching this minimum are kept → filters over-optimized ones. 65≈B, 80≈A.'} /></span>
              <input type="range" min={40} max={90} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={{ flex: 1, minWidth: 140 }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: minScore >= 80 ? GREEN : minScore >= 65 ? LIME : AMBER, minWidth: 78 }}>{minScore} · {minScore >= 80 ? 'A' : minScore >= 65 ? 'B' : minScore >= 50 ? 'C' : 'D'}</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>🧠 {es ? 'La IA (Claude) audita cada robot final' : 'AI (Claude) audits each final robot'}</span>
              <span className="muted" style={{ fontSize: 11.5 }}>{es ? '— interpreta su robustez y sugiere mejoras. Más lento pero es el sello de calidad.' : '— interprets robustness and suggests improvements. Slower but the quality seal.'}</span>
            </label>
          </div>
        </div>

        {/* Paso 5: ejecutar */}
        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {canManage && <button onClick={autopilot} disabled={auto || !bars} style={{ padding: '14px 30px', borderRadius: 13, border: 'none', fontWeight: 900, fontSize: 16, cursor: auto || !bars ? 'default' : 'pointer', background: auto || !bars ? '#3a4452' : 'linear-gradient(135deg,' + GREEN + ',' + AQUA + ')', color: auto || !bars ? '#8a94a6' : '#04201d', boxShadow: auto || !bars ? 'none' : '0 6px 20px color-mix(in srgb,' + GREEN + ' 40%,transparent)' }}>{auto ? (es ? '⏳ Trabajando…' : '⏳ Working…') : (es ? '🚀 Ejecutar' : '🚀 Run')}</button>}
          {!bars && !reading && <span className="muted" style={{ fontSize: 12.5 }}>{es ? '⬆ Elige primero un dataset arriba.' : '⬆ Pick a dataset above first.'}</span>}
          {auto && <span style={{ fontSize: 13, color: GREEN, fontWeight: 700 }}>{autoMsg}</span>}
        </div>
        {autoStats && (auto || !autoDone) && <GenMonitor s={autoStats} es={es} evo={evo} />}
        {autoDone && (
          <div style={{ marginTop: 12, background: 'var(--bg2)', borderRadius: 11, padding: '12px 14px', fontSize: 13.5, border: `1px solid color-mix(in srgb,${GREEN} 35%,var(--line))` }}>
            ✅ {es ? 'Listo. Creados' : 'Done. Created'} <b style={{ color: GREEN }}>{autoDone.created}</b> {es ? 'robots limpios' : 'clean robots'}{autoDone.avg ? <> · {es ? 'Onyx medio' : 'avg Onyx'} <b style={{ color: autoDone.avg >= 80 ? GREEN : LIME }}>{autoDone.avg} ({autoDone.avg >= 80 ? 'A' : autoDone.avg >= 65 ? 'B' : 'C'})</b></> : null} · {autoDone.survivors} {es ? 'pasaron el filtro de' : 'passed the gate of'} {autoDone.scanned} {es ? 'evaluadas' : 'evaluated'}{useAi ? (es ? ' · 🧠 auditados por IA' : ' · 🧠 AI-audited') : ''}. <span className="muted">{es ? 'Míralos en el Databank, y en Laboratorio y Pipeline (con la nota de la IA).' : 'See them in the Databank, and in Lab and Pipeline (with the AI note).'}</span>
          </div>
        )}
      </div>

      {/* Toggle: pliega TODO lo avanzado para ver solo el modo automático + resultados */}
      <button onClick={() => setAdvOpen((v) => !v)} style={{ ...btn(advOpen ? VIOLET : '#8a94a6'), padding: '11px 16px', justifyContent: 'center', fontSize: 13.5, fontWeight: 800 }}>
        {advOpen ? '▴ ' : '▾ '}⚙️ {es ? 'Ajustes avanzados' : 'Advanced settings'} <span className="muted" style={{ fontWeight: 500, marginLeft: 6 }}>{es ? '· costes, gestión monetaria, reto, OOS, evolución manual, databank, portafolios' : '· costs, money mgmt, challenge, OOS, manual evolution, databank, portfolios'}</span>
      </button>

      {advOpen && (<>
      {/* Asistente IA de configuración avanzada */}
      <div style={{ ...card, borderColor: `color-mix(in srgb,${CORAL} 40%,var(--line))`, background: `linear-gradient(150deg, color-mix(in srgb,${CORAL} 8%,var(--card)), var(--card) 65%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <h3 style={{ margin: 0, flex: 1 }}>{es ? 'Asistente IA · configura todo con tu objetivo' : 'AI assistant · configure everything from your goal'}</h3>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{es ? 'Escribe tu objetivo en lenguaje natural y Claude configura costes, gestión monetaria, reglas de reto (prop firm), OOS, evolución y la receta de bloques.' : 'Describe your goal in plain words and Claude sets costs, money management, prop-firm challenge rules, OOS, evolution and the block recipe.'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={aiObj} onChange={(e) => setAiObj(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAdvisor(); }} placeholder={es ? 'Ej: pasar FTMO 100k fase 1 en oro, riesgo bajo' : 'e.g. pass FTMO 100k phase 1 on gold, low risk'} style={{ ...inp, flex: 1, minWidth: 240 }} />
          {canManage && <button onClick={runAdvisor} disabled={aiBusy} style={{ ...btn(CORAL), padding: '9px 16px' }}>{aiBusy ? (es ? 'Pensando…' : 'Thinking…') : (es ? '✨ Configurar con IA' : '✨ Configure with AI')}</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {[es ? 'pasar FTMO 100k fase 1 en oro, riesgo bajo' : 'pass FTMO 100k phase 1 on gold, low risk', es ? 'cuenta real, bajo drawdown, tendencia' : 'live account, low drawdown, trend', es ? 'scalping agresivo en índices' : 'aggressive scalping on indices'].map((q) => (
            <button key={q} onClick={() => setAiObj(q)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 99, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', cursor: 'pointer' }}>{q}</button>
          ))}
        </div>
        {aiRes && (
          <div style={{ marginTop: 12, background: 'var(--bg2)', borderRadius: 10, padding: '11px 13px', border: `1px solid color-mix(in srgb,${CORAL} 30%,var(--line))` }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>{aiRes.byAi ? '🧠 ' + (es ? 'Configuración de Claude' : 'Claude config') : '⚙️ ' + (es ? 'Configuración base (conecta ANTHROPIC_API_KEY para IA)' : 'Base config (set ANTHROPIC_API_KEY for AI)')}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{aiRes.rationale}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {aiRes.cfg?.challenge?.target ? <span style={autoChip(GREEN)}>{es ? 'Objetivo' : 'Target'} {aiRes.cfg.challenge.target}%</span> : null}
              {aiRes.cfg?.challenge?.dailyLoss ? <span style={autoChip(AMBER)}>{es ? 'Pérdida diaria' : 'Daily loss'} {aiRes.cfg.challenge.dailyLoss}%</span> : null}
              {aiRes.cfg?.challenge?.maxDD ? <span style={autoChip(RED)}>DD máx {aiRes.cfg.challenge.maxDD}%</span> : null}
              <span style={autoChip('var(--brand)')}>{es ? 'Riesgo' : 'Risk'} {aiRes.cfg?.costs?.riskPct}%/op</span>
              <span style={autoChip(SKY)}>OOS {aiRes.cfg?.oosPct}%</span>
              <span style={autoChip(VIOLET)}>{es ? 'Bloques' : 'Blocks'}: {aiRes.cfg?.blockPreset}</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 7 }}>{es ? 'Ya se aplicó a los ajustes de abajo. Revísalos y ajusta lo que quieras — la IA no promete resultados; verifica las reglas exactas de tu prop firm.' : 'Already applied to the settings below. Review and tweak — AI does not promise results; verify your exact prop-firm rules.'}</div>
          </div>
        )}
      </div>

      {/* Datos + costes */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,' + VIOLET + ',' + AQUA + ')', color: '#04201d', fontSize: 18 }}>⚙️</span>
          <h3 style={{ margin: 0, flex: 1 }}>{es ? 'Motor de backtest + evolución' : 'Backtest + evolution engine'}</h3>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{es ? 'Elige un dataset de tu biblioteca (ya validado en la Puerta 0, sin volver a subir nada) o sube uno nuevo. El motor simula miles de estrategias con costes reales, evoluciona las mejores y las envía al laboratorio.' : 'Pick a dataset from your library (already validated in Gate 0, no re-upload) or upload a new one. The engine simulates thousands of strategies with real costs, evolves the best and sends them to the lab.'}</p>

        {/* Biblioteca de datos: reutiliza lo subido en la Puerta 0 (sin resubir) */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', border: '1px solid color-mix(in srgb,#0fb8a6 25%,var(--line))' }}>
          <span style={{ fontSize: 18 }}>🗄</span>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{es ? 'Desde la biblioteca' : 'From library'}</span>
          <select value={dsId} onChange={(e) => loadFromLibrary(e.target.value)} disabled={reading} style={{ ...inp, minWidth: 220 }}>
            <option value="">{usableDs.length ? (es ? '— elige un dataset guardado —' : '— pick a saved dataset —') : (es ? '— aún no hay datos guardados —' : '— no saved data yet —')}</option>
            {usableDs.map((d: any) => <option key={d.id} value={d.id}>{d.symbol} · {(d.from_year || '')}–{(d.to_year || '')} · {d.data_kind === 'ticks' || d.has_ticks ? 'ticks' : 'bars'} · {d.quality_score}%</option>)}
          </select>
          <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'o sube uno nuevo →' : 'or upload new →'}</span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label><span className="muted" style={{ fontSize: 11.5, marginRight: 6 }}>{es ? 'Convertir a' : 'Convert to'}</span>
            <select value={tfMin} onChange={(e) => setTfMin(Number(e.target.value))} style={{ ...inp, padding: '6px 9px' }}>
              {[[5, 'M5'], [15, 'M15'], [30, 'M30'], [60, 'H1'], [240, 'H4'], [1440, 'D1']].map(([v, l]) => <option key={v} value={v as number}>{l}</option>)}
            </select>
          </label>
          <label style={{ ...btn('#0fb8a6'), cursor: reading ? 'wait' : 'pointer', opacity: reading ? 0.7 : 1 }}>{reading ? (es ? `Leyendo ${Math.round(prog * 100)}%` : `Reading ${Math.round(prog * 100)}%`) : bars ? `${bars.length} barras · ${barsName.slice(0, 16)}` : (es ? 'Subir ticks/barras (cualquier tamaño)' : 'Upload ticks/bars (any size)')}
            <input type="file" accept=".csv,.txt,.tsv" disabled={reading} style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBarsName(f.name); setReading(true); setProg(0); setBars(null); try { const b = await parseBarsStreaming(f, tfMin, (p) => setProg(p)); if (b.length < 100) toastErr(es ? 'Se generaron muy pocas barras. Revisa el formato o usa una temporalidad más baja.' : 'Too few bars generated. Check the format or use a lower timeframe.'); setBars(b); const sym = guessSymbol(f.name); if (sym) setMeta((mt) => ({ ...mt, symbol: sym, tf: `M${tfMin}` })); } catch (err: any) { toastErr(es ? 'No se pudo leer el archivo. Revisa que sea CSV (Dukascopy: Gmt time, Ask, Bid).' : 'Could not read the file. Make sure it is CSV (Dukascopy: Gmt time, Ask, Bid).'); } finally { setReading(false); setProg(0); } }} />
          </label>
          {bars && <span className="muted" style={{ fontSize: 12 }}>{new Date(bars[0].t).toISOString().slice(0, 10)} → {new Date(bars[bars.length - 1].t).toISOString().slice(0, 10)} · pip {pip}</span>}
        </div>
        {reading && <div style={{ marginTop: 12 }}><ProgressBar p={prog} label={(es ? 'Procesando ' : 'Processing ') + barsName.slice(0, 24)} /></div>}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{es ? 'Acepta los mismos ticks de Dukascopy/StrategyQuant (hasta varios GB): se leen por trozos y se convierten a barras OHLC al vuelo, sin cargar todo en memoria.' : 'Accepts the same Dukascopy/StrategyQuant ticks (multi-GB): streamed in chunks and converted to OHLC bars on the fly.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 12 }}>
          {([['spreadPips', es ? 'Spread (pips)' : 'Spread (pips)'], ['slippagePips', 'Slippage (pips)'], ['commission', es ? 'Comisión ($/lote)' : 'Commission ($/lot)'], ['moneyPerPip', es ? '$/pip (1 lote)' : '$/pip (1 lot)']] as [string, string][]).map(([k, l]) => (
            <label key={k}><span className="muted" style={{ fontSize: 11.5 }}>{l}<Help text={tip(es, k)} /></span><input type="number" step="0.1" value={(costs as any)[k]} onChange={(e) => setCosts({ ...costs, [k]: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          ))}
        </div>

        {/* Gestión monetaria + dirección (estilo StrategyQuant, mejorado) */}
        <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${VIOLET} 22%,var(--line))` }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>💰 {es ? 'Gestión monetaria y dirección' : 'Money management & direction'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Dirección' : 'Direction'}<Help text={tip(es, 'dir')} /></span>
              <select value={dir} onChange={(e) => setDir(e.target.value as any)} style={{ ...inp, width: '100%', marginTop: 3 }}>
                <option value="both">{es ? 'Ambos (Long+Short)' : 'Both (Long+Short)'}</option>
                <option value="long">{es ? 'Solo Long' : 'Long only'}</option>
                <option value="short">{es ? 'Solo Short' : 'Short only'}</option>
              </select>
            </label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Balance inicial ($)' : 'Initial balance ($)'}<Help text={tip(es, 'capital')} /></span>
              <input type="number" step="100" value={costs.capital} onChange={(e) => setCosts({ ...costs, capital: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Tamaño de posición' : 'Position sizing'}<Help text={tip(es, 'mm')} /></span>
              <select value={costs.mm} onChange={(e) => setCosts({ ...costs, mm: e.target.value as any })} style={{ ...inp, width: '100%', marginTop: 3 }}>
                <option value="risk_pct">{es ? '% de riesgo sobre equity' : '% risk on equity'}</option>
                <option value="risk_atr">{es ? '% con stop por volatilidad (ATR)' : '% with volatility stop (ATR)'}</option>
                <option value="risk_money">{es ? 'Riesgo fijo ($)' : 'Fixed risk ($)'}</option>
                <option value="fixed">{es ? 'Lote fijo' : 'Fixed lot'}</option>
              </select>
            </label>
            {(costs.mm === 'risk_pct' || costs.mm === 'risk_atr') && <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? '% por operación' : '% per trade'}<Help text={tip(es, 'riskPct')} /></span><input type="number" step="0.1" value={costs.riskPct} onChange={(e) => setCosts({ ...costs, riskPct: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>}
            {costs.mm === 'risk_atr' && <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'ATR × (stop)' : 'ATR × (stop)'}<Help text={tip(es, 'atrMult')} /></span><input type="number" step="0.1" value={costs.atrMult ?? 1.5} onChange={(e) => setCosts({ ...costs, atrMult: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>}
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Pirámide (añadidos)' : 'Pyramid (add-ons)'}<Help text={tip(es, 'pyramid')} /></span><input type="number" step="1" min={0} max={5} value={costs.pyramid ?? 0} onChange={(e) => setCosts({ ...costs, pyramid: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            {costs.mm === 'risk_money' && <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? '$ por operación' : '$ per trade'}<Help text={tip(es, 'riskMoney')} /></span><input type="number" step="10" value={costs.riskMoney} onChange={(e) => setCosts({ ...costs, riskMoney: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>}
            {costs.mm === 'fixed' && <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Lote' : 'Lot'}<Help text={tip(es, 'lot')} /></span><input type="number" step="0.01" value={costs.lot} onChange={(e) => setCosts({ ...costs, lot: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>}
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Drawdown límite' : 'Drawdown limit'}<Help text={tip(es, 'ddType')} /></span>
              <select value={costs.ddType} onChange={(e) => setCosts({ ...costs, ddType: e.target.value as any })} style={{ ...inp, width: '100%', marginTop: 3 }}>
                <option value="trailing">{es ? 'Trailing (desde el pico)' : 'Trailing (from peak)'}</option>
                <option value="static">{es ? 'Estático (desde el inicio)' : 'Static (from start)'}</option>
                <option value="none">{es ? 'Sin límite' : 'No limit'}</option>
              </select>
            </label>
            {costs.ddType !== 'none' && <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'DD máx %' : 'Max DD %'}<Help text={tip(es, 'maxDDpct')} /></span><input type="number" step="1" value={costs.maxDDpct} onChange={(e) => setCosts({ ...costs, maxDDpct: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'La simulación compone sobre el equity y “revienta” la cuenta si toca el límite de drawdown (como una prop firm). Esos robots se descartan.' : 'The simulation compounds on equity and “blows” the account if it hits the drawdown limit (like a prop firm). Those robots are discarded.'}</div>
        </div>

        {/* Reto prop firm (opcional): objetivo + pérdida diaria + días mínimos */}
        <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${CORAL} 30%,var(--line))` }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>🏁 {es ? 'Reto prop firm (opcional)' : 'Prop-firm challenge (optional)'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Objetivo de beneficio %' : 'Profit target %'}<Help text={tip(es, 'chTarget')} /></span><input type="number" step="1" value={costs.chTarget ?? 0} onChange={(e) => setCosts({ ...costs, chTarget: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Pérdida diaria máx %' : 'Max daily loss %'}<Help text={tip(es, 'chDailyLoss')} /></span><input type="number" step="0.5" value={costs.chDailyLoss ?? 0} onChange={(e) => setCosts({ ...costs, chDailyLoss: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Días mínimos' : 'Minimum days'}<Help text={tip(es, 'chMinDays')} /></span><input type="number" step="1" value={costs.chMinDays ?? 0} onChange={(e) => setCosts({ ...costs, chMinDays: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'Deja en 0 lo que no apliques. Si activas el reto, cada robot recibe un veredicto “pasa el reto / no pasa” y solo pasan los que cumplen objetivo sin romper la pérdida diaria ni el drawdown, con los días mínimos operados.' : 'Leave at 0 what you don’t use. With the challenge on, each robot gets a “passes / fails” verdict and only those meeting the target without breaking daily loss or drawdown, over the minimum days, pass.'}</div>
        </div>

        {/* Opciones de trading finas (estilo StrategyQuant) */}
        <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${BLUE} 26%,var(--line))` }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>⏱️ {es ? 'Opciones de trading' : 'Trading options'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Máx operaciones/día' : 'Max trades/day'}<Help text={tip(es, 'maxTradesDay')} /></span><input type="number" step="1" min={0} value={costs.maxTradesDay ?? 0} onChange={(e) => setCosts({ ...costs, maxTradesDay: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Hora desde (UTC)' : 'Hour from (UTC)'}<Help text={tip(es, 'hourRange')} /></span><input type="number" step="1" min={-1} max={23} value={costs.hourFrom ?? -1} onChange={(e) => setCosts({ ...costs, hourFrom: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Hora hasta (UTC)' : 'Hour to (UTC)'}</span><input type="number" step="1" min={-1} max={24} value={costs.hourTo ?? -1} onChange={(e) => setCosts({ ...costs, hourTo: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Cerrar el viernes' : 'Close on Friday'}<Help text={tip(es, 'exitFri')} /></span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                <input type="checkbox" checked={!!costs.exitFri} onChange={(e) => setCosts({ ...costs, exitFri: e.target.checked })} />
                <input type="number" step="1" min={0} max={23} value={costs.friHour ?? 21} disabled={!costs.exitFri} onChange={(e) => setCosts({ ...costs, friHour: Number(e.target.value) })} style={{ ...inp, width: 60 }} /><span className="muted" style={{ fontSize: 11 }}>h UTC</span>
              </div>
            </label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'SL mín · máx (pips)' : 'SL min · max (pips)'}<Help text={tip(es, 'slLimit')} /></span>
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}><input type="number" step="1" min={0} value={costs.slMin ?? 0} onChange={(e) => setCosts({ ...costs, slMin: Number(e.target.value) })} style={{ ...inp, width: '50%' }} /><input type="number" step="1" min={0} value={costs.slMax ?? 0} onChange={(e) => setCosts({ ...costs, slMax: Number(e.target.value) })} style={{ ...inp, width: '50%' }} /></div></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'TP mín · máx (pips)' : 'TP min · max (pips)'}<Help text={tip(es, 'tpLimit')} /></span>
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}><input type="number" step="1" min={0} value={costs.tpMin ?? 0} onChange={(e) => setCosts({ ...costs, tpMin: Number(e.target.value) })} style={{ ...inp, width: '50%' }} /><input type="number" step="1" min={0} value={costs.tpMax ?? 0} onChange={(e) => setCosts({ ...costs, tpMax: Number(e.target.value) })} style={{ ...inp, width: '50%' }} /></div></label>
          </div>
        </div>

        {/* División dentro/fuera de muestra (IS/OOS) — con presets */}
        <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${CORAL} 28%,var(--line))` }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🧪 {es ? 'Fuera de muestra (OOS)' : 'Out-of-sample (OOS)'}<Help text={tip(es, 'oos')} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input type="range" min={0} max={50} step={5} value={oosPct} onChange={(e) => setOosPct(Number(e.target.value))} style={{ flex: 1, minWidth: 140 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: CORAL, minWidth: 44 }}>{oosPct}%</span>
            {[0, 20, 30, 50].map((v) => <button key={v} onClick={() => setOosPct(v)} style={{ ...btn(oosPct === v ? CORAL : '#8a94a6'), padding: '5px 10px', fontSize: 12 }}>{v === 0 ? (es ? 'Sin OOS' : 'No OOS') : v + '%'}</button>)}
          </div>
          {bars && oosPct > 0 && (() => { const t0 = bars[0].t, tN = bars[bars.length - 1].t; const cut = t0 + (tN - t0) * (1 - oosPct / 100); const fmt = (t: number) => new Date(t).toISOString().slice(0, 10); return <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'Dentro de muestra' : 'In-sample'}: {fmt(t0)} → {fmt(cut)} · <span style={{ color: CORAL }}>{es ? 'Fuera de muestra' : 'Out-of-sample'}: {fmt(cut)} → {fmt(tN)}</span></div>; })()}
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{es ? 'En la Receta y el Autopiloto, un robot que no gana en el tramo fuera de muestra se descarta (anti-sobreajuste). Mejor que SQ: es obligatorio, no opcional.' : 'In the Recipe and Autopilot, a robot that doesn’t profit out-of-sample is discarded (anti-overfit). Better than SQ: it’s mandatory, not optional.'}</div>
        </div>
      </div>

      {/* AUTOPILOTO */}
      <div style={{ ...card, borderColor: `color-mix(in srgb,${GREEN} 45%,var(--line))`, background: `linear-gradient(150deg, color-mix(in srgb,${GREEN} 8%,var(--card)), var(--card) 70%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,' + GREEN + ',' + AQUA + ')', color: '#04201d', fontSize: 19 }}>🤖</span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h3 style={{ margin: 0 }}>{es ? 'Autopiloto' : 'Autopilot'}</h3>
            <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Un botón: genera → backtestea → filtra por robustez (IS/OOS) → crea solo los robots que sobreviven y los manda al laboratorio. Sin CSV.' : 'One button: generate → backtest → filter by robustness → create only surviving robots and send them to the lab. No CSV.'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <span className="muted" style={{ fontSize: 12 }}>{es ? 'Crear hasta' : 'Create up to'}<Help text={tip(es, 'keepN')} /></span>
          <input type="number" value={keepN} min={1} max={500} onChange={(e) => setKeepN(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} style={{ ...inp, width: 70 }} />
          <span className="muted" style={{ fontSize: 12 }}>{es ? 'robots · de' : 'robots · from'} {n} {es ? 'candidatos' : 'candidates'}<Help text={tip(es, 'n')} /></span>
          {canManage && <button onClick={autopilot} disabled={auto || !bars} style={{ marginLeft: 'auto', padding: '12px 22px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14.5, cursor: auto || !bars ? 'default' : 'pointer', background: 'linear-gradient(135deg,' + GREEN + ',' + AQUA + ')', color: '#04201d', opacity: auto || !bars ? 0.6 : 1 }}>{auto ? (es ? 'Trabajando…' : 'Working…') : (es ? '🚀 Ejecutar autopiloto' : '🚀 Run autopilot')}</button>}
        </div>
        {auto && <div style={{ marginTop: 10, fontSize: 13, color: GREEN, fontWeight: 700 }}>{autoMsg}</div>}
        {autoDone && (
          <div style={{ marginTop: 10, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            ✓ {es ? 'Creados' : 'Created'} <b style={{ color: GREEN }}>{autoDone.created}</b> {es ? 'robots' : 'robots'} · {autoDone.survivors} {es ? 'robustos de' : 'robust of'} {autoDone.scanned} · <span className="muted">{es ? 'míralos en Laboratorio y Pipeline. Solo falta instalar su EA en la demo.' : 'see them in Lab and Pipeline. Just install their EA on demo.'}</span>
          </div>
        )}
      </div>

      {/* RECETA ENCADENADA (build → backtest → MC → walk-forward → rechazar) */}
      <div style={{ ...card, borderColor: `color-mix(in srgb,${BLUE} 45%,var(--line))` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,' + LIME + ',' + AQUA + ')', color: '#04201d', fontSize: 19 }}>🧪</span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h3 style={{ margin: 0 }}>{es ? 'Receta encadenada' : 'Chained recipe'}</h3>
            <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Generar → backtest → in/out-of-sample → Monte Carlo (8 tipos) → walk-forward matrix. Solo pasan los que superan TODAS las compuertas.' : 'Generate → backtest → in/out-of-sample → Monte Carlo (8 types) → walk-forward matrix. Only those passing ALL gates survive.'}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 12 }}>
          {([['minPf', es ? 'PF mínimo' : 'Min PF', 0.1, 'minPf'], ['maxDd', es ? 'DD máx %' : 'Max DD %', 1, 'maxDd'], ['minTr', es ? 'Ops mín' : 'Min trades', 1, 'minTr'], ['mcMaxLoss', es ? 'MC: prob. pérdida máx %' : 'MC: max loss prob %', 1, 'mcMaxLoss'], ['wfMinStab', es ? 'WF: estabilidad mín %' : 'WF: min stability %', 1, 'wfMinStab']] as [string, string, number, string][]).map(([k, l, step, tk]) => (
            <label key={k}><span className="muted" style={{ fontSize: 11 }}>{l}<Help text={tip(es, tk)} /></span><input type="number" step={step} value={(recipe as any)[k]} onChange={(e) => setRecipe({ ...recipe, [k]: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          ))}
        </div>
        {canManage && <button onClick={runRecipe} disabled={recRun || !bars} style={{ ...btn(BLUE), marginTop: 12, padding: '11px 20px', fontSize: 14 }}>{recRun ? (es ? 'Ejecutando…' : 'Running…') : (es ? '🧪 Ejecutar receta' : '🧪 Run recipe')}</button>}
        {recRun && <div style={{ marginTop: 10, fontSize: 13, color: BLUE, fontWeight: 700 }}>{recMsg}</div>}

        {recFunnel && (
          <div style={{ marginTop: 14 }}>
            {/* Embudo */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {[[es ? 'Generadas' : 'Generated', recFunnel.scanned, '#0fb8a6'], [es ? 'Backtest' : 'Backtest', recFunnel.bt, VIOLET], [es ? 'Monte Carlo' : 'Monte Carlo', recFunnel.mc, BLUE], [es ? 'Walk-forward' : 'Walk-forward', recFunnel.wf, GREEN], [es ? 'Supervivientes' : 'Survivors', recFunnel.survivors.length, GREEN]].map(([l, v, c]: any, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 11px', textAlign: 'center', border: `1px solid color-mix(in srgb,${c} 30%,var(--line))` }}><b style={{ color: c, fontSize: 16 }}>{v}</b><span className="muted" style={{ fontSize: 10.5, display: 'block' }}>{l}</span></span>
                  {i < 4 && <span className="muted">→</span>}
                </span>
              ))}
              {canManage && recFunnel.survivors.length > 0 && <button onClick={sendRecipe} disabled={recSending} style={{ ...btn(GREEN), marginLeft: 'auto' }}>{recSending ? (es ? 'Enviando…' : 'Sending…') : (es ? '🚀 Enviar supervivientes al lab' : '🚀 Send survivors to lab')}</button>}
            </div>

            {/* Mejor superviviente: walk-forward matrix + Monte Carlo */}
            {recBest && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginTop: 14 }}>
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{es ? 'Walk-forward matrix' : 'Walk-forward matrix'} <span className="muted" style={{ fontWeight: 400 }}>· {es ? 'estabilidad' : 'stability'} {recBest.wf.stability}%</span></div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
                      <thead><tr><th style={{ padding: 3, color: 'var(--mut)' }}>p1\\{es ? 'tramo' : 'fold'}</th>{Array.from({ length: recBest.wf.folds }).map((_, f) => <th key={f} style={{ padding: 3, color: 'var(--mut)' }}>{f + 1}</th>)}</tr></thead>
                      <tbody>{recBest.wf.cells.map((row: number[], ri: number) => (
                        <tr key={ri}><td style={{ padding: 3, fontFamily: 'monospace', color: 'var(--mut)' }}>{recBest.wf.values[ri]}</td>{row.map((pf: number, ci: number) => <td key={ci} style={{ padding: 0 }}><div title={'PF ' + pf} style={{ width: 34, height: 22, background: `color-mix(in srgb,${wfColor(pf)} 55%,transparent)`, color: '#0b1020', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, margin: 1 }}>{pf.toFixed(1)}</div></td>)}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>{es ? 'Verde en muchas celdas = meseta robusta (no un pico afortunado).' : 'Green across many cells = robust plateau (not a lucky peak).'}</div>
                </div>
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{es ? 'Monte Carlo · 8 tipos' : 'Monte Carlo · 8 types'} <span className="muted" style={{ fontWeight: 400 }}>· {es ? 'peor prob. pérdida' : 'worst loss prob'} {recBest.mc.worstLossProb}%</span></div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {recBest.mc.types.map((t: any) => (
                      <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10.5, width: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{es ? t.es : t.en}</span>
                        <div style={{ flex: 1, height: 9, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}><div style={{ width: Math.min(100, t.lossProb) + '%', height: '100%', background: t.lossProb <= 20 ? GREEN : t.lossProb <= 35 ? AMBER : RED }} /></div>
                        <span style={{ fontSize: 10.5, width: 60, textAlign: 'right', color: 'var(--mut)' }}>{t.lossProb}% · DD{t.p95DD}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bloques a combinar */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Bloques a combinar' : 'Blocks to combine'}</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {BLOCKS.map((b) => (
            <div key={b.key}>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 5 }}>{es ? b.es : b.en} <span className="muted" style={{ fontSize: 11 }}>· {(cfg[b.key] || []).length}</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {b.opts.map((o) => { const on = (cfg[b.key] || []).includes(o.id); return <button key={o.id} onClick={() => toggle(b.key, o.id)} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${on ? VIOLET : 'var(--line)'}`, background: on ? `color-mix(in srgb,${VIOLET} 15%,transparent)` : 'transparent', color: on ? VIOLET : 'var(--tx)' }}>{es ? o.es : o.en}</button>; })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          <span className="muted" style={{ fontSize: 12 }}>{es ? 'Backtestear' : 'Backtest'}</span>
          <input type="number" value={n || ''} step={500} placeholder={es ? 'cantidad' : 'amount'} onChange={(e) => setN(Math.max(0, Math.floor(Number(e.target.value) || 0)))} style={{ ...inp, width: 100 }} />
          {canManage && <button onClick={runBatch} disabled={busy || !bars} style={{ ...btn(VIOLET), opacity: busy || !bars ? 0.6 : 1 }}>{busy ? (es ? 'Corriendo…' : 'Running…') : (es ? '⚡ Backtestear lote' : '⚡ Backtest batch')}</button>}
          {canManage && <button onClick={runEvolve} disabled={busy || !bars} style={{ ...btn(GREEN), opacity: busy || !bars ? 0.6 : 1 }}>{es ? '🧬 Evolucionar' : '🧬 Evolve'}</button>}
        </div>
        {/* Parámetros de evolución (simple y transparente) */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>🧬 {es ? 'Evolución' : 'Evolution'}</span>
          {([['gens', es ? 'Generaciones' : 'Generations', 3, 500], ['pop', es ? 'Población' : 'Population', 20, 2000]] as [string, string, number, number][]).map(([k, l, lo, hi]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="muted" style={{ fontSize: 11 }}>{l}</span><input type="number" min={lo} max={hi} value={(evoCfg as any)[k]} onChange={(e) => setEvoCfg({ ...evoCfg, [k]: Math.max(lo, Math.min(hi, Number(e.target.value) || lo)) })} style={{ ...inp, width: 64, padding: '5px 7px' }} /></label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="muted" style={{ fontSize: 11 }}>{es ? 'Mutación' : 'Mutation'}</span><input type="number" step="0.05" min={0.05} max={0.6} value={evoCfg.mut} onChange={(e) => setEvoCfg({ ...evoCfg, mut: Math.max(0.05, Math.min(0.6, Number(e.target.value) || 0.25)) })} style={{ ...inp, width: 64, padding: '5px 7px' }} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="muted" style={{ fontSize: 11 }}>{es ? 'Reinicio si estanca' : 'Restart if stagnant'}</span><input type="number" min={0} max={20} value={evoCfg.restart} onChange={(e) => setEvoCfg({ ...evoCfg, restart: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} style={{ ...inp, width: 64, padding: '5px 7px' }} /></label>
        </div>
      </div>

      {/* Evolución */}
      {evo && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Evolución genética' : 'Genetic evolution'}</h3>
          <EvoChart history={evo.history} />
          <div className="muted" style={{ fontSize: 12, margin: '6px 0 10px' }}>{es ? 'Mejor fitness por generación (sube = mejora manteniéndose fuera de muestra).' : 'Best fitness per generation (up = improving while holding out-of-sample).'}</div>
          <SpecTable es={es} rows={evo.best.map((s) => ({ spec: s.spec, net: s.ev.isNet, pf: s.ev.isPf, dd: s.ev.dd, n: s.ev.trades, win: 0, exp: 0, oos: s.ev.oosPf }))} onSel={setSel} sel={sel} specLabel={specLabel} oos />
        </div>
      )}

      </>)}

      {/* Databank */}
      {rows && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <h3 style={{ margin: 0, flex: 1 }}>{es ? 'Databank' : 'Databank'} <span className="muted" style={{ fontSize: 13 }}>· {filtered.length}/{rows.length}</span></h3>
            <span className="muted" style={{ fontSize: 12 }}>PF≥<Help text={tip(es, 'minPf')} /></span><input type="number" step="0.1" value={minPf} onChange={(e) => setMinPf(Number(e.target.value))} style={{ ...inp, width: 70 }} />
            <span className="muted" style={{ fontSize: 12 }}>DD≤<Help text={tip(es, 'maxDd')} /></span><input type="number" value={maxDd} onChange={(e) => setMaxDd(Number(e.target.value))} style={{ ...inp, width: 70 }} />
            <span className="muted" style={{ fontSize: 12 }}>ops≥<Help text={tip(es, 'minTr')} /></span><input type="number" value={minTr} onChange={(e) => setMinTr(Number(e.target.value))} style={{ ...inp, width: 70 }} />
          </div>
          <SpecTable es={es} rows={filtered.slice(0, 40)} onSel={setSel} sel={sel} specLabel={specLabel} />
        </div>
      )}

      {/* Portafolio */}
      {portfolio && portfolio.chosen.length > 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Portafolio de baja correlación' : 'Low-correlation portfolio'}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{es ? 'El armador elige de mayor a menor neto y solo suma robots que se diversifican (corr < 0.6).' : 'The builder picks by net and only adds robots that diversify (corr < 0.6).'}</p>
          <div style={{ fontSize: 14, fontWeight: 800, color: GREEN, marginBottom: 8 }}>{portfolio.chosen.length} {es ? 'robots' : 'robots'} · {es ? 'neto combinado' : 'combined net'} ${portfolio.net.toLocaleString('en-US')}</div>
          <SpecTable es={es} rows={portfolio.chosen} onSel={setSel} sel={sel} specLabel={specLabel} />
        </div>
      )}

      {/* Estrategia seleccionada */}
      {sel && (
        <div style={{ ...card, borderColor: `color-mix(in srgb,${VIOLET} 40%,var(--line))` }}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Estrategia seleccionada' : 'Selected strategy'}</h3>
          <div style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--bg2)', borderRadius: 9, padding: 10 }}>{specLabel(sel)} · BE {sel.be} · Trail {sel.trailing} · {sel.sessions}</div>
          {selChallenge && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: `color-mix(in srgb,${selChallenge.pass ? GREEN : RED} 12%,var(--bg2))`, border: `1px solid color-mix(in srgb,${selChallenge.pass ? GREEN : RED} 40%,var(--line))`, borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ fontWeight: 900, fontSize: 14, color: selChallenge.pass ? GREEN : RED }}>{selChallenge.pass ? (es ? '✓ PASA EL RETO' : '✓ PASSES CHALLENGE') : (es ? '✗ NO PASA EL RETO' : '✗ FAILS CHALLENGE')}</span>
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'Beneficio' : 'Profit'} {selChallenge.profitPct}%{selChallenge.target > 0 ? `/${selChallenge.target}%` : ''} · {es ? 'días' : 'days'} {selChallenge.daysTraded}{selChallenge.minDays > 0 ? `/${selChallenge.minDays}` : ''}{selChallenge.dailyBreach ? (es ? ' · ⚠ rompió pérdida diaria' : ' · ⚠ daily loss broken') : ''}</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginTop: 12 }}>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Plataforma' : 'Platform'}</span><select value={meta.platform} onChange={(e) => setMeta({ ...meta, platform: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }}><option value="mt5">MT5</option><option value="mt4">MT4</option></select></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Símbolo' : 'Symbol'}</span><input value={meta.symbol} onChange={(e) => setMeta({ ...meta, symbol: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Temporalidad' : 'Timeframe'}</span><input value={meta.tf} onChange={(e) => setMeta({ ...meta, tf: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          </div>
          {selScore && <ScoreCard es={es} s={selScore} />}
          {selReport && selReport.trades > 0 && <StratReport es={es} r={selReport} oosPct={oosPct} setOosPct={setOosPct} />}
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button onClick={() => download(`ONYX_${sel.ind1}_${sel.entry}.mq5`, genMt5(sel, meta.symbol, 100000000 + Math.floor(Math.random() * 900000000)), 'text/plain')} style={btn(BLUE)}>{es ? 'Exportar EA .mq5' : 'Export EA .mq5'}</button>
              <button onClick={() => download(`ONYX_${sel.ind1}_${sel.entry}.mq4`, genMt4(sel, meta.symbol, 100000000 + Math.floor(Math.random() * 900000000)), 'text/plain')} style={btn(BLUE)}>{es ? 'Exportar EA .mq4' : 'Export EA .mq4'}</button>
              <button onClick={() => sendToLab(sel)} disabled={busy} style={{ ...btn(GREEN), padding: '10px 18px', fontSize: 14 }}>{es ? '🚀 Enviar al laboratorio' : '🚀 Send to lab'}</button>
            </div>
          )}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{es ? 'El EA exportado es un punto de partida compilable; verifica que su backtest en MT se parezca al del motor antes de pasar a demo.' : 'The exported EA is a compilable starting point; check that its MT backtest matches the engine before going to demo.'}</p>

          {/* Optimizador de parámetros con búsqueda de meseta */}
          <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${AQUA} 30%,var(--line))` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>🔎 {es ? 'Optimizador (búsqueda de meseta)' : 'Optimizer (plateau search)'}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'Barre período/TP/SL y recomienda la MESETA (donde los vecinos también rinden), no el pico aislado que suele estar sobre-ajustado.' : 'Sweeps period/TP/SL and recommends the PLATEAU (where neighbors also perform), not the isolated over-fit peak.'}</div>
              </div>
              <button onClick={() => runOptimize(sel)} disabled={optBusy} style={btn(AQUA)}>{optBusy ? (es ? 'Optimizando…' : 'Optimizing…') : (es ? 'Optimizar' : 'Optimize')}</button>
            </div>
            {optBusy && <div style={{ marginTop: 10 }}><ProgressBarIndeterminate label={es ? 'Barriendo parámetros…' : 'Sweeping parameters…'} /></div>}
            {optRes && <OptView es={es} res={optRes} onUse={(cell: any) => { setSel(specFromCell(sel, optRes.axes, cell)); toast(es ? 'Parámetros de la meseta aplicados' : 'Plateau params applied'); }} />}
          </div>
        </div>
      )}

      {/* Portafolio multi-símbolo / multi-timeframe con correlación */}
      {sel && usableDs.length >= 2 && (
        <div style={{ ...card, borderColor: `color-mix(in srgb,${LIME} 35%,var(--line))` }}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Portafolio multi-símbolo' : 'Multi-symbol portfolio'}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{es ? 'Corre la estrategia seleccionada contra varios datasets (par + temporalidad) de tu biblioteca y mide la correlación mensual: una cartera de baja correlación baja el drawdown combinado.' : 'Runs the selected strategy across several datasets (symbol + timeframe) from your library and measures monthly correlation: a low-correlation basket lowers combined drawdown.'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {usableDs.map((d: any) => {
              const on = msIds.includes(d.id);
              return <button key={d.id} onClick={() => setMsIds((s) => on ? s.filter((x) => x !== d.id) : [...s, d.id])} style={{ ...btn(on ? LIME : '#8a94a6'), background: on ? `color-mix(in srgb,${LIME} 18%,transparent)` : 'transparent' }}>{on ? '✓ ' : ''}{d.symbol || d.id}</button>;
            })}
          </div>
          <button onClick={() => runMultiSymbol(sel)} disabled={msBusy || msIds.length < 2} style={btn(LIME)}>{msBusy ? (msMsg || (es ? 'Calculando…' : 'Computing…')) : (es ? 'Armar portafolio' : 'Build portfolio')}</button>
          {msBusy && <div style={{ marginTop: 10 }}><ProgressBarIndeterminate label={msMsg} /></div>}
          {msRes && <PortView es={es} res={msRes} />}
        </div>
      )}
    </div>
  );
}

// Vista del optimizador: mapa de calor (TP×SL para el mejor período) + meseta.
function OptView({ es, res, onUse }: { es: boolean; res: OptResult; onUse: (c: any) => void }) {
  const { plateau, best, stability, tested } = res;
  if (!plateau) return <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{es ? 'Sin resultados.' : 'No results.'}</div>;
  const label = (c: any) => res.axes.map((ax) => `${ax === 'p1' ? (es ? 'Período' : 'Period') : ax.toUpperCase()} ${c[ax]}`).join(' · ');
  const maxScore = Math.max(1e-9, ...res.cells.map((c) => c.score));
  const heat = (v: number) => { const t = Math.max(0, Math.min(1, v / maxScore)); return `color-mix(in srgb, ${GREEN} ${Math.round(t * 100)}%, var(--bg2))`; };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ background: `color-mix(in srgb,${GREEN} 12%,var(--bg2))`, border: `1px solid color-mix(in srgb,${GREEN} 35%,var(--line))`, borderRadius: 10, padding: '8px 12px' }}>
          <div className="muted" style={{ fontSize: 11 }}>{es ? 'Meseta recomendada' : 'Recommended plateau'}</div>
          <div style={{ fontWeight: 800, fontSize: 13.5 }}>{label(plateau)}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>PF {plateau.pf} · {es ? 'neto' : 'net'} ${plateau.net.toLocaleString('en-US')} · DD {plateau.dd}% · {plateau.n} ops</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
          <div className="muted" style={{ fontSize: 11 }}>{es ? 'Estabilidad de la meseta' : 'Plateau stability'}</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: stability >= 0.6 ? GREEN : stability >= 0.35 ? AMBER : RED }}>{Math.round(stability * 100)}%</div>
          <div className="muted" style={{ fontSize: 11 }}>{tested} {es ? 'combinaciones' : 'combos'}</div>
        </div>
        {best && <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
          <div className="muted" style={{ fontSize: 11 }}>{es ? 'Pico bruto (¡ojo, sobre-ajuste!)' : 'Raw peak (beware overfit!)'}</div>
          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{label(best)}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>PF {best.pf} · DD {best.dd}%</div>
        </div>}
      </div>
      {/* Mapa de calor de todas las combinaciones probadas (color = puntuación robusta). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {res.cells.map((c, i) => (
          <div key={i} title={`${label(c)} · score ${c.score.toFixed(2)} · PF ${c.pf}`} style={{ width: 26, height: 26, borderRadius: 5, background: heat(c.score), border: c === plateau ? `2px solid ${GREEN}` : c === best ? `2px solid ${AMBER}` : '1px solid var(--line)' }} />
        ))}
      </div>
      <button onClick={() => onUse(plateau)} style={{ ...btn(GREEN), marginTop: 12 }}>{es ? '✓ Usar la meseta' : '✓ Use the plateau'}</button>
    </div>
  );
}

// Vista del portafolio multi-símbolo: métricas combinadas + matriz de correlación.
function PortView({ es, res }: { es: boolean; res: PortResult }) {
  const cc = (v: number) => v >= 0.6 ? RED : v >= 0.3 ? AMBER : v <= -0.1 ? BLUE : GREEN;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {[[es ? 'Neto combinado' : 'Combined net', '$' + res.combinedNet.toLocaleString('en-US'), GREEN], [es ? 'PF combinado' : 'Combined PF', String(res.combinedPf), AQUA], [es ? 'DD combinado' : 'Combined DD', res.combinedDDpct + '%', res.combinedDDpct > 25 ? RED : AMBER], [es ? 'Correlación media' : 'Avg correlation', String(res.avgCorr), cc(res.avgCorr)], [es ? 'Diversificación' : 'Diversification', Math.round(res.diversification * 100) + '%', res.diversification >= 0.6 ? GREEN : AMBER]].map(([l, v, c]: any, i) => (
          <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', minWidth: 120 }}>
            <div className="muted" style={{ fontSize: 11 }}>{l}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      {/* Matriz de correlación entre robots (mensual). */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead><tr><th style={{ padding: 5 }}></th>{res.legs.map((l, j) => <th key={j} style={{ padding: 5, whiteSpace: 'nowrap' }}>{l.name}</th>)}</tr></thead>
          <tbody>
            {res.legs.map((l, i) => (
              <tr key={i}>
                <td style={{ padding: 5, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.name} <span className="muted">${l.net.toLocaleString('en-US')}{l.blown ? ' ⚠' : ''}</span></td>
                {res.legs.map((_, j) => { const v = res.corr[i][j]; return <td key={j} style={{ padding: '5px 8px', textAlign: 'center', background: i === j ? 'var(--bg2)' : `color-mix(in srgb,${cc(v)} 22%,transparent)`, fontWeight: 700 }}>{v.toFixed(2)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'Verde/azul = baja o negativa correlación (mejor diversificación). Rojo = se mueven juntos (poco diversifica).' : 'Green/blue = low or negative correlation (better diversification). Red = they move together (little diversification).'}</p>
    </div>
  );
}

function EvoChart({ history }: { history: number[] }) {
  const W = 640, H = 120, pad = 10; if (!history.length) return null;
  const min = Math.min(...history, 0), max = Math.max(...history, 1);
  const x = (i: number) => pad + (i / Math.max(1, history.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);
  const d = history.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}><path d={d} fill="none" stroke={GREEN} strokeWidth="2.4" />{history.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={GREEN} />)}</svg>;
}

// Onyx Robustness Score: un número 0–100 con desglose y grado (anti-sobreajuste).
function ScoreCard({ es, s }: { es: boolean; s: OnyxScore }) {
  const col = s.score >= 80 ? GREEN : s.score >= 65 ? AQUA : s.score >= 50 ? AMBER : RED;
  const R = 34, C = 2 * Math.PI * R, off = C * (1 - s.score / 100);
  return (
    <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${col} 40%,var(--line))` }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
          <svg viewBox="0 0 84 84" width="84" height="84">
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--line)" strokeWidth="7" />
            <circle cx="42" cy="42" r={R} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 42 42)" />
            <text x="42" y="40" textAnchor="middle" fontSize="21" fontWeight="800" fill={col}>{s.score}</text>
            <text x="42" y="55" textAnchor="middle" fontSize="10" fill="var(--mut)">{es ? 'de 100' : 'of 100'}</text>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>🛡️ Onyx Robustness Score · <span style={{ color: col }}>{es ? 'Grado' : 'Grade'} {s.grade}</span></div>
          <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{es ? 'Qué tan robusta es (no sobre-ajustada). Penaliza la complejidad, la trampa nº1 del curve-fitting.' : 'How robust (not overfit) it is. Penalizes complexity, the #1 curve-fitting trap.'}</div>
          {s.parts.map((p, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span>{es ? p.label : p.label} <span className="muted">· {p.note}</span></span><span style={{ fontWeight: 700 }}>{p.got}/{p.max}</span></div>
              <div style={{ height: 5, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: Math.round((p.got / p.max) * 100) + '%', background: p.got / p.max >= 0.6 ? GREEN : p.got / p.max >= 0.35 ? AMBER : RED }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Reporte completo estilo StrategyQuant: KPIs + curva de equity + drawdown +
// rachas + estancamiento + tabla de rendimiento mensual.
function StratReport({ es, r, oosPct, setOosPct }: { es: boolean; r: FullReport; oosPct: number; setOosPct: (n: number) => void }) {
  const MON = es ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WD = es ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const money = (v: number) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US');
  // Curva de equity + drawdown (SVG).
  const W = 660, H = 150, dH = 46, pad = 6;
  const eq = r.equity; const eqMin = Math.min(...eq.map((p) => p.eq)); const eqMax = Math.max(...eq.map((p) => p.eq));
  const x = (i: number) => pad + (i / Math.max(1, eq.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - eqMin) / (eqMax - eqMin || 1)) * (H - 2 * pad);
  const area = `M${x(0)},${H - pad} ` + eq.map((p, i) => `L${x(i).toFixed(1)},${y(p.eq).toFixed(1)}`).join(' ') + ` L${x(eq.length - 1)},${H - pad} Z`;
  const line = eq.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.eq).toFixed(1)}`).join(' ');
  const ddMax = Math.max(1, ...r.ddSeries.map((p) => -p.dd));
  const ddBars = r.ddSeries;
  // Franja OOS: índice donde empieza el fuera de muestra.
  let oosIdx = -1; if (r.oosStart > 0) { for (let i = 1; i < eq.length; i++) { if (eq[i].t >= r.oosStart) { oosIdx = i; break; } } }
  const sideStat = (s: any, l: string, c: string) => (
    <div style={{ background: 'var(--bg2)', border: `1px solid color-mix(in srgb,${c} 30%,var(--line))`, borderRadius: 9, padding: '7px 10px', minWidth: 120 }}>
      <div className="muted" style={{ fontSize: 10.5 }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: s.net >= 0 ? GREEN : RED }}>{money(s.net)}</div>
      <div className="muted" style={{ fontSize: 10.5 }}>{s.n} ops · {s.n ? Math.round((s.wins / s.n) * 100) : 0}% win</div>
    </div>
  );
  const kpi = (l: string, v: string, c?: string) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 9, padding: '7px 9px' }}>
      <div className="muted" style={{ fontSize: 10.5, marginBottom: 2 }}>{l}</div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: c || 'var(--tx)' }}>{v}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, border: `1px solid color-mix(in srgb,${BLUE} 25%,var(--line))` }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>📊 {es ? 'Reporte completo' : 'Full report'} <span className="muted" style={{ fontWeight: 500 }}>· {r.years} {es ? 'años' : 'yrs'} · {r.trades} {es ? 'ops' : 'trades'}</span></div>

      {/* KPIs principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8, marginBottom: 12 }}>
        {kpi(es ? 'Neto' : 'Net profit', money(r.net), r.net >= 0 ? GREEN : RED)}
        {kpi('Profit factor', String(r.pf), r.pf >= 1.3 ? GREEN : AMBER)}
        {kpi(es ? 'Ret/DD' : 'Ret/DD', String(r.retDD), r.retDD >= 3 ? GREEN : AMBER)}
        {kpi('Sharpe', String(r.sharpe))}
        {kpi('SQN', String(r.sqn), r.sqn >= 2 ? GREEN : AMBER)}
        {kpi('% win', r.winRate + '%')}
        {kpi(es ? 'DD máx' : 'Max DD', money(r.maxDD) + ' · ' + r.maxDDpct + '%', RED)}
        {kpi('CAGR', r.cagr + '%')}
        {kpi('Expectancy', money(r.expectancy))}
        {kpi('Payout', String(r.payout))}
      </div>

      {/* KPIs avanzados (paridad StrategyQuant) */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '2px 0 6px' }}>{es ? 'Métricas avanzadas (estilo StrategyQuant)' : 'Advanced metrics (StrategyQuant-style)'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8, marginBottom: 12 }}>
        {kpi(es ? 'Anual medio' : 'Yearly avg', money(r.yearlyAvgProfit))}
        {kpi(es ? 'Anual medio %' : 'Yearly avg %', r.yearlyAvgPct + '%')}
        {kpi(es ? 'Mensual medio' : 'Monthly avg', money(r.monthlyAvgProfit))}
        {kpi(es ? 'Diario medio' : 'Daily avg', money(r.dailyAvgProfit))}
        {kpi('Annual/MaxDD', String(r.annualMaxDD), r.annualMaxDD >= 1 ? GREEN : AMBER)}
        {kpi('AHPR %', r.ahpr + '%')}
        {kpi('R-Expectancy', String(r.rExpectancy))}
        {kpi('R-Exp. score', String(r.rExpectancyScore), r.rExpectancyScore >= 2 ? GREEN : AMBER)}
        {kpi('STR Quality', String(r.strQuality), r.strQuality >= 2 ? GREEN : AMBER)}
        {kpi('Z-Score', String(r.zScore))}
        {kpi('Z-Prob %', r.zProb + '%')}
        {kpi(es ? 'Estancam.' : 'Stagnation', r.stagnationDays + (es ? 'd' : 'd') + ' · ' + r.stagnationPct + '%', AMBER)}
      </div>

      {/* Control de división In-sample / Out-of-sample */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 11 }} className="muted">{es ? 'Fuera de muestra (OOS) — % final reservado' : 'Out-of-sample (OOS) — % of the end reserved'}</span>
        <input type="range" min={0} max={50} step={5} value={oosPct} onChange={(e) => setOosPct(Number(e.target.value))} style={{ flex: 1, minWidth: 120 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: CORAL, minWidth: 34 }}>{oosPct}%</span>
      </div>

      {/* Curva de equity + drawdown (con franja OOS sombreada) */}
      <div style={{ marginBottom: 4 }} className="muted"><span style={{ fontSize: 11 }}>{es ? 'Curva de equity' : 'Equity curve'} <span style={{ color: BLUE }}>■ {es ? 'dentro de muestra' : 'in-sample'}</span> {oosIdx > 0 && <span style={{ color: CORAL }}>■ {es ? 'fuera de muestra' : 'out-of-sample'}</span>}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {oosIdx > 0 && <rect x={x(oosIdx)} y={0} width={W - pad - x(oosIdx)} height={H} fill={`color-mix(in srgb,${CORAL} 14%,transparent)`} />}
        <path d={area} fill={`color-mix(in srgb,${BLUE} 22%,transparent)`} />
        <path d={line} fill="none" stroke={BLUE} strokeWidth="2" />
        {oosIdx > 0 && <line x1={x(oosIdx)} y1={0} x2={x(oosIdx)} y2={H} stroke={CORAL} strokeWidth="1.5" strokeDasharray="4 3" />}
      </svg>
      {oosIdx > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {sideStat(r.isSum, es ? 'Dentro de muestra' : 'In-sample', BLUE)}
          {sideStat(r.oosSum, es ? 'Fuera de muestra' : 'Out-of-sample', CORAL)}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', minWidth: 130 }}>
            <div className="muted" style={{ fontSize: 10.5 }}>{es ? 'Veredicto' : 'Verdict'}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: r.oosSum.net > 0 ? GREEN : RED }}>{r.oosSum.net > 0 ? (es ? '✓ aguanta fuera de muestra' : '✓ holds out-of-sample') : (es ? '✗ falla fuera de muestra' : '✗ fails out-of-sample')}</div>
          </div>
        </div>
      )}
      <div style={{ marginTop: 4, marginBottom: 4 }} className="muted"><span style={{ fontSize: 11 }}>Drawdown ($)</span></div>
      <svg viewBox={`0 0 ${W} ${dH}`} width="100%" style={{ display: 'block' }}>
        {ddBars.map((p, i) => { const h = ((-p.dd) / ddMax) * dH; return <line key={i} x1={x(i)} y1={0} x2={x(i)} y2={h} stroke={RED} strokeWidth={Math.max(0.5, (W - 2 * pad) / ddBars.length)} opacity={0.55} />; })}
      </svg>

      {/* Rachas + estancamiento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, margin: '12px 0' }}>
        {kpi(es ? 'Ganadas consec. (máx · prom)' : 'Consec. wins (max · avg)', r.maxConsecWins + ' · ' + r.avgConsecWins, GREEN)}
        {kpi(es ? 'Perdidas consec. (máx · prom)' : 'Consec. losses (max · avg)', r.maxConsecLosses + ' · ' + r.avgConsecLosses, RED)}
        {kpi(es ? 'Estancamiento' : 'Stagnation', r.stagnationDays + (es ? ' días · ' : ' days · ') + r.stagnationPct + '%', AMBER)}
        {kpi(es ? 'Mayor ganancia' : 'Largest win', money(r.largestWin), GREEN)}
        {kpi(es ? 'Mayor pérdida' : 'Largest loss', money(r.largestLoss), RED)}
        {kpi(es ? 'Prom. ganada · perdida' : 'Avg win · loss', money(r.avgWin) + ' · ' + money(r.avgLoss))}
      </div>

      {/* Tabla de rendimiento mensual */}
      <div className="muted" style={{ fontSize: 11, margin: '6px 0 4px' }}>{es ? 'Rendimiento mensual ($)' : 'Monthly performance ($)'}</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 9 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead><tr>{[es ? 'Año' : 'Year', ...MON, 'YTD'].map((h) => <th key={h} style={{ padding: '5px 6px', color: BLUE, fontWeight: 700, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>
            {r.monthKeys.map((yr) => (
              <tr key={yr} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '5px 6px', fontWeight: 700 }}>{yr}</td>
                {MON.map((_, mo) => { const v = r.months[yr]?.[mo]; return <td key={mo} style={{ padding: '5px 6px', textAlign: 'right', color: v == null ? 'var(--mut)' : v >= 0 ? GREEN : RED }}>{v == null ? '·' : Math.round(v)}</td>; })}
                <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800, color: (r.ytd[yr] || 0) >= 0 ? GREEN : RED }}>{Math.round(r.ytd[yr] || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Análisis de operaciones: P/L por hora, por día de semana, Long vs Short */}
      <div className="muted" style={{ fontSize: 11, margin: '14px 0 4px' }}>{es ? 'Análisis de operaciones' : 'Trade analysis'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <MiniBars es={es} title={es ? 'P/L por hora' : 'P/L by hour'} labels={Array.from({ length: 24 }, (_, i) => String(i))} values={r.byHour} />
        <MiniBars es={es} title={es ? 'P/L por día de semana' : 'P/L by weekday'} labels={WD} values={r.byWeekday} />
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 9, padding: 10 }}>
          <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{es ? 'Largos vs Cortos' : 'Long vs Short'}</div>
          {[[es ? 'Largos' : 'Long', r.long, GREEN], [es ? 'Cortos' : 'Short', r.short, BLUE]].map(([l, s, c]: any, i) => {
            const tot = Math.max(1, Math.abs(r.long.net) + Math.abs(r.short.net));
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span>{l} <span className="muted">· {s.n} ops · {s.n ? Math.round((s.wins / s.n) * 100) : 0}%</span></span><span style={{ fontWeight: 800, color: s.net >= 0 ? GREEN : RED }}>{money(s.net)}</span></div>
                <div style={{ height: 7, borderRadius: 5, background: 'var(--line)', overflow: 'hidden', marginTop: 3 }}><div style={{ height: '100%', width: Math.round((Math.abs(s.net) / tot) * 100) + '%', background: s.net >= 0 ? c : RED }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista de operaciones */}
      <div className="muted" style={{ fontSize: 11, margin: '14px 0 4px' }}>{es ? 'Lista de operaciones' : 'List of trades'} <span>· {r.trades}{r.list.length < r.trades ? ' (' + (es ? 'primeras ' : 'first ') + r.list.length + ')' : ''}</span></div>
      <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 9 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--card)' }}><tr>{['#', es ? 'Fecha' : 'Date', es ? 'Tipo' : 'Type', 'P/L', es ? 'Balance' : 'Balance'].map((h) => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--mut)', fontWeight: 700, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>
            {r.list.map((t, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '4px 8px', color: 'var(--mut)' }}>{i + 1}</td>
                <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{new Date(t.t).toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td style={{ padding: '4px 8px', color: t.dir === 1 ? GREEN : t.dir === -1 ? BLUE : 'var(--mut)', fontWeight: 700 }}>{t.dir === 1 ? (es ? 'Compra' : 'Buy') : t.dir === -1 ? (es ? 'Venta' : 'Sell') : '—'}</td>
                <td style={{ padding: '4px 8px', fontWeight: 700, color: t.profit >= 0 ? GREEN : RED }}>{money(t.profit)}</td>
                <td style={{ padding: '4px 8px', color: 'var(--mut)' }}>{money(t.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Mini gráfico de barras (verde positivo / rojo negativo) para el análisis.
function MiniBars({ es, title, labels, values }: { es: boolean; title: string; labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const W = 220, H = 90, mid = H / 2, bw = (W - 4) / values.length;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 9, padding: 10 }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="var(--line)" strokeWidth="0.5" />
        {values.map((v, i) => { const h = (Math.abs(v) / max) * (mid - 4); return <rect key={i} x={2 + i * bw + 0.5} y={v >= 0 ? mid - h : mid} width={Math.max(1, bw - 1)} height={h} fill={v >= 0 ? GREEN : RED} opacity={0.85} />; })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }} className="muted"><span>{labels[0]}</span><span>{labels[Math.floor(labels.length / 2)]}</span><span>{labels[labels.length - 1]}</span></div>
    </div>
  );
}

function SpecTable({ es, rows, onSel, sel, specLabel, oos }: any) {
  if (!rows.length) return <div className="muted" style={{ fontSize: 13 }}>{es ? 'Sin resultados con esos filtros.' : 'No results with those filters.'}</div>;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead><tr>{['Estrategia', 'Neto', 'PF', oos ? 'PF OOS' : 'DD%', 'Ops', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: '1px solid var(--line)', color: 'var(--mut)', fontWeight: 700 }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} style={{ background: sel === r.spec ? 'color-mix(in srgb,#0fb8a6 10%,transparent)' : 'transparent', cursor: 'pointer' }} onClick={() => onSel(r.spec)}>
              <td style={{ padding: '6px 9px', fontFamily: 'monospace' }}>{specLabel(r.spec)}</td>
              <td style={{ padding: '6px 9px', fontWeight: 800, color: r.net >= 0 ? GREEN : RED }}>${r.net.toLocaleString('en-US')}</td>
              <td style={{ padding: '6px 9px', color: r.pf >= 1.3 ? GREEN : r.pf >= 1 ? AMBER : RED }}>{r.pf}</td>
              <td style={{ padding: '6px 9px' }}>{oos ? (r.oos ?? '—') : r.dd + '%'}</td>
              <td style={{ padding: '6px 9px' }}>{r.n}</td>
              <td style={{ padding: '6px 9px' }}><span style={{ fontSize: 11, color: '#0fb8a6', fontWeight: 700 }}>{sel === r.spec ? '✓' : (es ? 'elegir' : 'pick')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
