'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { errMsg } from '@/lib/i18nErrors';
import { StatCard } from './HubVitals';
import OnyxIcon from '@/app/components/OnyxIcon';

type TT = { id: string; account_id: string; symbol: string; side: string; volume: number; open_time: string | null; close_time: string; net_profit: number; commission?: number; swap?: number; profit?: number };
type Acc = { id: string; nickname?: string | null; broker?: string; platform?: string; fund_max_daily?: number | null; fund_max_total?: number | null };
type Entry = { trade_id: string; notes: string | null; tags: string[] | null; emotion: string | null; image_url: string | null; image_url_exit?: string | null; grade?: string | null; plan_followed?: string | null; market_tags?: string[] | null; error_tags?: string[] | null; risk_amount?: number | null };
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

// Ventana para documentar SEGÚN cuánto estuvo abierta la operación (estilo real
// del trade): un scalp se documenta pronto; un swing puede esperar semanas. Si no
// hay hora de apertura, se usa una ventana por defecto de 2 días.
const H_MS = 3600e3, D_MS = 864e5;
function docWindowMs(x: TT): number {
  const openT = x.open_time ? new Date(x.open_time).getTime() : NaN;
  const closeT = new Date(x.close_time).getTime();
  const holdMin = isFinite(openT) ? (closeT - openT) / 60000 : NaN;
  if (!isFinite(holdMin)) return 2 * D_MS;   // sin hora de apertura
  if (holdMin < 15) return 2 * H_MS;         // scalp
  if (holdMin < 1440) return 2 * D_MS;       // intradía
  return 14 * D_MS;                          // swing
}
// Estado del diario del trade: 'done' (registrado) · 'recent' (aún en ventana) ·
// 'pending' (pasó la ventana) · 'late' (muy atrasado, > 3× la ventana).
type JState = 'done' | 'recent' | 'pending' | 'late';
function journalState(x: TT, e: Entry | undefined, nowMs: number): JState {
  if (isDocumented(e)) return 'done';
  const w = docWindowMs(x);
  const age = nowMs - new Date(x.close_time).getTime();
  if (age < w) return 'recent';
  if (age < w * 3) return 'pending';
  return 'late';
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
    stDone: 'Registrado', stRecent: 'Reciente · aún tienes tiempo', stPending: 'Documentar', stPendingT: 'Pasó su ventana para documentar', stLate: 'Atrasado', stLateT: 'Muy atrasado: documenta antes de olvidarlo',
    stDoneT: 'Registrado · clic para quitar del diario', clearConfirm: '¿Quitar esta operación del diario? Se borra su registro (grado, nota, tags…).', clearBtn: 'Quitar del diario',
    streak: 'Racha', days: 'días', day: 'día',
    delTitle: 'Borrar el tag', delBody: 'Se quita de tu lista y ya no aparecerá al documentar. Las operaciones que ya etiquetaste con él no cambian.', delCancel: 'Cancelar', delOk: 'Borrar tag',
    mDuration: 'Duración', mSession: 'Sesión', risk: 'Riesgo', riskPh: 'Ej: 100', riskHint: 'Cuánto arriesgaste ($). Con esto calculamos el resultado en R.',
    removePhoto: 'Quitar foto', zoomHint: 'click para ampliar', coach: 'Coach IA', coaching: 'Analizando…', coachErr: 'No se pudo analizar ahora. Inténtalo de nuevo.',
    rulesTitle: 'Chequeo de reglas', rulesOk: 'Sin alertas: este trade y el día respetan las reglas de tu cuenta.', rulesNoRules: 'Añade el límite diario/total en Fondeo para chequear reglas.',
    ruleTradeOverDaily: 'Este trade arriesgó más que tu límite diario', ruleDayOverDaily: 'El día superó el límite diario de la cuenta', ruleRiskOverDaily: 'El riesgo que anotaste supera el límite diario',
    shots: 'Capturas', entryShot: 'Entrada', exitShot: 'Salida',
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
    stDone: 'Logged', stRecent: 'Recent · still time', stPending: 'Document', stPendingT: 'Past its window to document', stLate: 'Overdue', stLateT: 'Overdue: document before you forget',
    stDoneT: 'Logged · click to remove from journal', clearConfirm: 'Remove this trade from the journal? Its entry (grade, note, tags…) will be deleted.', clearBtn: 'Remove from journal',
    streak: 'Streak', days: 'days', day: 'day',
    delTitle: 'Delete tag', delBody: 'It leaves your list and won’t appear when documenting. Trades you already tagged with it don’t change.', delCancel: 'Cancel', delOk: 'Delete tag',
    mDuration: 'Duration', mSession: 'Session', risk: 'Risk', riskPh: 'e.g. 100', riskHint: 'How much you risked ($). We use it to show the result in R.',
    removePhoto: 'Remove photo', zoomHint: 'click to zoom', coach: 'AI Coach', coaching: 'Analyzing…', coachErr: 'Couldn’t analyze right now. Try again.',
    rulesTitle: 'Rule check', rulesOk: 'No alerts: this trade and the day respect your account rules.', rulesNoRules: 'Add your daily/total limit in Funding to check rules.',
    ruleTradeOverDaily: 'This trade risked more than your daily limit', ruleDayOverDaily: 'The day exceeded the account daily limit', ruleRiskOverDaily: 'The risk you logged exceeds the daily limit',
    shots: 'Screenshots', entryShot: 'Entry', exitShot: 'Exit',
  },
};

// Sesión de mercado por la hora UTC de apertura (aprox., forex).
function sessionOf(iso: string | null, es: boolean): string {
  if (!iso) return '—';
  const h = new Date(iso).getUTCHours();
  if (h >= 0 && h < 7) return es ? 'Asia' : 'Asia';
  if (h < 12) return es ? 'Londres' : 'London';
  if (h < 16) return es ? 'Londres/NY' : 'London/NY';
  if (h < 21) return 'NY';
  return es ? 'Sídney' : 'Sydney';
}
// Duración legible entre apertura y cierre.
function durationOf(openIso: string | null, closeIso: string): string {
  if (!openIso) return '—';
  const m = Math.round((new Date(closeIso).getTime() - new Date(openIso).getTime()) / 60000);
  if (!isFinite(m) || m < 0) return '—';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}
// Nombre bonito de la plataforma para el chip del encabezado.
function platLabel(p?: string): string {
  const k = String(p || '').toLowerCase();
  if (k.includes('mt5') || k === 'metatrader5') return 'MT5';
  if (k.includes('mt4') || k === 'metatrader4') return 'MT4';
  if (k.includes('ctrader')) return 'cTrader';
  if (k.includes('match')) return 'Match-Trader';
  return p ? p.slice(0, 14) : '';
}

export default function Journal({ trades, lang, focusUndoc = false, accounts = [] }: { trades: TT[]; lang: Lang; focusUndoc?: boolean; accounts?: Acc[] }) {
  const t = dictFor(J, lang);
  const accMap = useMemo(() => { const m: Record<string, Acc> = {}; (accounts || []).forEach((a) => { m[a.id] = a; }); return m; }, [accounts]);
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

  // Persiste la lista de un grupo (helper común de añadir/renombrar/borrar).
  function persistGroup(group: keyof CustomTags, list: string[]) {
    fetch('/api/journal/tags', { method: 'POST', body: JSON.stringify({ [group]: list }) }).catch(() => {});
  }
  // Guarda un tag nuevo del trader (persistente) y lo deja disponible al vuelo.
  function addCustomTag(group: keyof CustomTags, value: string) {
    const v = value.trim().slice(0, 40);
    if (!v) return;
    setCustomTags((c) => {
      if (c[group].some((x) => x.toLowerCase() === v.toLowerCase())) return c;
      const next = { ...c, [group]: [...c[group], v] };
      persistGroup(group, next[group]);
      return next;
    });
  }
  // Renombra un tag propio (los ya guardados en operaciones no cambian).
  function renameCustomTag(group: keyof CustomTags, oldV: string, newV: string) {
    const v = newV.trim().slice(0, 40);
    if (!v || v === oldV) return;
    setCustomTags((c) => {
      const next = { ...c, [group]: c[group].map((x) => (x === oldV ? v : x)) };
      persistGroup(group, next[group]);
      return next;
    });
  }
  // Borra un tag propio de tu lista (no toca las operaciones ya etiquetadas).
  function deleteCustomTag(group: keyof CustomTags, v: string) {
    setCustomTags((c) => {
      const next = { ...c, [group]: c[group].filter((x) => x !== v) };
      persistGroup(group, next[group]);
      return next;
    });
  }

  // Solo cuentan las que ya PASARON su ventana (pending + late), no las recientes.
  const pending = useMemo(() => { const n = Date.now(); return trades.filter((x) => { const s = journalState(x, entries[x.id], n); return s === 'pending' || s === 'late'; }).length; }, [trades, entries]);

  const symbols = useMemo(() => Array.from(new Set(trades.map((x) => x.symbol))).sort(), [trades]);
  const allTags = useMemo(() => { const s = new Set<string>(); Object.values(entries).forEach((e) => (e.tags || []).forEach((x) => s.add(x))); return Array.from(s).sort(); }, [entries]);

  const view = useMemo(() => trades.filter((x) => {
    if (fSym !== 'all' && x.symbol !== fSym) return false;
    if (fSide !== 'all' && (x.side === 'buy' ? 'buy' : 'sell') !== fSide) return false;
    if (fRes === 'win' && +x.net_profit < 0) return false;
    if (fRes === 'loss' && +x.net_profit >= 0) return false;
    if (fTag !== 'all' && !((entries[x.id]?.tags) || []).includes(fTag)) return false;
    if (fDoc === 'undoc') { const s = journalState(x, entries[x.id], Date.now()); if (s === 'done' || s === 'recent') return false; }
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

  // Quitar TODO el diario de una operación → vuelve a "sin documentar".
  function clearEntry(id: string) {
    setEntries((prev) => { const n = { ...prev }; delete n[id]; return n; });
    fetch('/api/journal', { method: 'POST', body: JSON.stringify({ trade_id: id, clear: true }) }).catch(() => {});
  }
  // Calificar en 1 toque desde la tabla, sin abrir el modal. Guarda al instante.
  // Si al quitar el grado la entrada queda vacía, se borra la fila para que
  // la operación vuelva a "sin documentar" (y desaparezca el check verde).
  function quickGrade(id: string, g: string) {
    const cur: any = entries[id] || { trade_id: id, notes: null, tags: [], emotion: null, image_url: null };
    const grade = cur.grade === g ? '' : g;
    const next: any = { ...cur, grade: grade || null };
    if (!isDocumented(next)) { clearEntry(id); return; }
    setEntries({ ...entries, [id]: next });
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
                {view.slice(0, 300).map((x) => { const e = entries[x.id]; const gross = +(x.profit ?? x.net_profit); const net = +x.net_profit; const isBuy = x.side === 'buy'; const st = journalState(x, e, Date.now()); const accent = st === 'pending' ? AMBER : st === 'late' ? RED : 'transparent'; return (
                  <tr key={x.id} className="jrow" onClick={() => setOpen(x)} style={{ borderLeft: '3px solid ' + accent, background: st === 'pending' ? 'rgba(255,192,77,.05)' : st === 'late' ? 'rgba(255,107,125,.06)' : undefined }}>
                    <td className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{x.close_time.slice(0, 16).replace('T', ' ')}</td>
                    <td style={{ fontWeight: 600 }}>{x.symbol}</td>
                    <td><span className={'jside ' + (isBuy ? 'buy' : 'sell')}>{x.side}</span></td>
                    <td style={{ textAlign: 'right' }}>{(+x.volume).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}><span className={'jchip ' + (gross >= 0 ? 'pos' : 'neg')}>{money2(gross)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className={'jchip ' + (net >= 0 ? 'pos' : 'neg')}>{money2(net)}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <div onClick={(ev) => ev.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {(['A', 'B', 'C'] as const).map((g) => { const on = e?.grade === g; const gc = g === 'A' ? GREEN : g === 'B' ? GOLD : RED; return (
                            <button key={g} onClick={() => quickGrade(x.id, g)} title={g} style={{ cursor: 'pointer', width: 22, height: 22, padding: 0, borderRadius: 6, fontSize: 11, fontWeight: 800, lineHeight: 1, border: '1px solid ' + (on ? gc : 'var(--line)'), background: on ? (g === 'A' ? 'rgba(52,226,160,.18)' : g === 'B' ? 'rgba(255,192,77,.18)' : 'rgba(255,107,125,.18)') : 'transparent', color: on ? gc : 'var(--mut)' }}>{g}</button>
                          ); })}
                        </div>
                        <JStatus st={st} t={t} onClear={() => { if (typeof window !== 'undefined' && window.confirm(t.clearConfirm)) clearEntry(x.id); }} />
                      </div>
                    </td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">{t.noTrades}</p>}
      </div>

      {open && <TradeModal trade={open} entry={entries[open.id]} acc={accMap[open.account_id]} allTrades={trades} lang={lang} customTags={customTags} onAddTag={addCustomTag} onRenameTag={renameCustomTag} onDeleteTag={deleteCustomTag} onClose={() => setOpen(null)} onSaved={(e) => setEntries({ ...entries, [open.id]: e })} />}
    </>
  );
}

// Estado del diario del trade en la fila: check (registrado), reloj (reciente),
// pastilla ámbar (por documentar) o roja (atrasado). El tooltip explica el porqué.
function JStatus({ st, t, onClear }: { st: JState; t: any; onClear?: () => void }) {
  if (st === 'done') return <button onClick={onClear} title={t.stDoneT} aria-label={t.clearBtn} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--green)' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l2.6 2.6L12.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>;
  if (st === 'recent') return <span title={t.stRecent} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--mut)' }}><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5v3.2l2 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></span>;
  const amber = st === 'pending';
  return (
    <span title={amber ? t.stPendingT : t.stLateT} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, color: amber ? 'var(--amber)' : 'var(--red)', background: amber ? 'rgba(255,192,77,.14)' : 'rgba(255,107,125,.14)', border: '1px solid ' + (amber ? 'var(--amber)' : 'var(--red)') }}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">{amber
        ? <path d="M11 2l3 3-8 8-3.6.6.6-3.6 8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        : <><path d="M8 2 1.5 13.5h13L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 6.5v3M8 11.4v.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></>}</svg>
      {amber ? t.stPending : t.stLate}
    </span>
  );
}

// Grupo de tags reutilizable con selección múltiple (o única) y "+ Añadir".
// Combina los tags por defecto con los propios del trader; el que crea se
// guarda y queda seleccionado. accent controla el color del chip activo.
function TagGroup({ label, hint, options, custom, selected, multi, accent, groupKey, lang, onToggle, onAdd, onRename, onAskDelete, addLabel, addPh }: {
  label: string; hint?: string; options: string[]; custom: string[]; selected: string[]; multi: boolean;
  accent: string; groupKey: keyof CustomTags; lang: Lang; onToggle: (v: string) => void; onAdd: (v: string) => void;
  onRename: (g: keyof CustomTags, oldV: string, newV: string) => void; onAskDelete: (g: keyof CustomTags, v: string) => void;
  addLabel: string; addPh: string;
}) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const [editing, setEditing] = useState<string | null>(null); // tag en modo renombrar
  const [editVal, setEditVal] = useState('');
  const isCustom = (s: string) => custom.some((c) => c === s) && !options.some((o) => o.toLowerCase() === s.toLowerCase());
  const all = [...options, ...custom.filter((c) => !options.some((o) => o.toLowerCase() === c.toLowerCase()))];
  const commit = () => { const v = val.trim(); if (v) onAdd(v); setVal(''); setAdding(false); };
  const commitEdit = (oldV: string) => { const v = editVal.trim(); if (v && v !== oldV) onRename(groupKey, oldV, v); setEditing(null); setEditVal(''); };
  const tint = accent === GREEN ? 'rgba(52,226,160,.15)' : accent === RED ? 'rgba(255,107,125,.15)' : accent === AMBER ? 'rgba(255,192,77,.15)' : 'rgba(124,140,255,.18)';
  return (
    <div style={{ margin: '14px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 600 }}>{label}{hint ? <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> · {hint}</span> : null}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {all.map((s) => { const on = selected.includes(s); const mine = isCustom(s);
          if (editing === s) return (
            <input key={s} autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(s); if (e.key === 'Escape') { setEditing(null); setEditVal(''); } }} onBlur={() => commitEdit(s)} style={{ margin: 0, width: 120, padding: '4px 9px', fontSize: 13 }} />
          );
          return (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: mine ? '5px 7px 5px 11px' : '5px 11px', borderRadius: 8, fontSize: 13, border: '1px solid ' + (on ? accent : 'var(--line)'), background: on ? tint : 'transparent', color: 'var(--tx)' }}>
              <span onClick={() => onToggle(s)} style={{ cursor: 'pointer' }}>{s}</span>
              {mine && (
                <span style={{ display: 'inline-flex', gap: 2, opacity: .75 }}>
                  <span title={lang === 'es' ? 'Renombrar' : 'Rename'} onClick={(e) => { e.stopPropagation(); setEditing(s); setEditVal(s); }} style={{ cursor: 'pointer', fontSize: 11 }}>✎</span>
                  <span title={lang === 'es' ? 'Borrar' : 'Delete'} onClick={(e) => { e.stopPropagation(); onAskDelete(groupKey, s); }} style={{ cursor: 'pointer', fontSize: 12 }}>✕</span>
                </span>
              )}
            </span>
          );
        })}
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

// Una ranura de captura (entrada o salida): miniatura con zoom + subir/cambiar/quitar.
function ImgSlot({ url, label, busy, tt, onUploadClick, onRemove, onZoom }: { url: string; label: string; busy: boolean; tt: any; onUploadClick: () => void; onRemove: () => void; onZoom: () => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, color: 'var(--tx)', fontWeight: 600 }}>{label}</span>
        {url && <span className="muted" style={{ fontSize: 11 }}>🔍 {tt.zoomHint}</span>}
      </div>
      {url ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', cursor: 'zoom-in' }} onClick={onZoom}>
          <img src={url} alt={label} style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }} />
          <span style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,.55)', color: '#fff', borderRadius: 999, padding: '4px 8px', fontSize: 12 }}>🔍</span>
        </div>
      ) : (
        <div onClick={onUploadClick} style={{ borderRadius: 12, border: '1px dashed var(--line)', background: 'var(--bg2)', height: 108, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--mut)', fontSize: 13, cursor: 'pointer' }}>
          <span style={{ fontSize: 20 }}>🖼️</span> {tt.upload}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={onUploadClick} disabled={busy} style={{ flex: 1, fontSize: 12.5, padding: '6px 10px' }}>{busy ? tt.uploading : (url ? tt.replace : tt.upload)}</button>
        {url && <button className="btn btn-ghost" onClick={onRemove} style={{ fontSize: 12.5, padding: '6px 10px', color: 'var(--red)', borderColor: 'rgba(255,107,125,.5)' }}>🗑</button>}
      </div>
    </div>
  );
}

function TradeModal({ trade, entry, acc, allTrades, lang, customTags, onAddTag, onRenameTag, onDeleteTag, onClose, onSaved }: { trade: TT; entry?: Entry; acc?: Acc; allTrades: TT[]; lang: Lang; customTags: CustomTags; onAddTag: (g: keyof CustomTags, v: string) => void; onRenameTag: (g: keyof CustomTags, oldV: string, newV: string) => void; onDeleteTag: (g: keyof CustomTags, v: string) => void; onClose: () => void; onSaved: (e: Entry) => void }) {
  const t = dictFor(J, lang);
  const es = lang === 'es';
  const [confirmDel, setConfirmDel] = useState<{ group: keyof CustomTags; value: string } | null>(null);
  const [notes, setNotes] = useState(entry?.notes || '');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [emotion, setEmotion] = useState(entry?.emotion || '');
  const [markets, setMarkets] = useState<string[]>(entry?.market_tags || []);
  const [errs, setErrs] = useState<string[]>(entry?.error_tags || []);
  const [grade, setGrade] = useState(entry?.grade || '');
  const [planF, setPlanF] = useState(entry?.plan_followed || '');
  const [img, setImg] = useState(entry?.image_url || '');
  const [imgExit, setImgExit] = useState(entry?.image_url_exit || '');
  const [risk, setRisk] = useState(entry?.risk_amount != null ? String(entry.risk_amount) : '');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [uploading, setUploading] = useState<'' | 'entry' | 'exit'>('');
  const [zoom, setZoom] = useState('');  // url que se está viendo en grande
  const [coach, setCoach] = useState('');
  const [coaching, setCoaching] = useState(false);
  const fileEntry = useRef<HTMLInputElement>(null);
  const fileExit = useRef<HTMLInputElement>(null);

  const toggle = (arr: string[], set: (v: string[]) => void, s: string) => set(arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);

  const net = +trade.net_profit;
  const riskNum = Number(risk);
  const rMultiple = (isFinite(riskNum) && riskNum > 0) ? net / riskNum : null;
  const durTxt = durationOf(trade.open_time, trade.close_time);
  const durMin = trade.open_time ? Math.round((new Date(trade.close_time).getTime() - new Date(trade.open_time).getTime()) / 60000) : null;
  const sess = sessionOf(trade.open_time, es);
  const plat = platLabel(acc?.platform);
  const accName = acc?.nickname || acc?.broker || '';

  // Chequeo de reglas: usa el límite diario de la cuenta (Fondeo) y el neto del
  // día en esa cuenta (de las operaciones ya cargadas). Sin límite → sin chequeo.
  const rules = useMemo(() => {
    const daily = Number(acc?.fund_max_daily) || 0;
    if (!(daily > 0)) return { has: false, alerts: [] as string[] };
    const day = trade.close_time.slice(0, 10);
    let dayNet = 0;
    for (const x of allTrades) if (x.account_id === trade.account_id && x.close_time.slice(0, 10) === day) dayNet += +x.net_profit || 0;
    const alerts: string[] = [];
    const tradeLoss = net < 0 ? -net : 0;
    if (tradeLoss > daily) alerts.push(t.ruleTradeOverDaily);
    if (dayNet < -daily) alerts.push(t.ruleDayOverDaily);
    if (isFinite(riskNum) && riskNum > daily) alerts.push(t.ruleRiskOverDaily);
    return { has: true, alerts };
  }, [acc, allTrades, trade, net, riskNum, t]);

  async function upload(f: File, slot: 'entry' | 'exit') {
    setUploading(slot);
    const fd = new FormData(); fd.append('file', f); fd.append('trade_id', trade.id); fd.append('slot', slot);
    const r = await fetch('/api/journal/upload', { method: 'POST', body: fd });
    const j = await r.json(); setUploading('');
    if (j.url) { slot === 'exit' ? setImgExit(j.url) : setImg(j.url); } else toast(errMsg(j, lang));
  }
  async function askCoach() {
    setCoaching(true); setCoach('');
    try {
      const r = await fetch('/api/journal/coach', { method: 'POST', body: JSON.stringify({
        trade_id: trade.id, symbol: trade.symbol, side: trade.side, net,
        grade, planFollowed: planF, emotion, setups: tags, markets, errors: errs,
        rMultiple, durationMin: durMin, session: sess, lang,
      }) });
      const j = await r.json();
      setCoach(j?.text || t.coachErr);
    } catch { setCoach(t.coachErr); }
    setCoaching(false);
  }
  async function save() {
    setSaving(true);
    const e: Entry = { trade_id: trade.id, notes, tags, emotion, image_url: img, image_url_exit: imgExit || null, grade: grade || null, plan_followed: planF || null, market_tags: markets, error_tags: errs, risk_amount: (isFinite(riskNum) && riskNum > 0) ? riskNum : null };
    const r = await fetch('/api/journal', { method: 'POST', body: JSON.stringify({ ...e, image_url_exit: imgExit, risk_amount: risk === '' ? '' : riskNum }) });
    setSaving(false);
    if (!r.ok) { const j = await r.json(); toast(errMsg(j, lang)); return; }
    onSaved(e);
    setOk(true);
    setTimeout(() => onClose(), 650); // guarda y CIERRA solo
  }

  const lbl = { fontSize: 13, color: 'var(--mut)', margin: '14px 0 6px', display: 'block', fontWeight: 600 } as any;
  const chip = (bg: string, br: string, cl: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: bg, border: '1px solid ' + br, color: cl }) as any;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 100, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 780, width: '100%' }}>
        <div className="row between" style={{ marginBottom: 8, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{t.mTitle}: {trade.symbol}</h3>
            {plat && <span style={chip('rgba(124,140,255,.14)', BLUE, 'var(--soft-brand)')}>{plat}</span>}
            {accName && <span style={chip('var(--bg2)', 'var(--line)', 'var(--mut)')}>{accName}</span>}
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        {/* Resumen: lote, neto, duración, sesión + tira de tiempos/costes */}
        <div className="grid g4" style={{ marginBottom: 6 }}>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mLots}</div><b>{(+trade.volume).toFixed(2)}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mNet}</div><b className={net >= 0 ? 'pos' : 'neg'}>{money2(net)}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mDuration}</div><b style={{ fontSize: 13 }}>{durTxt}</b></div>
          <div><div className="muted" style={{ fontSize: 11 }}>{t.mSession}</div><b style={{ fontSize: 13 }}>{sess}</b></div>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}>
          {t.mOpen}: {(trade.open_time || '').slice(0, 16).replace('T', ' ') || '—'} · {t.mClose}: {trade.close_time.slice(0, 16).replace('T', ' ')} · {t.mComm} {money2(+(trade.commission || 0))} · {t.mSwap} {money2(+(trade.swap || 0))}
        </div>

        {/* Dos columnas: izquierda documentación · derecha foto (se apilan en móvil) */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 340px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 10 }}>
              <Segment label={t.quality} value={grade} onPick={setGrade} opts={[{ v: 'A', t: 'A', c: GREEN }, { v: 'B', t: 'B', c: GOLD }, { v: 'C', t: 'C', c: RED }]} />
              <Segment label={t.planQ} value={planF} onPick={setPlanF} opts={[{ v: 'yes', t: t.planYes, c: GREEN }, { v: 'partial', t: t.planPartial, c: AMBER }, { v: 'no', t: t.planNo, c: RED }]} />
            </div>

            <TagGroup label={t.strat} hint={t.adapts} options={STRATS} custom={customTags.setups} selected={tags} multi accent={BLUE} groupKey="setups" lang={lang} onToggle={(s) => toggle(tags, setTags, s)} onAdd={(v) => { onAddTag('setups', v); setTags((a) => a.includes(v) ? a : [...a, v]); }} onRename={onRenameTag} onAskDelete={(g, v) => setConfirmDel({ group: g, value: v })} addLabel={t.add} addPh={t.addPh} />
            <TagGroup label={t.market} options={t.markets} custom={customTags.markets} selected={markets} multi accent={BLUE} groupKey="markets" lang={lang} onToggle={(s) => toggle(markets, setMarkets, s)} onAdd={(v) => { onAddTag('markets', v); setMarkets((a) => a.includes(v) ? a : [...a, v]); }} onRename={onRenameTag} onAskDelete={(g, v) => setConfirmDel({ group: g, value: v })} addLabel={t.add} addPh={t.addPh} />
            <TagGroup label={t.emotion} options={t.emotions} custom={customTags.emotions} selected={emotion ? [emotion] : []} multi={false} accent={GREEN} groupKey="emotions" lang={lang} onToggle={(s) => setEmotion(emotion === s ? '' : s)} onAdd={(v) => { onAddTag('emotions', v); setEmotion(v); }} onRename={onRenameTag} onAskDelete={(g, v) => setConfirmDel({ group: g, value: v })} addLabel={t.add} addPh={t.addPh} />
            <TagGroup label={t.whatFailed} hint={t.optional} options={t.errors} custom={customTags.errors} selected={errs} multi accent={RED} groupKey="errors" lang={lang} onToggle={(s) => toggle(errs, setErrs, s)} onAdd={(v) => { onAddTag('errors', v); setErrs((a) => a.includes(v) ? a : [...a, v]); }} onRename={onRenameTag} onAskDelete={(g, v) => setConfirmDel({ group: g, value: v })} addLabel={t.add} addPh={t.addPh} />

            {/* Riesgo → Resultado en R */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, margin: '14px 0 0', flexWrap: 'wrap' }}>
              <div>
                <span style={{ ...lbl, margin: '0 0 6px' }}>{t.risk} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· $</span></span>
                <input value={risk} onChange={(e) => setRisk(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={t.riskPh} style={{ margin: 0, width: 120, padding: '8px 10px', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, color: '#15181f', fontSize: 14 }} />
              </div>
              {rMultiple != null && (
                <div style={{ padding: '6px 12px', borderRadius: 10, background: rMultiple >= 0 ? 'rgba(52,226,160,.14)' : 'rgba(255,107,125,.14)', border: '1px solid ' + (rMultiple >= 0 ? GREEN : RED) }}>
                  <div className="muted" style={{ fontSize: 11 }}>{t.result}</div>
                  <b style={{ color: rMultiple >= 0 ? GREEN : RED, fontSize: 17 }}>{(rMultiple >= 0 ? '+' : '') + rMultiple.toFixed(2)}R</b>
                </div>
              )}
            </div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>{t.riskHint}</div>

            <span style={lbl}>{t.notes} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {t.optional}</span></span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={t.notesPh} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, color: '#15181f', fontSize: 14, fontFamily: 'inherit' }} />

            {/* Chequeo de reglas */}
            <div style={{ marginTop: 14, borderRadius: 12, border: '1px solid ' + (rules.has && rules.alerts.length ? RED : 'var(--line)'), background: rules.has && rules.alerts.length ? 'rgba(255,107,125,.08)' : 'var(--bg2)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: rules.has ? 6 : 0 }}>
                <OnyxIcon emoji={rules.has && rules.alerts.length ? '⚠️' : '🛡️'} size={16} />
                <b style={{ fontSize: 13 }}>{t.rulesTitle}</b>
              </div>
              {!rules.has ? (
                <div className="muted" style={{ fontSize: 12.5 }}>{t.rulesNoRules}</div>
              ) : rules.alerts.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>{rules.alerts.map((a, i) => <li key={i} style={{ color: RED, fontSize: 12.5, lineHeight: 1.6 }}>{a}</li>)}</ul>
              ) : (
                <div style={{ color: GREEN, fontSize: 12.5 }}>✓ {t.rulesOk}</div>
              )}
            </div>

            {/* Coach IA por trade */}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={askCoach} disabled={coaching} style={{ fontSize: 13 }}>{coaching ? t.coaching : '✨ ' + t.coach}</button>
              {coach && (
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', fontSize: 13.5, lineHeight: 1.6, color: 'var(--tx)' }}>{coach}</div>
              )}
            </div>
          </div>

          {/* Columna derecha: capturas de entrada y salida con zoom + quitar */}
          <div style={{ flex: '1 1 250px', minWidth: 0 }}>
            <span style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 600, display: 'block', marginBottom: 8 }}>{t.shots} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {t.optional}</span></span>
            <input ref={fileEntry} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, 'entry'); e.currentTarget.value = ''; }} />
            <input ref={fileExit} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, 'exit'); e.currentTarget.value = ''; }} />
            <ImgSlot url={img} label={t.entryShot} busy={uploading === 'entry'} tt={t} onUploadClick={() => fileEntry.current?.click()} onRemove={() => setImg('')} onZoom={() => setZoom(img)} />
            <ImgSlot url={imgExit} label={t.exitShot} busy={uploading === 'exit'} tt={t} onUploadClick={() => fileExit.current?.click()} onRemove={() => setImgExit('')} onZoom={() => setZoom(imgExit)} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12 }}>✓ {t.minHint}</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : (ok ? t.saved : t.save)}</button>
            <button className="btn btn-ghost" onClick={onClose}>{t.close}</button>
          </div>
        </div>
      </div>

      {/* Lightbox: foto en grande */}
      {zoom && (
        <div onClick={(e) => { e.stopPropagation(); setZoom(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 300, cursor: 'zoom-out' }}>
          <img src={zoom} alt="trade" style={{ maxWidth: '96vw', maxHeight: '92vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }} />
          <button onClick={(e) => { e.stopPropagation(); setZoom(''); }} aria-label="close" style={{ position: 'fixed', top: 16, right: 18, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Confirmación iluminada al borrar un tag propio */}
      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,16,.62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(94vw,400px)', background: 'var(--card)', border: '1px solid var(--amber)', borderRadius: 18, padding: 22, boxShadow: '0 0 0 1px var(--amber), 0 0 38px -8px var(--amber), 0 24px 60px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,192,77,.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)', fontSize: 19 }}>🗑</span>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t.delTitle} “{confirmDel.value}”</div>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--mut)', lineHeight: 1.6 }}>{t.delBody}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>{t.delCancel}</button>
              <button className="btn" style={{ background: RED, border: 'none', color: '#fff', fontWeight: 600 }} onClick={() => { onDeleteTag(confirmDel.group, confirmDel.value); setConfirmDel(null); }}>{t.delOk}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
