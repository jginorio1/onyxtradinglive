// ============================================================
// Onyx Bot Factory · Analizador de datos en Web Worker
//  · Lee el archivo COMPLETO fuera del hilo principal (no congela la UI y
//    sobrevive a cambiar de pestaña).
//  · Calcula métricas de calidad + rango de fechas REAL (primer y último tick)
//    y bucketea a barras OHLC reutilizables (biblioteca de datos).
//  · Autodetecta símbolo, ticks vs barras y años desde/hasta.
// ============================================================

// Los precios/tiempos vienen en arreglos TIPADOS (menos memoria). Se indexan igual
// que arreglos normales; solo al serializar a JSON hay que pasar por barsToJSON().
type NumArr = number[] | Float64Array | Float32Array;
export type ColumnarBars = { tf: number; digits: number; t: NumArr; o: NumArr; h: NumArr; l: NumArr; c: NumArr };

// Convierte las barras columnar (arreglos tipados) a objeto plano serializable a JSON.
export function barsToJSON(b: ColumnarBars): string {
  const arr = (x: NumArr) => Array.from(x as any);
  return JSON.stringify({ tf: b.tf, digits: b.digits, t: arr(b.t), o: arr(b.o), h: arr(b.h), l: arr(b.l), c: arr(b.c) });
}
export type AnalyzeResult = { metrics: any; bars: ColumnarBars };

// El worker es autónomo (no importa módulos): todo su código va en este string.
const WORKER_SRC = `
function toMs(dateStr, timeStr){
  var ds=(dateStr||'').trim().replace(/\\./g,'-').replace(/\\//g,'-');
  var p=ds.split('-').map(function(x){return parseInt(x,10);});
  var y,mo,d;
  if(String(dateStr).slice(0,4).length===4 && p[0]>1900){ y=p[0]; mo=p[1]; d=p[2]; }
  else { y=p[2]; mo=p[1]; d=p[0]; }
  var hh=0,mi=0,ss=0,ms=0;
  if(timeStr){ var t=timeStr.trim().split(':'); hh=parseInt(t[0],10)||0; mi=parseInt(t[1],10)||0;
    if(t[2]){ var sp=t[2].split('.'); ss=parseInt(sp[0],10)||0; ms=sp[1]?Math.round(parseFloat('0.'+sp[1])*1000):0; } }
  var v=Date.UTC(y,(mo||1)-1,d||1,hh,mi,ss,ms);
  return isNaN(v)?NaN:v;
}

self.onmessage=function(e){
  var file=e.data.file, tfMin=e.data.tfMin||15, capBars=e.data.capBars||3000000;
  run(file, tfMin, capBars).then(function(r){ self.postMessage({type:'done',metrics:r.metrics,bars:r.bars}, r._transfer||[]); })
    .catch(function(err){ self.postMessage({type:'error',message:String(err&&err.message||err)}); });
};

async function run(file, tfMin, capBars){
  var total=file.size||1, read=0, lastProg=0, lastPost=0;
  var reader=file.stream().getReader(); var dec=new TextDecoder('utf-8'); var buf='';
  var cfg=null, delim=',', hasTicks=false;
  var rows=0, outOfOrder=0, duplicates=0, gaps=0, anomalies=0, spreadZero=0, spreadSum=0, spreadN=0, digits=5, gotDigits=false;
  var prevTs=NaN, prevPrice=NaN, fromMs=NaN, toMs2=NaN;
  var bucketMs=tfMin*60000;
  // Barras en arreglos TIPADOS (mucho menos memoria que arreglos JS: evita que el
  // navegador recargue la pestaña por "memoria excesiva" con archivos grandes).
  // Tiempo en Float64 (ms), precios en Float32 (7 cifras significativas: sobra para FX/índices).
  var cap0=65536;
  var bt=new Float64Array(cap0), bo=new Float32Array(cap0), bh=new Float32Array(cap0), bl=new Float32Array(cap0), bc=new Float32Array(cap0);
  var bn=0; var curKey=-1; var barsCapped=false;
  function grow(){ if(bn<bt.length) return; var nc=bt.length*2;
    var nt=new Float64Array(nc); nt.set(bt); bt=nt;
    var a=new Float32Array(nc); a.set(bo); bo=a; var b2=new Float32Array(nc); b2.set(bh); bh=b2;
    var c2=new Float32Array(nc); c2.set(bl); bl=c2; var d2=new Float32Array(nc); d2.set(bc); bc=d2; }

  function handle(ln){
    if(!ln) return;
    if(cfg===null){
      delim=[',','\\t',';'].map(function(d){return {d:d,n:ln.split(d).length};}).sort(function(a,b){return b.n-a.n;})[0].d;
      var isHeader=/[a-zA-Z]{3,}/.test(ln) && !/^\\d{4}[.\\-\\/]\\d{1,2}[.\\-\\/]\\d{1,2}/.test(ln);
      cfg={dt:-1,date:-1,time:-1,bid:-1,ask:-1,close:-1,hi:-1,lo:-1,open:-1};
      if(isHeader){
        var h=ln.split(delim).map(function(s){return s.trim().toLowerCase();});
        h.forEach(function(c,idx){
          if(cfg.bid<0 && /\\bbid\\b/.test(c)) cfg.bid=idx;
          else if(cfg.ask<0 && /\\bask\\b/.test(c)) cfg.ask=idx;
          else if(cfg.open<0 && /\\bopen\\b/.test(c)) cfg.open=idx;
          else if(cfg.close<0 && /close/.test(c)) cfg.close=idx;
          else if(cfg.hi<0 && /high/.test(c)) cfg.hi=idx;
          else if(cfg.lo<0 && /low/.test(c)) cfg.lo=idx;
          if(cfg.dt<0 && /(gmt|timestamp|datetime|date time)/.test(c)) cfg.dt=idx;
          else if(cfg.date<0 && /date|fecha/.test(c) && !/update/.test(c)) cfg.date=idx;
          else if(cfg.time<0 && /time|hora/.test(c)) cfg.time=idx;
        });
        hasTicks=cfg.bid>=0 && cfg.ask>=0;
        return;
      }
      var t=ln.split(delim); var dateHasTime=/\\d{2}:\\d{2}/.test(t[0]);
      cfg.dt=dateHasTime?0:-1; cfg.date=dateHasTime?-1:0; cfg.time=dateHasTime?-1:1;
      var off=dateHasTime?1:2; var nums=t.slice(off).filter(function(x){return x!=='' && !isNaN(parseFloat(x));});
      if(nums.length>=4){ cfg.open=off; cfg.hi=off+1; cfg.lo=off+2; cfg.close=off+3; }
      else if(nums.length>=2){ cfg.bid=off; cfg.ask=off+1; }
      else cfg.close=off;
      hasTicks=cfg.bid>=0 && cfg.ask>=0;
    }
    var c=ln.split(delim); if(c.length<2) return;
    var ts;
    if(cfg.dt>=0){ var dv=(c[cfg.dt]||'').trim(); var sp=dv.split(/\\s+/); ts=toMs(sp[0],sp[1]); }
    else ts=toMs(c[cfg.date], cfg.time>=0?c[cfg.time]:undefined);
    if(isNaN(ts)) return;
    var bid=NaN,ask=NaN,price=NaN,pO,pH,pL,pC;
    if(hasTicks){ bid=parseFloat(c[cfg.bid]); ask=parseFloat(c[cfg.ask]); price=(bid+ask)/2; pO=price; pH=price; pL=price; pC=price; }
    else { pC=cfg.close>=0?parseFloat(c[cfg.close]):NaN; if(isNaN(pC)) return; price=pC; pH=cfg.hi>=0?parseFloat(c[cfg.hi]):pC; pL=cfg.lo>=0?parseFloat(c[cfg.lo]):pC; pO=cfg.open>=0?parseFloat(c[cfg.open]):pC; }
    if(isNaN(price)) return;
    if(!gotDigits && hasTicks && c[cfg.bid]){ var dot=c[cfg.bid].indexOf('.'); digits=dot>=0?(c[cfg.bid].trim().length-dot-1):0; gotDigits=true; }
    else if(!gotDigits && !hasTicks && cfg.close>=0 && c[cfg.close]){ var d2=c[cfg.close].indexOf('.'); digits=d2>=0?(c[cfg.close].trim().length-d2-1):0; gotDigits=true; }
    rows++;
    if(isNaN(fromMs)) fromMs=ts;
    toMs2=ts;
    if(!isNaN(prevTs)){
      if(ts<prevTs) outOfOrder++;
      else if(ts===prevTs) duplicates++;
      else { var dt=ts-prevTs; if(dt>21600000){ var wd=new Date(prevTs).getUTCDay(); if(!(wd===5||wd===6)) gaps++; } }
    }
    if(!isNaN(prevPrice) && prevPrice>0 && Math.abs(price-prevPrice)/prevPrice>0.2) anomalies++;
    if(hasTicks){ var spd=ask-bid; if(spd<=0) spreadZero++; else { spreadSum+=spd; spreadN++; } }
    prevTs=ts; prevPrice=price;
    // Bucketeo a OHLC reutilizable.
    if(!barsCapped){
      var key=Math.floor(ts/bucketMs)*bucketMs;
      if(key!==curKey){ curKey=key; grow(); bt[bn]=key; bo[bn]=pO; bh[bn]=pH; bl[bn]=pL; bc[bn]=pC; bn++; if(bn>=capBars) barsCapped=true; }
      else { var i=bn-1; if(pH>bh[i]) bh[i]=pH; if(pL<bl[i]) bl[i]=pL; bc[i]=pC; }
    }
  }
  function flush(final){
    var idx;
    while((idx=buf.indexOf('\\n'))>=0){ var line=buf.slice(0,idx); buf=buf.slice(idx+1); handle(line.charCodeAt(line.length-1)===13?line.slice(0,-1):line); }
    if(final && buf){ handle(buf.charCodeAt(buf.length-1)===13?buf.slice(0,-1):buf); buf=''; }
  }
  while(true){
    var res=await reader.read();
    if(res.done) break;
    read += res.value.byteLength||res.value.length||0;
    buf += dec.decode(res.value,{stream:true});
    flush(false);
    var p=read/total; var now=Date.now();
    // Emite progreso al avanzar 0.8% o cada 2 s (latido/heartbeat: así se sabe que sigue vivo).
    if(p-lastProg>0.008 || now-lastPost>2000){ lastProg=p; lastPost=now; self.postMessage({type:'progress',p:p,read:read,rows:rows}); }
  }
  buf += dec.decode(); flush(true);
  self.postMessage({type:'progress',p:1});

  // Recorta a la longitud exacta (libera la sobre-reserva) y redondea precios.
  bt=bt.slice(0,bn); bo=bo.slice(0,bn); bh=bh.slice(0,bn); bl=bl.slice(0,bn); bc=bc.slice(0,bn);
  var f=Math.pow(10,digits);
  for(var k=0;k<bn;k++){ bo[k]=Math.round(bo[k]*f)/f; bh[k]=Math.round(bh[k]*f)/f; bl[k]=Math.round(bl[k]*f)/f; bc[k]=Math.round(bc[k]*f)/f; }

  var spreadAvgPts=spreadN?(spreadSum/spreadN)*Math.pow(10,digits):0;
  var metrics={ rows:rows, parsed:rows>0,
    fromMs:isNaN(fromMs)?undefined:fromMs, toMs:isNaN(toMs2)?undefined:toMs2,
    outOfOrder:outOfOrder, duplicates:duplicates, gaps:gaps, anomalies:anomalies,
    hasTicks:hasTicks, spreadAvgPts:Math.round(spreadAvgPts), spreadZero:spreadZero,
    truncated:barsCapped, barsCount:bn, digits:digits };
  var bars={ tf:tfMin, digits:digits, t:bt, o:bo, h:bh, l:bl, c:bc };
  // Devuelve los buffers por TRANSFERENCIA (no se copian): evita duplicar memoria al terminar.
  return { metrics:metrics, bars:bars, _transfer:[bt.buffer,bo.buffer,bh.buffer,bl.buffer,bc.buffer] };
}
`;

let _url: string | null = null;
function workerUrl(): string {
  if (!_url) _url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' }));
  return _url;
}

// Analiza un archivo en un Web Worker. Devuelve métricas + barras columnar.
// El worker sigue vivo aunque cambies de pestaña dentro de la app; el resultado
// se entrega al terminar. `onProgress` recibe 0..1.
export function analyzeInWorker(
  file: File,
  opts: { tfMin?: number; onProgress?: (p: number) => void } = {}
): { promise: Promise<AnalyzeResult>; cancel: () => void } {
  const w = new Worker(workerUrl());
  let done = false;
  const promise = new Promise<AnalyzeResult>((resolve, reject) => {
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data || {};
      if (m.type === 'progress') { opts.onProgress?.(Math.max(0, Math.min(1, m.p))); return; }
      if (m.type === 'done') { done = true; resolve({ metrics: m.metrics, bars: m.bars }); w.terminate(); return; }
      if (m.type === 'error') { done = true; reject(new Error(m.message || 'error al analizar')); w.terminate(); return; }
    };
    w.onerror = (ev) => { if (!done) { reject(new Error(ev.message || 'error del worker')); } };
  });
  w.postMessage({ file, tfMin: opts.tfMin || 15, capBars: 3000000 });
  return { promise, cancel: () => { try { w.terminate(); } catch {} } };
}

// ============================================================
// Store GLOBAL del análisis (vive fuera de React).
// Así el análisis NO se detiene al cambiar de pestaña ni de sección del panel;
// solo un refresh completo del navegador lo reinicia (no se puede conservar un
// archivo local tras recargar la página).
// ============================================================
export type LogEvent = { t: number; kind: 'info' | 'ok' | 'warn' | 'error'; msg: string };
export type AnalysisState = {
  busy: boolean; prog: number; fileName: string; symbol: string; fileSize: number;
  source: string; broker: string; metrics: any; q: any; bars: ColumnarBars | null; file: File | null; error: string | null;
  // Telemetría del análisis (registro/bitácora + tiempos).
  startedAt: number; updatedAt: number; bytesRead: number; rows: number; stalled: boolean; interrupted: boolean; runId: string;
  log: LogEvent[];
};
const EMPTY: AnalysisState = {
  busy: false, prog: 0, fileName: '', symbol: '', fileSize: 0, source: 'dukascopy', broker: '', metrics: null, q: null, bars: null, file: null, error: null,
  startedAt: 0, updatedAt: 0, bytesRead: 0, rows: 0, stalled: false, interrupted: false, runId: '', log: [],
};
let _state: AnalysisState = { ...EMPTY };
let _worker: Worker | null = null;
const _subs = new Set<() => void>();
function _emit() { _subs.forEach((f) => { try { f(); } catch {} }); }

// ---- Persistencia de la bitácora (sobrevive a recargas / entrada por PIN) ----
const LS_KEY = 'onyx_analysis_run';       // corrida actual (con la bitácora completa)
const LS_HIST = 'onyx_analysis_history';   // últimas corridas terminadas/interrumpidas
let _lastSave = 0;
function _persist(force = false) {
  if (typeof localStorage === 'undefined') return;
  const now = Date.now(); if (!force && now - _lastSave < 1500) return; _lastSave = now;
  try {
    const snap = { busy: _state.busy, prog: _state.prog, fileName: _state.fileName, symbol: _state.symbol, fileSize: _state.fileSize, source: _state.source, broker: _state.broker, startedAt: _state.startedAt, updatedAt: _state.updatedAt, bytesRead: _state.bytesRead, rows: _state.rows, error: _state.error, runId: _state.runId, log: _state.log.slice(-60), metrics: _state.metrics };
    localStorage.setItem(LS_KEY, JSON.stringify(snap));
  } catch {}
}
function _archive() {
  if (typeof localStorage === 'undefined') return;
  try {
    const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
    hist.unshift({ fileName: _state.fileName, symbol: _state.symbol, fileSize: _state.fileSize, startedAt: _state.startedAt, endedAt: Date.now(), bytesRead: _state.bytesRead, rows: _state.rows, prog: _state.prog, error: _state.error, interrupted: _state.interrupted, log: _state.log.slice(-60) });
    localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 10)));
  } catch {}
}
export function logEvent(kind: LogEvent['kind'], msg: string) {
  _state = { ..._state, log: [..._state.log.slice(-59), { t: Date.now(), kind, msg }] };
  _persist(true); _emit();
}
export function getAnalysisHistory(): any[] { if (typeof localStorage === 'undefined') return []; try { return JSON.parse(localStorage.getItem(LS_HIST) || '[]'); } catch { return []; } }
export function clearAnalysisHistory() { try { localStorage.removeItem(LS_HIST); } catch {} }

// Al cargar el módulo (tras una recarga): recupera la última corrida. Si estaba
// "busy", significa que se interrumpió (recarga / PIN) → deja el contexto visible.
function _restore() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return;
    const s = JSON.parse(raw);
    _state = { ...EMPTY, source: s.source || 'dukascopy', broker: s.broker || '', fileName: s.fileName || '', symbol: s.symbol || '', fileSize: s.fileSize || 0, prog: s.prog || 0, startedAt: s.startedAt || 0, updatedAt: s.updatedAt || 0, bytesRead: s.bytesRead || 0, rows: s.rows || 0, runId: s.runId || '', log: Array.isArray(s.log) ? s.log : [], metrics: s.busy ? null : s.metrics || null };
    if (s.busy) {
      _state.interrupted = true; _state.error = 'interrumpido';
      _state.log = [..._state.log, { t: Date.now(), kind: 'error', msg: 'Análisis detenido por recarga de la página (PIN o refresco). El archivo local no se conserva; hay que volver a seleccionarlo.' }];
      _persist(true);
    }
  } catch {}
}
_restore();

// ---- Vigilante de estancamiento (la pestaña en segundo plano congela el worker) ----
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (_state.busy && _state.updatedAt && Date.now() - _state.updatedAt > 25000 && !_state.stalled) {
      _state = { ..._state, stalled: true, log: [..._state.log.slice(-59), { t: Date.now(), kind: 'warn', msg: 'Sin avance por más de 25 s. Si dejaste la pestaña en segundo plano, el navegador la congela; vuelve a esta pestaña para que continúe.' }] };
      _persist(true); _emit();
    }
  }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (!_state.busy) return;
    logEvent(document.hidden ? 'warn' : 'info', document.hidden ? 'Pestaña en segundo plano — el análisis puede frenarse hasta que vuelvas.' : 'Pestaña en primer plano — el análisis continúa.');
  });
  window.addEventListener('beforeunload', () => { if (_state.busy) { _state.error = 'interrumpido'; _persist(true); } });
}

export function subscribeAnalysis(fn: () => void): () => void { _subs.add(fn); return () => { _subs.delete(fn); }; }
export function getAnalysis(): AnalysisState { return _state; }
export function patchAnalysis(p: Partial<AnalysisState>) { _state = { ..._state, ...p }; _emit(); }

function _fmtMB(b: number) { return (b / 1048576).toFixed(0) + ' MB'; }

// Arranca el análisis del archivo en un Web Worker persistente.
export function startAnalysis(file: File, opts: { tfMin?: number } = {}) {
  if (_worker) { try { _worker.terminate(); } catch {} _worker = null; }
  const now = Date.now();
  const runId = 'run_' + now.toString(36);
  _state = { ..._state, busy: true, prog: 0, fileName: file.name, symbol: guessSymbol(file.name) || '', fileSize: file.size, metrics: null, q: null, bars: null, file, error: null, startedAt: now, updatedAt: now, bytesRead: 0, rows: 0, stalled: false, interrupted: false, runId, log: [{ t: now, kind: 'info', msg: 'Análisis iniciado · ' + file.name + ' · ' + _fmtMB(file.size) }] };
  if (file.size > 2 * 1024 * 1024 * 1024) _state.log.push({ t: now, kind: 'warn', msg: 'Archivo muy grande (' + _fmtMB(file.size) + '). El navegador puede quedarse sin memoria y recargar. Recomendado: divide el archivo por años o usa un rango más corto.' });
  if (/duka/i.test(file.name)) _state.source = 'dukascopy';
  _persist(true); _emit();
  const w = new Worker(workerUrl());
  _worker = w;
  w.onmessage = (ev: MessageEvent) => {
    const m = ev.data || {};
    if (m.type === 'progress') {
      _state = { ..._state, prog: Math.max(0, Math.min(1, m.p)), updatedAt: Date.now(), bytesRead: m.read || _state.bytesRead, rows: m.rows || _state.rows, stalled: false };
      _persist(); _emit(); return;
    }
    if (m.type === 'done') {
      _state = { ..._state, busy: false, prog: 1, metrics: m.metrics, bars: m.bars, updatedAt: Date.now(), rows: m.metrics?.rows || _state.rows, stalled: false, log: [..._state.log.slice(-59), { t: Date.now(), kind: 'ok', msg: 'Análisis completado · ' + (m.metrics?.rows || 0).toLocaleString('en-US') + ' filas · ' + (m.metrics?.barsCount || 0).toLocaleString('en-US') + ' barras' }] };
      _archive(); _persist(true); _emit(); try { w.terminate(); } catch {} if (_worker === w) _worker = null; return;
    }
    if (m.type === 'error') {
      _state = { ..._state, busy: false, error: m.message || 'error', log: [..._state.log.slice(-59), { t: Date.now(), kind: 'error', msg: 'Error: ' + (m.message || 'desconocido') }] };
      _archive(); _persist(true); _emit(); try { w.terminate(); } catch {} if (_worker === w) _worker = null; return;
    }
  };
  w.onerror = (ev) => { if (_state.busy) { _state = { ..._state, busy: false, error: ev.message || 'error del worker', log: [..._state.log.slice(-59), { t: Date.now(), kind: 'error', msg: 'Error del worker: ' + (ev.message || '') }] }; _archive(); _persist(true); _emit(); } };
  w.postMessage({ file, tfMin: opts.tfMin || 1, capBars: 3000000 });
}

export function resetAnalysis() {
  if (_worker) { try { _worker.terminate(); } catch {} _worker = null; }
  _state = { ...EMPTY, source: _state.source, broker: _state.broker };
  try { localStorage.removeItem(LS_KEY); } catch {}
  _emit();
}

// Reconstituye Bar[] desde el formato columnar (para el motor/lab).
export function barsFromColumnar(b: ColumnarBars): { t: number; o: number; h: number; l: number; c: number }[] {
  const out: any[] = [];
  const n = b.t.length;
  for (let i = 0; i < n; i++) out.push({ t: b.t[i], o: b.o[i], h: b.h[i], l: b.l[i], c: b.c[i] });
  return out;
}

// Autodetección de símbolo a partir del nombre del archivo (Dukascopy, MT, etc.).
const SYMBOL_MAP: Record<string, string> = {
  USA500IDXUSD: 'US500', USATECHIDXUSD: 'NAS100', USA30IDXUSD: 'US30', US30USD: 'US30',
  DEUIDXEUR: 'GER40', GBRIDXGBP: 'UK100', JPNIDXJPY: 'JP225', FRAIDXEUR: 'FRA40',
  DOLLARIDXUSD: 'DXY', GASUSDUSD: 'NGAS', LIGHTCMDUSD: 'USOIL', BRENTCMDUSD: 'UKOIL',
};
export function guessSymbol(name: string): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  const up = base.toUpperCase();
  // Prefijo alfanumérico antes del primer separador (EURUSD_..., XAUUSD-...).
  const m = up.match(/^([A-Z0-9]{3,14}?)[ _\-.]/) || up.match(/^([A-Z]{6})/);
  let sym = m ? m[1] : '';
  if (SYMBOL_MAP[sym]) return SYMBOL_MAP[sym];
  // Limpia sufijos de dígitos de fecha pegados (raro).
  return sym.replace(/\d{6,}$/, '') || sym;
}

// Detecta un rango de años embebido en el nombre (Dukascopy: SYM_YYYYMMDDhhmm_YYYY...).
export function guessYearsFromName(name: string): { from?: number; to?: number } {
  const ys = (name.match(/(19|20)\d{2}/g) || []).map((x) => parseInt(x, 10)).filter((y) => y >= 1990 && y <= 2100);
  if (!ys.length) return {};
  return { from: Math.min(...ys), to: Math.max(...ys) };
}
