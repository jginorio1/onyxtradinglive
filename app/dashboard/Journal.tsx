'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { errMsg } from '@/lib/i18nErrors';
import { StatCard } from './HubVitals';
import OnyxIcon from '@/app/components/OnyxIcon';

type TT = { id: string; account_id: string; symbol: string; side: string; volume: number; open_time: string | null; close_time: string; net_profit: number; commission?: number; swap?: number; profit?: number };
type Entry = { trade_id: string; notes: string | null; tags: string[] | null; emotion: string | null; image_url: string | null; grade?: string | null; plan_followed?: string | null; market_tags?: string[] | null; error_tags?: string[] | null };
type CustomTags = { setups: string[]; emotions: string[]; markets: string[]; errors: string[] };
type Lang = 'es' | 'en';

const GREEN = 'var(--green)', RED = 'var(--red)', BLUE = 'var(--brand)', GOLD = 'var(--gold)', AMBER = 'var(--amber)';
const STRATS = ['Turtle Soup', 'ORB', 'Breakout', 'Reversal', 'Trend', 'News', 'Scalp', 'Swing'];

// ¿La operación está documentada? Basta cualquier dato con sustancia (grado,
// emoción, nota, foto o algún tag). Sirve para la bandeja "sin diario".
function isDocumented(e?: Entry): boolean {
  if (!e) return false;
  return !!(e.grade || e.emotion || (e.notes && e.notes.trim()) || e.image_url
    || (e.tags && e.tags.length) || (e.market_tags && e.market_tags.length) || (e.error_tags && e.error_tags.length));
}

function money2(n: number) {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const J = {
  es: {
    lotTitle: '📦 Estadísticas de lotaje', volToday: 'Hoy', volWeek: 'Semana', volMonth: 'Mes', volYear: 'Año', volTotal: 'Total', lots: 'lotes', byPair: 'Volumen por par',
    heat: '🔥 Mapa de calor (día × hora)', heatNote: 'Verde = ganancia · Rojo = pérdida · intensidad = tamaño',
    trades: '📋 Operaciones', filters: 'Filtros', all: 'Todos', longs: 'Largos', shorts: 'Cortos', wins: 'Ganadoras', losses: 'Perdedoras',
    from: 'Desde', to: 'Hasta', pair: 'Par', side: 'Lado', result: 'Resultado', tag: 'Etiqueta', clear: 'Limpiar', export: 'Exportar CSV',
    thDate: 'Fecha', thPair: 'Par', thSide: 'Lado', thLots: 'Lotes', thGross: 'Bruto', thNet: 'Neto', thNote: 'Diario', noTrades: 'Sin operaciones con esos filtros.', showing: 'Mostrando',
    mTitle: 'Operación', mLots: 'Lotaje', mOpen: 'Apertura', mClose: 'Cierre', mNet: 'Neto', mComm: 'Comisión', mSwap: 'Swap',
    photo: 'Foto de la operación', upload: '⬆ Subir foto', uploading: 'Subiendo…', replace: 'Cambiar foto', notes: 'Notas', notesPh: 'Toca un tema: ¿por qué entraste? · ¿qué harías distinto? · ¿qué salió bien?',
    strat: 'Setup', emotion: 'Emoción', save: 'Guardar', saved: '✓ Guardado', close: 'Cerrar', hasNote: '📝',
    emotions: ['Disciplinado', 'FOMO', 'Revancha', 'Miedo', 'Confiado', 'Impaciente', 'Dudas'],
    markets: ['Tendencia', 'Rango', 'Noticia', 'Volátil', 'Apertura', 'Cierre'],
    errors: ['Entré tarde', 'Moví el SL', 'Sobreoperé', 'Sin plan', 'Cerré antes', 'Riesgo alto'],
    quality: 'Calidad del trade', planQ: '¿Seguiste tu plan?', planYes: 'Sí', planPartial: 'Parcial', planNo: 'No',
    market: 'Condición de mercado', whatFailed: '¿Qué falló?', optional: 'opcional', adapts: 'se adapta a tu estilo',
    add: 'Añadir', addPh: 'Escribe y Enter', minHint: 'Con grado + 1 emoción ya cuenta como documentada',
    undoc: 'Sin diario', pendingTitle: 'operaciones sin diario', pendingSub: 'Documéntalas mientras las recuerdas', docNow: 'Documentar ahora',
    streak: 'Racha', days: 'días', day: 'día',
  },
  en: {
    lotTitle: '📦 Lot statistics', volToday: 'Today', volWeek: 'Week', volMonth: 'Month', volYear: 'Year', volTotal: 'Total', lots: 'lots', byPair: 'Volume by pair',
    heat: '🔥 Heatmap (day × hour)', heatNote: 'Green = profit · Red = loss · intensity = size',
    trades: '📋 Trades', filters: 'Filters', all: 'All', longs: 'Longs', shorts: 'Shorts', wins: 'Winners', losses: 'Losers',
    from: 'From', to: 'To', pair: 'Pair', side: 'Side', result: 'Result', tag: 'Tag', clear: 'Clear', export: 'Export CSV',
    thDate: 'Date', thPair: 'Pair', thSide: 'Side', thLots: 'Lots', thGross: 'Gross', thNet: 'Net', thNote: 'Journal', noTrades: 'No trades with those filters.', showing: 'Showing',
    mTitle: 'Trade', mLots: 'Lot size', mOpen: 'Open', mClose: 'Close', mNet: 'Net', mComm: 'Commission', mSwap: 'Swap',
    photo: 'Trade screenshot', upload: '⬆ Upload photo', uploading: 'Uploading…', replace: 'Replace photo', notes: 'Notes', notesPh: 'Pick a prompt: why did you enter? · what would you change? · what went well?',
    strat: 'Setup', emotion: 'Emotion', save: 'Save', saved: '✓ Saved', close: 'Close', hasNote: '📝',
    emotions: ['Disciplined', 'FOMO', 'Revenge', 'Fear', 'Confident', 'Impatient', 'Doubt'],
    markets: ['Trend', 'Range', 'News', 'Volatile', 'Open', 'Close'],
    errors: ['Entered late', 'Moved SL', 'Overtraded', 'No plan', 'Closed early', 'High risk'],
    quality: 'Trade quality', planQ: 'Did you follow your plan?', planYes: 'Yes', planPartial: 'Partly', planNo: 'No',
    market: 'Market condition', whatFailed: 'What went wrong?', optional: 'optional', adapts: 'adapts to your style',
    add: 'Add', addPh: 'Type and Enter', minHint: 'Grade + 1 emotion already counts as documented',
    undoc: 'No journal', pendingTitle: 'trades without a journal', pendingSub: 'Document them while you remember', docNow: 'Document now',
    streak: 'Streak', days: 'days', day: 'day',
  },
};

export default function Journal({ trades, lang, focusUndoc = false }: { trades: TT[]; lang: Lang; focusUndoc?: boolean }) {
  const t = dictFor(J, lang);
  const WD = lang === 'es' ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [customTags, setCustomTags] = useState<CustomTags>({ setups: [], emotions: [], markets: [], errors: [] });
  const [open, setOpen] = useState<TT | null>(null);

  // filtros
  const [fSym, setFSym] = useState('all');
  const [fSide, setFSide] = useState('all');
  const [fRes, setFRes] = useState('all');
  const [fTag, setFTag] = useState('all');
  const [fDoc, setFDoc] = useState(focusUndoc ? 'undoc' : 'all'); // all | undoc
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  useEffect(() => {
    fetch('/api/journal').then((r) => r.json()).then((j) => {
      const m: Record<string, Entry> = {};
      (j.entries || []).forEach((e: Entry) => { m[e.trade_id] = e; });
      setEntries(m);
      const ct = j.customTags || {};
      setCustomTags({ setups: ct.setups || [], emotions: ct.emotions || [], markets: ct.markets || [], errors: ct.errors || [] });
    }).catch(() => {});
  }, []);

  // Guarda un tag nuevo del trader (persistente) y lo deja disponible al vuelo.
  function addCustomTag(group: keyof CustomTags, value: string) {
    const v = value.trim().slice(0, 40);
    if (!v) return;
    setCustomTags((c) => {
      if (c[group].some((x) => x.toLowerCase() === v.toLowerCase())) return c;
      const next = { ...c, [group]: [...c[group], v] };
      fetch('/api/journal/tags', { method: 'POST', body: JSON.stringify({ [group]: next[group] }) }).catch(() => {});
      return next;
    });
  }

  const pending = useMemo(() => trades.filter((x) => !isDocumented(entries[x.id])).length, [trades, entries]);

  const symbols = useMemo(() => Array.from(new Set(trades.map((x) => x.symbol))).sort(), [trades]);
  const allTags = useMemo(() => { const s = new Set<string>(); Object.values(entries).forEach((e) => (e.tags || []).forEach((x) => s.add(x))); return Array.from(s).sort(); }, [entries]);

  const view = useMemo(() => trades.filter((x) => {
    if (fSym !== 'all' && x.symbol !== fSym) return false;
    if (fSide !== 'all' && (x.side === 'buy' ? 'buy' : 'sell') !== fSide) return false;
    if (fRes === 'win' && +x.net_profit < 0) return false;
    if (fRes === 'loss' && +x.net_profit >= 0) return false;
    if (fTag !== 'all' && !((entries[x.id]?.tags) || []).includes(fTag)) return false;
    if (fDoc === 'undoc' && isDocumented(entries[x.id])) return false;
    const d = x.close_time.slice(0, 10);
    if (fFrom && d < fFrom) return false;
    if (fTo && d > fTo) return false;
    return true;
  }), [trades, fSym, fSide, fRes, fTag, fDoc, fFrom, fTo, entries]);

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

  // Calificar en 1 toque desde la tabla, sin abrir el modal. Guarda al instante.
  function quickGrade(id: string, g: string) {
    const cur: any = entries[id] || { trade_id: id, notes: null, tags: [], emotion: null, image_url: null };
    const grade = cur.grade === g ? '' : g;
    setEntries({ ...entries, [id]: { ...cur, grade: grade || null } });
    fetch('/api/journal', { method: 'POST', body: JSON.stringify({ trade_id: id, grade }) }).catch(() => {});
  }

  // Racha de diario: días seguidos (hasta hoy o ayer) documentando al menos una
  // operación. Motiva el hábito sin castigar si aún no documentó hoy.
  const streak = useMemo(() => {
    const days = new Set<string>();
    Object.values(entries).forEach((e: any) => { if (isDocumented(e) && e.updated_at) days.add(String(e.updated_at).slice(0, 10)); });
    if (!days.size) return 0;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const cur = new Date(iso(new Date()));
    if (!days.has(iso(cur))) { cur.setUTCDate(cur.getUTCDate() - 1); if (!days.has(iso(cur))) return 0; }
    let n = 0;
    while (days.has(iso(cur))) { n++; cur.setUTCDate(cur.getUTCDate() - 1); }
    return n;
  }, [entries]);

  const inp = { margin: 0, padding: '7px 9px', width: 'auto', fontSize: 13 } as any;
  const box = { background: 'var(--bg2)', borderRadius: 12, padding: 14, textAlign: 'center' as const };

  return (
    <>
      {/* Lotaje */}
      <div className="card">
        <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="📦" size={16} /></span> {t.lotTitle.replace('📦 ', '')}</h3>
        <div className="grid g4" style={{ marginBottom: 14 }}>
          {([[t.volToday, lot.today, '📅', 'var(--brand)'], [t.volWeek, lot.week, '🗓️', GREEN], [t.volMonth, lot.month, '📆', 'var(--gold)'], [t.volYear, lot.year, '🎯', 'var(--cyan)']] as const).map(([l, v, ic, ac], i) => (
            <StatCard key={i} icon={ic} label={l as string} value={(v as number).toFixed(2)} accent={ac as string} sub={t.lots} />
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>{t.byPair} · {t.volTotal}: <b style={{ color: 'var(--tx)' }}>{lot.total.toFixed(2)} {t.lots}</b></div>
        {lot.pairs.map(([sym, v]) => { const pct = Math.max(6, (v / lot.maxP) * 100); return (
          <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '7px 0' }}>
            <div style={{ width: 84, fontSize: 13 }}>{sym}</div>
            <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 8, height: 16, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 8, background: 'linear-gradient(90deg,var(--brand),var(--purple))', boxShadow: '0 0 12px -2px var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                {pct > 20 && <span style={{ fontSize: 10, fontWeight: 700, color: '#0e1220' }}>{v.toFixed(2)}</span>}
              </div>
            </div>
            {pct <= 20 && <div style={{ width: 54, textAlign: 'right', fontSize: 12, color: 'var(--mut)' }}>{v.toFixed(2)}</div>}
          </div>
        ); })}
      </div>

      {/* Heatmap */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}><h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="🔥" size={16} /></span> {t.heat.replace('🔥 ', '')}</h3></div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.heatNote}</p>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(24, 1fr)', gap: 3, minWidth: 640 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => <div key={h} style={{ fontSize: 9, color: 'var(--mut)', textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</div>)}
            {WD.map((wd, wi) => (
              <Fragment key={wi}>
                <div style={{ fontSize: 11, color: 'var(--mut)', display: 'flex', alignItems: 'center' }}>{wd}</div>
                {Array.from({ length: 24 }, (_, h) => { const c = heat.g[wi + '-' + h]; const net = c?.net || 0; const inten = c ? Math.min(1, Math.abs(net) / heat.max) : 0; const glowC = net >= 0 ? '52,226,160' : '255,107,125'; const bg = !c ? 'var(--bg2)' : `rgba(${glowC},${.18 + inten * .72})`; return <div key={wi + '-' + h} title={c ? `${wd} ${h}:00 · ${money2(net)} · ${c.count}` : ''} style={{ height: 20, borderRadius: 5, background: bg, boxShadow: c && inten > 0.25 ? `0 0 9px -1px rgba(${glowC},${0.4 + inten * 0.4})` : 'none' }} />; })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Operaciones + filtros */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="📋" size={16} /></span> {t.trades.replace('📋 ', '')} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· {t.showing} {view.length}</span></h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {streak > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: 'rgba(255,192,77,.12)', border: '1px solid var(--amber)', color: 'var(--amber)' }}><OnyxIcon emoji="🔥" size={14} /> {t.streak}: {streak} {streak === 1 ? t.day : t.days}</span>}
            <button className="btn btn-ghost" onClick={exportCSV}>⬇ {t.export}</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <select value={fSym} onChange={(e) => setFSym(e.target.value)} className="jfilter"><option value="all">{t.pair}: {t.all}</option>{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select value={fSide} onChange={(e) => setFSide(e.target.value)} className="jfilter"><option value="all">{t.side}: {t.all}</option><option value="buy">{t.longs}</option><option value="sell">{t.shorts}</option></select>
          <select value={fRes} onChange={(e) => setFRes(e.target.value)} className="jfilter"><option value="all">{t.result}: {t.all}</option><option value="win">{t.wins}</option><option value="loss">{t.losses}</option></select>
          <select value={fDoc} onChange={(e) => setFDoc(e.target.value)} className="jfilter"><option value="all">{t.thNote}: {t.all}</option><option value="undoc">{t.undoc}</option></select>
          {allTags.length > 0 && <select value={fTag} onChange={(e) => setFTag(e.target.value)} className="jfilter"><option value="all">{t.tag}: {t.all}</option>{allTags.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="jfilter" title={t.from} />
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="jfilter" title={t.to} />
          <button className="btn btn-ghost" style={inp} onClick={() => { setFSym('all'); setFSide('all'); setFRes('all'); setFTag('all'); setFDoc('all'); setFFrom(''); setFTo(''); }}>{t.clear}</button>
        </div>
        {pending > 0 && fDoc !== 'undoc' && (
          <div onClick={() => setFDoc('undoc')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,192,77,.10)', border: '1px solid var(--amber)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <OnyxIcon emoji="📓" size={18} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)' }}>{pending} {t.pendingTitle}</div>
                <div className="muted" style={{ fontSize: 12 }}>{t.pendingSub}</div>
              </div>
            </div>
            <span className="btn btn-ghost" style={{ fontSize: 13 }}>{t.docNow} →</span>
          </div>
        )}
        {view.length ? (
          <div style={{ overflowX: 'auto', maxHeight: 520, borderRadius: 12 }}>
            <table className="jtbl">
              <thead><tr><th>{t.thDate}</th><th>{t.thPair}</th><th>{t.thSide}</th><th style={{ textAlign: 'right' }}>{t.thLots}</th><th style={{ textAlign: 'right' }}>{t.thGross}</th><th style={{ textAlign: 'right' }}>{t.thNet}</th><th style={{ textAlign: 'center' }}>{t.thNote}</th></tr></thead>
              <tbody>
                {view.slice(0, 300).map((x) => { const e = entries[x.id]; const has = isDocumented(e); const gross = +(x.profit ?? x.net_profit); const net = +x.net_profit; const isBuy = x.side === 'buy'; return (
                  <tr key={x.id} className="jrow" onClick={() => setOpen(x)}>
                    <td className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{x.close_time.slice(0, 16).replace('T', ' ')}</td>
                    <td style={{ fontWeight: 600 }}>{x.symbol}</td>
                    <td><span className={'jside ' + (isBuy ? 'buy' : 'sell')}>{x.side}</span></td>
                    <td style={{ textAlign: 'right' }}>{(+x.volume).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}><span className={'jchip ' + (gross >= 0 ? 'pos' : 'neg')}>{money2(gross)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className={'jchip ' + (net >= 0 ? 'pos' : 'neg')}>{money2(net)}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <div onClick={(ev) => ev.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {(['A', 'B', 'C'] as const).map((g) => { const on = e?.grade === g; const gc = g === 'A' ? GREEN : g === 'B' ? GOLD : RED; return (
                          <button key={g} onClick={() => quickGrade(x.id, g)} title={g} style={{ cursor: 'pointer', width: 22, height: 22, padding: 0, borderRadius: 6, fontSize: 11, fontWeight: 800, lineHeight: 1, border: '1px solid ' + (on ? gc : 'var(--line)'), background: on ? (g === 'A' ? 'rgba(52,226,160,.18)' : g === 'B' ? 'rgba(255,192,77,.18)' : 'rgba(255,107,125,.18)') : 'transparent', color: on ? gc : 'var(--mut)' }}>{g}</button>
                        ); })}
                        {(e?.notes || e?.image_url) ? <span style={{ marginLeft: 3, fontSize: 12 }}>{e?.image_url ? '🖼️' : t.hasNote}</span> : (!has && <span style={{ marginLeft: 2, color: 'var(--amber)', fontSize: 14 }}>•</span>)}
                      </div>
                    </td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">{t.noTrades}</p>}
      </div>

      {open && <TradeModal trade={open} entry={entries[open.id]} lang={lang} customTags={customTags} onAddTag={addCustomTag} onClose={() => setOpen(null)} onSaved={(e) => setEntries({ ...entries, [open.id]: e })} />}
    </>
  );
}

// Grupo de tags reutilizable con selección múltiple (o única) y "+ Añadir".
// Combina los tags por defecto con los propios del trader; el que crea se
// guarda y queda seleccionado. accent controla el color del chip activo.
function TagGroup({ label, hint, options, custom, selected, multi, accent, onToggle, onAdd, addLabel, addPh }: {
  label: string; hint?: string; options: string[]; custom: string[]; selected: string[]; multi: boolean;
  accent: string; onToggle: (v: string) => void; onAdd: (v: string) => void; addLabel: string; addPh: string;
}) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const all = [...options, ...custom.filter((c) => !options.some((o) => o.toLowerCase() === c.toLowerCase()))];
  const commit = () => { const v = val.trim(); if (v) { onAdd(v); if (!multi) { /* selección única: onAdd no selecciona */ } } setVal(''); setAdding(false); };
  const tint = accent === GREEN ? 'rgba(52,226,160,.15)' : accent === RED ? 'rgba(255,107,125,.15)' : accent === AMBER ? 'rgba(255,192,77,.15)' : 'rgba(124,140,255,.18)';
  return (
    <div style={{ margin: '14px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 600 }}>{label}{hint ? <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> · {hint}</span> : null}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {all.map((s) => { const on = selected.includes(s); return (
          <button key={s} onClick={() => onToggle(s)} style={{ cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontSize: 13, border: '1px solid ' + (on ? accent : 'var(--line)'), background: on ? tint : 'transparent', color: 'var(--tx)' }}>{s}</button>
        ); })}
        {adding ? (
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setVal(''); } }} onBlur={commit} placeholder={addPh} style={{ margin: 0, width: 130, padding: '4px 9px', fontSize: 13 }} />
        ) : (
          <button onClick={() => setAdding(true)} style={{ cursor: 'pointer', padding: '5px 11px', borderRadius: 8, fontSize: 13, border: '1px dashed var(--brand)', background: 'transparent', color: 'var(--soft-brand)' }}>+ {addLabel}</button>
        )}
      </div>
    </div>
  );
}

// Segmento tipo "elige uno" (grado, adherencia). value '' = ninguno.
function Segment({ label, opts, value, onPick }: { label: string; opts: { v: string; t: string; c: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {opts.map((o) => { const on = value === o.v; const tint = o.c === GREEN ? 'rgba(52,226,160,.18)' : o.c === RED ? 'rgba(255,107,125,.18)' : o.c === AMBER ? 'rgba(255,192,77,.18)' : 'rgba(124,140,255,.18)'; return (
          <button key={o.v} onClick={() => onPick(on ? '' : o.v)} style={{ cursor: 'pointer', minWidth: 34, height: 30, padding: '0 12px', borderRadius: 8, fontSize: 13, fontWeight: on ? 700 : 400, border: '1px solid ' + (on ? o.c : 'var(--line)'), background: on ? tint : 'transparent', color: on ? o.c : 'var(--tx)' }}>{o.t}</button>
        ); })}
      </div>
    </div>
  );
}

function TradeModal({ trade, entry, lang, customTags, onAddTag, onClose, onSaved }: { trade: TT; entry?: Entry; lang: Lang; customTags: CustomTags; onAddTag: (g: keyof CustomTags, v: string) => void; onClose: () => void; onSaved: (e: Entry) => void }) {
  const t = dictFor(J, lang);
  const [notes, setNotes] = useState(entry?.notes || '');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [emotion, setEmotion] = useState(entry?.emotion || '');
  const [markets, setMarkets] = useState<string[]>(entry?.market_tags || []);
  const [errs, setErrs] = useState<string[]>(entry?.error_tags || []);
  const [grade, setGrade] = useState(entry?.grade || '');
  const [planF, setPlanF] = useState(entry?.plan_followed || '');
  const [img, setImg] = useState(entry?.image_url || '');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (arr: string[], set: (v: string[]) => void, s: string) => set(arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);

  async function upload(f: File) {
    setUploading(true);
    const fd = new FormData(); fd.append('file', f); fd.append('trade_id', trade.id);
    const r = await fetch('/api/journal/upload', { method: 'POST', body: fd });
    const j = await r.json(); setUploading(false);
    if (j.url) setImg(j.url); else toast(errMsg(j, lang));
  }
  async function save() {
    setSaving(true);
    const e: Entry = { trade_id: trade.id, notes, tags, emotion, image_url: img, grade: grade || null, plan_followed: planF || null, market_tags: markets, error_tags: errs };
    const r = await fetch('/api/journal', { method: 'POST', body: JSON.stringify(e) });
    setSaving(false);
    if (!r.ok) { const j = await r.json(); toast(errMsg(j, lang)); return; }
    setOk(true); setTimeout(() => setOk(false), 1500);
    onSaved(e);
  }

  const lbl = { fontSize: 13, color: 'var(--mut)', margin: '14px 0 6px', display: 'block', fontWeight: 600 } as any;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 100, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 560, width: '100%' }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3>{t.mTitle}: {trade.symbol}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="grid g4" style={{ marginBottom: 10 }}>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mLots}</div><b>{(+trade.volume).toFixed(2)}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mNet}</div><b className={+trade.net_profit >= 0 ? 'pos' : 'neg'}>{money2(+trade.net_profit)}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mComm}</div><b className={+(trade.commission || 0) >= 0 ? 'pos' : 'neg'}>{money2(+(trade.commission || 0))}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mSwap}</div><b className={+(trade.swap || 0) >= 0 ? 'pos' : 'neg'}>{money2(+(trade.swap || 0))}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mOpen}</div><b style={{ fontSize: 12 }}>{(trade.open_time || '').slice(0, 16).replace('T', ' ') || '—'}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mClose}</div><b style={{ fontSize: 12 }}>{trade.close_time.slice(0, 16).replace('T', ' ')}</b></div>
        </div>

        {/* Grado + adherencia: dos toques que resumen la calidad del trade */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 10 }}>
          <Segment label={t.quality} value={grade} onPick={setGrade} opts={[{ v: 'A', t: 'A', c: GREEN }, { v: 'B', t: 'B', c: GOLD }, { v: 'C', t: 'C', c: RED }]} />
          <Segment label={t.planQ} value={planF} onPick={setPlanF} opts={[{ v: 'yes', t: t.planYes, c: GREEN }, { v: 'partial', t: t.planPartial, c: AMBER }, { v: 'no', t: t.planNo, c: RED }]} />
        </div>

        <TagGroup label={t.strat} hint={t.adapts} options={STRATS} custom={customTags.setups} selected={tags} multi accent={BLUE} onToggle={(s) => toggle(tags, setTags, s)} onAdd={(v) => { onAddTag('setups', v); setTags((a) => a.includes(v) ? a : [...a, v]); }} addLabel={t.add} addPh={t.addPh} />

        <TagGroup label={t.market} options={t.markets} custom={customTags.markets} selected={markets} multi accent={BLUE} onToggle={(s) => toggle(markets, setMarkets, s)} onAdd={(v) => { onAddTag('markets', v); setMarkets((a) => a.includes(v) ? a : [...a, v]); }} addLabel={t.add} addPh={t.addPh} />

        <TagGroup label={t.emotion} options={t.emotions} custom={customTags.emotions} selected={emotion ? [emotion] : []} multi={false} accent={GREEN} onToggle={(s) => setEmotion(emotion === s ? '' : s)} onAdd={(v) => { onAddTag('emotions', v); setEmotion(v); }} addLabel={t.add} addPh={t.addPh} />

        <TagGroup label={t.whatFailed} hint={t.optional} options={t.errors} custom={customTags.errors} selected={errs} multi accent={RED} onToggle={(s) => toggle(errs, setErrs, s)} onAdd={(v) => { onAddTag('errors', v); setErrs((a) => a.includes(v) ? a : [...a, v]); }} addLabel={t.add} addPh={t.addPh} />

        <span style={lbl}>{t.notes} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {t.optional}</span></span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={t.notesPh} style={{ width: '100%', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />

        <span style={lbl}>{t.photo} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {t.optional}</span></span>
        {img ? <img src={img} alt="trade" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', marginBottom: 8 }} /> : null}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? t.uploading : (img ? t.replace : t.upload)}</button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12 }}>✓ {t.minHint}</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : (ok ? t.saved : t.save)}</button>
            <button className="btn btn-ghost" onClick={onClose}>{t.close}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
