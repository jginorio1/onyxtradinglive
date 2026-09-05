'use client';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';
import FactoryLab from './FactoryLab';
import FactoryPipeline from './FactoryPipeline';

// ============================================================
// Onyx Bot Factory · Fase 1 (solo admin)
//  · Puerta 0: subir datos de backtest + validación de calidad de tick.
//  · Constructor con nombre automático ÚNICO no editable.
// ============================================================

const GREEN = '#1D9E75', AMBER = '#EF9F27', RED = '#E24B4A', VIOLET = '#a06bff';
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 };

function statusColor(s: string) { return s === 'pass' ? GREEN : s === 'warn' ? AMBER : RED; }
function verdictColor(v: string) { return v === 'apta' ? GREEN : v === 'reservas' ? AMBER : RED; }

// -------- Parser de datos en el navegador (calcula métricas crudas) --------
function toMs(dateStr: string, timeStr?: string): number {
  let ds = (dateStr || '').trim().replace(/\./g, '-').replace(/\//g, '-');
  const p = ds.split('-').map((x) => parseInt(x, 10));
  let y: number, mo: number, d: number;
  if (String(dateStr).slice(0, 4).length === 4 && p[0] > 1900) { y = p[0]; mo = p[1]; d = p[2]; }
  else { y = p[2]; mo = p[1]; d = p[0]; }
  let hh = 0, mi = 0, ss = 0, ms = 0;
  if (timeStr) {
    const t = timeStr.trim().split(':');
    hh = parseInt(t[0], 10) || 0; mi = parseInt(t[1], 10) || 0;
    if (t[2]) { const sp = t[2].split('.'); ss = parseInt(sp[0], 10) || 0; ms = sp[1] ? Math.round(parseFloat('0.' + sp[1]) * 1000) : 0; }
  }
  const v = Date.UTC(y, (mo || 1) - 1, d || 1, hh, mi, ss, ms);
  return isNaN(v) ? NaN : v;
}

async function analyzeFile(file: File): Promise<any> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  let i = 0; while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return { rows: 0, parsed: false };

  const first = lines[i];
  const delim = [',', '\t', ';'].map((d) => ({ d, n: first.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const isHeader = /[a-zA-Z]{3,}/.test(first) && !/^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(first);

  const cfg: any = { dt: -1, date: -1, time: -1, bid: -1, ask: -1, close: -1, hi: -1, lo: -1 };
  let start = i;
  if (isHeader) {
    const h = first.split(delim).map((s) => s.trim().toLowerCase());
    h.forEach((c, idx) => {
      if (cfg.bid < 0 && /\bbid\b/.test(c)) cfg.bid = idx;
      else if (cfg.ask < 0 && /\bask\b/.test(c)) cfg.ask = idx;
      else if (cfg.close < 0 && /close/.test(c)) cfg.close = idx;
      else if (cfg.hi < 0 && /high/.test(c)) cfg.hi = idx;
      else if (cfg.lo < 0 && /low/.test(c)) cfg.lo = idx;
      if (cfg.dt < 0 && /(gmt|timestamp|datetime|date time)/.test(c)) cfg.dt = idx;
      else if (cfg.date < 0 && /date|fecha/.test(c) && !/update/.test(c)) cfg.date = idx;
      else if (cfg.time < 0 && /time|hora/.test(c)) cfg.time = idx;
    });
    start = i + 1;
  } else {
    // Sin cabecera: layout MT. token0 = fecha; puede llevar la hora pegada.
    const t = first.split(delim);
    const dateHasTime = /\d{2}:\d{2}/.test(t[0]);
    cfg.dt = dateHasTime ? 0 : -1;
    cfg.date = dateHasTime ? -1 : 0;
    cfg.time = dateHasTime ? -1 : 1;
    const off = dateHasTime ? 1 : 2;
    const nums = t.slice(off).filter((x) => x !== '' && !isNaN(parseFloat(x)));
    if (nums.length >= 4) { cfg.close = off + 3; cfg.hi = off + 1; cfg.lo = off + 2; }
    else if (nums.length >= 2) { cfg.bid = off; cfg.ask = off + 1; }
    else { cfg.close = off; }
  }
  const hasTicks = cfg.bid >= 0 && cfg.ask >= 0;

  const MAXL = 2000000;
  let rows = 0, outOfOrder = 0, duplicates = 0, gaps = 0, anomalies = 0, spreadZero = 0;
  let spreadSum = 0, spreadN = 0, digits = 5;
  let prevTs = NaN, prevPrice = NaN, fromMs = NaN, toMs2 = NaN;
  let gotDigits = false;
  let processed = 0;

  for (let k = start; k < lines.length; k++) {
    const ln = lines[k]; if (!ln) continue;
    const c = ln.split(delim); if (c.length < 2) continue;
    let ts: number;
    if (cfg.dt >= 0) { const dv = c[cfg.dt].trim(); const sp = dv.split(/\s+/); ts = toMs(sp[0], sp[1]); }
    else ts = toMs(c[cfg.date], cfg.time >= 0 ? c[cfg.time] : undefined);
    if (isNaN(ts)) continue;

    let bid = NaN, ask = NaN, price = NaN;
    if (hasTicks) { bid = parseFloat(c[cfg.bid]); ask = parseFloat(c[cfg.ask]); price = (bid + ask) / 2; }
    else if (cfg.close >= 0) price = parseFloat(c[cfg.close]);
    if (isNaN(price)) continue;

    if (!gotDigits && hasTicks && c[cfg.bid]) { const dot = c[cfg.bid].indexOf('.'); digits = dot >= 0 ? (c[cfg.bid].trim().length - dot - 1) : 0; gotDigits = true; }

    rows++;
    if (isNaN(fromMs)) fromMs = ts;
    toMs2 = ts;
    if (!isNaN(prevTs)) {
      if (ts < prevTs) outOfOrder++;
      else if (ts === prevTs) duplicates++;
      else {
        const dt = ts - prevTs;
        if (dt > 21600000) { const wd = new Date(prevTs).getUTCDay(); if (!(wd === 5 || wd === 6)) gaps++; }
      }
    }
    if (!isNaN(prevPrice) && prevPrice > 0 && Math.abs(price - prevPrice) / prevPrice > 0.2) anomalies++;
    if (hasTicks) { const sp = ask - bid; if (sp <= 0) spreadZero++; else { spreadSum += sp; spreadN++; } }
    prevTs = ts; prevPrice = price;

    processed++;
    if (processed >= MAXL) break;
  }

  const truncated = processed >= MAXL;
  const spreadAvgPts = spreadN ? (spreadSum / spreadN) * Math.pow(10, digits) : 0;
  return {
    rows, parsed: rows > 0,
    fromMs: isNaN(fromMs) ? undefined : fromMs,
    toMs: isNaN(toMs2) ? undefined : toMs2,
    outOfOrder, duplicates, gaps, anomalies, hasTicks, spreadAvgPts: Math.round(spreadAvgPts), spreadZero, truncated,
  };
}

// -------- Anillo de calidad --------
function Ring({ score, color, size = 120, label }: any) {
  const r = size * 0.4, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={size * 0.1} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset .7s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color, lineHeight: 1 }}>{score}%</span>
        <span className="muted" style={{ fontSize: size * 0.09 }}>{label}</span>
      </div>
    </div>
  );
}

export default function Factory({ canManage = true }: { canManage?: boolean }) {
  const { lang } = useLang(); const es = lang !== 'en';
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'datos' | 'constructor' | 'laboratorio' | 'pipeline' | 'robots'>('datos');

  async function load() { try { const r = await fetch('/api/admin/factory'); const j = await r.json(); setD(j); } catch {} }
  useEffect(() => { load(); }, []);
  async function post(body: any) { const r = await fetch('/api/admin/factory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'error'); return j; }

  if (!d) return <div className="muted" style={{ padding: 20 }}>{es ? 'Cargando…' : 'Loading…'}</div>;
  const stats = d.stats || {};

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {[[es ? 'Robots en la fábrica' : 'Robots in factory', stats.bots || 0, VIOLET], [es ? 'Datasets validados' : 'Validated datasets', stats.datasets || 0, GREEN], [es ? 'Siguiente nombre' : 'Next name', d.nextName || '—', 'var(--brand)']].map(([l, v, c]: any, i) => (
          <div key={i} style={{ ...card, padding: 14, borderLeft: `3px solid ${c}` }}>
            <div className="muted" style={{ fontSize: 12 }}>{l}</div>
            <div style={{ fontSize: i === 2 ? 16 : 24, fontWeight: 800, color: c, marginTop: 4, fontFamily: i === 2 ? 'monospace' : 'inherit' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['datos', es ? 'Puerta 0 · Datos' : 'Gate 0 · Data'], ['constructor', es ? 'Constructor' : 'Builder'], ['laboratorio', es ? 'Laboratorio' : 'Lab'], ['pipeline', es ? 'Pipeline' : 'Pipeline'], ['robots', es ? 'Robots' : 'Robots']] as [any, string][]).map(([k, lbl]) => {
          const on = sub === k;
          return <button key={k} onClick={() => setSub(k)} style={{ padding: '9px 15px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'var(--card)', color: on ? 'var(--brand)' : 'var(--tx)' }}>{lbl}</button>;
        })}
      </div>

      {sub === 'datos' && <DataGate es={es} canManage={canManage} post={post} reload={load} datasets={d.datasets || []} />}
      {sub === 'constructor' && <Builder es={es} canManage={canManage} post={post} reload={load} nextName={d.nextName} datasets={d.datasets || []} />}
      {sub === 'laboratorio' && <FactoryLab es={es} canManage={canManage} post={post} reload={load} bots={d.bots || []} />}
      {sub === 'pipeline' && <FactoryPipeline es={es} canManage={canManage} post={post} />}
      {sub === 'robots' && <BotList es={es} canManage={canManage} post={post} reload={load} bots={d.bots || []} />}
    </div>
  );
}

// -------- Puerta 0 · Datos --------
function DataGate({ es, canManage, post, reload, datasets }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState('M1');
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [q, setQ] = useState<any>(null);

  async function analyze(f: File) {
    setBusy(true); setQ(null); setMetrics(null);
    try {
      const m = await analyzeFile(f);
      setMetrics(m);
      const j = await post({ action: 'validate', metrics: m });
      setQ(j.quality);
    } catch (e: any) { toastErr(e?.message || 'No se pudo leer el archivo.'); } finally { setBusy(false); }
  }
  async function save() {
    if (!metrics || !q) return; setBusy(true);
    try { await post({ action: 'dataset_save', symbol, timeframe: tf, filename: file?.name, metrics }); toast(es ? 'Dataset guardado' : 'Dataset saved'); setFile(null); setMetrics(null); setQ(null); reload(); }
    catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Sube los datos de backtest' : 'Upload backtest data'}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{es ? 'CSV de MT4/MT5 (fecha, hora, precios) o export de ticks (bid/ask). Se valida la calidad antes de dejar entrar el robot a la fábrica.' : 'MT4/MT5 CSV (date, time, prices) or tick export (bid/ask). Quality is validated before a robot enters the factory.'}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={es ? 'Símbolo (XAUUSD)' : 'Symbol (XAUUSD)'} style={inp} />
          <select value={tf} onChange={(e) => setTf(e.target.value)} style={inp}>{['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'tick'].map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <label style={{ ...btn('var(--brand)'), display: 'inline-flex', cursor: 'pointer' }}>
            {file ? file.name.slice(0, 26) : (es ? 'Elegir archivo' : 'Choose file')}
            <input type="file" accept=".csv,.txt,.tsv,.hst" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f) analyze(f); }} />
          </label>
          {busy && <span className="muted" style={{ fontSize: 12.5 }}>{es ? 'Analizando…' : 'Analyzing…'}</span>}
        </div>
      </div>

      {q && metrics && (
        <div style={{ ...card, borderColor: `color-mix(in srgb,${verdictColor(q.verdict)} 45%,var(--line))` }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <Ring score={q.score} color={verdictColor(q.verdict)} label={es ? 'calidad tick' : 'tick quality'} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: verdictColor(q.verdict) }}>
                {q.verdict === 'apta' ? (es ? 'Data apta para backtest' : 'Data fit for backtest') : q.verdict === 'reservas' ? (es ? 'Apta con reservas' : 'Fit with caveats') : (es ? 'Rechazada' : 'Rejected')}
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
                {symbol || '—'} · {tf} {metrics.hasTicks ? (es ? '· ticks reales' : '· real ticks') : (es ? '· barras OHLC' : '· OHLC bars')}<br />
                {metrics.fromMs ? new Date(metrics.fromMs).toISOString().slice(0, 10) : '—'} → {metrics.toMs ? new Date(metrics.toMs).toISOString().slice(0, 10) : '—'} · {q.years} {es ? 'años' : 'yrs'} · {(metrics.rows || 0).toLocaleString('en-US')} {es ? 'filas' : 'rows'}{metrics.truncated ? (es ? ' (muestra)' : ' (sample)') : ''}
              </div>
              {q.verdict !== 'rechazada' && canManage && <button onClick={save} disabled={busy} style={{ ...btn(GREEN), marginTop: 10 }}>{es ? 'Guardar dataset' : 'Save dataset'}</button>}
              {q.verdict === 'rechazada' && <div style={{ fontSize: 12.5, color: RED, marginTop: 8 }}>{es ? 'No se puede confiar en un backtest con estos datos. Corrige y vuelve a subir.' : 'A backtest on this data cannot be trusted. Fix and re-upload.'}</div>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8, marginTop: 14 }}>
            {(q.checks || []).map((c: any) => (
              <div key={c.key} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 11px', background: 'var(--bg2)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: statusColor(c.status), flex: 'none', marginTop: 5 }} />
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{c.label}</div><div className="muted" style={{ fontSize: 11.5 }}>{c.detail}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Datasets validados' : 'Validated datasets'}</h3>
        {!datasets.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Aún no hay datos.' : 'No data yet.'}</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {datasets.map((ds: any) => (
            <div key={ds.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: verdictColor(ds.verdict), flex: 'none' }} />
              <b style={{ fontSize: 13.5 }}>{ds.symbol || '—'} · {ds.timeframe || '—'}</b>
              <span className="muted" style={{ fontSize: 12 }}>{ds.years} {es ? 'años' : 'yrs'} · {(ds.rows || 0).toLocaleString('en-US')} {es ? 'filas' : 'rows'} · {ds.has_ticks ? 'ticks' : 'OHLC'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: verdictColor(ds.verdict) }}>{ds.quality_score}% · {ds.verdict}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------- Constructor --------
function Builder({ es, canManage, post, reload, nextName, datasets }: any) {
  const [platform, setPlatform] = useState<'mt5' | 'mt4'>('mt5');
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState('M15');
  const [family, setFamily] = useState('tendencia');
  const [notes, setNotes] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [busy, setBusy] = useState(false);
  const usable = (datasets as any[]).filter((d) => d.verdict !== 'rechazada');

  async function create() {
    setBusy(true);
    try {
      const j = await post({ action: 'bot_create', platform, symbol, timeframe: tf, strategy: { family, notes }, datasetId: datasetId || null });
      toast((es ? 'Robot creado: ' : 'Robot created: ') + (j.bot?.name || ''));
      setSymbol(''); setNotes(''); setDatasetId(''); reload();
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>{es ? 'Constructor de robots (solo admin)' : 'Robot builder (admin only)'}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, border: `1px solid color-mix(in srgb,${VIOLET} 30%,var(--line))` }}>
        <div style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: 12 }}>{es ? 'Nombre automático (no editable, nunca se repite)' : 'Automatic name (locked, never repeats)'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: VIOLET, marginTop: 2 }}>{nextName || '—'}</div>
        </div>
        <span style={{ fontSize: 22 }}>🔒</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <Lbl es={es} t={es ? 'Plataforma' : 'Platform'}><select value={platform} onChange={(e) => setPlatform(e.target.value as any)} style={inp}><option value="mt5">MT5</option><option value="mt4">MT4</option></select></Lbl>
        <Lbl es={es} t={es ? 'Símbolo' : 'Symbol'}><input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="XAUUSD" style={inp} /></Lbl>
        <Lbl es={es} t={es ? 'Temporalidad' : 'Timeframe'}><select value={tf} onChange={(e) => setTf(e.target.value)} style={inp}>{['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((x) => <option key={x} value={x}>{x}</option>)}</select></Lbl>
        <Lbl es={es} t={es ? 'Familia de estrategia' : 'Strategy family'}><select value={family} onChange={(e) => setFamily(e.target.value)} style={inp}>{[['tendencia', es ? 'Tendencia' : 'Trend'], ['rango', es ? 'Rango' : 'Range'], ['ruptura', es ? 'Ruptura' : 'Breakout'], ['reversion', es ? 'Reversión' : 'Reversion'], ['volatilidad', es ? 'Volatilidad' : 'Volatility'], ['scalping', 'Scalping']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Lbl>
        <Lbl es={es} t={es ? 'Datos (dataset)' : 'Data (dataset)'} wide><select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} style={inp}><option value="">{es ? '— sin asignar —' : '— none —'}</option>{usable.map((d: any) => <option key={d.id} value={d.id}>{d.symbol} · {d.timeframe} · {d.years}y · {d.verdict}</option>)}</select></Lbl>
      </div>
      <Lbl es={es} t={es ? 'Notas de la estrategia' : 'Strategy notes'}><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={es ? 'Idea, reglas de entrada/salida, gestión…' : 'Idea, entry/exit rules, management…'} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} /></Lbl>

      {canManage && <button onClick={create} disabled={busy} style={{ ...btn(VIOLET), marginTop: 14, padding: '11px 20px', fontSize: 14 }}>{busy ? (es ? 'Creando…' : 'Creating…') : (es ? 'Crear robot' : 'Create robot')}</button>}
    </div>
  );
}

// -------- Lista de robots --------
function BotList({ es, canManage, post, reload, bots }: any) {
  async function del(id: string) { try { await post({ action: 'bot_delete', id }); toast(es ? 'Eliminado' : 'Deleted'); reload(); } catch (e: any) { toastErr(e?.message); } }
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>{es ? 'Robots de la fábrica' : 'Factory robots'}</h3>
      {!bots.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Aún no has creado robots.' : 'No robots yet.'}</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {bots.map((b: any) => (
          <div key={b.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 13, padding: 13, background: `linear-gradient(140deg,color-mix(in srgb,${VIOLET} 7%,transparent),transparent 60%)` }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: GREEN, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <b style={{ fontSize: 15, fontFamily: 'monospace', color: VIOLET }}>{b.name}</b>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{String(b.platform || '').toUpperCase()} · {b.symbol || '—'} · {b.timeframe || '—'} · {b.strategy?.family || '—'} · {es ? 'etapa' : 'stage'} {b.stage}</div>
            </div>
            {b.robustness_verdict && <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: `color-mix(in srgb,${b.robustness_verdict === 'robusto' ? GREEN : b.robustness_verdict === 'moderado' ? AMBER : RED} 16%,transparent)`, color: b.robustness_verdict === 'robusto' ? GREEN : b.robustness_verdict === 'moderado' ? AMBER : RED }}>{b.robustness_score} · {b.robustness_verdict}</span>}
            {b.demo_ready && <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: `color-mix(in srgb,${GREEN} 16%,transparent)`, color: GREEN }}>{es ? '🚀 en demo' : '🚀 in demo'}</span>}
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: 'color-mix(in srgb,var(--brand) 14%,transparent)', color: 'var(--brand)' }}>{b.stage}</span>
            {canManage && <button onClick={() => del(b.id)} style={btn(RED)}>{es ? 'Borrar' : 'Delete'}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const inp: any = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function Lbl({ t, children, wide }: any) { return <label style={{ display: 'block', gridColumn: wide ? 'span 2' : 'auto', marginTop: 2 }}><span className="muted" style={{ fontSize: 12 }}>{t}</span><div style={{ marginTop: 4 }}>{children}</div></label>; }
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }
