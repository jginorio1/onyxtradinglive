'use client';
import { useEffect, useRef, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';
import FactoryLab from './FactoryLab';
import FactoryPipeline from './FactoryPipeline';
import StratGenerator from './StratGenerator';
import FactoryEngine from './FactoryEngine';
import { subscribeAnalysis, getAnalysis, startAnalysis, resetAnalysis, patchAnalysis, barsToUploadBlob, type ColumnarBars } from '@/lib/dataAnalyzer';
import { BLOCKS } from '@/lib/stratgen';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { ProgressBar, ProgressBarIndeterminate, LIME } from './ProgressBar';

// Suscribe el componente al store global del análisis (sobrevive a navegar).
function useAnalysis() {
  const [, force] = useState(0);
  useEffect(() => subscribeAnalysis(() => force((x) => x + 1)), []);
  return getAnalysis();
}

// ============================================================
// Onyx Bot Factory · Fase 1 (solo admin)
//  · Puerta 0: subir datos de backtest + validación de calidad de tick.
//  · Constructor con nombre automático ÚNICO no editable.
// ============================================================

const GREEN = '#1D9E75', AMBER = '#EF9F27', RED = '#E24B4A', VIOLET = '#a06bff';
// Paleta FRESCA "Laguna" (teal · aqua · lima · coral) — nada de púrpura ni verde apagado.
const TEAL = '#0fb8a6', AQUA = '#2ee6c5', SKY = '#22c1e0', MINT = '#5bd11e', CORAL = '#ff8a5c';
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 };

function statusColor(s: string) { return s === 'pass' ? GREEN : s === 'warn' ? AMBER : RED; }

// Telemetría del análisis en curso: leído / total, filas, velocidad, transcurrido, ETA.
function AnalysisTelemetry({ gate, es }: any) {
  const [, tick] = useState(0);
  useEffect(() => { if (!gate.busy) return; const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, [gate.busy]);
  const el = gate.startedAt ? Math.max(0, Date.now() - gate.startedAt) : 0;
  const secs = el / 1000;
  const mb = (gate.bytesRead || 0) / 1048576, totMb = (gate.fileSize || 0) / 1048576;
  const speed = secs > 0 ? mb / secs : 0;
  const remainMb = Math.max(0, totMb - mb);
  const eta = speed > 0.05 && gate.prog < 0.999 ? remainMb / speed : 0;
  const fmtDur = (s: number) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + ss + 's'; };
  const cell = (l: string, v: string) => (<div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}><div className="muted" style={{ fontSize: 10.5 }}>{l}</div><div style={{ fontSize: 13.5, fontWeight: 800 }}>{v}</div></div>);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(92px,1fr))', gap: 6, marginTop: 10 }}>
      {cell(es ? 'Leído' : 'Read', mb.toFixed(0) + ' / ' + totMb.toFixed(0) + ' MB')}
      {cell(es ? 'Filas' : 'Rows', (gate.rows || 0).toLocaleString('en-US'))}
      {cell(es ? 'Velocidad' : 'Speed', speed.toFixed(1) + ' MB/s')}
      {cell(es ? 'Transcurrido' : 'Elapsed', fmtDur(secs))}
      {cell('ETA', eta > 0 ? fmtDur(eta) : '—')}
    </div>
  );
}

// Bitácora persistente: eventos con hora. Sobrevive a recargas.
function AnalysisLog({ gate, es }: any) {
  const [open, setOpen] = useState(!!gate.interrupted);
  const log: any[] = gate.log || [];
  if (!log.length) return null;
  const hhmm = (t: number) => new Date(t).toLocaleTimeString(es ? 'es' : 'en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const kc = (k: string) => k === 'ok' ? GREEN : k === 'warn' ? AMBER : k === 'error' ? RED : 'var(--brand)';
  function download() {
    const lines = log.map((e) => new Date(e.t).toISOString() + '  [' + e.kind.toUpperCase() + ']  ' + e.msg);
    const head = ['Onyx · Registro de análisis', 'Archivo: ' + gate.fileName, 'Tamaño: ' + ((gate.fileSize || 0) / 1048576).toFixed(0) + ' MB', 'Símbolo: ' + gate.symbol, 'Progreso: ' + Math.round((gate.prog || 0) * 100) + '%', 'Filas: ' + (gate.rows || 0), ''];
    const b = new Blob([head.concat(lines).join('\n')], { type: 'text/plain' });
    const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'onyx_analisis_' + Date.now() + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setOpen((o) => !o)} style={{ background: 'transparent', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>{open ? '▾' : '▸'} {es ? 'Registro de análisis' : 'Analysis log'} ({log.length})</button>
        <button onClick={download} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tx)', cursor: 'pointer', fontSize: 11.5, padding: '4px 9px' }}>{es ? '⬇ Descargar' : '⬇ Download'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)' }}>
          {log.slice().reverse().map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '6px 10px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 12 }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--mut)', minWidth: 62 }}>{hhmm(e.t)}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: kc(e.kind), flex: 'none', marginTop: 5 }} />
              <span>{e.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function verdictColor(v: string) { return v === 'apta' ? GREEN : v === 'reservas' ? AMBER : RED; }

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
  const [sub, setSub] = useState<'datos' | 'constructor' | 'motor' | 'laboratorio' | 'pipeline' | 'robots'>('datos');

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

      {/* Barra de progreso de las 6 etapas — el flujo va en una sola dirección:
          Datos → Constructor → Motor → Laboratorio → Pipeline → Robots. */}
      <StageBar sub={sub} setSub={setSub} es={es} />

      {sub === 'datos' && <DataGate es={es} canManage={canManage} post={post} reload={load} datasets={d.datasets || []} />}
      {sub === 'constructor' && <Builder es={es} canManage={canManage} post={post} reload={load} nextName={d.nextName} datasets={d.datasets || []} templates={d.templates || []} blocks={d.blocks || []} bots={d.bots || []} setSub={setSub} />}
      {sub === 'motor' && <FactoryEngine es={es} canManage={canManage} post={post} reload={load} datasets={d.datasets || []} blocks={d.blocks || []} />}
      {sub === 'laboratorio' && <FactoryLab es={es} canManage={canManage} post={post} reload={load} bots={d.bots || []} datasets={d.datasets || []} />}
      {sub === 'pipeline' && <FactoryPipeline es={es} canManage={canManage} post={post} />}
      {sub === 'robots' && <BotList es={es} canManage={canManage} post={post} reload={load} bots={d.bots || []} />}
    </div>
  );
}

// -------- Barra de etapas (stepper) --------
// Menú SIEMPRE arriba y visible. Muestra el flujo de una sola dirección y deja
// saltar a cualquier etapa. La activa se resalta; las pasadas quedan en verde.
const STAGES: [string, string, string][] = [
  ['datos', 'Datos', 'Data'], ['constructor', 'Constructor', 'Builder'], ['motor', 'Motor', 'Engine'],
  ['laboratorio', 'Laboratorio', 'Lab'], ['pipeline', 'Pipeline', 'Pipeline'], ['robots', 'Robots', 'Robots'],
];
function StageBar({ sub, setSub, es }: any) {
  const idx = STAGES.findIndex((s) => s[0] === sub);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 8 }}>
      {STAGES.map(([k, esL, enL], i) => {
        const on = sub === k, done = i < idx;
        const c = on ? 'var(--brand)' : done ? GREEN : 'var(--tx)';
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setSub(k)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--brand)' : done ? `color-mix(in srgb,${GREEN} 40%,var(--line))` : 'var(--line)'), background: on ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : done ? `color-mix(in srgb,${GREEN} 10%,transparent)` : 'var(--bg2)', color: c }}>
              <span style={{ display: 'inline-flex', width: 19, height: 19, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: on ? 'var(--brand)' : done ? GREEN : 'var(--line)', color: on || done ? '#04140f' : 'var(--tx)' }}>{done ? '✓' : i + 1}</span>
              {es ? esL : enL}
            </button>
            {i < STAGES.length - 1 && <span className="muted" style={{ fontSize: 13 }}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

// -------- Puerta 0 · Datos --------
// Un archivo se sube y valida UNA sola vez aquí; se guarda en la biblioteca y se
// reutiliza en Constructor/Motor/Laboratorio sin volver a subir nada.
function DataGate({ es, canManage, post, reload, datasets }: any) {
  const gate = useAnalysis(); // store global — sobrevive a navegar por el panel
  const source = gate.source, broker = gate.broker;
  const [saving, setSaving] = useState(false);
  const [upMsg, setUpMsg] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const metrics = gate.metrics, q = gate.q;
  const errShown = useRef('');

  // Al terminar el análisis, pide el veredicto de calidad (server-side).
  useEffect(() => {
    let alive = true;
    if (gate.metrics && !gate.q && !gate.busy && !gate.error) {
      post({ action: 'validate', metrics: gate.metrics }).then((j: any) => { if (alive) patchAnalysis({ q: j.quality }); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [gate.metrics, gate.q, gate.busy, gate.error]);

  // Muestra el error real del worker (una vez).
  useEffect(() => {
    if (gate.error && errShown.current !== gate.error) { errShown.current = gate.error; toastErr((es ? 'No se pudo analizar: ' : 'Could not analyze: ') + gate.error); }
  }, [gate.error]);

  function pick(f: File | null) { if (!f) return; startAnalysis(f, { tfMin: 1 }); }
  function chooseAnother() {
    resetAnalysis();
    if (inputRef.current) inputRef.current.value = ''; // permite re-elegir el MISMO archivo
    inputRef.current?.click();
  }

  async function save() {
    if (!metrics || !q || !gate.bars) return;
    // Fuente y broker OBLIGATORIOS: sin saber de dónde vienen los datos no se puede confiar
    // en el backtest (spread, comisiones y horario dependen del broker/proveedor).
    if (!source) { toastErr(es ? 'Elige de dónde sacaste la data (Dukascopy, MetaTrader u otro).' : 'Choose where the data is from (Dukascopy, MetaTrader or other).'); return; }
    if ((source === 'metatrader' || source === 'otro') && !(broker || '').trim()) { toastErr(es ? 'Escribe el broker/proveedor: el spread y las comisiones dependen de él.' : 'Enter the broker/provider: spread and commissions depend on it.'); return; }
    setSaving(true);
    try {
      // 1) Pide URLs firmadas (el admin las crea; la subida va DIRECTA a Supabase,
      //    sin pasar por Vercel, por eso soporta archivos de varios GB).
      setUpMsg(es ? 'Preparando subida…' : 'Preparing upload…');
      const sign = await post({ action: 'dataset_sign_upload', symbol: gate.symbol || 'data', wantTick: !!(gate.file && metrics.hasTicks) });
      const sb = supabaseBrowser();

      // 2) Sube las barras M1 (para generación rápida).
      setUpMsg(es ? 'Subiendo barras…' : 'Uploading bars…');
      const barsBlob = await barsToUploadBlob(gate.bars);   // gzip → 10× menos peso
      const ub = await sb.storage.from('factory-data').uploadToSignedUrl(sign.bars.path, sign.bars.token, barsBlob, { contentType: 'application/octet-stream' } as any);
      if (ub.error) throw new Error('barras: ' + ub.error.message);

      // 3) Sube el archivo de TICKS REALES tal cual (máxima fidelidad).
      let tick: any = null;
      if (gate.file && metrics.hasTicks && sign.tick) {
        setUpMsg(es ? 'Subiendo ticks reales (puede tardar)…' : 'Uploading real ticks (may take a while)…');
        const ut = await sb.storage.from('factory-data').uploadToSignedUrl(sign.tick.path, sign.tick.token, gate.file, { contentType: gate.file.type || 'text/csv' } as any);
        if (ut.error) throw new Error('ticks: ' + ut.error.message);
        tick = { path: sign.tick.path, url: sign.tick.url, size: gate.file.size };
      }

      // 4) Guarda la ficha del dataset (metadata pequeña por JSON).
      setUpMsg(es ? 'Guardando…' : 'Saving…');
      await post({ action: 'dataset_save', meta: {
        symbol: gate.symbol, timeframe: metrics.hasTicks ? 'tick' : 'bars', filename: gate.fileName, metrics,
        source, broker: source === 'metatrader' ? broker : '',
        barsPath: sign.bars.path, barsUrl: sign.bars.url, barsTf: gate.bars.tf, barsCount: gate.bars.t?.length || 0, fileSize: gate.fileSize,
        tickPath: tick?.path, tickUrl: tick?.url, tickSize: tick?.size, tickFormat: metrics.hasTicks ? (/duka/i.test(gate.fileName) ? 'dukascopy-csv' : 'csv-ticks') : null,
      } });
      toast(es ? 'Dataset guardado en la biblioteca' : 'Dataset saved to the library');
      resetAnalysis();
      if (inputRef.current) inputRef.current.value = '';
      reload();
    } catch (e: any) { toastErr(e?.message); } finally { setSaving(false); setUpMsg(''); }
  }

  async function del(id: string) {
    if (!confirm(es ? '¿Borrar este dataset de la biblioteca?' : 'Delete this dataset from the library?')) return;
    try { await post({ action: 'dataset_delete', id }); toast(es ? 'Borrado' : 'Deleted'); reload(); } catch (e: any) { toastErr(e?.message); }
  }

  const fromY = metrics?.fromMs ? new Date(metrics.fromMs).getUTCFullYear() : null;
  const toY = metrics?.toMs ? new Date(metrics.toMs).getUTCFullYear() : null;
  const fromD = metrics?.fromMs ? new Date(metrics.fromMs).toISOString().slice(0, 10) : null;
  const toD = metrics?.toMs ? new Date(metrics.toMs).toISOString().slice(0, 10) : null;
  // Aviso: pocos años de TICKS suele ser el límite de MT5 (guarda barras años atrás, pero ticks solo recientes).
  const shortTicks = !!(metrics?.hasTicks && q && q.years != null && q.years < 1.5);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Puerta 0 · Sube los datos (una sola vez)' : 'Gate 0 · Upload data (once)'}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{es ? 'Arrastra tu archivo de Dukascopy o MetaTrader (ticks o barras, de cualquier tamaño). El sistema detecta solo el símbolo, el tipo y los años. Se guarda para todos los tests futuros — no lo vuelves a subir.' : 'Drop your Dukascopy or MetaTrader file (ticks or bars, any size). The system auto-detects symbol, type and years. It is saved for all future tests — no re-upload.'}</p>

        {/* Fuente de los datos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
          <Lbl t={(es ? '¿De dónde sacaste la data?' : 'Where is the data from?') + ' *'}>
            <select value={source} onChange={(e) => patchAnalysis({ source: e.target.value })} style={{ ...inp, borderColor: source ? 'var(--line)' : RED }}>
              <option value="">{es ? '— elige (obligatorio) —' : '— choose (required) —'}</option>
              <option value="dukascopy">Dukascopy</option>
              <option value="metatrader">MetaTrader</option>
              <option value="otro">{es ? 'Otro' : 'Other'}</option>
            </select>
          </Lbl>
          {source === 'metatrader' && <Lbl t={(es ? 'Broker' : 'Broker') + ' *'}><input value={broker} onChange={(e) => patchAnalysis({ broker: e.target.value })} placeholder={es ? 'IC Markets, Pepperstone…' : 'IC Markets, Pepperstone…'} style={{ ...inp, borderColor: broker.trim() ? 'var(--line)' : RED }} /></Lbl>}
          {source === 'otro' && <Lbl t={(es ? 'Proveedor / broker' : 'Provider / broker') + ' *'}><input value={broker} onChange={(e) => patchAnalysis({ broker: e.target.value })} placeholder={es ? '¿de dónde?' : 'from where?'} style={{ ...inp, borderColor: broker.trim() ? 'var(--line)' : RED }} /></Lbl>}
        </div>

        {gate.interrupted && !gate.busy && (
          <div style={{ border: `1px solid ${AMBER}`, background: `color-mix(in srgb,${AMBER} 12%,var(--bg2))`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: AMBER, marginBottom: 4 }}>⚠ {es ? 'El análisis anterior se interrumpió' : 'The previous analysis was interrupted'}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{es ? `Se detuvo por una recarga de la página (entraste con el PIN o refrescaste). Iba en ${Math.round(gate.prog * 100)}% con ${gate.fileName}. El archivo local no se guarda al recargar — vuelve a seleccionarlo para reanalizar. Abajo tienes el registro con los tiempos.` : `It stopped due to a page reload (PIN entry or refresh). It was at ${Math.round(gate.prog * 100)}% with ${gate.fileName}. The local file isn't kept on reload — pick it again to re-analyze. The log with times is below.`}</div>
            <AnalysisLog gate={gate} es={es} />
          </div>
        )}

        {!gate.busy && (
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed color-mix(in srgb,var(--brand) 40%,var(--line))', borderRadius: 12, padding: '26px 14px', cursor: 'pointer', background: 'var(--bg2)', textAlign: 'center' }}>
            <span style={{ fontSize: 26 }}>📈</span>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{gate.fileName && !q ? gate.fileName : (es ? 'Arrastra o elige tu archivo de datos' : 'Drop or choose your data file')}</div>
            <div className="muted" style={{ fontSize: 12 }}>CSV · TXT · TSV — Dukascopy, MetaTrader…</div>
            <input ref={inputRef} type="file" accept=".csv,.txt,.tsv,.hst" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0] || null; pick(f); }} />
          </label>
        )}

        {gate.busy && (
          <div style={{ border: '1px solid color-mix(in srgb,' + LIME + ' 35%,var(--line))', borderRadius: 12, padding: 16, background: 'var(--bg2)' }}>
            <ProgressBar p={gate.prog} label={(es ? 'Analizando ' : 'Analyzing ') + (gate.symbol || gate.fileName)} />
            {gate.fileSize > 2e9 && <div style={{ fontSize: 12.5, color: RED, fontWeight: 700, marginTop: 8 }}>⚠ {es ? `Archivo muy grande (${(gate.fileSize / 1073741824).toFixed(1)} GB). El navegador puede quedarse sin memoria y recargar la pestaña. Si se corta, divide el archivo por años o usa un rango más corto.` : `Very large file (${(gate.fileSize / 1073741824).toFixed(1)} GB). The browser may run out of memory and reload the tab. If it stops, split the file by year or use a shorter range.`}</div>}
            {gate.stalled &&<div style={{ fontSize: 12.5, color: AMBER, fontWeight: 700, marginTop: 8 }}>⏸ {es ? 'Sin avance — ¿dejaste la pestaña en segundo plano? Vuelve a esta pestaña para que continúe.' : 'No progress — did you leave the tab in the background? Return to this tab to continue.'}</div>}
            <AnalysisTelemetry gate={gate} es={es} />
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{es ? 'Se lee el archivo completo en segundo plano. Puedes cambiar de sección del panel sin detenerlo. Mantén esta pestaña en primer plano y NO recargues (ni entres con el PIN) hasta que termine.' : 'Reading the whole file in the background. Switch panel sections freely. Keep this tab in the foreground and do NOT reload (or enter the PIN) until it finishes.'}</div>
            <AnalysisLog gate={gate} es={es} />
          </div>
        )}
      </div>

      {q && metrics && (
        <div style={{ ...card, borderColor: `color-mix(in srgb,${verdictColor(q.verdict)} 45%,var(--line))` }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <Ring score={q.score} color={verdictColor(q.verdict)} label={es ? 'calidad tick' : 'tick quality'} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: verdictColor(q.verdict) }}>
                {q.verdict === 'apta' ? (es ? 'Data apta para backtest' : 'Data fit for backtest') : q.verdict === 'reservas' ? (es ? 'Apta con reservas' : 'Fit with caveats') : (es ? 'Rechazada' : 'Rejected')}
              </div>
              {/* Chips autodetectados */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={chip(VIOLET)}>🏷 {gate.symbol || (es ? 'símbolo ?' : 'symbol ?')} <span style={{ opacity: .7 }}>({es ? 'auto' : 'auto'})</span></span>
                <span style={chip(metrics.hasTicks ? GREEN : AMBER)}>{metrics.hasTicks ? (es ? '⚡ ticks reales' : '⚡ real ticks') : (es ? '▦ barras' : '▦ bars')}</span>
                <span style={chip('var(--brand)')}>📅 {fromD || '—'} → {toD || '—'} · {q.years} {es ? 'años' : 'yrs'}</span>
                <span style={chip('var(--brand)')}>{(metrics.rows || 0).toLocaleString('en-US')} {es ? 'filas' : 'rows'}</span>
                {source && <span style={chip('var(--tx)')}>{source === 'dukascopy' ? 'Dukascopy' : source === 'metatrader' ? ('MetaTrader' + (broker ? ' · ' + broker : '')) : (es ? 'Otro' : 'Other')}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {q.verdict !== 'rechazada' && canManage && <button onClick={save} disabled={saving} style={btn(GREEN)}>{saving ? (es ? 'Guardando…' : 'Saving…') : (es ? '💾 Guardar en biblioteca' : '💾 Save to library')}</button>}
                <button onClick={chooseAnother} style={btn('var(--brand)')}>{es ? '↻ Analizar otra data' : '↻ Analyze another file'}</button>
              </div>
              {q.verdict === 'rechazada' && <div style={{ fontSize: 12.5, color: RED, marginTop: 8 }}>{es ? 'No se puede confiar en un backtest con estos datos. Corrige y vuelve a subir.' : 'A backtest on this data cannot be trusted. Fix and re-upload.'}</div>}
              {shortTicks && (
                <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.55, background: `color-mix(in srgb,${AMBER} 12%,var(--bg2))`, border: `1px solid color-mix(in srgb,${AMBER} 40%,var(--line))`, borderRadius: 10, padding: '10px 12px' }}>
                  <b style={{ color: AMBER }}>{es ? '¿Esperabas más años?' : 'Expected more years?'}</b> {es ? `Este archivo cubre ${fromD} → ${toD} (${q.years} años). MetaTrader guarda años de BARRAS, pero solo guarda TICKS de un período reciente y corto, así que un export de ticks casi siempre sale corto. Para más historia:` : `This file covers ${fromD} → ${toD} (${q.years} yrs). MetaTrader keeps years of BARS but only recent TICKS, so a tick export is almost always short. For more history:`}
                  <div style={{ marginTop: 6, color: 'var(--tx)' }}>{es ? '• En MT5 exporta barras M1 (van años atrás) en vez de ticks.' : '• In MT5, export M1 bars (they go back years) instead of ticks.'}</div>
                  <div style={{ color: 'var(--tx)' }}>{es ? '• O usa Dukascopy para ticks reales de 5+ años.' : '• Or use Dukascopy for real 5+ year ticks.'}</div>
                </div>
              )}
              {saving && <div style={{ marginTop: 12 }}><ProgressBarIndeterminate label={upMsg || (es ? 'Subiendo…' : 'Uploading…')} /><div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{es ? 'Los ticks reales se suben directo a Supabase (puede tardar en archivos grandes).' : 'Real ticks upload straight to Supabase (large files take a while).'}</div></div>}
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
        <h3 style={{ marginTop: 0 }}>{es ? 'Mis datos · biblioteca reutilizable' : 'My data · reusable library'}</h3>
        {!datasets.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Aún no hay datos. Sube uno arriba y quedará guardado aquí para siempre.' : 'No data yet. Upload one above and it stays here forever.'}</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          {datasets.map((ds: any) => <DatasetCard key={ds.id} ds={ds} es={es} post={post} canManage={canManage} onDelete={del} />)}
        </div>
      </div>
    </div>
  );
}

function chip(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: `color-mix(in srgb,${c} 15%,transparent)`, color: c, border: `1px solid color-mix(in srgb,${c} 30%,transparent)` }; }

// Ficha rica de un dataset: metadata completa (subida, tipo, rango, spread,
// broker, fuente, calidad) + resumen de la IA sobre los datos (bajo demanda).
function DatasetCard({ ds, es, post, canManage, onDelete }: any) {
  const [sum, setSum] = useState<{ summary: string; byAi: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const hasTicks = ds.data_kind === 'ticks' || ds.has_ticks;
  const fromY = ds.from_year || (ds.from_date ? new Date(ds.from_date).getUTCFullYear() : '—');
  const toY = ds.to_year || (ds.to_date ? new Date(ds.to_date).getUTCFullYear() : '—');
  const meta = (l: string, v: any) => <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 9px' }}><div className="muted" style={{ fontSize: 10.5 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>{v}</div></div>;
  async function summarize() {
    setBusy(true);
    try { const j = await post({ action: 'dataset_summary', id: ds.id, lang: es ? 'es' : 'en' }); setSum(j); }
    catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }
  return (
    <div style={{ border: `1px solid color-mix(in srgb,${verdictColor(ds.verdict)} 35%,var(--line))`, borderRadius: 12, padding: 12, background: 'var(--card)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: verdictColor(ds.verdict), flex: 'none' }} />
        <b style={{ fontSize: 14.5, fontFamily: 'monospace' }}>{ds.symbol || '—'}</b>
        <span style={chip(hasTicks ? GREEN : AMBER)}>{hasTicks ? '⚡ ' + (es ? 'ticks reales' : 'real ticks') : (es ? '▦ barras' : '▦ bars')}</span>
        {ds.bars_url && <span style={chip(LIME)}>{es ? 'listo p/ motor' : 'engine-ready'}</span>}
        {ds.created_at && <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>🕒 {es ? 'subido' : 'uploaded'} {new Date(ds.created_at).toLocaleString(es ? 'es-ES' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
        <span style={{ fontSize: 12, fontWeight: 800, color: verdictColor(ds.verdict) }}>{ds.quality_score}% · {ds.verdict}</span>
        {canManage && <button onClick={() => onDelete(ds.id)} style={{ ...btn(RED), padding: '5px 9px' }}>✕</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(84px,1fr))', gap: 7, marginTop: 10 }}>
        {meta(es ? 'Rango' : 'Range', `${fromY}–${toY}`)}
        {meta(es ? 'Años' : 'Years', `${ds.years ?? '—'}`)}
        {meta(es ? 'Resolución' : 'Resolution', hasTicks ? 'M1 · tick' : (ds.timeframe || 'bars'))}
        {meta(es ? 'Filas' : 'Rows', (ds.rows || 0).toLocaleString('en-US'))}
        {meta('Spread', hasTicks && ds.spread_avg_pts != null ? Math.round(ds.spread_avg_pts) + ' pts' : (es ? 'n/d' : 'n/a'))}
        {meta(es ? 'Fuente' : 'Source', ds.source || '—')}
        {meta('Broker', ds.broker || '—')}
        {ds.tick_size && meta(es ? 'Ticks' : 'Ticks', ds.tick_size / 1073741824 >= 1 ? (ds.tick_size / 1073741824).toFixed(1) + ' GB' : Math.round(ds.tick_size / 1048576) + ' MB')}
      </div>
      <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        {!sum && <button onClick={summarize} disabled={busy} style={{ ...btn(VIOLET), padding: '6px 12px' }}>{busy ? (es ? 'Analizando…' : 'Analyzing…') : '🧠 ' + (es ? 'Resumen IA de la data' : 'AI data summary')}</button>}
        {sum && (
          <div style={{ background: `color-mix(in srgb,${VIOLET} 8%,var(--bg2))`, border: `1px solid color-mix(in srgb,${VIOLET} 30%,var(--line))`, borderRadius: 10, padding: '9px 11px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: VIOLET, marginBottom: 3 }}>🧠 {es ? 'Resumen de la data' : 'Data summary'} {!sum.byAi && <span className="muted" style={{ fontWeight: 400 }}>({es ? 'sin IA — conecta ANTHROPIC_API_KEY' : 'no AI — set ANTHROPIC_API_KEY'})</span>}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{sum.summary}</div>
            <button onClick={summarize} disabled={busy} style={{ ...btn('var(--brand)'), padding: '4px 9px', marginTop: 7, fontSize: 11 }}>↻ {es ? 'regenerar' : 'regenerate'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// -------- Constructor --------
function Builder({ es, canManage, post, reload, nextName, datasets, templates = [], blocks = [], bots = [], setSub }: any) {
  const [platform, setPlatform] = useState<'mt5' | 'mt4'>('mt5');
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState('M15');
  const [family, setFamily] = useState('tendencia');
  const [datasetId, setDatasetId] = useState('');
  const [anyBroker, setAnyBroker] = useState(true);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false); // constructor manual de 1 robot (plegado)
  const usable = (datasets as any[]).filter((d) => d.verdict !== 'rechazada');

  // Al usar una plantilla, rellena los campos del constructor manual (la
  // generación masiva vive SOLO en el Motor; aquí no se duplica).
  function useTemplate(t: any) {
    if (t.symbol) setSymbol(t.symbol);
    if (t.timeframe) setTf(t.timeframe);
    if (t.family) setFamily(t.family);
    setAdvanced(true);
  }

  async function create() {
    setBusy(true);
    try {
      const j = await post({ action: 'bot_create', platform, symbol, timeframe: tf, strategy: { family, anyBroker }, datasetId: datasetId || null });
      toast((es ? 'Robot creado: ' : 'Robot created: ') + (j.bot?.name || '') + (j.bot?.magic ? ` · magic ${j.bot.magic}` : ''));
      setSymbol(''); setDatasetId(''); reload();
    } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Lanzador automático — la puerta de entrada al proceso de la fábrica.
          La generación masiva (evolución + Onyx + IA) vive en el Motor; aquí
          eliges los datos y arrancas. Todo pasa solo: Motor → Lab → Pipeline. */}
      <div style={{ ...card, background: `linear-gradient(150deg, color-mix(in srgb,${LIME} 12%,var(--card)), color-mix(in srgb,${TEAL} 8%,var(--card)) 70%, var(--card))`, borderColor: `color-mix(in srgb,${LIME} 34%,var(--line))` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${LIME},${TEAL})`, color: '#04201d', fontSize: 18 }}>⚡</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ margin: 0 }}>{es ? 'Fábrica automática' : 'Automatic factory'}</h3>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{es ? 'Elige los datos y arranca. El Motor genera y evoluciona miles, aplica el filtro anti-sobreajuste Onyx + auditoría IA, y valida en M1 — sin saltar entre pestañas.' : 'Pick the data and start. The Engine generates and evolves thousands, applies the Onyx anti-overfit gate + AI audit, and validates on M1 — no tab hopping.'}</div>
          </div>
          {canManage && <button onClick={() => setSub && setSub('motor')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 12, border: 'none', fontWeight: 800, cursor: 'pointer', background: `linear-gradient(135deg,${LIME},${TEAL})`, color: '#04201d' }}>{es ? '⚡ Abrir Motor automático →' : '⚡ Open automatic Engine →'}</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={chip(TEAL)}>{usable.length} {es ? 'datasets listos' : 'datasets ready'}</span>
          <span style={chip(SKY)}>{es ? 'evolución genética' : 'genetic evolution'}</span>
          <span style={chip(VIOLET)}>Onyx {es ? 'anti-sobreajuste' : 'anti-overfit'}</span>
          <span style={chip(CORAL)}>✨ {es ? 'auditoría IA' : 'AI audit'}</span>
          <span style={chip(GREEN)}>{es ? '📰 filtro noticias en todos los EA' : '📰 news filter in every EA'}</span>
        </div>
      </div>

      {/* Constructor: plantillas + constructor manual de 1 robot (plegado) */}
      <div style={{ ...card, background: `linear-gradient(150deg, color-mix(in srgb,${TEAL} 10%,var(--card)), color-mix(in srgb,${SKY} 8%,var(--card)) 70%, var(--card))`, borderColor: `color-mix(in srgb,${TEAL} 32%,var(--line))` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${TEAL},${AQUA})`, color: '#04201d', fontSize: 18 }}>🛠</span>
          <h3 style={{ margin: 0, flex: 1 }}>{es ? 'Plantillas y constructor manual' : 'Templates & manual builder'}</h3>
          {canManage && <button onClick={() => setAdvanced((v) => !v)} style={{ ...btn(SKY), padding: '8px 13px' }}>{advanced ? (es ? 'Ocultar manual' : 'Hide manual') : (es ? '＋ Crear 1 robot a mano' : '＋ Build 1 robot by hand')}</button>}
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{es ? 'Las plantillas son recetas de partida (edítalas o crea las tuyas). Para producir muchos robots usa la Fábrica automática de arriba; el constructor manual es para armar un solo robot puntual.' : 'Templates are starting recipes (edit them or make your own). To mass-produce robots use the Automatic factory above; the manual builder is for a single one-off robot.'}</p>

        <TemplateLibrary es={es} canManage={canManage} post={post} reload={reload} templates={templates} datasets={usable} onUse={useTemplate} />

        {advanced && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, border: `1px solid color-mix(in srgb,${TEAL} 30%,var(--line))` }}>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 12 }}>{es ? 'Nombre + magic automáticos (no editables, nunca se repiten)' : 'Automatic name + magic (locked, never repeat)'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: TEAL, marginTop: 2 }}>{nextName || '—'}</div>
              </div>
              <span style={{ fontSize: 22 }}>🔒</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <Lbl es={es} t={es ? 'Plataforma' : 'Platform'}><select value={platform} onChange={(e) => setPlatform(e.target.value as any)} style={inp}><option value="mt5">MT5</option><option value="mt4">MT4</option></select></Lbl>
              <Lbl es={es} t={es ? 'Instrumento / par' : 'Instrument / pair'}><InstrumentPicker value={symbol} onChange={setSymbol} es={es} /></Lbl>
              <Lbl es={es} t={es ? 'Temporalidad' : 'Timeframe'}><select value={tf} onChange={(e) => setTf(e.target.value)} style={inp}>{['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((x) => <option key={x} value={x}>{x}</option>)}</select></Lbl>
              <Lbl es={es} t={es ? 'Familia de estrategia' : 'Strategy family'}><select value={family} onChange={(e) => setFamily(e.target.value)} style={inp}>{[['tendencia', es ? 'Tendencia' : 'Trend'], ['rango', es ? 'Rango' : 'Range'], ['ruptura', es ? 'Ruptura' : 'Breakout'], ['reversion', es ? 'Reversión' : 'Reversion'], ['volatilidad', es ? 'Volatilidad' : 'Volatility'], ['scalping', 'Scalping']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Lbl>
              <Lbl es={es} t={es ? 'Datos (dataset)' : 'Data (dataset)'} wide><select value={datasetId} onChange={(e) => { const id = e.target.value; setDatasetId(id); const d = usable.find((x: any) => x.id === id); if (d) { if (d.symbol) setSymbol(d.symbol); if (d.timeframe) setTf(d.timeframe); } }} style={inp}><option value="">{es ? '— sin asignar —' : '— none —'}</option>{usable.map((d: any) => <option key={d.id} value={d.id}>{d.symbol} · {d.timeframe} · {d.years}y · {d.verdict}</option>)}</select></Lbl>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, cursor: 'pointer', background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
              <input type="checkbox" checked={anyBroker} onChange={(e) => setAnyBroker(e.target.checked)} style={{ width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{es ? 'Funciona en cualquier broker' : 'Works on any broker'}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'El robot ignora prefijos y sufijos del símbolo (XAUUSD.m, EURUSD.pro, #US30…).' : 'The robot ignores symbol prefixes/suffixes (XAUUSD.m, EURUSD.pro, #US30…).'}</div>
              </div>
            </label>

            {canManage && <button onClick={create} disabled={busy} style={{ marginTop: 14, padding: '12px 22px', fontSize: 14, borderRadius: 12, border: 'none', fontWeight: 800, cursor: 'pointer', background: `linear-gradient(135deg,${TEAL},${AQUA})`, color: '#04201d' }}>{busy ? (es ? 'Creando…' : 'Creating…') : (es ? '✨ Crear robot' : '✨ Create robot')}</button>}
          </div>
        )}
      </div>

      {/* Rejilla de robots de la fábrica (estilo Mis Robots) */}
      <RobotGrid bots={bots} es={es} post={post} canManage={canManage} reload={reload} setSub={setSub} />
    </div>
  );
}

// -------- Biblioteca de plantillas (estilo StrategyQuant + Claude) --------
const BLABEL = (es: boolean, key: string, id: string) => {
  const b = BLOCKS.find((x) => x.key === key); const o = b?.opts.find((x) => x.id === id);
  return o ? (es ? o.es : o.en) : id;
};
function tplSummary(es: boolean, cfg: any): string {
  const parts: string[] = [];
  for (const b of BLOCKS) { const arr = (cfg?.[b.key] || []); if (arr.length) parts.push(arr.slice(0, 3).map((id: string) => BLABEL(es, b.key, id)).join('/')); }
  return parts.slice(0, 4).join(' · ');
}

function TemplateLibrary({ es, canManage, post, reload, templates, datasets, onUse }: any) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSym, setAiSym] = useState('XAUUSD');
  const [aiTf, setAiTf] = useState('M15');
  const [aiFam, setAiFam] = useState('');
  const [aiDs, setAiDs] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRes, setAiRes] = useState<any>(null);

  async function askClaude() {
    setAiBusy(true); setAiRes(null);
    try { const j = await post({ action: 'template_ai', symbol: aiSym, timeframe: aiTf, family: aiFam || undefined, datasetId: aiDs || undefined, lang: es ? 'es' : 'en' }); setAiRes(j); }
    catch (e: any) { toastErr(e?.message); } finally { setAiBusy(false); }
  }
  async function saveAi() {
    if (!aiRes) return;
    try { await post({ action: 'template_save', name: aiRes.name, symbol: aiSym, timeframe: aiTf, family: aiRes.family, config: aiRes.config, origin: 'ai', aiRationale: aiRes.rationale }); toast(es ? 'Plantilla guardada' : 'Template saved'); setAiOpen(false); setAiRes(null); reload(); }
    catch (e: any) { toastErr(e?.message); }
  }
  async function del(id: string) {
    if (!confirm(es ? '¿Borrar esta plantilla?' : 'Delete this template?')) return;
    try { await post({ action: 'template_delete', id }); toast(es ? 'Borrada' : 'Deleted'); reload(); } catch (e: any) { toastErr(e?.message); }
  }

  const originChip = (o: string) => o === 'preset' ? { c: SKY, t: es ? 'de fábrica' : 'preset' } : o === 'ai' ? { c: CORAL, t: '✨ Claude' } : { c: AQUA, t: es ? 'tuya' : 'custom' };

  return (
    <div style={{ marginTop: 16, background: 'var(--bg2)', borderRadius: 12, padding: 14, border: `1px solid color-mix(in srgb,${TEAL} 22%,var(--line))` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ fontSize: 14, flex: 1 }}>📚 {es ? 'Biblioteca de plantillas' : 'Template library'} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {es ? 'nombre · instrumento · temporalidad' : 'name · instrument · timeframe'}</span></b>
        {canManage && <button onClick={() => onUse({ config: {}, symbol: '', timeframe: tfDefault, family: '' })} style={{ ...btn(TEAL), padding: '7px 12px' }}>＋ {es ? 'Nueva' : 'New'}</button>}
        {canManage && <button onClick={() => { setAiOpen((v) => !v); setAiRes(null); }} style={{ ...btn(CORAL), padding: '7px 12px' }}>✨ {es ? 'Claude, arma una' : 'Ask Claude'}</button>}
      </div>

      {aiOpen && (
        <div style={{ border: '1px solid color-mix(in srgb,#c084fc 35%,var(--line))', borderRadius: 10, padding: 12, marginBottom: 12, background: 'var(--card)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <Lbl t={es ? 'Instrumento' : 'Instrument'}><InstrumentPicker value={aiSym} onChange={setAiSym} es={es} /></Lbl>
            <Lbl t={es ? 'Temporalidad' : 'Timeframe'}><select value={aiTf} onChange={(e) => setAiTf(e.target.value)} style={inp}>{['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((x) => <option key={x} value={x}>{x}</option>)}</select></Lbl>
            <Lbl t={es ? 'Familia (opcional)' : 'Family (optional)'}><select value={aiFam} onChange={(e) => setAiFam(e.target.value)} style={inp}><option value="">{es ? 'auto' : 'auto'}</option>{[['tendencia', es ? 'Tendencia' : 'Trend'], ['rango', es ? 'Rango' : 'Range'], ['ruptura', es ? 'Ruptura' : 'Breakout'], ['reversion', es ? 'Reversión' : 'Reversion'], ['volatilidad', es ? 'Volatilidad' : 'Volatility'], ['scalping', 'Scalping']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Lbl>
            <Lbl t={es ? 'Usar datos de…' : 'Use data from…'}><select value={aiDs} onChange={(e) => setAiDs(e.target.value)} style={inp}><option value="">{es ? '— sin dataset —' : '— no dataset —'}</option>{(datasets as any[]).map((d) => <option key={d.id} value={d.id}>{d.symbol} · {d.from_year || ''}–{d.to_year || ''}</option>)}</select></Lbl>
          </div>
          <button onClick={askClaude} disabled={aiBusy} style={{ ...btn(CORAL), marginTop: 10 }}>{aiBusy ? (es ? 'Pensando…' : 'Thinking…') : (es ? '✨ Diseñar plantilla' : '✨ Design template')}</button>
          {aiRes && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{aiRes.name} {!aiRes.byAi && <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>({es ? 'base sin IA — conecta ANTHROPIC_API_KEY' : 'base, no AI — set ANTHROPIC_API_KEY'})</span>}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{tplSummary(es, aiRes.config)}</div>
              {aiRes.rationale && <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.55, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>{aiRes.rationale}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {canManage && <button onClick={saveAi} style={btn(MINT)}>{es ? '💾 Guardar plantilla' : '💾 Save template'}</button>}
                <button onClick={() => onUse({ config: aiRes.config, symbol: aiSym, timeframe: aiTf, family: aiRes.family })} style={btn(TEAL)}>{es ? 'Usar ahora' : 'Use now'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        {(templates as any[]).map((t) => { const oc = originChip(t.origin || 'custom'); return (
          <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 11, padding: 12, background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <b style={{ fontSize: 13, flex: 1 }}>{t.name}</b>
              <span style={chip(oc.c)}>{oc.t}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={chip(TEAL)}>{t.symbol || '—'}</span>
              <span style={chip(SKY)}>{t.timeframe || '—'}</span>
              {t.family && <span style={chip('var(--tx)')}>{t.family}</span>}
            </div>
            <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, minHeight: 30 }}>{tplSummary(es, t.config)}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              {canManage && <button onClick={() => onUse(t)} style={{ ...btn(TEAL), padding: '6px 11px', flex: 1, justifyContent: 'center' }}>{es ? 'Usar' : 'Use'}</button>}
              {canManage && t.origin !== 'preset' && <button onClick={() => del(t.id)} style={{ ...btn(RED), padding: '6px 9px' }}>✕</button>}
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}
const tfDefault = 'M15';

// -------- Lista de robots (cartera estilo Mis Robots) --------
function BotList({ es, canManage, post, reload, bots }: any) {
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>{es ? 'Robots de la fábrica' : 'Factory robots'}</h3>
      <RobotGrid bots={bots} es={es} post={post} canManage={canManage} reload={reload} embedded />
    </div>
  );
}

// Etapa de un robot → estado legible + color (borrador → demo → fondeo → real).
function stageInfo(b: any, es: boolean): { label: string; color: string } {
  const s = String(b.stage || '').toLowerCase();
  if (b.live_real || s.includes('real')) return { label: es ? 'real' : 'live', color: GREEN };
  if (b.funded || s.includes('fond')) return { label: es ? 'fondeo' : 'funded', color: TEAL };
  if (b.demo_ready || s.includes('demo')) return { label: 'demo', color: SKY };
  if (b.fine_score != null || s.includes('lab')) return { label: 'lab', color: VIOLET };
  return { label: es ? 'borrador' : 'draft', color: AMBER };
}
const gradeColor = (g: string) => g === 'A' || g === 'B' ? GREEN : g === 'C' ? AMBER : g ? RED : 'var(--tx)';

// Rejilla de tarjetas de robots — misma estética que "Mis Robots" del trader:
// par, estado por etapa, grado Onyx, mini-curva y acciones (Lab · borrar).
function RobotGrid({ bots = [], es, post, canManage, reload, setSub, embedded }: any) {
  const [filter, setFilter] = useState('todos');
  async function del(id: string) { if (!confirm(es ? '¿Borrar este robot?' : 'Delete this robot?')) return; try { await post({ action: 'bot_delete', id }); toast(es ? 'Eliminado' : 'Deleted'); reload && reload(); } catch (e: any) { toastErr(e?.message); } }
  const FOLDERS: [string, string][] = [['todos', es ? 'Todos' : 'All'], ['borrador', es ? 'Borrador' : 'Draft'], ['lab', 'Lab'], ['demo', 'Demo'], ['fondeo', es ? 'Fondeo' : 'Funded'], ['real', es ? 'Real' : 'Live']];
  const withStage = (bots as any[]).map((b) => ({ b, st: stageInfo(b, es) }));
  const counts: Record<string, number> = {}; withStage.forEach(({ st }) => { counts[st.label] = (counts[st.label] || 0) + 1; });
  const norm = (l: string) => ({ 'live': 'real', 'funded': 'fondeo', 'draft': 'borrador' } as any)[l] || l;
  const shown = filter === 'todos' ? withStage : withStage.filter(({ st }) => norm(st.label) === filter);

  return (
    <div style={embedded ? {} : { ...card }}>
      {!embedded && <h3 style={{ marginTop: 0 }}>{es ? 'Robots de la fábrica' : 'Factory robots'}</h3>}
      {!bots.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Aún no hay robots. Arranca la Fábrica automática de arriba.' : 'No robots yet. Start the Automatic factory above.'}</div>}
      {!!bots.length && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {FOLDERS.map(([k, l]) => { const on = filter === k; const n = k === 'todos' ? bots.length : (counts[k] || counts[({ real: 'live', fondeo: 'funded', borrador: 'draft' } as any)[k]] || 0); return (
            <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 11px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'var(--bg2)', color: on ? 'var(--brand)' : 'var(--tx)' }}>{l} · {n}</button>
          ); })}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))', gap: 10 }}>
        {shown.map(({ b, st }) => {
          const grade = b.fine_grade || (b.robustness_verdict === 'robusto' ? 'A' : b.robustness_verdict === 'moderado' ? 'C' : '');
          const score = b.fine_score ?? b.robustness_score;
          return (
            <div key={b.id} style={{ border: `1px solid color-mix(in srgb,${st.color} 32%,var(--line))`, borderRadius: 12, padding: 12, background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <b style={{ fontSize: 13.5, fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</b>
                <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: `color-mix(in srgb,${st.color} 16%,transparent)`, color: st.color }}>{st.label}</span>
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>{String(b.platform || '').toUpperCase()} · {b.symbol || '—'} · {b.timeframe || '—'}{score != null ? ' · ' : ''}{score != null && <span style={{ color: gradeColor(grade), fontWeight: 800 }}>{grade || ''} {score}</span>}</div>
              {b.magic && <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--tx)', opacity: .7 }}>magic {b.magic}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                {setSub && <button onClick={() => setSub('laboratorio')} style={{ ...btn(VIOLET), padding: '6px 10px', flex: 1, justifyContent: 'center', fontSize: 12 }}>🔬 Lab</button>}
                {canManage && <button onClick={() => del(b.id)} style={{ ...btn(RED), padding: '6px 9px' }}>✕</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inp: any = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function Lbl({ t, children, wide }: any) { return <label style={{ display: 'block', gridColumn: wide ? 'span 2' : 'auto', marginTop: 2 }}><span className="muted" style={{ fontSize: 12 }}>{t}</span><div style={{ marginTop: 4 }}>{children}</div></label>; }

// Catálogo de instrumentos (base, sin prefijos/sufijos de broker).
const INSTRUMENTS: { s: string; cat: string }[] = [
  ...['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD'].map((s) => ({ s, cat: 'Forex mayores' })),
  ...['EURGBP', 'EURJPY', 'GBPJPY', 'EURAUD', 'EURCHF', 'AUDJPY', 'CADJPY', 'CHFJPY', 'GBPAUD', 'GBPCAD', 'AUDNZD', 'NZDJPY', 'EURCAD', 'AUDCAD'].map((s) => ({ s, cat: 'Forex cruces' })),
  ...['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'].map((s) => ({ s, cat: 'Metales' })),
  ...['US30', 'NAS100', 'SPX500', 'US2000', 'GER40', 'UK100', 'FRA40', 'JP225', 'HK50', 'AUS200', 'EU50'].map((s) => ({ s, cat: 'Índices' })),
  ...['USOIL', 'UKOIL', 'NGAS'].map((s) => ({ s, cat: 'Materias primas' })),
  ...['BTCUSD', 'ETHUSD', 'XRPUSD', 'LTCUSD', 'SOLUSD', 'DOGEUSD'].map((s) => ({ s, cat: 'Cripto' })),
];

// Selector con búsqueda; permite escribir uno propio si el broker usa otro nombre.
function InstrumentPicker({ value, onChange, es }: any) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = INSTRUMENTS.filter((i) => !q || i.s.toLowerCase().includes(q.toLowerCase()) || i.cat.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ position: 'relative' }}>
      <input value={open ? q : value} onFocus={() => { setOpen(true); setQ(''); }} onChange={(e) => { setQ(e.target.value); onChange(e.target.value.toUpperCase()); }} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={es ? 'Busca: XAUUSD, US30, BTCUSD…' : 'Search: XAUUSD, US30, BTCUSD…'} style={inp} />
      {open && (
        <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
          {!list.length && <div className="muted" style={{ fontSize: 12.5, padding: 10 }}>{es ? 'Escribe tu instrumento (se acepta cualquiera).' : 'Type your instrument (any accepted).'}</div>}
          {list.map((i) => (
            <button key={i.s} onMouseDown={(e) => { e.preventDefault(); onChange(i.s); setOpen(false); }} style={{ display: 'flex', width: '100%', textAlign: 'left', gap: 8, alignItems: 'center', padding: '8px 11px', border: 'none', background: value === i.s ? 'color-mix(in srgb,var(--brand) 14%,transparent)' : 'transparent', color: 'var(--tx)', cursor: 'pointer' }}>
              <b style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}>{i.s}</b>
              <span className="muted" style={{ fontSize: 11 }}>{i.cat}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }
