'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { errMsg } from '@/lib/i18nErrors';

type TT = { id: string; account_id: string; symbol: string; side: string; volume: number; open_time: string | null; close_time: string; net_profit: number; commission?: number; swap?: number; profit?: number };
type Entry = { trade_id: string; notes: string | null; tags: string[] | null; emotion: string | null; image_url: string | null };
type Lang = 'es' | 'en';

const GREEN = '#34e2a0', RED = '#ff6b7d', BLUE = '#7c8cff';
const STRATS = ['Turtle Soup', 'ORB', 'Breakout', 'Reversal', 'Trend', 'News', 'Scalp', 'Swing'];

function money2(n: number) {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const J = {
  es: {
    lotTitle: '📦 Estadísticas de lotaje', volToday: 'Hoy', volWeek: 'Semana', volMonth: 'Mes', volYear: 'Año', volTotal: 'Total', lots: 'lotes', byPair: 'Volumen por par',
    heat: '🔥 Mapa de calor (día × hora)', heatNote: 'Verde = ganancia · Rojo = pérdida · intensidad = tamaño',
    trades: '📋 Operaciones', filters: 'Filtros', all: 'Todos', longs: 'Largos', shorts: 'Cortos', wins: 'Ganadoras', losses: 'Perdedoras',
    from: 'Desde', to: 'Hasta', pair: 'Par', side: 'Lado', result: 'Resultado', tag: 'Etiqueta', clear: 'Limpiar', export: '⬇ Exportar CSV',
    thDate: 'Fecha', thPair: 'Par', thSide: 'Lado', thLots: 'Lotes', thGross: 'Bruto', thNet: 'Neto', thNote: 'Diario', noTrades: 'Sin operaciones con esos filtros.', showing: 'Mostrando',
    mTitle: 'Operación', mLots: 'Lotaje', mOpen: 'Apertura', mClose: 'Cierre', mNet: 'Neto', mComm: 'Comisión', mSwap: 'Swap',
    photo: 'Foto de la operación', upload: '⬆ Subir foto', uploading: 'Subiendo…', replace: 'Cambiar foto', notes: 'Notas', notesPh: '¿Qué pasó en este trade? ¿Por qué entraste? ¿Qué aprendiste?',
    strat: 'Estrategia / setup', emotion: 'Emoción', save: 'Guardar', saved: '✓ Guardado', close: 'Cerrar', hasNote: '📝',
    emotions: ['Disciplinado', 'FOMO', 'Revancha', 'Miedo', 'Confiado', 'Impaciente', 'Dudas'],
  },
  en: {
    lotTitle: '📦 Lot statistics', volToday: 'Today', volWeek: 'Week', volMonth: 'Month', volYear: 'Year', volTotal: 'Total', lots: 'lots', byPair: 'Volume by pair',
    heat: '🔥 Heatmap (day × hour)', heatNote: 'Green = profit · Red = loss · intensity = size',
    trades: '📋 Trades', filters: 'Filters', all: 'All', longs: 'Longs', shorts: 'Shorts', wins: 'Winners', losses: 'Losers',
    from: 'From', to: 'To', pair: 'Pair', side: 'Side', result: 'Result', tag: 'Tag', clear: 'Clear', export: '⬇ Export CSV',
    thDate: 'Date', thPair: 'Pair', thSide: 'Side', thLots: 'Lots', thGross: 'Gross', thNet: 'Net', thNote: 'Journal', noTrades: 'No trades with those filters.', showing: 'Showing',
    mTitle: 'Trade', mLots: 'Lot size', mOpen: 'Open', mClose: 'Close', mNet: 'Net', mComm: 'Commission', mSwap: 'Swap',
    photo: 'Trade screenshot', upload: '⬆ Upload photo', uploading: 'Uploading…', replace: 'Replace photo', notes: 'Notes', notesPh: 'What happened in this trade? Why did you enter? What did you learn?',
    strat: 'Strategy / setup', emotion: 'Emotion', save: 'Save', saved: '✓ Saved', close: 'Close', hasNote: '📝',
    emotions: ['Disciplined', 'FOMO', 'Revenge', 'Fear', 'Confident', 'Impatient', 'Doubt'],
  },
};

export default function Journal({ trades, lang }: { trades: TT[]; lang: Lang }) {
  const t = J[lang];
  const WD = lang === 'es' ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [open, setOpen] = useState<TT | null>(null);

  // filtros
  const [fSym, setFSym] = useState('all');
  const [fSide, setFSide] = useState('all');
  const [fRes, setFRes] = useState('all');
  const [fTag, setFTag] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  useEffect(() => {
    fetch('/api/journal').then((r) => r.json()).then((j) => {
      const m: Record<string, Entry> = {};
      (j.entries || []).forEach((e: Entry) => { m[e.trade_id] = e; });
      setEntries(m);
    }).catch(() => {});
  }, []);

  const symbols = useMemo(() => Array.from(new Set(trades.map((x) => x.symbol))).sort(), [trades]);
  const allTags = useMemo(() => { const s = new Set<string>(); Object.values(entries).forEach((e) => (e.tags || []).forEach((x) => s.add(x))); return Array.from(s).sort(); }, [entries]);

  const view = useMemo(() => trades.filter((x) => {
    if (fSym !== 'all' && x.symbol !== fSym) return false;
    if (fSide !== 'all' && (x.side === 'buy' ? 'buy' : 'sell') !== fSide) return false;
    if (fRes === 'win' && +x.net_profit < 0) return false;
    if (fRes === 'loss' && +x.net_profit >= 0) return false;
    if (fTag !== 'all' && !((entries[x.id]?.tags) || []).includes(fTag)) return false;
    const d = x.close_time.slice(0, 10);
    if (fFrom && d < fFrom) return false;
    if (fTo && d > fTo) return false;
    return true;
  }), [trades, fSym, fSide, fRes, fTag, fFrom, fTo, entries]);

  // estadísticas de lotaje
  const now = new Date();
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), day = now.getUTCDate();
  const weekAgo = new Date(Date.UTC(y, mo, day - 6)).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  const lot = useMemo(() => {
    let today = 0, week = 0, month = 0, year = 0, total = 0; const byPair: Record<string, number> = {};
    for (const x of trades) {
      const v = Math.abs(+x.volume || 0); const d = x.close_time.slice(0, 10); const dt = new Date(x.close_time);
      total += v; byPair[x.symbol] = (byPair[x.symbol] || 0) + v;
      if (d === todayStr) today += v;
      if (d >= weekAgo) week += v;
      if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo) month += v;
      if (dt.getUTCFullYear() === y) year += v;
    }
    const pairs = Object.entries(byPair).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxP = Math.max(1, ...pairs.map(([, v]) => v));
    return { today, week, month, year, total, pairs, maxP };
  }, [trades]);

  // heatmap día × hora
  const heat = useMemo(() => {
    const g: Record<string, { net: number; count: number }> = {};
    let max = 1;
    for (const x of trades) {
      const dt = new Date(x.open_time || x.close_time);
      const wd = (dt.getUTCDay() + 6) % 7; const h = dt.getUTCHours();
      const key = wd + '-' + h; if (!g[key]) g[key] = { net: 0, count: 0 };
      g[key].net += +x.net_profit || 0; g[key].count++;
      if (Math.abs(g[key].net) > max) max = Math.abs(g[key].net);
    }
    return { g, max };
  }, [trades]);

  function exportCSV() {
    const head = ['fecha', 'par', 'lado', 'lotes', 'neto', 'etiquetas', 'emocion', 'notas'];
    const lines = view.map((x) => {
      const e = entries[x.id];
      const cell = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
      return [x.close_time.slice(0, 16).replace('T', ' '), x.symbol, x.side, (+x.volume).toFixed(2), (+x.net_profit).toFixed(2), (e?.tags || []).join(' / '), e?.emotion || '', (e?.notes || '').replace(/\n/g, ' ')].map(cell).join(',');
    });
    const csv = head.join(',') + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'onyx_operaciones.csv'; a.click();
  }

  const inp = { margin: 0, padding: '7px 9px', width: 'auto', fontSize: 13 } as any;
  const box = { background: 'var(--bg2)', borderRadius: 12, padding: 14, textAlign: 'center' as const };

  return (
    <>
      {/* Lotaje */}
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>{t.lotTitle}</h3>
        <div className="grid g4" style={{ marginBottom: 8 }}>
          {[[t.volToday, lot.today], [t.volWeek, lot.week], [t.volMonth, lot.month], [t.volYear, lot.year]].map(([l, v], i) => (
            <div key={i} style={box}><div className="muted" style={{ fontSize: 12 }}>{l as string}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{(v as number).toFixed(2)}</div><div className="muted" style={{ fontSize: 11 }}>{t.lots}</div></div>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12, margin: '14px 0 8px' }}>{t.byPair} · {t.volTotal}: <b style={{ color: 'var(--tx)' }}>{lot.total.toFixed(2)} {t.lots}</b></div>
        {lot.pairs.map(([sym, v]) => (
          <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <div style={{ width: 84, fontSize: 13 }}>{sym}</div>
            <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, height: 18, overflow: 'hidden' }}><div style={{ width: `${Math.max(4, (v / lot.maxP) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#7c8cff,#b98bff)' }} /></div>
            <div style={{ width: 70, textAlign: 'right', fontSize: 12, color: 'var(--mut)' }}>{v.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}><h3>{t.heat}</h3></div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.heatNote}</p>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(24, 1fr)', gap: 3, minWidth: 640 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => <div key={h} style={{ fontSize: 9, color: 'var(--mut)', textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</div>)}
            {WD.map((wd, wi) => (
              <Fragment key={wi}>
                <div style={{ fontSize: 11, color: 'var(--mut)', display: 'flex', alignItems: 'center' }}>{wd}</div>
                {Array.from({ length: 24 }, (_, h) => { const c = heat.g[wi + '-' + h]; const net = c?.net || 0; const inten = c ? Math.min(1, Math.abs(net) / heat.max) : 0; const bg = !c ? 'var(--bg2)' : net >= 0 ? `rgba(52,226,160,${.15 + inten * .7})` : `rgba(255,107,125,${.15 + inten * .7})`; return <div key={wi + '-' + h} title={c ? `${wd} ${h}:00 · ${money2(net)} · ${c.count}` : ''} style={{ height: 20, borderRadius: 3, background: bg }} />; })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Operaciones + filtros */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3>{t.trades} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· {t.showing} {view.length}</span></h3>
          <button className="btn btn-ghost" onClick={exportCSV}>{t.export}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <select value={fSym} onChange={(e) => setFSym(e.target.value)} style={inp}><option value="all">{t.pair}: {t.all}</option>{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select value={fSide} onChange={(e) => setFSide(e.target.value)} style={inp}><option value="all">{t.side}: {t.all}</option><option value="buy">{t.longs}</option><option value="sell">{t.shorts}</option></select>
          <select value={fRes} onChange={(e) => setFRes(e.target.value)} style={inp}><option value="all">{t.result}: {t.all}</option><option value="win">{t.wins}</option><option value="loss">{t.losses}</option></select>
          {allTags.length > 0 && <select value={fTag} onChange={(e) => setFTag(e.target.value)} style={inp}><option value="all">{t.tag}: {t.all}</option>{allTags.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} style={inp} title={t.from} />
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} style={inp} title={t.to} />
          <button className="btn btn-ghost" style={inp} onClick={() => { setFSym('all'); setFSide('all'); setFRes('all'); setFTag('all'); setFFrom(''); setFTo(''); }}>{t.clear}</button>
        </div>
        {view.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>{t.thDate}</th><th>{t.thPair}</th><th>{t.thSide}</th><th style={{ textAlign: 'right' }}>{t.thLots}</th><th style={{ textAlign: 'right' }}>{t.thGross}</th><th style={{ textAlign: 'right' }}>{t.thNet}</th><th style={{ textAlign: 'center' }}>{t.thNote}</th></tr></thead>
              <tbody>
                {view.slice(0, 300).map((x) => { const e = entries[x.id]; const has = e && (e.notes || e.image_url || (e.tags && e.tags.length)); return (
                  <tr key={x.id} onClick={() => setOpen(x)} style={{ cursor: 'pointer' }}>
                    <td className="muted" style={{ fontSize: 13 }}>{x.close_time.slice(0, 16).replace('T', ' ')}</td>
                    <td>{x.symbol}</td>
                    <td className="muted">{x.side}</td>
                    <td style={{ textAlign: 'right' }}>{(+x.volume).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }} className={+(x.profit ?? x.net_profit) >= 0 ? 'pos' : 'neg'}>{money2(+(x.profit ?? x.net_profit))}</td>
                    <td style={{ textAlign: 'right' }} className={+x.net_profit >= 0 ? 'pos' : 'neg'}>{money2(+x.net_profit)}</td>
                    <td style={{ textAlign: 'center' }}>{has ? (e.image_url ? '🖼️' : t.hasNote) : ''}</td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">{t.noTrades}</p>}
      </div>

      {open && <TradeModal trade={open} entry={entries[open.id]} lang={lang} onClose={() => setOpen(null)} onSaved={(e) => setEntries({ ...entries, [open.id]: e })} />}
    </>
  );
}

function TradeModal({ trade, entry, lang, onClose, onSaved }: { trade: TT; entry?: Entry; lang: Lang; onClose: () => void; onSaved: (e: Entry) => void }) {
  const t = J[lang];
  const [notes, setNotes] = useState(entry?.notes || '');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [emotion, setEmotion] = useState(entry?.emotion || '');
  const [img, setImg] = useState(entry?.image_url || '');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleTag = (s: string) => setTags(tags.includes(s) ? tags.filter((x) => x !== s) : [...tags, s]);

  async function upload(f: File) {
    setUploading(true);
    const fd = new FormData(); fd.append('file', f); fd.append('trade_id', trade.id);
    const r = await fetch('/api/journal/upload', { method: 'POST', body: fd });
    const j = await r.json(); setUploading(false);
    if (j.url) setImg(j.url); else alert(errMsg(j, lang));
  }
  async function save() {
    setSaving(true);
    const body = { trade_id: trade.id, notes, tags, emotion, image_url: img };
    const r = await fetch('/api/journal', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (!r.ok) { const j = await r.json(); alert(errMsg(j, lang)); return; }
    setOk(true); setTimeout(() => setOk(false), 1500);
    onSaved({ trade_id: trade.id, notes, tags, emotion, image_url: img });
  }

  const lbl = { fontSize: 13, color: 'var(--mut)', margin: '14px 0 6px', display: 'block', fontWeight: 600 } as any;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 100, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 560, width: '100%' }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3>{t.mTitle}: {trade.symbol}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="grid g4" style={{ marginBottom: 6 }}>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mLots}</div><b>{(+trade.volume).toFixed(2)}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mNet}</div><b className={+trade.net_profit >= 0 ? 'pos' : 'neg'}>{money2(+trade.net_profit)}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mComm}</div><b className={+(trade.commission || 0) >= 0 ? 'pos' : 'neg'}>{money2(+(trade.commission || 0))}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mSwap}</div><b className={+(trade.swap || 0) >= 0 ? 'pos' : 'neg'}>{money2(+(trade.swap || 0))}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mOpen}</div><b style={{ fontSize: 12 }}>{(trade.open_time || '').slice(0, 16).replace('T', ' ') || '—'}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mClose}</div><b style={{ fontSize: 12 }}>{trade.close_time.slice(0, 16).replace('T', ' ')}</b></div>
        </div>

        <span style={lbl}>{t.photo}</span>
        {img ? <img src={img} alt="trade" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', marginBottom: 8 }} /> : null}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? t.uploading : (img ? t.replace : t.upload)}</button>

        <span style={lbl}>{t.strat}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STRATS.map((s) => <button key={s} onClick={() => toggleTag(s)} style={{ cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontSize: 13, border: '1px solid ' + (tags.includes(s) ? BLUE : 'var(--line)'), background: tags.includes(s) ? 'rgba(124,140,255,.18)' : 'transparent', color: 'var(--tx)' }}>{s}</button>)}
        </div>

        <span style={lbl}>{t.emotion}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {t.emotions.map((s) => <button key={s} onClick={() => setEmotion(emotion === s ? '' : s)} style={{ cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontSize: 13, border: '1px solid ' + (emotion === s ? GREEN : 'var(--line)'), background: emotion === s ? 'rgba(52,226,160,.15)' : 'transparent', color: 'var(--tx)' }}>{s}</button>)}
        </div>

        <span style={lbl}>{t.notes}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder={t.notesPh} style={{ width: '100%', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : (ok ? t.saved : t.save)}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t.close}</button>
        </div>
      </div>
    </div>
  );
}
