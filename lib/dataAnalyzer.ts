// ============================================================
// Onyx Bot Factory · Analizador de datos en Web Worker
//  · Lee el archivo COMPLETO fuera del hilo principal (no congela la UI y
//    sobrevive a cambiar de pestaña).
//  · Calcula métricas de calidad + rango de fechas REAL (primer y último tick)
//    y bucketea a barras OHLC reutilizables (biblioteca de datos).
//  · Autodetecta símbolo, ticks vs barras y años desde/hasta.
// ============================================================

export type ColumnarBars = { tf: number; digits: number; t: number[]; o: number[]; h: number[]; l: number[]; c: number[] };
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
  run(file, tfMin, capBars).then(function(r){ self.postMessage({type:'done',metrics:r.metrics,bars:r.bars}); })
    .catch(function(err){ self.postMessage({type:'error',message:String(err&&err.message||err)}); });
};

async function run(file, tfMin, capBars){
  var total=file.size||1, read=0, lastProg=0;
  var reader=file.stream().getReader(); var dec=new TextDecoder('utf-8'); var buf='';
  var cfg=null, delim=',', hasTicks=false;
  var rows=0, outOfOrder=0, duplicates=0, gaps=0, anomalies=0, spreadZero=0, spreadSum=0, spreadN=0, digits=5, gotDigits=false;
  var prevTs=NaN, prevPrice=NaN, fromMs=NaN, toMs2=NaN;
  var bucketMs=tfMin*60000;
  var bt=[],bo=[],bh=[],bl=[],bc=[]; var curKey=-1; var barsCapped=false;

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
      if(key!==curKey){ curKey=key; bt.push(key); bo.push(pO); bh.push(pH); bl.push(pL); bc.push(pC); if(bt.length>=capBars) barsCapped=true; }
      else { var i=bt.length-1; if(pH>bh[i]) bh[i]=pH; if(pL<bl[i]) bl[i]=pL; bc[i]=pC; }
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
    var p=read/total; if(p-lastProg>0.008){ lastProg=p; self.postMessage({type:'progress',p:p}); }
  }
  buf += dec.decode(); flush(true);
  self.postMessage({type:'progress',p:1});

  // Redondea precios a los dígitos detectados para achicar la biblioteca.
  var f=Math.pow(10,digits);
  for(var k=0;k<bt.length;k++){ bo[k]=Math.round(bo[k]*f)/f; bh[k]=Math.round(bh[k]*f)/f; bl[k]=Math.round(bl[k]*f)/f; bc[k]=Math.round(bc[k]*f)/f; }

  var spreadAvgPts=spreadN?(spreadSum/spreadN)*Math.pow(10,digits):0;
  var metrics={ rows:rows, parsed:rows>0,
    fromMs:isNaN(fromMs)?undefined:fromMs, toMs:isNaN(toMs2)?undefined:toMs2,
    outOfOrder:outOfOrder, duplicates:duplicates, gaps:gaps, anomalies:anomalies,
    hasTicks:hasTicks, spreadAvgPts:Math.round(spreadAvgPts), spreadZero:spreadZero,
    truncated:barsCapped, barsCount:bt.length, digits:digits };
  var bars={ tf:tfMin, digits:digits, t:bt, o:bo, h:bh, l:bl, c:bc };
  return { metrics:metrics, bars:bars };
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
export type AnalysisState = {
  busy: boolean; prog: number; fileName: string; symbol: string; fileSize: number;
  source: string; broker: string; metrics: any; q: any; bars: ColumnarBars | null; file: File | null; error: string | null;
};
const EMPTY: AnalysisState = { busy: false, prog: 0, fileName: '', symbol: '', fileSize: 0, source: 'dukascopy', broker: '', metrics: null, q: null, bars: null, file: null, error: null };
let _state: AnalysisState = { ...EMPTY };
let _worker: Worker | null = null;
const _subs = new Set<() => void>();
function _emit() { _subs.forEach((f) => { try { f(); } catch {} }); }

export function subscribeAnalysis(fn: () => void): () => void { _subs.add(fn); return () => { _subs.delete(fn); }; }
export function getAnalysis(): AnalysisState { return _state; }
export function patchAnalysis(p: Partial<AnalysisState>) { _state = { ..._state, ...p }; _emit(); }

// Arranca el análisis del archivo en un Web Worker persistente.
export function startAnalysis(file: File, opts: { tfMin?: number } = {}) {
  if (_worker) { try { _worker.terminate(); } catch {} _worker = null; }
  _state = { ..._state, busy: true, prog: 0, fileName: file.name, symbol: guessSymbol(file.name) || '', fileSize: file.size, metrics: null, q: null, bars: null, file, error: null };
  if (/duka/i.test(file.name)) _state.source = 'dukascopy';
  _emit();
  const w = new Worker(workerUrl());
  _worker = w;
  w.onmessage = (ev: MessageEvent) => {
    const m = ev.data || {};
    if (m.type === 'progress') { _state = { ..._state, prog: Math.max(0, Math.min(1, m.p)) }; _emit(); return; }
    if (m.type === 'done') { _state = { ..._state, busy: false, prog: 1, metrics: m.metrics, bars: m.bars }; _emit(); try { w.terminate(); } catch {} if (_worker === w) _worker = null; return; }
    if (m.type === 'error') { _state = { ..._state, busy: false, error: m.message || 'error' }; _emit(); try { w.terminate(); } catch {} if (_worker === w) _worker = null; return; }
  };
  w.onerror = (ev) => { if (_state.busy) { _state = { ..._state, busy: false, error: ev.message || 'error del worker' }; _emit(); } };
  w.postMessage({ file, tfMin: opts.tfMin || 1, capBars: 3000000 });
}

export function resetAnalysis() {
  if (_worker) { try { _worker.terminate(); } catch {} _worker = null; }
  _state = { ...EMPTY, source: _state.source, broker: _state.broker };
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
