'use client';
import { useMemo, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { BLOCKS, sampleCandidates, enrichSpec } from '@/lib/stratgen';
import { parseBars, parseBarsStreaming, runBacktest, inferPip, type Bar, type Spec, type Costs } from '@/lib/backtest';
import { evolve, evaluate, type Survivor } from '@/lib/evolve';
import { genMt5, genMt4 } from '@/lib/mqlgen';
import { barsFromColumnar, type ColumnarBars } from '@/lib/dataAnalyzer';
import { mcSuite } from '@/lib/montecarlo';
import { walkForwardMatrix } from '@/lib/walkforward';
import { ProgressBar } from './ProgressBar';

// ============================================================
// Onyx Bot Factory · Fase 5 — Motor (backtest + evolución + databank + portafolio)
// Corre en el navegador: simula cada estrategia sobre tus barras con costes
// reales, evoluciona las mejores, arma portafolio de baja correlación, exporta
// el EA y envía las buenas al laboratorio de robustez.
// ============================================================

const VIOLET = '#a06bff', GREEN = '#1D9E75', AMBER = '#EF9F27', RED = '#E24B4A', BLUE = '#378ADD';
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 };
const inp: any = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }
function download(name: string, text: string, mime: string) { const b = new Blob([text], { type: mime }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }

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

  // Carga barras desde la biblioteca (sin volver a subir el archivo).
  async function loadFromLibrary(id: string) {
    setDsId(id); if (!id) return;
    const ds = (datasets as any[]).find((d) => d.id === id);
    if (!ds?.bars_url) { toastErr(es ? 'Ese dataset no tiene barras guardadas. Vuelve a guardarlo en la Puerta 0.' : 'That dataset has no saved bars. Re-save it in Gate 0.'); return; }
    setReading(true); setProg(0); setBars(null); setBarsName((ds.symbol || 'dataset') + ' · biblioteca');
    try {
      const r = await fetch(ds.bars_url); setProg(0.6);
      const col = (await r.json()) as ColumnarBars;
      const b = barsFromColumnar(col); setProg(1);
      if (b.length < 100) { toastErr(es ? 'El dataset guardado tiene muy pocas barras.' : 'Saved dataset has too few bars.'); }
      setBars(b);
      if (ds.symbol) setMeta((mt) => ({ ...mt, symbol: ds.symbol, tf: `M${col.tf || tfMin}` }));
      toast(es ? 'Datos cargados desde la biblioteca' : 'Data loaded from library');
    } catch (e: any) { toastErr(es ? 'No se pudieron cargar las barras guardadas.' : 'Could not load saved bars.'); }
    finally { setReading(false); setProg(0); }
  }
  const [costs, setCosts] = useState<Costs>({ spreadPips: 1.2, slippagePips: 0.3, commission: 3.5, moneyPerPip: 10, lot: 1, pip: 0 });
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
  const [autoMsg, setAutoMsg] = useState('');
  const [keepN, setKeepN] = useState(8);
  const [autoDone, setAutoDone] = useState<{ created: number; scanned: number; survivors: number } | null>(null);
  // Receta encadenada (build → backtest → IS/OOS → Monte Carlo → walk-forward → rechazar).
  const [recipe, setRecipe] = useState({ minPf: 1.2, maxDd: 25, minTr: 30, mcMaxLoss: 35, wfMinStab: 55 });
  const [recRun, setRecRun] = useState(false);
  const [recMsg, setRecMsg] = useState('');
  const [recFunnel, setRecFunnel] = useState<any>(null);
  const [recBest, setRecBest] = useState<any>(null);
  const [recSending, setRecSending] = useState(false);

  const toggle = (bk: string, id: string) => setCfg((c) => { const cur = c[bk] || []; return { ...c, [bk]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }; });
  const pip = bars ? (costs.pip || inferPip(bars[Math.floor(bars.length / 2)].c)) : 0;

  const filtered = useMemo(() => (rows || []).filter((r) => r.pf >= minPf && r.dd <= maxDd && r.n >= minTr).sort((a, b) => b.net - a.net), [rows, minPf, maxDd, minTr]);

  async function runBatch() {
    if (!bars) { toastErr(es ? 'Sube las barras primero.' : 'Upload bars first.'); return; }
    setBusy(true); setRows(null); setEvo(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const cands = sampleCandidates(cfg, n) as Spec[];
      const out: Row[] = [];
      for (const c of cands) { const spec = enrichSpec(c, blockMap); const m = runBacktest(bars, spec, costs); if (m.n > 0) out.push({ spec, net: m.net, pf: m.pf, dd: m.maxddPct, n: m.n, win: m.winRate, exp: m.expectancy }); }
      setRows(out);
      toast(es ? `${out.length} estrategias backtesteadas` : `${out.length} strategies backtested`);
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }
  async function runEvolve() {
    if (!bars) { toastErr(es ? 'Sube las barras primero.' : 'Upload bars first.'); return; }
    setBusy(true); await new Promise((r) => setTimeout(r, 30));
    try { const r = evolve(bars, costs, { pop: 60, gens: 8, keep: 12 }); setEvo({ best: r.best, history: r.history }); toast(es ? `Evolución: ${r.evaluated} evaluaciones` : `Evolution: ${r.evaluated} evals`); }
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
    setAuto(true); setAutoDone(null); setAutoMsg(es ? 'Generando estrategias…' : 'Generating strategies…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const cands = sampleCandidates(cfg, n) as Spec[];
      const cut = Math.floor(bars.length * 0.7); const isB = bars.slice(0, cut), oosB = bars.slice(cut);
      const survivors: { spec: Spec; fit: number }[] = [];
      for (let i = 0; i < cands.length; i++) {
        const ev = evaluate(cands[i], isB, oosB, costs);
        if (ev.fit > 0 && ev.oosPf >= 1 && ev.dd <= maxDd && ev.trades >= minTr && ev.oosNet > 0) survivors.push({ spec: cands[i], fit: ev.fit });
        if (i % 120 === 0) { setAutoMsg((es ? 'Backtesteando ' : 'Backtesting ') + i + '/' + cands.length + ' · ' + (es ? 'robustos ' : 'robust ') + survivors.length); await new Promise((r) => setTimeout(r, 0)); }
      }
      survivors.sort((a, b) => b.fit - a.fit);
      const top = survivors.slice(0, Math.max(1, keepN));
      let created = 0;
      for (let i = 0; i < top.length; i++) {
        setAutoMsg((es ? 'Creando robot ' : 'Creating robot ') + (i + 1) + '/' + top.length + '…');
        const trades = runBacktest(bars, top[i].spec, costs).trades;
        if (trades.length < 20) continue;
        const j = await post({ action: 'bot_create', platform: meta.platform, symbol: meta.symbol, timeframe: meta.tf, strategy: { family: 'autopiloto', gen: top[i].spec } });
        await post({ action: 'lab_run', botId: j.bot?.id, trades, paramCount: 6, noAi: true });
        created++;
      }
      setAutoDone({ created, scanned: cands.length, survivors: survivors.length });
      toast((es ? 'Autopiloto: ' : 'Autopilot: ') + created + (es ? ' robots creados y en el laboratorio' : ' robots created in the lab'));
      if (reload) reload();
    } catch (e: any) { toastErr(e?.message); } finally { setAuto(false); setAutoMsg(''); }
  }

  // RECETA ENCADENADA: build → backtest → IS/OOS → Monte Carlo (8 tipos) →
  // walk-forward matrix → sobreviven solo los que pasan TODAS las compuertas.
  async function runRecipe() {
    if (!bars) { toastErr(es ? 'Carga los datos primero.' : 'Load data first.'); return; }
    setRecRun(true); setRecFunnel(null); setRecBest(null); setRecMsg(es ? 'Generando…' : 'Generating…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const cands = sampleCandidates(cfg, n) as Spec[];
      const cut = Math.floor(bars.length * 0.7); const oosB = bars.slice(cut);
      let bt = 0, mc = 0, wf = 0; const survivors: any[] = [];
      for (let i = 0; i < cands.length; i++) {
        const spec = enrichSpec(cands[i], blockMap);
        const m = runBacktest(bars, spec, costs);
        if (!(m.pf >= recipe.minPf && m.maxddPct <= recipe.maxDd && m.n >= recipe.minTr)) continue;
        bt++;
        const oos = runBacktest(oosB, spec, costs);
        if (!(oos.n >= 8 && oos.pf >= 1)) continue;
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
      {/* Datos + costes */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,var(--brand),' + VIOLET + ')', color: '#0b1020', fontSize: 18 }}>⚙️</span>
          <h3 style={{ margin: 0, flex: 1 }}>{es ? 'Motor de backtest + evolución' : 'Backtest + evolution engine'}</h3>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{es ? 'Elige un dataset de tu biblioteca (ya validado en la Puerta 0, sin volver a subir nada) o sube uno nuevo. El motor simula miles de estrategias con costes reales, evoluciona las mejores y las envía al laboratorio.' : 'Pick a dataset from your library (already validated in Gate 0, no re-upload) or upload a new one. The engine simulates thousands of strategies with real costs, evolves the best and sends them to the lab.'}</p>

        {/* Biblioteca de datos: reutiliza lo subido en la Puerta 0 (sin resubir) */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', border: '1px solid color-mix(in srgb,var(--brand) 25%,var(--line))' }}>
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
          <label style={{ ...btn('var(--brand)'), cursor: reading ? 'wait' : 'pointer', opacity: reading ? 0.7 : 1 }}>{reading ? (es ? `Leyendo ${Math.round(prog * 100)}%` : `Reading ${Math.round(prog * 100)}%`) : bars ? `${bars.length} barras · ${barsName.slice(0, 16)}` : (es ? 'Subir ticks/barras (cualquier tamaño)' : 'Upload ticks/bars (any size)')}
            <input type="file" accept=".csv,.txt,.tsv" disabled={reading} style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBarsName(f.name); setReading(true); setProg(0); setBars(null); try { const b = await parseBarsStreaming(f, tfMin, (p) => setProg(p)); if (b.length < 100) toastErr(es ? 'Se generaron muy pocas barras. Revisa el formato o usa una temporalidad más baja.' : 'Too few bars generated. Check the format or use a lower timeframe.'); setBars(b); const sym = guessSymbol(f.name); if (sym) setMeta((mt) => ({ ...mt, symbol: sym, tf: `M${tfMin}` })); } catch (err: any) { toastErr(es ? 'No se pudo leer el archivo. Revisa que sea CSV (Dukascopy: Gmt time, Ask, Bid).' : 'Could not read the file. Make sure it is CSV (Dukascopy: Gmt time, Ask, Bid).'); } finally { setReading(false); setProg(0); } }} />
          </label>
          {bars && <span className="muted" style={{ fontSize: 12 }}>{new Date(bars[0].t).toISOString().slice(0, 10)} → {new Date(bars[bars.length - 1].t).toISOString().slice(0, 10)} · pip {pip}</span>}
        </div>
        {reading && <div style={{ marginTop: 12 }}><ProgressBar p={prog} label={(es ? 'Procesando ' : 'Processing ') + barsName.slice(0, 24)} /></div>}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{es ? 'Acepta los mismos ticks de Dukascopy/StrategyQuant (hasta varios GB): se leen por trozos y se convierten a barras OHLC al vuelo, sin cargar todo en memoria.' : 'Accepts the same Dukascopy/StrategyQuant ticks (multi-GB): streamed in chunks and converted to OHLC bars on the fly.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 12 }}>
          {([['spreadPips', es ? 'Spread (pips)' : 'Spread (pips)'], ['slippagePips', 'Slippage (pips)'], ['commission', es ? 'Comisión ($/lote)' : 'Commission ($/lot)'], ['moneyPerPip', es ? '$/pip (1 lote)' : '$/pip (1 lot)'], ['lot', es ? 'Lote' : 'Lot']] as [string, string][]).map(([k, l]) => (
            <label key={k}><span className="muted" style={{ fontSize: 11.5 }}>{l}</span><input type="number" step="0.1" value={(costs as any)[k]} onChange={(e) => setCosts({ ...costs, [k]: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          ))}
        </div>
      </div>

      {/* AUTOPILOTO */}
      <div style={{ ...card, borderColor: `color-mix(in srgb,${GREEN} 45%,var(--line))`, background: `linear-gradient(150deg, color-mix(in srgb,${GREEN} 8%,var(--card)), var(--card) 70%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,' + GREEN + ',var(--brand))', color: '#0b1020', fontSize: 19 }}>🤖</span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h3 style={{ margin: 0 }}>{es ? 'Autopiloto' : 'Autopilot'}</h3>
            <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Un botón: genera → backtestea → filtra por robustez (IS/OOS) → crea solo los robots que sobreviven y los manda al laboratorio. Sin CSV.' : 'One button: generate → backtest → filter by robustness → create only surviving robots and send them to the lab. No CSV.'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <span className="muted" style={{ fontSize: 12 }}>{es ? 'Crear hasta' : 'Create up to'}</span>
          <input type="number" value={keepN} min={1} max={30} onChange={(e) => setKeepN(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} style={{ ...inp, width: 70 }} />
          <span className="muted" style={{ fontSize: 12 }}>{es ? 'robots · de' : 'robots · from'} {n} {es ? 'candidatos' : 'candidates'}</span>
          {canManage && <button onClick={autopilot} disabled={auto || !bars} style={{ marginLeft: 'auto', padding: '12px 22px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14.5, cursor: auto || !bars ? 'default' : 'pointer', background: 'linear-gradient(135deg,' + GREEN + ',var(--brand))', color: '#0b1020', opacity: auto || !bars ? 0.6 : 1 }}>{auto ? (es ? 'Trabajando…' : 'Working…') : (es ? '🚀 Ejecutar autopiloto' : '🚀 Run autopilot')}</button>}
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
          <span style={{ display: 'inline-flex', width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,' + BLUE + ',' + VIOLET + ')', color: '#0b1020', fontSize: 19 }}>🧪</span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h3 style={{ margin: 0 }}>{es ? 'Receta encadenada' : 'Chained recipe'}</h3>
            <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Generar → backtest → in/out-of-sample → Monte Carlo (8 tipos) → walk-forward matrix. Solo pasan los que superan TODAS las compuertas.' : 'Generate → backtest → in/out-of-sample → Monte Carlo (8 types) → walk-forward matrix. Only those passing ALL gates survive.'}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 12 }}>
          {([['minPf', es ? 'PF mínimo' : 'Min PF', 0.1], ['maxDd', es ? 'DD máx %' : 'Max DD %', 1], ['minTr', es ? 'Ops mín' : 'Min trades', 1], ['mcMaxLoss', es ? 'MC: prob. pérdida máx %' : 'MC: max loss prob %', 1], ['wfMinStab', es ? 'WF: estabilidad mín %' : 'WF: min stability %', 1]] as [string, string, number][]).map(([k, l, step]) => (
            <label key={k}><span className="muted" style={{ fontSize: 11 }}>{l}</span><input type="number" step={step} value={(recipe as any)[k]} onChange={(e) => setRecipe({ ...recipe, [k]: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          ))}
        </div>
        {canManage && <button onClick={runRecipe} disabled={recRun || !bars} style={{ ...btn(BLUE), marginTop: 12, padding: '11px 20px', fontSize: 14 }}>{recRun ? (es ? 'Ejecutando…' : 'Running…') : (es ? '🧪 Ejecutar receta' : '🧪 Run recipe')}</button>}
        {recRun && <div style={{ marginTop: 10, fontSize: 13, color: BLUE, fontWeight: 700 }}>{recMsg}</div>}

        {recFunnel && (
          <div style={{ marginTop: 14 }}>
            {/* Embudo */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {[[es ? 'Generadas' : 'Generated', recFunnel.scanned, 'var(--brand)'], [es ? 'Backtest' : 'Backtest', recFunnel.bt, VIOLET], [es ? 'Monte Carlo' : 'Monte Carlo', recFunnel.mc, BLUE], [es ? 'Walk-forward' : 'Walk-forward', recFunnel.wf, GREEN], [es ? 'Supervivientes' : 'Survivors', recFunnel.survivors.length, GREEN]].map(([l, v, c]: any, i) => (
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
          <input type="number" value={n} min={100} max={5000} onChange={(e) => setN(Math.max(100, Math.min(5000, Number(e.target.value) || 100)))} style={{ ...inp, width: 100 }} />
          {canManage && <button onClick={runBatch} disabled={busy || !bars} style={{ ...btn(VIOLET), opacity: busy || !bars ? 0.6 : 1 }}>{busy ? (es ? 'Corriendo…' : 'Running…') : (es ? '⚡ Backtestear lote' : '⚡ Backtest batch')}</button>}
          {canManage && <button onClick={runEvolve} disabled={busy || !bars} style={{ ...btn(GREEN), opacity: busy || !bars ? 0.6 : 1 }}>{es ? '🧬 Evolucionar' : '🧬 Evolve'}</button>}
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

      {/* Databank */}
      {rows && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <h3 style={{ margin: 0, flex: 1 }}>{es ? 'Databank' : 'Databank'} <span className="muted" style={{ fontSize: 13 }}>· {filtered.length}/{rows.length}</span></h3>
            <span className="muted" style={{ fontSize: 12 }}>PF≥</span><input type="number" step="0.1" value={minPf} onChange={(e) => setMinPf(Number(e.target.value))} style={{ ...inp, width: 70 }} />
            <span className="muted" style={{ fontSize: 12 }}>DD≤</span><input type="number" value={maxDd} onChange={(e) => setMaxDd(Number(e.target.value))} style={{ ...inp, width: 70 }} />
            <span className="muted" style={{ fontSize: 12 }}>ops≥</span><input type="number" value={minTr} onChange={(e) => setMinTr(Number(e.target.value))} style={{ ...inp, width: 70 }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginTop: 12 }}>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Plataforma' : 'Platform'}</span><select value={meta.platform} onChange={(e) => setMeta({ ...meta, platform: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }}><option value="mt5">MT5</option><option value="mt4">MT4</option></select></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Símbolo' : 'Symbol'}</span><input value={meta.symbol} onChange={(e) => setMeta({ ...meta, symbol: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
            <label><span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Temporalidad' : 'Timeframe'}</span><input value={meta.tf} onChange={(e) => setMeta({ ...meta, tf: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button onClick={() => download(`ONYX_${sel.ind1}_${sel.entry}.mq5`, genMt5(sel, meta.symbol, 100000000 + Math.floor(Math.random() * 900000000)), 'text/plain')} style={btn(BLUE)}>{es ? 'Exportar EA .mq5' : 'Export EA .mq5'}</button>
              <button onClick={() => download(`ONYX_${sel.ind1}_${sel.entry}.mq4`, genMt4(sel, meta.symbol, 100000000 + Math.floor(Math.random() * 900000000)), 'text/plain')} style={btn(BLUE)}>{es ? 'Exportar EA .mq4' : 'Export EA .mq4'}</button>
              <button onClick={() => sendToLab(sel)} disabled={busy} style={{ ...btn(GREEN), padding: '10px 18px', fontSize: 14 }}>{es ? '🚀 Enviar al laboratorio' : '🚀 Send to lab'}</button>
            </div>
          )}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{es ? 'El EA exportado es un punto de partida compilable; verifica que su backtest en MT se parezca al del motor antes de pasar a demo.' : 'The exported EA is a compilable starting point; check that its MT backtest matches the engine before going to demo.'}</p>
        </div>
      )}
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

function SpecTable({ es, rows, onSel, sel, specLabel, oos }: any) {
  if (!rows.length) return <div className="muted" style={{ fontSize: 13 }}>{es ? 'Sin resultados con esos filtros.' : 'No results with those filters.'}</div>;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead><tr>{['Estrategia', 'Neto', 'PF', oos ? 'PF OOS' : 'DD%', 'Ops', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: '1px solid var(--line)', color: 'var(--mut)', fontWeight: 700 }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} style={{ background: sel === r.spec ? 'color-mix(in srgb,var(--brand) 10%,transparent)' : 'transparent', cursor: 'pointer' }} onClick={() => onSel(r.spec)}>
              <td style={{ padding: '6px 9px', fontFamily: 'monospace' }}>{specLabel(r.spec)}</td>
              <td style={{ padding: '6px 9px', fontWeight: 800, color: r.net >= 0 ? GREEN : RED }}>${r.net.toLocaleString('en-US')}</td>
              <td style={{ padding: '6px 9px', color: r.pf >= 1.3 ? GREEN : r.pf >= 1 ? AMBER : RED }}>{r.pf}</td>
              <td style={{ padding: '6px 9px' }}>{oos ? (r.oos ?? '—') : r.dd + '%'}</td>
              <td style={{ padding: '6px 9px' }}>{r.n}</td>
              <td style={{ padding: '6px 9px' }}><span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>{sel === r.spec ? '✓' : (es ? 'elegir' : 'pick')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
