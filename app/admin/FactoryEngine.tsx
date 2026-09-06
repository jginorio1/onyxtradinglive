'use client';
import { useMemo, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { BLOCKS, sampleCandidates } from '@/lib/stratgen';
import { parseBars, parseBarsStreaming, runBacktest, inferPip, type Bar, type Spec, type Costs } from '@/lib/backtest';
import { evolve, type Survivor } from '@/lib/evolve';
import { genMt5, genMt4 } from '@/lib/mqlgen';

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

export default function FactoryEngine({ es, canManage, post, reload }: any) {
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [barsName, setBarsName] = useState('');
  const [reading, setReading] = useState(false);
  const [prog, setProg] = useState(0);
  const [tfMin, setTfMin] = useState(15);
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
      for (const c of cands) { const m = runBacktest(bars, c, costs); if (m.n > 0) out.push({ spec: c, net: m.net, pf: m.pf, dd: m.maxddPct, n: m.n, win: m.winRate, exp: m.expectancy }); }
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

  const specLabel = (s: Spec) => `${s.ind1}${s.ind2 ? '+' + s.ind2 : ''} · ${s.entry} · TP ${s.tp}/SL ${s.sl}`;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Datos + costes */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,var(--brand),' + VIOLET + ')', color: '#0b1020', fontSize: 18 }}>⚙️</span>
          <h3 style={{ margin: 0, flex: 1 }}>{es ? 'Motor de backtest + evolución' : 'Backtest + evolution engine'}</h3>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{es ? 'Sube barras OHLC (CSV MT). El motor simula miles de estrategias con costes reales, evoluciona las mejores y las envía al laboratorio.' : 'Upload OHLC bars (MT CSV). The engine simulates thousands of strategies with real costs, evolves the best and sends them to the lab.'}</p>
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
        <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{es ? 'Acepta los mismos ticks de Dukascopy/StrategyQuant (hasta varios GB): se leen por trozos y se convierten a barras OHLC al vuelo, sin cargar todo en memoria.' : 'Accepts the same Dukascopy/StrategyQuant ticks (multi-GB): streamed in chunks and converted to OHLC bars on the fly.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 12 }}>
          {([['spreadPips', es ? 'Spread (pips)' : 'Spread (pips)'], ['slippagePips', 'Slippage (pips)'], ['commission', es ? 'Comisión ($/lote)' : 'Commission ($/lot)'], ['moneyPerPip', es ? '$/pip (1 lote)' : '$/pip (1 lot)'], ['lot', es ? 'Lote' : 'Lot']] as [string, string][]).map(([k, l]) => (
            <label key={k}><span className="muted" style={{ fontSize: 11.5 }}>{l}</span><input type="number" step="0.1" value={(costs as any)[k]} onChange={(e) => setCosts({ ...costs, [k]: Number(e.target.value) })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
          ))}
        </div>
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
