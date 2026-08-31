'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { toast } from '@/lib/toast';

type Lang = 'es' | 'en';
const T: any = {
  es: {
    title: 'Mis robots', sub: 'Cada cuenta es una tarjeta. Entra para ver sus robots. Abajo, arma y compara portafolios.',
    testing: 'En pruebas', live: 'En vivo', all: 'Todos', running: 'activo', idle: 'inactivo',
    net: 'Neto', pf: 'PF', dd: 'DD', win: 'Aciertos', ops: 'Ops', exp: 'Exp', rec: 'Recovery', opsDay: 'Ops/día',
    ready: 'Listo para vivo', promote: 'Promover a vivo', config: 'Config', detail: 'Métricas', save: 'Guardar', saved: 'Guardado',
    name: 'Nombre del bot', mode: 'Modo', mAuto: 'Automático', mTest: 'Forzar pruebas', mLive: 'Forzar vivo',
    crit: 'Criterios para graduar a vivo', cDays: 'Días mín.', cTrades: 'Ops mín.', cPf: 'PF mín.', cDd: 'DD máx. %',
    metrics: 'Métricas avanzadas', sharpe: 'Sharpe', sortino: 'Sortino', mar: 'MAR/Calmar', sqn: 'SQN', payoff: 'Payoff',
    ddDur: 'DD (días)', maxLoss: 'Máx. pérdidas seg.', monthsPos: '% meses +', exposure: 'Exposición', annual: 'Anualizado', avgWin: 'Gan. media', avgLoss: 'Pérd. media',
    stability: 'Stability (R²)', retDD: 'Ret/DD', mcT: 'Monte Carlo (95%)', mcDD: 'Drawdown peor 5%', mcRet: 'Retorno peor 5%', mcNote: 'Reordena las operaciones al azar para estimar el peor caso realista.', wfT: 'Walk-forward (por trimestre)', wfNet: 'Neto', wfNoData: 'Aún no hay suficientes operaciones.',
    btT: 'Backtest esperado (para comparar el vivo)', btPf: 'PF esperado', btWin: 'Win % esperado', btDd: 'DD % esperado', btHint: 'Copia los números del reporte del Strategy Tester.',
    divOk: '✓ en línea con el backtest', divWatch: '~ algo por debajo del backtest', divBad: '⚠ divergencia — revisa sobreajuste',
    divGood: 'buena', divMid: 'media', divLow: 'baja',
    online: 'EA en línea', offline: 'EA desconectado', bots: 'robots',
    statusRun: 'Operando', statusWait: 'Activo · en espera', statusOff: 'Inactivo',
    addBot: 'Añadir por magic', addBotT: 'Registrar un robot', magicL: 'Magic number', accountL: 'Cuenta',
    create: 'Registrar', cancel: 'Cancelar', pendingBadge: 'Sin operaciones aún',
    addBotHint: 'Escribe el magic number de tu EA para verlo aquí desde ya, aunque todavía no opere.', dupBot: 'Ya tienes un bot con ese magic en esta cuenta.',
    openNowLbl: 'abierta(s) ahora', floatLbl: 'flotante', del: 'Eliminar',
    detectedLbl: 'Magics detectados en esta cuenta (toca para usar):', detectedNone: 'Aún no se detecta ningún magic en esta cuenta. Si la operación fue manual, no lleva magic (es 0) y no cuenta como robot.', detectedTip: 'Usa el magic exacto que tu EA tiene en sus inputs. Si el EA ya operó, aparece aquí abajo.', builtLbl: 'Tus robots creados (toca para registrarlo):',
    noPair: 'Sin par', noneHere: 'Nada en este filtro.',
    lockT: 'Módulo de bots', lockD: 'Evalúa tus estrategias algorítmicas: KPIs por bot, pruebas vs vivo, criterios de graduación, backtest vs vivo y correlación de portafolio.', lockCta: 'Ver planes',
    addBtn: 'Añadir por $%/mes', addOr: 'o incluido en Black Onyx', addNeedSub: 'Necesitas un plan de pago activo para añadir el módulo. Elige uno abajo.',
    emptyT: 'Aún no vemos bots', emptyD: 'Cuando un EA opere en una cuenta conectada, aquí aparecerá por su magic number. Reinstala Onyx Connect si es una versión vieja (ahora reporta el magic).',
  },
  en: {
    title: 'My robots', sub: 'Each account is a card. Open it to see its robots. Below, build and compare portfolios.',
    testing: 'Testing', live: 'Live', all: 'All', running: 'active', idle: 'idle',
    net: 'Net', pf: 'PF', dd: 'DD', win: 'Win', ops: 'Trades', exp: 'Exp', rec: 'Recovery', opsDay: 'Trades/day',
    ready: 'Ready for live', promote: 'Promote to live', config: 'Config', detail: 'Metrics', save: 'Save', saved: 'Saved',
    name: 'Bot name', mode: 'Mode', mAuto: 'Automatic', mTest: 'Force testing', mLive: 'Force live',
    crit: 'Criteria to graduate to live', cDays: 'Min days', cTrades: 'Min trades', cPf: 'Min PF', cDd: 'Max DD %',
    metrics: 'Advanced metrics', sharpe: 'Sharpe', sortino: 'Sortino', mar: 'MAR/Calmar', sqn: 'SQN', payoff: 'Payoff',
    ddDur: 'DD (days)', maxLoss: 'Max consec. losses', monthsPos: '% months +', exposure: 'Exposure', annual: 'Annualized', avgWin: 'Avg win', avgLoss: 'Avg loss',
    stability: 'Stability (R²)', retDD: 'Ret/DD', mcT: 'Monte Carlo (95%)', mcDD: 'Worst-5% drawdown', mcRet: 'Worst-5% return', mcNote: 'Randomly reshuffles trades to estimate a realistic worst case.', wfT: 'Walk-forward (per quarter)', wfNet: 'Net', wfNoData: 'Not enough trades yet.',
    btT: 'Expected backtest (to compare live)', btPf: 'Expected PF', btWin: 'Expected win %', btDd: 'Expected DD %', btHint: 'Copy the numbers from your Strategy Tester report.',
    divOk: '✓ in line with backtest', divWatch: '~ a bit below backtest', divBad: '⚠ diverging — check overfitting',
    divGood: 'good', divMid: 'medium', divLow: 'low',
    online: 'EA online', offline: 'EA offline', bots: 'robots',
    statusRun: 'Running', statusWait: 'Active · idle', statusOff: 'Offline',
    addBot: 'Add by magic', addBotT: 'Register a robot', magicL: 'Magic number', accountL: 'Account',
    create: 'Register', cancel: 'Cancel', pendingBadge: 'No trades yet',
    addBotHint: 'Type your EA magic number to see it here right away, even before it trades.', dupBot: 'You already have a bot with that magic in this account.',
    openNowLbl: 'open now', floatLbl: 'floating', del: 'Delete',
    detectedLbl: 'Magics detected on this account (tap to use):', detectedNone: 'No magic detected on this account yet. If the trade was manual it has no magic (0) and does not count as a robot.', detectedTip: 'Use the exact magic your EA has in its inputs. If the EA already traded, it shows below.', builtLbl: 'Your created robots (tap to register):',
    noPair: 'No pair', noneHere: 'Nothing in this filter.',
    lockT: 'Bots module', lockD: 'Evaluate your algorithmic strategies: per-bot KPIs, testing vs live, graduation criteria, backtest vs live and portfolio correlation.', lockCta: 'See plans',
    addBtn: 'Add for $%/mo', addOr: 'or included in Black Onyx', addNeedSub: 'You need an active paid plan to add the module. Pick one below.',
    emptyT: 'No bots yet', emptyD: 'When an EA trades on a connected account it appears here by its magic number. Reinstall the Onyx Connector or Guardian if it is an old version (they now report the magic).',
  },
};

const money = (n: number) => (n >= 0 ? '+' : '−') + '$' + Math.round(Math.abs(n)).toLocaleString();
// Con 2 decimales y separador de miles (para los números grandes y del portafolio).
const money2 = (n: number) => (n >= 0 ? '+' : '−') + '$' + Math.abs(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num2 = (n: any) => (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = (n: any) => (Number.isFinite(Number(n)) ? Number(n) : 0).toFixed(1);

// ---- Correlación desde la curva (spark) de cada bot, calculada en el cliente ----
const rets = (s: number[]) => (s || []).slice(1).map((v, i) => v - s[i]);
function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const A = a.slice(a.length - n), B = b.slice(b.length - n);
  const ma = A.reduce((s, x) => s + x, 0) / n, mb = B.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = A[i] - ma, y = B[i] - mb; num += x * y; da += x * x; db += y * y; }
  if (da <= 0 || db <= 0) return null;
  return Math.max(-1, Math.min(1, num / Math.sqrt(da * db)));
}
// Curva combinada de un conjunto de bots (suma alineada por la cola).
function combinedCurve(sparks: number[][]): number[] {
  const valid = sparks.filter((s) => s && s.length >= 2);
  if (!valid.length) return [];
  const n = Math.min(...valid.map((s) => s.length));
  const out: number[] = new Array(n).fill(0);
  for (const s of valid) { const tail = s.slice(s.length - n); for (let i = 0; i < n; i++) out[i] += tail[i]; }
  return out;
}
function maxDD(curve: number[]): number {
  let peak = -Infinity, dd = 0;
  for (const v of curve) { if (v > peak) peak = v; dd = Math.max(dd, peak - v); }
  return dd;
}
function pfFromCurve(curve: number[]): number {
  const r = rets(curve); let up = 0, dn = 0;
  for (const x of r) { if (x >= 0) up += x; else dn += -x; }
  if (dn <= 0) return up > 0 ? 99 : 0;
  return Math.round((up / dn) * 100) / 100;
}
// Diversificación 0–100 a partir de la correlación media (abs) fuera de la diagonal.
function diversification(botsArr: any[]): number | null {
  const S = botsArr.map((b) => rets(b.spark || []));
  let sum = 0, cnt = 0;
  for (let i = 0; i < botsArr.length; i++) for (let j = i + 1; j < botsArr.length; j++) {
    const c = pearson(S[i], S[j]); if (c == null) continue; sum += Math.abs(c); cnt++;
  }
  if (!cnt) return null;
  return Math.round(100 * (1 - sum / cnt));
}

function AreaSpark({ pts, color, h = 42 }: { pts: number[]; color: string; h?: number }) {
  if (!pts || pts.length < 2) return <div style={{ height: h }} />;
  const w = 240, min = Math.min(...pts), max = Math.max(...pts), range = (max - min) || 1;
  const xy = pts.map((p, i) => [(i / (pts.length - 1)) * w, h - 5 - ((p - min) / range) * (h - 10)] as [number, number]);
  const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `M0,${h} ` + xy.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ` L${w},${h} Z`;
  const gid = 'sp' + Math.random().toString(36).slice(2, 8);
  const last = xy[xy.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', margin: '8px 0' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

export default function Bots() {
  const { lang } = useLang() as { lang: Lang };
  const t = dictFor(T, lang);
  const L = (a: string, b: string) => (lang === 'es' ? a : b);
  const [d, setD] = useState<any>(null);
  const [port, setPort] = useState<any>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'live' | 'testing'>('all');
  const [addFor, setAddFor] = useState<any>(null);
  const [addForm, setAddForm] = useState<any>({ magic: '', name: '', mode: 'testing' });
  const [built, setBuilt] = useState<any[]>([]);
  const [viewAcc, setViewAcc] = useState<string | null>(null);   // cuenta abierta (detalle aparte)
  const [sel, setSel] = useState<Set<string>>(new Set());        // bots elegidos para el laboratorio
  const [tourHide, setTourHide] = useState(true);                // franja de 5 pasos (oculta hasta leer localStorage)

  async function load() {
    try { const r = await fetch('/api/bots'); setD(await r.json()); } catch { setD({ bots: [] }); }
    try { const r = await fetch('/api/bots?view=portfolio'); setPort(await r.json()); } catch {}
  }
  async function loadBuilt() {
    try { const r = await fetch('/api/bots/build'); const j = await r.json(); setBuilt(Array.isArray(j.bots) ? j.bots : []); } catch {}
  }
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('onyx_port_sel') || '[]'); if (Array.isArray(s)) setSel(new Set(s)); } catch {}
    try { setTourHide(localStorage.getItem('onyx_bots_tour') === 'hide'); } catch { setTourHide(false); }
    load(); loadBuilt(); const iv = setInterval(load, 20000); return () => clearInterval(iv);
  }, []);
  useEffect(() => { try { localStorage.setItem('onyx_port_sel', JSON.stringify([...sel])); } catch {} }, [sel]);

  // Llaves de gating de la matriz de planes (editable en Admin). Si aún no cargó,
  // asumimos habilitado para no parpadear un bloqueo falso mientras llega el fetch.
  const caps = { advMetrics: d?.caps ? !!d.caps.advMetrics : true, portfolioLab: d?.caps ? !!d.caps.portfolioLab : true };
  // Tarjeta de upsell reutilizable cuando una capacidad no está en el plan.
  const UpsellBox = ({ title, desc }: { title: string; desc: string }) => (
    <div style={{ marginTop: 8, border: '1px dashed color-mix(in srgb,var(--brand) 45%,transparent)', background: 'color-mix(in srgb,var(--brand) 7%,transparent)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 13.5 }}>🔒 {title}</div>
      <div className="muted" style={{ fontSize: 12, margin: '6px 0 10px' }}>{desc}</div>
      <a href="/dashboard/cuenta?upgrade=1" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>{L('Mejorar plan', 'Upgrade plan')}</a>
    </div>
  );

  async function save(b: any, patch: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/bots', { method: 'PATCH', body: JSON.stringify({ magic: b.magic, account_id: b.accountId, ...patch }) });
      if (r.ok) { toast(t.saved, 'ok'); setEdit(null); await load(); }
      else { const j = await r.json().catch(() => ({})); toast(j.message || j.error || 'error'); }
    } finally { setBusy(false); }
  }
  function openEdit(b: any) {
    setEdit(b.key); setDetail(null);
    setForm({ name: b.name, mode: 'auto', ...b.criteria, btPf: b.backtest?.pf ?? '', btWin: b.backtest?.winRate ?? '', btDd: b.backtest?.maxDD ?? '' });
  }
  async function delBot(b: any) {
    if (!window.confirm(lang === 'es' ? `¿Eliminar el robot "${b.name}"? Se quita de la lista (su historial de operaciones no se borra).` : `Delete robot "${b.name}"? It is removed from the list (its trade history is kept).`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/bots', { method: 'DELETE', body: JSON.stringify({ magic: b.magic, account_id: b.accountId }) });
      if (r.ok) { toast(t.saved, 'ok'); setEdit(null); setDetail(null); await load(); }
      else { const j = await r.json().catch(() => ({})); toast(j.error || 'error'); }
    } finally { setBusy(false); }
  }
  async function createBot() {
    const magic = Number(addForm.magic);
    if (!Number.isFinite(magic) || magic === 0) return;
    if ((d?.bots || []).some((x: any) => x.accountId === addFor.accountId && Number(x.magic) === magic)) { toast(t.dupBot); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/bots', { method: 'PATCH', body: JSON.stringify({ magic, account_id: addFor.accountId, name: addForm.name || `Bot #${magic}`, mode: addForm.mode }) });
      if (r.ok) { toast(t.saved, 'ok'); setAddFor(null); setAddForm({ magic: '', name: '', mode: 'testing' }); await load(); }
      else { const j = await r.json().catch(() => ({})); toast(j.message || j.error || 'error'); }
    } finally { setBusy(false); }
  }
  async function buyAddon() {
    setBusy(true);
    try {
      const r = await fetch('/api/account/addon-algo', { method: 'POST', body: JSON.stringify({ on: true }) });
      const j = await r.json();
      if (r.ok) { toast(t.saved, 'ok'); await load(); }
      else toast(j.code === 'no_sub' ? t.addNeedSub : (j.error || 'error'));
    } finally { setBusy(false); }
  }

  const bots: any[] = d?.bots || [];
  const botKey = (b: any) => `${b.accountId}:${b.magic}`;
  const botOf = (k: string) => bots.find((b: any) => botKey(b) === k);
  // Orden estable: cuentas por nombre; bots por magic (no cambia al refrescar).
  const accountsSorted = useMemo(() => [...(d?.accounts || [])].sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))), [d]);
  const botsOfAcc = (accId: string) => bots.filter((b: any) => b.accountId === accId).sort((a: any, b: any) => Number(a.magic) - Number(b.magic));

  const Metric = ({ k, v }: { k: string; v: any }) => (
    <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '6px 8px' }}>
      <div className="muted" style={{ fontSize: 10 }}>{k}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{v}</div>
    </div>
  );

  const Card = ({ b }: { b: any }) => {
    const up = b.net >= 0; const m = b.metrics || {};
    const dv = b.divergence;
    const accent = up ? 'var(--green)' : 'var(--red)';
    const stColor = b.status === 'operando' ? 'var(--green)' : b.status === 'espera' ? 'var(--brand)' : 'var(--mut)';
    const stTxt = b.status === 'operando' ? t.statusRun : b.status === 'espera' ? t.statusWait : t.statusOff;
    const extra = (b.symbols?.length || 0) - 1;
    return (
      <div style={{
        background: 'var(--card)', border: '1px solid var(--line)', borderLeft: `3px solid ${accent}`,
        borderRadius: 14, padding: '12px 13px', display: 'flex', flexDirection: 'column',
        boxShadow: b.status === 'operando' ? '0 0 0 1px color-mix(in srgb,var(--green) 22%,transparent)' : 'none',
      }}>
        <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
          <div className="row" style={{ gap: 7, alignItems: 'center', minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{b.pair || t.noPair}</span>
            {extra > 0 && <span className="muted" style={{ fontSize: 10.5 }}>+{extra}</span>}
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', padding: '1px 5px', borderRadius: 5, color: b.mode === 'live' ? 'var(--green)' : 'var(--amber)', border: `1px solid color-mix(in srgb,${b.mode === 'live' ? 'var(--green)' : 'var(--amber)'} 45%,transparent)` }}>{b.mode === 'live' ? 'LIVE' : 'TEST'}</span>
          </div>
          <span style={{ fontSize: 11, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, color: stColor }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: stColor, boxShadow: b.status === 'operando' ? '0 0 0 3px color-mix(in srgb,var(--green) 22%,transparent)' : 'none' }} />
            {stTxt}
          </span>
        </div>
        <div className="muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name} · #{b.magic}{b.pending && <span style={{ marginLeft: 5, color: 'var(--amber)' }}>· {t.pendingBadge}</span>}</div>

        <AreaSpark pts={b.spark} color={accent} />

        <div style={{ fontSize: 22, fontWeight: 800, color: accent, marginBottom: 6 }}>{money2(b.net)}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', fontSize: 11.5, marginBottom: b.mode === 'testing' || b.open?.count > 0 ? 8 : 2 }}>
          <span className="muted">{t.pf} <b style={{ color: 'var(--tx)' }}>{num2(b.pf)}</b></span>
          <span className="muted">{t.win} <b style={{ color: 'var(--tx)' }}>{pct1(b.winRate)}%</b></span>
          <span className="muted">{t.dd} <b style={{ color: b.ddPct > (b.criteria?.maxDD ?? 10) ? 'var(--amber)' : 'var(--tx)' }}>{pct1(b.ddPct)}%</b></span>
          <span className="muted">{t.ops} <b style={{ color: 'var(--tx)' }}>{b.trades}</b></span>
        </div>

        {/* Aviso según el estado real del robot: "en espera" (conectado, sin señal)
            → informativo/calmado; "desconectado" (EA no reporta) → acción. */}
        {!b.pending && b.status !== 'operando' && (b.open?.count || 0) === 0 && (
          b.status === 'espera'
            ? <div style={{ marginBottom: 8, fontSize: 11, display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--mut)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 8px' }}>
                <OnyxIcon emoji="⏳" size={11} glow={false} />
                <span>{L('En espera: el robot está conectado pero no hay señal ahora. Suele ser porque está fuera de su horario/sesión o aún no aparece su entrada.', 'On standby: the robot is connected but there\'s no signal right now. Usually it\'s outside its session/hours or its setup hasn\'t appeared yet.')}</span>
              </div>
            : <div style={{ marginBottom: 8, fontSize: 11, display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 9%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 28%,transparent)', borderRadius: 8, padding: '5px 8px' }}>
                <OnyxIcon emoji="🔌" size={11} glow={false} />
                <span>{L('Sin conexión: el EA no ha reportado. Ponlo en esta cuenta con su número magic y AutoTrading activo.', 'No connection: the EA hasn\'t reported. Attach it to this account with its magic number and AutoTrading on.')}</span>
              </div>
        )}

        {b.open?.count > 0 && (
          <div style={{ marginBottom: 8, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 32%,transparent)', borderRadius: 8, padding: '5px 8px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 3px color-mix(in srgb,var(--green) 22%,transparent)' }} />
            <span><b>{b.open.count}</b> {t.openNowLbl} · {t.floatLbl} <b style={{ color: b.open.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{money2(b.open.profit)}</b></span>
          </div>
        )}

        {b.mode === 'testing' && (
          <div style={{ marginBottom: 8 }}>
            <div className="row between" style={{ fontSize: 10.5, marginBottom: 4 }}>
              <span className="muted">{t.ready}</span>
              <span style={{ color: b.passed === b.total ? 'var(--green)' : 'var(--amber)' }}>{b.passed}/{b.total}</span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: 'var(--bg2)', overflow: 'hidden' }}>
              <div style={{ width: `${(b.passed / (b.total || 4)) * 100}%`, height: '100%', background: b.passed === b.total ? 'var(--green)' : 'linear-gradient(90deg,var(--amber),#ffd36b)' }} />
            </div>
            {/* Qué le falta para graduarse: cada criterio con ✓/✗ y su meta (para que sepa qué mejorar) */}
            {b.passed < b.total && Array.isArray(b.checks) && (() => {
              const CRIT_LBL: Record<string, string> = {
                minDays: L(`${b.days || 0}/${b.criteria?.minDays} días`, `${b.days || 0}/${b.criteria?.minDays} days`),
                minTrades: L(`${b.trades}/${b.criteria?.minTrades} ops`, `${b.trades}/${b.criteria?.minTrades} trades`),
                pf: `PF ${num2(b.pf)}/${b.criteria?.pf}`,
                maxDD: L(`DD ${pct1(b.ddPct)}%/máx ${b.criteria?.maxDD}%`, `DD ${pct1(b.ddPct)}%/max ${b.criteria?.maxDD}%`),
              };
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {b.checks.map((c: any) => (
                    <span key={c.k} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4, color: c.ok ? 'var(--green)' : 'var(--amber)', background: `color-mix(in srgb,${c.ok ? 'var(--green)' : 'var(--amber)'} 12%,transparent)`, border: `1px solid color-mix(in srgb,${c.ok ? 'var(--green)' : 'var(--amber)'} 32%,transparent)` }}>
                      <OnyxIcon emoji={c.ok ? '✓' : '•'} size={9} glow={false} /> {CRIT_LBL[c.k] || c.k}
                    </span>
                  ))}
                </div>
              );
            })()}
            {b.passed === b.total && b.trades > 0 && <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, fontSize: 12 }} onClick={() => save(b, { mode: 'live' })} disabled={busy}>↗ {t.promote}</button>}
          </div>
        )}
        {b.mode === 'live' && dv && (
          <div style={{ marginBottom: 6, fontSize: 11, color: dv.status === 'diverge' ? 'var(--red)' : dv.status === 'watch' ? 'var(--amber)' : 'var(--green)' }}>
            {dv.status === 'diverge' ? t.divBad : dv.status === 'watch' ? t.divWatch : t.divOk} {dv.deltaPct != null && `(PF ${dv.deltaPct > 0 ? '+' : ''}${dv.deltaPct}%)`}
          </div>
        )}

        <div className="row" style={{ gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} title={b.trades === 0 ? L('Disponible cuando el robot tenga su primera operación.', 'Available once the robot has its first trade.') : ''} onClick={() => { setDetail(detail === b.key ? null : b.key); setEdit(null); }} disabled={b.trades === 0}><OnyxIcon emoji="📊" size={15} /> {t.detail}</button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => (edit === b.key ? setEdit(null) : openEdit(b))}><OnyxIcon emoji="⚙" size={15} /> {t.config}</button>
          <button className="btn btn-ghost" title={L('Añadir/quitar del laboratorio de portafolio', 'Add/remove from the portfolio lab')} style={{ fontSize: 11.5, padding: '5px 10px', color: sel.has(botKey(b)) ? 'var(--brand)' : 'var(--mut)', borderColor: sel.has(botKey(b)) ? 'var(--brand)' : undefined }} onClick={() => toggleSel(botKey(b))}><OnyxIcon emoji="🧩" size={14} /> {sel.has(botKey(b)) ? L('En portafolio', 'In portfolio') : L('Al portafolio', 'To portfolio')}</button>
          {b.pending && <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px', color: 'var(--red)', marginLeft: 'auto' }} onClick={() => delBot(b)} disabled={busy}><OnyxIcon emoji="🗑" size={14} /></button>}
        </div>

        {detail === b.key && !caps.advMetrics && (
          <UpsellBox title={L('Métricas avanzadas', 'Advanced metrics')} desc={L('Sharpe, Sortino, Monte Carlo y walk-forward están disponibles en Trader y Black Onyx.', 'Sharpe, Sortino, Monte Carlo and walk-forward are available on Trader and Black Onyx.')} />
        )}
        {detail === b.key && caps.advMetrics && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{t.metrics}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              <Metric k={t.sharpe} v={m.sharpe} /><Metric k={t.sortino} v={m.sortino} /><Metric k={t.mar} v={m.mar} />
              <Metric k={t.sqn} v={m.sqn} /><Metric k={t.payoff} v={m.payoff} /><Metric k={t.ddDur} v={m.ddDur} />
              <Metric k={t.maxLoss} v={m.maxConsecLoss} /><Metric k={t.monthsPos} v={m.monthsPos + '%'} /><Metric k={t.exposure} v={m.exposure + '%'} />
              <Metric k={t.annual} v={money(m.annualNet)} /><Metric k={t.avgWin} v={money(m.avgWin)} /><Metric k={t.avgLoss} v={money(-m.avgLoss)} />
              <Metric k={t.stability} v={m.stability} /><Metric k={t.retDD} v={m.retDD} /><Metric k={t.rec} v={b.recovery} />
            </div>
            {m.mc ? (
              <div style={{ marginTop: 10 }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{t.mcT}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                  <Metric k={t.mcDD} v={money(-m.mc.p95dd)} /><Metric k={t.mcRet} v={money(m.mc.p5ret)} />
                </div>
                <p className="muted" style={{ fontSize: 10.5, margin: '4px 0 0' }}>{t.mcNote}</p>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 10.5, marginTop: 10 }}><OnyxIcon emoji="🎲" size={11} /> {L('El análisis Monte Carlo aparece cuando el robot acumula 20+ operaciones cerradas.', 'The Monte Carlo analysis appears once the robot has 20+ closed trades.')}</p>
            )}
            {Array.isArray(m.wf) && m.wf.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{t.wfT}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.wf.map((q: any) => (
                    <div key={q.label} style={{ flex: '1 1 92px', minWidth: 92, background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '6px 8px' }}>
                      <div className="muted" style={{ fontSize: 10.5 }}>{q.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: q.net >= 0 ? 'var(--soft-green,#34e2a0)' : 'var(--red,#ff6b7d)' }}>{money(q.net)}</div>
                      <div className="muted" style={{ fontSize: 10.5 }}>PF {q.pf} · {q.win}% · {q.trades}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 10.5, marginTop: 10 }}><OnyxIcon emoji="📆" size={11} /> {t.wfT}: {t.wfNoData}</p>
            )}
          </div>
        )}

        {edit === b.key && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><span className="muted" style={{ fontSize: 11 }}>{t.name}</span><input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ margin: '3px 0 0', fontSize: 13 }} /></div>
            <div><span className="muted" style={{ fontSize: 11 }}>{t.mode}</span>
              <select value={form.mode || 'auto'} onChange={(e) => setForm({ ...form, mode: e.target.value })} style={{ margin: '3px 0 0', fontSize: 13 }}>
                <option value="auto">{t.mAuto}</option><option value="testing">{t.mTest}</option><option value="live">{t.mLive}</option>
              </select>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>{t.crit}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[['minDays', t.cDays], ['minTrades', t.cTrades], ['pf', t.cPf], ['maxDD', t.cDd]].map(([k, lab]: any) => (
                <div key={k} style={{ flex: '1 1 44%' }}><span className="muted" style={{ fontSize: 10.5 }}>{lab}</span><input type="number" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ margin: '2px 0 0', fontSize: 13 }} /></div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>{t.btT}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[['btPf', t.btPf], ['btWin', t.btWin], ['btDd', t.btDd]].map(([k, lab]: any) => (
                <div key={k} style={{ flex: '1 1 30%' }}><span className="muted" style={{ fontSize: 10.5 }}>{lab}</span><input type="number" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ margin: '2px 0 0', fontSize: 13 }} /></div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 10.5 }}>{t.btHint}</div>
            <button className="btn btn-primary" style={{ fontSize: 12.5 }} disabled={busy}
              onClick={() => save(b, { name: form.name, mode: form.mode, criteria: { minDays: form.minDays, minTrades: form.minTrades, pf: form.pf, maxDD: form.maxDD }, backtest: { pf: form.btPf, winRate: form.btWin, maxDD: form.btDd } })}>{t.save}</button>
          </div>
        )}
      </div>
    );
  };

  function toggleSel(k: string) { setSel((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); }

  const corrCell = (v: number) => {
    if (v >= 0.6) return `rgba(247,107,107,${(0.20 + 0.35 * Math.min(1, (v - 0.6) / 0.4)).toFixed(2)})`;
    if (v >= 0.3) return `rgba(245,181,68,${(0.16 + 0.22 * ((v - 0.3) / 0.3)).toFixed(2)})`;
    if (v >= 0) return `rgba(52,211,168,${(0.10 + 0.16 * (1 - v / 0.3)).toFixed(2)})`;
    return `rgba(52,211,168,${(0.28 + 0.22 * Math.min(1, -v)).toFixed(2)})`;
  };
  const seg = (v: 'all' | 'live' | 'testing', label: string, n: number) => (
    <button onClick={() => setFilter(v)} style={{ background: filter === v ? 'color-mix(in srgb,var(--brand) 20%,transparent)' : 'transparent', border: 'none', color: filter === v ? 'var(--tx)' : 'var(--mut)', fontWeight: filter === v ? 600 : 400, padding: '6px 13px', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>{label} <span style={{ fontSize: 10.5, opacity: .7 }}>{n}</span></button>
  );

  // ---- Laboratorio de portafolio (bots elegidos) ----
  const selBots = useMemo(() => [...sel].map(botOf).filter(Boolean) as any[], [sel, bots]);
  const labStats = useMemo(() => {
    if (selBots.length < 1) return null;
    const curve = combinedCurve(selBots.map((b) => b.spark || []));
    const net = selBots.reduce((s, b) => s + (b.net || 0), 0);
    const div = diversification(selBots);
    return { curve, net, dd: maxDD(curve), pf: pfFromCurve(curve), div };
  }, [selBots]);
  const labMatrix = useMemo(() => {
    const S = selBots.map((b) => rets(b.spark || []));
    return selBots.map((_, i) => selBots.map((__, j) => (i === j ? 1 : (pearson(S[i], S[j]) ?? 0))));
  }, [selBots]);

  // ---- Sugerencias: universo = bots con curva y expectativa positiva ----
  const canCorr = (b: any) => (b.spark?.length || 0) >= 3 && b.trades > 0;   // se puede correlacionar
  const universe = useMemo(() => bots.filter(canCorr), [bots]);
  const avgCorrOf = (arr: any[]) => { const d2 = diversification(arr); return d2 == null ? null : (100 - d2) / 100; };
  function greedyLowCorr(pool: any[], size: number, seed?: any) {
    if (!pool.length) return [];
    const chosen = [seed || pool.slice().sort((a, b) => (b.net || 0) - (a.net || 0))[0]];
    while (chosen.length < size && chosen.length < pool.length) {
      let best: any = null, bestScore = Infinity;
      for (const c of pool) {
        if (chosen.includes(c)) continue;
        const sc = avgCorrOf([...chosen, c]);
        const score = (sc == null ? 0.5 : sc) - (c.net > 0 ? 0.05 : 0);   // premia baja correlación + expectativa positiva
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (!best) break; chosen.push(best);
    }
    return chosen;
  }
  const suggestions = useMemo(() => {
    const pos = universe.filter((b: any) => (b.net || 0) > 0);
    const pool = pos.length >= 2 ? pos : universe;
    if (pool.length < 2) return null;
    const pack = (arr: any[]) => ({ bots: arr, div: diversification(arr), dd: maxDD(combinedCurve(arr.map((b) => b.spark || []))), net: arr.reduce((s, b) => s + (b.net || 0), 0), key: arr.map((b) => b.magic).sort().join(',') });
    // Defensivo: arranca del bot de menor DD y añade poco correlacionados (más estabilidad).
    const seedLowDD = pool.slice().sort((a, b) => (Number(a.ddPct) || 0) - (Number(b.ddPct) || 0))[0];
    const defensive = pack(greedyLowCorr(pool, Math.min(3, pool.length), seedLowDD));
    // Equilibrado: mayor mezcla de expectativa + diversificación (hasta 4).
    const balanced = pack(greedyLowCorr(pool, Math.min(4, pool.length)));
    // Agresivo: los de mayor ganancia (sin mirar correlación).
    const aggressive = pack(pool.slice().sort((a, b) => (b.net || 0) - (a.net || 0)).slice(0, Math.min(3, pool.length)));
    const distinct = new Set([defensive.key, balanced.key, aggressive.key]).size > 1;
    return { defensive, balanced, aggressive, distinct, best: balanced };
  }, [universe]);
  // Bot que más diversifica: el que más sube la diversificación del portafolio actual.
  const bestToAdd = useMemo(() => {
    if (selBots.length < 1) return null;
    const cur = diversification(selBots) ?? 0;
    let best: any = null, bestDiv = cur;
    for (const b of universe) { if (sel.has(botKey(b))) continue; const dvn = diversification([...selBots, b]); if (dvn != null && dvn > bestDiv) { bestDiv = dvn; best = { bot: b, div: dvn }; } }
    return best;
  }, [selBots, universe, sel]);

  const applyPreset = (arr: any[]) => setSel(new Set(arr.map(botKey)));
  const chipLabel = (b: any) => `${b.pair || b.name?.slice(0, 8) || '#' + b.magic}`;
  const divTxt = (v: number | null) => v == null ? '—' : `${v}%`;
  const divCol = (v: number | null) => v == null ? 'var(--mut)' : v >= 60 ? 'var(--green)' : v >= 35 ? 'var(--amber)' : 'var(--red)';

  // Progreso aproximado del recorrido de 5 pasos.
  const hasCreated = built.length > 0;
  const hasRegistered = bots.length > 0;          // un bot aparece aquí cuando el EA reporta (ya instalado + con clave)
  const hasTrades = bots.some((b: any) => b.trades > 0);
  const tourDone = hasRegistered ? (hasTrades ? 5 : 4) : (hasCreated ? 1 : 0);
  const hideTour = () => { setTourHide(true); try { localStorage.setItem('onyx_bots_tour', 'hide'); } catch {} };
  const tourSteps = [
    { ic: '➕', tx: L('Crea el robot', 'Create the robot') },
    { ic: '⬇️', tx: L('Descárgalo', 'Download it') },
    { ic: '🔌', tx: L('Instálalo', 'Install it') },
    { ic: '🔑', tx: L('Pega tu clave', 'Paste your key') },
    { ic: '📊', tx: L('Ve tus KPIs', 'See your KPIs') },
  ];
  const tourNote = tourDone >= 5 ? L('¡Listo! Tus robots ya operan; aquí ves sus KPIs.', 'Done! Your robots are trading; you see their KPIs here.')
    : tourDone >= 4 ? L('Instalado y conectado. Cuando el robot cierre operaciones, verás sus KPIs aquí abajo.', 'Installed and connected. Once the robot closes trades, you\'ll see its KPIs below.')
    : tourDone >= 1 ? L('Ya creaste un robot. Descárgalo e instálalo en tu plataforma, pega tu clave Onyx y empezará a operar.', 'You created a robot. Download and install it, paste your Onyx key and it will start trading.')
    : L('Empieza creando tu primer robot. Te guiamos paso a paso hasta verlo operar aquí.', 'Start by creating your first robot. We guide you step by step until you see it trading here.');

  return (
    <div className="wrap" style={{ padding: '24px 0 60px', maxWidth: 1180, fontSize: 15 }}>
      <div className="row between" style={{ padding: '0 4px', marginBottom: 16, flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 24 }}><OnyxIcon emoji="🤖" size={16} /> {t.title}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{t.sub}</p>
          <p className="muted" style={{ marginTop: 4, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="💡" size={12} /> {L('Tus robots aparecen aquí solos cuando su EA opera con su número magic en una cuenta conectada.', 'Your robots show up here automatically when their EA trades with its magic number on a connected account.')}</p>
        </div>
        <Link href="/dashboard/constructor" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, padding: '11px 20px', boxShadow: '0 0 0 1px var(--brand), 0 6px 18px color-mix(in srgb, var(--brand) 45%, transparent)' }}><OnyxIcon emoji="➕" size={15} glow={false} /> {lang === 'es' ? 'Crear robot' : 'Create robot'}</Link>
      </div>

      {!d && <div className="card muted">…</div>}

      {d?.locked && (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}><OnyxIcon emoji="🤖" size={16} /></div>
          <h3 style={{ marginBottom: 6 }}>{t.lockT}</h3>
          <p className="muted" style={{ fontSize: 14, maxWidth: 460, margin: '0 auto 14px' }}>{t.lockD}</p>
          {d.addon?.enabled ? (
            <>
              <button className="btn btn-primary" onClick={buyAddon} disabled={busy} style={{ marginBottom: 8 }}>{(t.addBtn as string).replace('%', String(d.addon.price))}</button>
              <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.addOr}</div>
              <Link className="btn btn-ghost" href="/pricing">{t.lockCta}</Link>
            </>
          ) : (
            <Link className="btn btn-primary" href="/pricing">{t.lockCta}</Link>
          )}
        </div>
      )}

      {d && !d.locked && !bots.length && d.needsMigration && (
        <div className="card" style={{ textAlign: 'center', padding: 28, border: '1px solid var(--amber)' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}><OnyxIcon emoji="🛠️" size={18} /></div>
          <h3 style={{ marginBottom: 6 }}>{lang === 'es' ? 'Falta una actualización de la base de datos' : 'A database update is missing'}</h3>
          <p className="muted" style={{ fontSize: 14, maxWidth: 560, margin: '0 auto' }}>{lang === 'es'
            ? 'Tu tabla de operaciones aún no tiene la columna “magic”, que es como se identifica cada robot. Corre el SQL de robots en Supabase (supabase/bots.sql) una sola vez y vuelve a sincronizar; entonces tus robots aparecerán aquí solos.'
            : 'Your trades table doesn\'t have the “magic” column yet, which is how each robot is identified. Run the bots SQL in Supabase (supabase/bots.sql) once and re-sync; then your robots will show up here automatically.'}</p>
        </div>
      )}

      {d && !d.locked && !d.needsMigration && !(d.accounts?.length) && (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}><OnyxIcon emoji="📡" size={16} /></div>
          <h3 style={{ marginBottom: 6 }}>{t.emptyT}</h3>
          <p className="muted" style={{ fontSize: 14, maxWidth: 520, margin: '0 auto 16px' }}>{t.emptyD}</p>
          <Link href="/dashboard/constructor" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, padding: '11px 22px' }}><OnyxIcon emoji="➕" size={14} glow={false} /> {L('Crea tu primer robot', 'Create your first robot')}</Link>
        </div>
      )}

      {/* ====== DETALLE DE UNA CUENTA (página aparte) ====== */}
      {d && !d.locked && !d.needsMigration && viewAcc && (() => {
        const acc = accountsSorted.find((a: any) => a.id === viewAcc);
        if (!acc) { setViewAcc(null); return null; }
        const mine = botsOfAcc(acc.id);
        const shown = mine.filter((b: any) => filter === 'all' || b.mode === filter);
        const running = mine.filter((b: any) => b.status === 'operando').length;
        const accNet = mine.reduce((s: number, b: any) => s + (b.net || 0), 0);
        return (
          <>
            <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => setViewAcc(null)}>← {L('Todas las cuentas', 'All accounts')}</button>
            <div className="card" style={{ marginBottom: 14, borderColor: acc.online ? 'color-mix(in srgb,var(--green) 30%,var(--line))' : 'var(--line)' }}>
              <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div className="row" style={{ gap: 11, alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: acc.online ? 'var(--green)' : 'var(--mut)', boxShadow: acc.online ? '0 0 0 4px color-mix(in srgb,var(--green) 20%,transparent)' : 'none' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{acc.name}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{mine.length} {t.bots} · <b style={{ color: accNet >= 0 ? 'var(--green)' : 'var(--red)' }}>{money2(accNet)}</b> · {acc.online ? t.online : t.offline}{running ? ` · ${running} ${t.statusRun.toLowerCase()}` : ''}</div>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => { setAddFor({ accountId: acc.id, accName: acc.name }); setAddForm({ magic: '', name: '', mode: 'testing' }); }}>＋ {t.addBot}</button>
              </div>
            </div>
            <div className="row" style={{ marginBottom: 14 }}>
              <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {seg('all', t.all, mine.length)}
                {seg('live', t.live, mine.filter((b) => b.mode === 'live').length)}
                {seg('testing', t.testing, mine.filter((b) => b.mode === 'testing').length)}
              </div>
            </div>
            {shown.length === 0
              ? <div className="card muted" style={{ fontSize: 13 }}>{mine.length === 0 ? L('Aún sin robots en esta cuenta.', 'No robots on this account yet.') : t.noneHere}</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(248px,1fr))', gap: 12, alignItems: 'start' }}>{shown.map((b: any) => <Card key={b.key} b={b} />)}</div>}
          </>
        );
      })()}

      {/* ====== TABLERO: CUENTAS COMO TARJETAS GRANDES ====== */}
      {d && !d.locked && !d.needsMigration && !viewAcc && !!(d.accounts?.length) && (
        <>
          {/* Recorrido guiado de 5 pasos: dónde estás y qué sigue */}
          {!tourHide && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'color-mix(in srgb,var(--brand) 30%,var(--line))' }}>
              <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}><OnyxIcon emoji="🗺️" size={14} /> {L('Cómo tener tu robot operando', 'How to get your robot trading')}</span>
                <span className="muted" style={{ fontSize: 12 }}>{L(`Paso ${Math.min(tourDone + 1, 5)} de 5`, `Step ${Math.min(tourDone + 1, 5)} of 5`)} <button onClick={hideTour} title={L('Ocultar', 'Hide')} style={{ background: 'none', border: 'none', color: 'var(--mut)', cursor: 'pointer', marginLeft: 6, fontSize: 13 }}>✕</button></span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tourSteps.map((s, i) => {
                  const done = i < tourDone, cur = i === tourDone;
                  return (
                    <div key={i} style={{ flex: '1 1 120px', minWidth: 118, borderRadius: 10, padding: '9px 10px', background: done ? 'color-mix(in srgb,var(--green) 12%,transparent)' : cur ? 'color-mix(in srgb,var(--brand) 15%,transparent)' : 'var(--bg2)', border: '1px solid ' + (cur ? 'color-mix(in srgb,var(--brand) 45%,transparent)' : 'transparent') }}>
                      <div style={{ fontSize: 12, fontWeight: cur ? 700 : 600, color: done ? 'var(--green)' : cur ? 'var(--brand)' : 'var(--mut)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <OnyxIcon emoji={done ? '✅' : s.ic} size={12} /> {i + 1} · {s.tx}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 11, background: 'var(--bg2)', borderRadius: 10, padding: '9px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span><OnyxIcon emoji="💡" size={12} /> {tourNote}</span>
                {tourDone < 1 && <Link href="/dashboard/constructor" className="btn btn-primary" style={{ fontSize: 12.5, marginLeft: 'auto' }}><OnyxIcon emoji="➕" size={12} glow={false} /> {L('Crear mi primer robot', 'Create my first robot')}</Link>}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14, marginBottom: 22 }}>
            {accountsSorted.map((acc: any) => {
              const mine = botsOfAcc(acc.id);
              const running = mine.filter((b: any) => b.status === 'operando').length;
              const accNet = mine.reduce((s: number, b: any) => s + (b.net || 0), 0);
              const best = mine.slice().sort((a, b) => (b.net || 0) - (a.net || 0))[0];
              const worst = mine.slice().sort((a, b) => (a.net || 0) - (b.net || 0))[0];
              const ddMax = mine.reduce((mx, b) => Math.max(mx, Number(b.ddPct) || 0), 0);
              const curve = combinedCurve(mine.map((b: any) => b.spark || []));
              const up = accNet >= 0; const accent = up ? 'var(--green)' : 'var(--red)';
              return (
                <button key={acc.id} onClick={() => { setViewAcc(acc.id); setFilter('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--card)', border: '1px solid ' + (acc.online ? 'color-mix(in srgb,var(--green) 30%,var(--line))' : 'var(--line)'), borderRadius: 16, padding: 15, display: 'flex', flexDirection: 'column', gap: 4, boxShadow: acc.online ? '0 0 0 1px color-mix(in srgb,var(--green) 16%,transparent)' : 'none' }}>
                  <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: acc.online ? 'var(--green)' : 'var(--mut)', boxShadow: acc.online ? '0 0 0 3px color-mix(in srgb,var(--green) 22%,transparent)' : 'none' }} />
                      <span style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.name}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', color: acc.online ? 'var(--green)' : 'var(--mut)', background: acc.online ? 'color-mix(in srgb,var(--green) 12%,transparent)' : 'var(--bg2)', padding: '2px 8px', borderRadius: 99 }}>{acc.online ? t.online : t.offline}</span>
                  </div>
                  <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 25, fontWeight: 800, color: accent }}>{money2(accNet)}</span>
                    <span className="muted" style={{ fontSize: 12 }}>net · {mine.length} {t.bots}{running ? ` · ${running} ${t.statusRun.toLowerCase()}` : ''}</span>
                  </div>
                  {curve.length >= 2 ? <AreaSpark pts={curve} color={accent} /> : <div style={{ height: 42 }} />}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 9px' }}><div className="muted" style={{ fontSize: 10.5 }}>{L('Mejor bot', 'Best bot')}</div><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{best ? `${best.pair || best.name} ${money2(best.net)}` : '—'}</div></div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 9px' }}><div className="muted" style={{ fontSize: 10.5 }}>{L('Peor bot', 'Worst bot')}</div><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{worst ? `${worst.pair || worst.name} ${money2(worst.net)}` : '—'}</div></div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 9px' }}><div className="muted" style={{ fontSize: 10.5 }}>{L('DD máx.', 'Max DD')}</div><div style={{ fontSize: 12.5, fontWeight: 700, color: ddMax > 10 ? 'var(--amber)' : 'var(--tx)' }}>{pct1(ddMax)}%</div></div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 9px' }}><div className="muted" style={{ fontSize: 10.5 }}>{L('Diversificación', 'Diversification')}</div><div style={{ fontSize: 12.5, fontWeight: 700, color: divCol(diversification(mine)) }}>{divTxt(diversification(mine))}</div></div>
                  </div>
                  <div style={{ marginTop: 11, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(90deg,#6f77ea,#5b63d3)', borderRadius: 11, padding: '10px', boxShadow: '0 6px 16px color-mix(in srgb,var(--brand) 40%,transparent)', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><OnyxIcon emoji="📊" size={14} glow={false} /> {L(`Ver los ${mine.length} robots`, `See the ${mine.length} robots`)} →</div>
                </button>
              );
            })}
          </div>

          {/* ====== LABORATORIO DE PORTAFOLIO ====== */}
          {!caps.portfolioLab && (
            <div className="card" style={{ padding: '18px 16px', marginBottom: 16, textAlign: 'center' }}>
              <h3 style={{ marginBottom: 4 }}><OnyxIcon emoji="🧪" size={16} /> {L('Laboratorio de portafolio', 'Portfolio lab')}</h3>
              <UpsellBox title={L('Laboratorio de portafolio + correlación', 'Portfolio lab + correlation')} desc={L('Combina tus robots, mira su correlación y recibe portafolios sugeridos. Disponible en Trader y Black Onyx.', 'Combine your robots, see their correlation and get suggested portfolios. Available on Trader and Black Onyx.')} />
            </div>
          )}
          {caps.portfolioLab && (
          <div className="card" style={{ padding: '16px 16px 18px', marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}><OnyxIcon emoji="🧪" size={16} /> {L('Laboratorio de portafolio', 'Portfolio lab')}</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Prueba combinaciones de tus robots sin arriesgar dinero: mira si se diversifican (se mueven por separado) o si caen juntos.', 'Test combinations of your robots without risking money: see if they diversify (move separately) or fall together.')}</p>

            {/* Cómo usarlo, en 3 pasos simples */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { n: '1', tx: L('Toca los robots que quieras juntar', 'Tap the robots you want together') },
                { n: '2', tx: L('Mira la “Diversificación”: verde = bien, rojo = caen juntos', 'Check “Diversification”: green = good, red = fall together') },
                { n: '3', tx: L('¿No sabes cuáles? Usa un portafolio sugerido abajo', 'Not sure which? Use a suggested portfolio below') },
              ].map((s) => (
                <div key={s.n} style={{ flex: '1 1 180px', minWidth: 170, display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px' }}>
                  <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 6, background: 'color-mix(in srgb,var(--brand) 20%,transparent)', color: 'var(--brand)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{s.n}</span>
                  <span style={{ fontSize: 12, lineHeight: 1.4 }}>{s.tx}</span>
                </div>
              ))}
            </div>

            {/* Contador que cuadra con las cuentas + chips (todos los bots; sin datos = deshabilitado) */}
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 7 }}>{L(`Elige tus robots · ${universe.length} de ${bots.length} tienen operaciones (los demás aún no se pueden comparar)`, `Pick your robots · ${universe.length} of ${bots.length} have trades (the rest can\'t be compared yet)`)}</div>
            <div className="row" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
              {bots.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{L('Aún no hay robots.', 'No robots yet.')}</span>}
              {[...bots].sort((a, b) => Number(canCorr(b)) - Number(canCorr(a))).map((b: any) => {
                const on = sel.has(botKey(b)); const ok = canCorr(b);
                return (
                  <button key={b.key} disabled={!ok} title={ok ? '' : L('Aún sin operaciones — no se puede comparar', 'No trades yet — can\'t be compared')} onClick={() => ok && toggleSel(botKey(b))}
                    style={{ fontSize: 12.5, padding: '6px 11px', borderRadius: 999, cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.45, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (on ? 'color-mix(in srgb,var(--green) 55%,transparent)' : 'var(--line)'), background: on ? 'color-mix(in srgb,var(--green) 16%,transparent)' : 'var(--bg2)', color: on ? 'var(--green)' : 'var(--mut)' }}>
                    <OnyxIcon emoji={on ? '✅' : ok ? '➕' : '⏳'} size={12} /> {chipLabel(b)} <span style={{ opacity: .7 }}>#{b.magic}</span>
                  </button>
                );
              })}
              {sel.size > 0 && <button onClick={() => setSel(new Set())} className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>{L('Limpiar', 'Clear')}</button>}
            </div>

            {selBots.length < 2 ? (
              <div className="muted" style={{ fontSize: 12.5, background: 'var(--bg2)', borderRadius: 10, padding: '11px 13px' }}>{L('Elige al menos 2 bots para ver su correlación y curva combinada.', 'Pick at least 2 bots to see their correlation and combined curve.')}</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}><div className="muted" style={{ fontSize: 11 }}>{L('Net combinado', 'Combined net')}</div><div style={{ fontSize: 20, fontWeight: 800, color: (labStats!.net) >= 0 ? 'var(--green)' : 'var(--red)' }}>{money2(labStats!.net)}</div></div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}><div className="muted" style={{ fontSize: 11 }}>{L('Robots en el combo', 'Robots in combo')}</div><div style={{ fontSize: 20, fontWeight: 800 }}>{selBots.length}</div></div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}><div className="muted" style={{ fontSize: 11 }}>{L('DD del combo', 'Combo drawdown')}</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>−${Math.round(labStats!.dd).toLocaleString()}</div></div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}><div className="muted" style={{ fontSize: 11 }}>{L('Diversificación', 'Diversification')}</div><div style={{ fontSize: 20, fontWeight: 800, color: divCol(labStats!.div) }}>{divTxt(labStats!.div)}</div></div>
                </div>

                {/* Veredicto en lenguaje simple */}
                {labStats!.div != null && (
                  <div style={{ fontSize: 12.5, marginBottom: 12, background: `color-mix(in srgb,${divCol(labStats!.div)} 9%,var(--bg2))`, border: `1px solid color-mix(in srgb,${divCol(labStats!.div)} 30%,transparent)`, borderRadius: 10, padding: '9px 12px' }}>
                    <b style={{ color: divCol(labStats!.div) }}>{labStats!.div}% {L('de diversificación', 'diversification')}</b> — {labStats!.div >= 60 ? L('muy bien: estos robots se mueven por separado, así que rara vez caen todos a la vez.', 'great: these robots move separately, so they rarely all fall at once.') : labStats!.div >= 35 ? L('aceptable: algunos tienden a moverse juntos. Cambia uno por otro menos parecido para mejorar.', 'okay: some tend to move together. Swap one for a less similar bot to improve.') : L('ojo: se mueven casi igual. Sus caídas se suman — no estás diversificando de verdad.', 'careful: they move almost the same. Their drawdowns stack — you\'re not really diversifying.')}
                  </div>
                )}

                {/* Aviso si dos bots en vivo se mueven juntos */}
                {(() => {
                  let warn: any = null;
                  for (let i = 0; i < selBots.length; i++) for (let j = i + 1; j < selBots.length; j++) {
                    if (selBots[i].mode === 'live' && selBots[j].mode === 'live' && labMatrix[i][j] >= 0.6 && (!warn || labMatrix[i][j] > warn.v)) warn = { a: chipLabel(selBots[i]), b: chipLabel(selBots[j]), v: labMatrix[i][j] };
                  }
                  return warn ? <div style={{ fontSize: 12, color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 35%,transparent)', borderRadius: 10, padding: '8px 11px', marginBottom: 12 }}><OnyxIcon emoji="⚠️" size={12} /> {L(`En vivo, ${warn.a} y ${warn.b} se están moviendo juntos (${warn.v.toFixed(2)}). Sus caídas se suman — considera separarlos.`, `Live, ${warn.a} and ${warn.b} are moving together (${warn.v.toFixed(2)}). Their drawdowns stack — consider splitting them.`)}</div> : null;
                })()}

                {/* Heatmap de correlación de los elegidos */}
                <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                  <table style={{ fontSize: 11.5, borderCollapse: 'separate', borderSpacing: 3 }}>
                    <thead><tr><th></th>{selBots.map((b, j) => <th key={j} style={{ padding: '4px 6px', color: 'var(--mut)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{chipLabel(b)}</th>)}</tr></thead>
                    <tbody>
                      {labMatrix.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 8px', color: 'var(--tx)', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 11 }}>{chipLabel(selBots[i])}</td>
                          {row.map((v, j) => (
                            <td key={j} style={{ padding: '9px 10px', textAlign: 'center', minWidth: 44, background: i === j ? 'var(--bg2)' : corrCell(v), borderRadius: 8, fontWeight: i === j ? 400 : 600, color: i === j ? 'var(--mut)' : 'var(--tx)' }}>{i === j ? '—' : v.toFixed(2)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 11 }}>{L('Independientes', 'Independent')}</span>
                  <div style={{ flex: '1 1 140px', maxWidth: 260, height: 8, borderRadius: 8, background: 'linear-gradient(90deg, rgba(52,211,168,.5), rgba(52,211,168,.16), rgba(245,181,68,.4), rgba(247,107,107,.55))' }} />
                  <span className="muted" style={{ fontSize: 11 }}>{L('Se mueven juntos', 'Move together')}</span>
                </div>

                {/* Curva combinada */}
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8, marginBottom: 2 }}>{L('Curva combinada', 'Combined curve')}</div>
                <AreaSpark pts={labStats!.curve} color={labStats!.net >= 0 ? 'var(--brand)' : 'var(--red)'} h={54} />

                {/* Bot que más diversifica */}
                {bestToAdd && <div style={{ marginTop: 10, fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'color-mix(in srgb,var(--brand) 8%,var(--bg2))', border: '1px solid color-mix(in srgb,var(--brand) 28%,transparent)', borderRadius: 10, padding: '9px 12px' }}>
                  <span><OnyxIcon emoji="💡" size={13} /> {L('Para diversificar más, añade', 'To diversify more, add')} <b style={{ color: 'var(--tx)' }}>{chipLabel(bestToAdd.bot)}</b> <span className="muted">→ {L('subiría a', 'would rise to')} {bestToAdd.div}%</span></span>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px', marginLeft: 'auto' }} onClick={() => toggleSel(botKey(bestToAdd.bot))}>＋ {L('Añadir', 'Add')}</button>
                </div>}
              </>
            )}
          </div>
          )}

          {/* ====== SUGERENCIAS DE PORTAFOLIO ====== */}
          {caps.portfolioLab && suggestions && (
            <div className="card" style={{ padding: '16px 16px 18px' }}>
              <h3 style={{ marginBottom: 4 }}><OnyxIcon emoji="✨" size={16} /> {L('Portafolios sugeridos', 'Suggested portfolios')}</h3>
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{L('Onyx elige combinaciones de bots poco correlacionados y con expectativa positiva. Toca “Aplicar” para cargarlos al laboratorio.', 'Onyx picks combinations of low-correlated, positive-expectancy bots. Tap “Apply” to load them into the lab.')}</p>
              {!suggestions.distinct && <div style={{ fontSize: 12.5, color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 32%,transparent)', borderRadius: 10, padding: '9px 12px', marginBottom: 12 }}><OnyxIcon emoji="ℹ️" size={12} /> {L('Todavía tienes pocos robots con historial, por eso las tres opciones coincidían. Cuando más robots tengan operaciones, verás Defensivo, Equilibrado y Agresivo distintos.', 'You still have few robots with history, so the three options matched. With more robots that have trades, you\'ll see distinct Defensive, Balanced and Aggressive.')}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
                {(suggestions.distinct ? [
                  { key: 'defensive', icon: '🛡️', title: L('Defensivo', 'Defensive'), sub: L('Menor riesgo, más estable', 'Lower risk, steadier'), p: suggestions.defensive, hi: false },
                  { key: 'balanced', icon: '⚖️', title: L('Equilibrado', 'Balanced'), sub: L('Mejor balance riesgo/retorno', 'Best risk/return balance'), p: suggestions.balanced, hi: true },
                  { key: 'aggressive', icon: '🔥', title: L('Agresivo', 'Aggressive'), sub: L('Más retorno, más varianza', 'More return, more variance'), p: suggestions.aggressive, hi: false },
                ] : [
                  { key: 'best', icon: '✨', title: L('Mejor combinación disponible', 'Best available combo'), sub: L('Con los robots que tienen historial', 'From robots that have history'), p: suggestions.best, hi: true },
                ]).map((s) => (
                  <div key={s.key} style={{ background: 'var(--card)', border: s.hi ? '2px solid var(--brand)' : '1px solid var(--line)', borderRadius: 12, padding: 14, boxShadow: s.hi ? '0 0 0 1px color-mix(in srgb,var(--brand) 25%,transparent)' : 'none' }}>
                    {s.hi && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'color-mix(in srgb,var(--brand) 14%,transparent)', padding: '2px 8px', borderRadius: 99 }}>{L('Recomendado', 'Recommended')}</span>}
                    <div style={{ fontSize: 15, fontWeight: 700, margin: '6px 0 2px' }}><OnyxIcon emoji={s.icon} size={14} /> {s.title}</div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{s.sub}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 8 }}>{s.p.bots.map((b: any) => chipLabel(b)).join(' · ') || '—'}</div>
                    <div className="row" style={{ gap: 12, fontSize: 12, marginBottom: 10 }}>
                      <span style={{ color: divCol(s.p.div) }}>{L('Div.', 'Div.')} {divTxt(s.p.div)}</span>
                      <span className="muted">DD −${Math.round(s.p.dd).toLocaleString()}</span>
                      <span style={{ color: s.p.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(s.p.net)}</span>
                    </div>
                    <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12.5 }} onClick={() => applyPreset(s.p.bots)}>{L('Aplicar al laboratorio', 'Apply to lab')}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {addFor && (
        <div onClick={() => setAddFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 400, width: '100%', border: '1px solid var(--brand)', boxShadow: '0 24px 70px -20px color-mix(in srgb,var(--brand) 55%,transparent)', background: 'linear-gradient(180deg, color-mix(in srgb,var(--brand) 8%, var(--card)) 0%, var(--card) 55%)' }}>
            <h3 style={{ marginBottom: 4 }}><OnyxIcon emoji="🤖" size={15} /> {t.addBotT}</h3>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t.accountL}: <b style={{ color: 'var(--tx)' }}>{addFor.accName}</b></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><span className="muted" style={{ fontSize: 12 }}>{t.magicL}</span><input type="number" value={addForm.magic} onChange={(e) => setAddForm({ ...addForm, magic: e.target.value })} placeholder="12345" style={{ margin: '4px 0 0' }} /></div>
              {(() => {
                const already = new Set((d?.bots || []).filter((x: any) => x.accountId === addFor.accountId).map((x: any) => Number(x.magic)));
                const mine = built.filter((b: any) => Number(b.magic) && !already.has(Number(b.magic)));
                if (!mine.length) return null;
                return (
                  <div style={{ background: 'color-mix(in srgb,var(--brand) 6%, var(--bg2))', border: '1px solid color-mix(in srgb,var(--brand) 30%, var(--line))', borderRadius: 10, padding: '8px 10px' }}>
                    <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{t.builtLbl}</div>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {mine.map((b: any) => (
                        <button key={b.id} type="button" onClick={() => setAddForm({ ...addForm, magic: String(b.magic), name: b.name || `Bot #${b.magic}` })}
                          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (String(b.magic) === String(addForm.magic) ? 'var(--brand)' : 'var(--line)'), background: String(b.magic) === String(addForm.magic) ? 'color-mix(in srgb,var(--brand) 22%,transparent)' : 'var(--card)', color: 'var(--tx)' }}>
                          <OnyxIcon emoji="🤖" size={11} glow={false} /> {b.name || `#${b.magic}`} <span className="muted">· #{b.magic}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const accMagics: number[] = (d?.accounts || []).find((a: any) => a.id === addFor.accountId)?.magics || [];
                return (
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}>
                    {accMagics.length > 0 ? (<>
                      <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{t.detectedLbl}</div>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {accMagics.map((mg) => (
                          <button key={mg} type="button" onClick={() => setAddForm({ ...addForm, magic: String(mg) })}
                            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (String(mg) === String(addForm.magic) ? 'var(--brand)' : 'var(--line)'), background: String(mg) === String(addForm.magic) ? 'color-mix(in srgb,var(--brand) 22%,transparent)' : 'var(--card)', color: 'var(--tx)' }}>#{mg}</button>
                        ))}
                      </div>
                    </>) : <div className="muted" style={{ fontSize: 11.5 }}>{t.detectedNone}</div>}
                    <div className="muted" style={{ fontSize: 11, marginTop: 8, opacity: .85 }}>{t.detectedTip}</div>
                  </div>
                );
              })()}
              <div><span className="muted" style={{ fontSize: 12 }}>{t.name}</span><input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder={`Bot #${addForm.magic || '…'}`} style={{ margin: '4px 0 0' }} /></div>
              <div><span className="muted" style={{ fontSize: 12 }}>{t.mode}</span>
                <select value={addForm.mode} onChange={(e) => setAddForm({ ...addForm, mode: e.target.value })} style={{ margin: '4px 0 0' }}>
                  <option value="testing">{t.testing}</option><option value="live">{t.live}</option>
                </select>
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>{t.addBotHint}</div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={createBot} disabled={busy || !addForm.magic}>＋ {t.create}</button>
              <button className="btn btn-ghost" onClick={() => setAddFor(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
