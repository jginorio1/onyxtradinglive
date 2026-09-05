'use client';
import { useState } from 'react';
import { toast, toastErr } from '@/lib/toast';

// ============================================================
// Onyx Bot Factory · Laboratorio de robustez (Fase 2)
// Sube las operaciones del backtest → Monte Carlo, IS/OOS, walk-forward,
// sensibilidad → veredicto. Luego compara con el backtest real de MetaTrader
// y, si se parece, pasa el robot a demo.
// ============================================================

const GREEN = '#1D9E75', AMBER = '#EF9F27', RED = '#E24B4A', VIOLET = '#a06bff', BLUE = '#378ADD';
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 };
const inp: any = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }
function verdictColor(v: string) { return v === 'robusto' ? GREEN : v === 'moderado' ? AMBER : RED; }

// ----- parser tolerante de operaciones (t, profit) -----
function num(x: string) { const v = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(v) ? NaN : v; }
function parseTrades(text: string): { t: number; profit: number }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = [',', '\t', ';'].map((d) => ({ d, n: lines[0].split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const head = lines[0].split(delim).map((s) => s.trim().toLowerCase());
  const hasHeader = /[a-z]{3,}/.test(lines[0]);
  let pIdx = -1, tIdx = -1;
  if (hasHeader) {
    head.forEach((h, i) => {
      if (pIdx < 0 && /(profit|p\/?l|pnl|net|ganancia|beneficio|resultado)/.test(h)) pIdx = i;
      if (tIdx < 0 && /(close|time|date|fecha|hora)/.test(h)) tIdx = i;
    });
  }
  const out: { t: number; profit: number }[] = [];
  const rows = hasHeader ? lines.slice(1) : lines;
  rows.forEach((ln, k) => {
    const c = ln.split(delim);
    let profit = NaN;
    if (pIdx >= 0) profit = num(c[pIdx]);
    else { for (let j = c.length - 1; j >= 0; j--) { const v = num(c[j]); if (!isNaN(v)) { profit = v; break; } } }
    if (isNaN(profit)) return;
    let t = k;
    if (tIdx >= 0) { const d = Date.parse(String(c[tIdx]).replace(/\./g, '-')); if (!isNaN(d)) t = d; }
    out.push({ t, profit });
  });
  return out;
}
function parseGrid(text: string): { profit: number }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delim = [',', '\t', ';'].map((d) => ({ d, n: lines[0].split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const head = lines[0].split(delim).map((s) => s.trim().toLowerCase());
  let pIdx = head.findIndex((h) => /(profit|net|result|total|ganancia|beneficio)/.test(h));
  const rows = lines.slice(1);
  const out: { profit: number }[] = [];
  rows.forEach((ln) => {
    const c = ln.split(delim);
    let v = pIdx >= 0 ? num(c[pIdx]) : NaN;
    if (isNaN(v)) { for (let j = c.length - 1; j >= 0; j--) { const x = num(c[j]); if (!isNaN(x)) { v = x; break; } } }
    if (!isNaN(v)) out.push({ profit: v });
  });
  return out;
}

// ----- Anillo -----
function Ring({ score, color, size = 116 }: any) {
  const r = size * 0.4, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={size * 0.1} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset .7s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.27, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span className="muted" style={{ fontSize: size * 0.09 }}>robustez</span>
      </div>
    </div>
  );
}

// ----- helpers de gráfica -----
function pathFor(arr: number[], W: number, H: number, pad: number, min: number, max: number) {
  const n = arr.length; if (n < 2) return '';
  const x = (i: number) => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);
  return arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}
function Fan({ samples, base, es }: any) {
  const flat = [...(samples || []).flat(), ...(base || []), 0];
  const min = Math.min(...flat), max = Math.max(...flat); const W = 640, H = 190, pad = 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <line x1={pad} y1={H - pad - ((0 - min) / (max - min || 1)) * (H - 2 * pad)} x2={W - pad} y2={H - pad - ((0 - min) / (max - min || 1)) * (H - 2 * pad)} stroke="var(--line)" strokeDasharray="4 4" />
      {(samples || []).map((s: number[], i: number) => <path key={i} d={pathFor(s, W, H, pad, min, max)} fill="none" stroke={VIOLET} strokeWidth="1" opacity="0.28" />)}
      <path d={pathFor(base || [], W, H, pad, min, max)} fill="none" stroke={GREEN} strokeWidth="2.4" />
    </svg>
  );
}
function Hist({ vals }: any) {
  const W = 640, H = 150, pad = 10, bins = 26;
  if (!vals || !vals.length) return null;
  const max = Math.max(...vals), min = Math.min(...vals);
  const counts = new Array(bins).fill(0);
  vals.forEach((v: number) => { let b = Math.floor(((v - min) / (max - min || 1)) * (bins - 1)); counts[Math.max(0, Math.min(bins - 1, b))]++; });
  const cmax = Math.max(...counts, 1); const bw = (W - 2 * pad) / bins;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {counts.map((c, i) => { const h = (c / cmax) * (H - 2 * pad); return <rect key={i} x={pad + i * bw + 1} y={H - pad - h} width={bw - 2} height={h} rx="2" fill={AMBER} opacity="0.85" />; })}
    </svg>
  );
}
function WinBars({ windows }: any) {
  const W = 640, H = 140, pad = 10;
  if (!windows || !windows.length) return null;
  const mx = Math.max(...windows.map((v: number) => Math.abs(v)), 1); const bw = (W - 2 * pad) / windows.length; const mid = H / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <line x1={pad} y1={mid} x2={W - pad} y2={mid} stroke="var(--line)" />
      {windows.map((v: number, i: number) => { const h = (Math.abs(v) / mx) * (mid - pad); return <rect key={i} x={pad + i * bw + 3} y={v >= 0 ? mid - h : mid} width={bw - 6} height={h} rx="3" fill={v >= 0 ? GREEN : RED} />; })}
    </svg>
  );
}
function GridCurve({ grid }: any) {
  const W = 640, H = 140, pad = 10;
  if (!grid || grid.length < 2) return null;
  const min = Math.min(...grid), max = Math.max(...grid);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <path d={pathFor(grid, W, H, pad, min, max)} fill="none" stroke={BLUE} strokeWidth="2.4" />
    </svg>
  );
}

export default function FactoryLab({ es, canManage, post, reload, bots }: any) {
  const [botId, setBotId] = useState('');
  const [trades, setTrades] = useState<any[] | null>(null);
  const [tradesName, setTradesName] = useState('');
  const [grid, setGrid] = useState<any[] | null>(null);
  const [gridName, setGridName] = useState('');
  const [paramCount, setParamCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [mt, setMt] = useState<any>({ net: '', pf: '', winRate: '', maxdd: '', trades: '' });
  const [cmp, setCmp] = useState<any>(null);

  const bot = (bots as any[]).find((b) => b.id === botId);

  async function run() {
    if (!botId) { toastErr(es ? 'Elige un robot.' : 'Pick a robot.'); return; }
    if (!trades || trades.length < 20) { toastErr(es ? 'Sube al menos 20 operaciones.' : 'Upload at least 20 trades.'); return; }
    setBusy(true); setRes(null); setCmp(null);
    try {
      const j = await post({ action: 'lab_run', botId, trades, grid: grid || undefined, paramCount, lang: es ? 'es' : 'en' });
      setRes(j); reload();
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }
  async function compare() {
    if (!res?.run?.id) return; setBusy(true);
    const payload = { net: mt.net === '' ? null : Number(mt.net), pf: mt.pf === '' ? null : Number(mt.pf), winRate: mt.winRate === '' ? null : Number(mt.winRate), maxdd: mt.maxdd === '' ? null : Number(mt.maxdd), trades: mt.trades === '' ? null : Number(mt.trades) };
    try { const j = await post({ action: 'lab_compare', runId: res.run.id, botId, mt: payload }); setCmp(j); }
    catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }
  async function advance() {
    setBusy(true);
    try { await post({ action: 'lab_advance', botId }); toast(es ? 'Robot pasado a demo' : 'Robot advanced to demo'); reload(); }
    catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  const r = res?.robustness;
  const vc = r ? verdictColor(r.verdict) : GREEN;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Configuración */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Laboratorio de robustez' : 'Robustness lab'}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{es ? 'Sube las operaciones cerradas del backtest del constructor. Se corre Monte Carlo, in/out-of-sample, walk-forward y sensibilidad para descartar el sobreajuste.' : 'Upload the closed trades from the builder backtest. Monte Carlo, in/out-of-sample, walk-forward and sensitivity run to rule out overfitting.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
          <label><span className="muted" style={{ fontSize: 12 }}>{es ? 'Robot' : 'Robot'}</span>
            <select value={botId} onChange={(e) => { setBotId(e.target.value); setRes(null); setCmp(null); }} style={{ ...inp, marginTop: 4 }}>
              <option value="">{es ? '— elige —' : '— pick —'}</option>
              {(bots as any[]).map((b) => <option key={b.id} value={b.id}>{b.name} · {b.symbol || '—'} {b.robustness_verdict ? `· ${b.robustness_verdict}` : ''}</option>)}
            </select>
          </label>
          <label><span className="muted" style={{ fontSize: 12 }}>{es ? 'Operaciones (CSV)' : 'Trades (CSV)'}</span>
            <label style={{ ...btn('var(--brand)'), marginTop: 4, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>{trades ? `${trades.length} ops · ${tradesName.slice(0, 14)}` : (es ? 'Subir operaciones' : 'Upload trades')}
              <input type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setTradesName(f.name); const t = parseTrades(await f.text()); if (t.length < 20) toastErr(es ? 'No se detectaron suficientes operaciones/columna de profit.' : 'Not enough trades / profit column found.'); setTrades(t); }} />
            </label>
          </label>
          <label><span className="muted" style={{ fontSize: 12 }}>{es ? 'Optimización (CSV, opcional)' : 'Optimization (CSV, optional)'}</span>
            <label style={{ ...btn(BLUE), marginTop: 4, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>{grid ? `${grid.length} combos` : (es ? 'Subir grid' : 'Upload grid')}
              <input type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setGridName(f.name); setGrid(parseGrid(await f.text())); }} />
            </label>
          </label>
          <label><span className="muted" style={{ fontSize: 12 }}>{es ? 'Nº de parámetros/reglas' : 'Params/rules count'}</span>
            <input type="number" value={paramCount} min={1} max={40} onChange={(e) => setParamCount(Math.max(1, Number(e.target.value) || 1))} style={{ ...inp, marginTop: 4 }} />
          </label>
        </div>
        {canManage && <button onClick={run} disabled={busy} style={{ ...btn(VIOLET), marginTop: 14, padding: '11px 20px', fontSize: 14 }}>{busy ? (es ? 'Procesando…' : 'Running…') : (es ? 'Ejecutar laboratorio' : 'Run lab')}</button>}
      </div>

      {r && (
        <>
          {/* Veredicto + parciales */}
          <div style={{ ...card, borderColor: `color-mix(in srgb,${vc} 45%,var(--line))` }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <Ring score={r.score} color={vc} />
              <div style={{ flex: 1, minWidth: 210 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: vc, textTransform: 'capitalize' }}>{r.verdict}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{es ? 'sobre' : 'from'} {r.trades} {es ? 'operaciones' : 'trades'} · PF {r.pf} · DD {r.maxdd} · {es ? 'neto' : 'net'} {r.net}</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                  {[['Monte Carlo', r.parts.mc], ['IS/OOS', r.parts.oos], ['Walk-fwd', r.parts.wfo], ['Sensib.', r.parts.sens], ['Simplicidad', r.parts.cx]].map(([k, v]: any) => (
                    <div key={k} style={{ background: 'var(--bg2)', borderRadius: 9, padding: '6px 10px', textAlign: 'center', minWidth: 74 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: v == null ? 'var(--mut)' : v >= 70 ? GREEN : v >= 50 ? AMBER : RED }}>{v == null ? 'N/A' : v}</div>
                      <div className="muted" style={{ fontSize: 10 }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {r.flags?.length > 0 && (
              <div style={{ marginTop: 12, display: 'grid', gap: 5 }}>
                {r.flags.map((f: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: AMBER }}>⚠ {f}</div>)}
              </div>
            )}
          </div>

          {/* Gráficas grandes */}
          <div style={card}>
            <ChartHead es={es} t={es ? 'Monte Carlo · 1000 barajados del orden' : 'Monte Carlo · 1000 order shuffles'} d={es ? 'Cada línea es un orden posible; verde = el real.' : 'Each line is a possible order; green = actual.'} />
            <Fan samples={r.charts.mcSamples} base={r.charts.baseCurve} es={es} />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, marginTop: 8 }}>
              <span className="muted">{es ? 'Final peor 5%' : 'Worst 5% final'}: <b style={{ color: r.charts.mcFinals.p5 < 0 ? RED : 'var(--tx)' }}>{r.charts.mcFinals.p5}</b></span>
              <span className="muted">{es ? 'Mediana' : 'Median'}: <b>{r.charts.mcFinals.p50}</b></span>
              <span className="muted">{es ? 'Prob. de pérdida' : 'Loss prob.'}: <b style={{ color: r.mc.lossProb > 0.15 ? RED : GREEN }}>{Math.round(r.mc.lossProb * 100)}%</b></span>
            </div>
          </div>

          <div style={card}>
            <ChartHead es={es} t={es ? 'Distribución del drawdown (Monte Carlo)' : 'Drawdown distribution (Monte Carlo)'} d={es ? 'Qué tan hondo puede caer en el peor caso.' : 'How deep it can fall in the worst case.'} />
            <Hist vals={r.charts.ddDist} />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{es ? 'DD mediano' : 'Median DD'} {r.mc.medianDD} · {es ? 'DD peor 95%' : 'P95 DD'} {r.mc.p95DD}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            <div style={card}>
              <ChartHead es={es} t={es ? 'In-sample vs Out-of-sample' : 'In-sample vs Out-of-sample'} d={es ? 'El detector de sobreajuste.' : 'The overfitting detector.'} />
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', height: 130, padding: '0 10px' }}>
                {[[es ? 'In-sample' : 'In-sample', r.isPf, GREEN], [es ? 'Out-of-sample' : 'Out-of-sample', r.oosPf, r.oosPf >= r.isPf * 0.7 ? GREEN : RED]].map(([l, v, c]: any) => {
                  const mxp = Math.max(r.isPf, r.oosPf, 1); const h = (v / mxp) * 100;
                  return <div key={l} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
                    <div style={{ height: `${h}%`, minHeight: 6, background: c, borderRadius: '6px 6px 0 0', margin: '4px 0' }} />
                    <div className="muted" style={{ fontSize: 11.5 }}>{l}</div>
                  </div>;
                })}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>{es ? 'Retención' : 'Retention'} {Math.round(r.retention * 100)}% · {es ? 'neto OOS' : 'OOS net'} {r.oosNet}</div>
            </div>
            <div style={card}>
              <ChartHead es={es} t={es ? 'Walk-forward · consistencia' : 'Walk-forward · consistency'} d={es ? 'Neto por ventana de tiempo.' : 'Net per time window.'} />
              <WinBars windows={r.charts.windows} />
              <div className="muted" style={{ fontSize: 12, marginTop: 6, textAlign: 'center' }}>{Math.round(r.wfoConsistency * 100)}% {es ? 'de ventanas rentables' : 'profitable windows'}</div>
            </div>
          </div>

          {r.charts.grid && (
            <div style={card}>
              <ChartHead es={es} t={es ? 'Sensibilidad · ¿meseta o pico?' : 'Sensitivity · plateau or peak?'} d={es ? 'Curva de resultados de la optimización, de mejor a peor.' : 'Optimization results, best to worst.'} />
              <GridCurve grid={r.charts.grid} />
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{es ? 'Meseta' : 'Plateau'} {r.sensitivity}/100 · {r.sensitivity != null && r.sensitivity < 55 ? (es ? 'pico solitario (frágil)' : 'lone peak (fragile)') : (es ? 'estable' : 'stable')}</div>
            </div>
          )}

          {/* Auditoría de Claude */}
          {(res.ai?.audit || (res.ai?.mutations || []).length) && (
            <div style={{ ...card, borderColor: `color-mix(in srgb,${VIOLET} 40%,var(--line))` }}>
              <ChartHead es={es} t={es ? 'Auditoría de Claude' : 'Claude audit'} d={es ? 'Interpretación en palabras + mutaciones a probar.' : 'Plain-language read + mutations to try.'} />
              {res.ai?.audit && <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{res.ai.audit}</div>}
              {(res.ai?.mutations || []).length > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  <div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{es ? 'Mutaciones sugeridas' : 'Suggested mutations'}</div>
                  {res.ai.mutations.map((m: string, i: number) => <div key={i} style={{ fontSize: 13, background: 'var(--bg2)', borderRadius: 9, padding: '8px 11px', borderLeft: `3px solid ${VIOLET}` }}>{m}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Comparación con MetaTrader → pasar a demo */}
          <div style={card}>
            <ChartHead es={es} t={es ? 'Compara con el backtest de MetaTrader' : 'Compare with the MetaTrader backtest'} d={es ? 'Corre el robot en MT y pega sus KPIs. Si se parece al esperado, pasa a demo.' : 'Run the robot in MT and paste its KPIs. If similar to expected, advance to demo.'} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
              {([['net', es ? 'Neto' : 'Net'], ['pf', 'Profit factor'], ['winRate', es ? '% aciertos' : 'Win %'], ['maxdd', 'Drawdown'], ['trades', es ? 'Operaciones' : 'Trades']] as [string, string][]).map(([k, l]) => (
                <label key={k}><span className="muted" style={{ fontSize: 11.5 }}>{l} <span style={{ color: 'var(--mut)' }}>({es ? 'esp.' : 'exp.'} {r.expected[k === 'winRate' ? 'winRate' : k]})</span></span>
                  <input value={mt[k]} onChange={(e) => setMt({ ...mt, [k]: e.target.value })} placeholder="—" style={{ ...inp, marginTop: 3 }} />
                </label>
              ))}
            </div>
            {canManage && <button onClick={compare} disabled={busy} style={{ ...btn(BLUE), marginTop: 12 }}>{es ? 'Comparar' : 'Compare'}</button>}

            {cmp && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: cmp.similar ? GREEN : RED }}>{cmp.similar ? (es ? '✓ Se parece al esperado' : '✓ Similar to expected') : (es ? '✕ Difiere del esperado' : '✕ Differs from expected')}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{es ? 'divergencia' : 'divergence'} {cmp.divergence}% ({es ? 'límite 25%' : 'limit 25%'})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 10 }}>
                  {cmp.parts.map((p: any) => (
                    <div key={p.k} style={{ background: 'var(--bg2)', borderRadius: 9, padding: '8px 10px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.label}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'esp.' : 'exp.'} {p.exp} · MT {p.got}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: p.diff <= 25 ? GREEN : RED }}>{p.diff}% {es ? 'dif.' : 'diff'}</div>
                    </div>
                  ))}
                </div>
                {canManage && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={advance} disabled={busy || !cmp.similar || r.verdict === 'fragil'} style={{ ...btn(GREEN), padding: '11px 20px', fontSize: 14, opacity: (!cmp.similar || r.verdict === 'fragil') ? 0.5 : 1 }}>{es ? '🚀 Pasar a demo (pipeline)' : '🚀 Advance to demo (pipeline)'}</button>
                    {(r.verdict === 'fragil') && <span style={{ fontSize: 12, color: RED }}>{es ? 'Frágil: no puede pasar.' : 'Fragile: cannot advance.'}</span>}
                    {r.verdict !== 'fragil' && !cmp.similar && <span style={{ fontSize: 12, color: AMBER }}>{es ? 'El backtest debe parecerse antes de pasar.' : 'Backtest must match before advancing.'}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChartHead({ t, d }: any) {
  return <div style={{ marginBottom: 10 }}><div style={{ fontSize: 14.5, fontWeight: 800 }}>{t}</div><div className="muted" style={{ fontSize: 12 }}>{d}</div></div>;
}
