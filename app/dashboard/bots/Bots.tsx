'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { toast } from '@/lib/toast';

type Lang = 'es' | 'en';
const T: any = {
  es: {
    title: 'Mis robots', sub: 'Rendimiento por estrategia. Cada tarjeta muestra el par que más opera. Filtra entre pruebas y vivo.',
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
    portT: 'Portafolio en vivo', portSub: 'Qué tan independientes son tus robots entre sí. Colores fríos = diversifican; cálidos = ganan y pierden juntos.',
    combined: 'Curva combinada', kNet: 'Neto combinado', kPF: 'PF combinado', kDD: 'Peor caída', kDiv: 'Diversificación',
    divGood: 'buena', divMid: 'media', divLow: 'baja',
    corrLo: 'Independientes', corrMid: 'Algo ligados', corrHi: 'Van juntos',
    mostCorr: 'Más correlacionados', leastCorr: 'Menos correlacionados', corrKey: 'Robots (fila/columna)',
    divTipGood: 'Bien: tus robots se mueven por separado, así que rara vez caen todos a la vez.',
    divTipMid: 'Aceptable: algunos robots tienden a moverse juntos. Vigila los pares cálidos.',
    divTipLow: 'Ojo: varios robots ganan y pierden a la vez. No estás diversificando de verdad — sus caídas se suman.',
    emptyT: 'Aún no vemos bots', emptyD: 'Cuando un EA opere en una cuenta conectada, aquí aparecerá por su magic number. Reinstala Onyx Connect si es una versión vieja (ahora reporta el magic).',
    lockT: 'Módulo de bots', lockD: 'Evalúa tus estrategias algorítmicas: KPIs por bot, pruebas vs vivo, criterios de graduación, backtest vs vivo y correlación de portafolio.', lockCta: 'Ver planes',
    addBtn: 'Añadir por $%/mes', addOr: 'o incluido en Black Onyx', addNeedSub: 'Necesitas un plan de pago activo para añadir el módulo. Elige uno abajo.',
    statusRun: 'Operando', statusWait: 'Activo · en espera', statusOff: 'Inactivo',
    addBot: 'Añadir por magic', addBotT: 'Registrar un robot', magicL: 'Magic number', accountL: 'Cuenta',
    create: 'Registrar', cancel: 'Cancelar', pendingBadge: 'Sin operaciones aún', online: 'EA en línea', offline: 'EA desconectado',
    addBotHint: 'Escribe el magic number de tu EA para verlo aquí desde ya, aunque todavía no opere.', dupBot: 'Ya tienes un bot con ese magic en esta cuenta.', bots: 'robots',
    openNowLbl: 'abierta(s) ahora', floatLbl: 'flotante', closedHint: 'Los números (Neto, PF, aciertos) suman solo operaciones cerradas.', del: 'Eliminar',
    detectedLbl: 'Magics detectados en esta cuenta (toca para usar):', detectedNone: 'Aún no se detecta ningún magic en esta cuenta. Si la operación fue manual, no lleva magic (es 0) y no cuenta como robot.', detectedTip: 'Usa el magic exacto que tu EA tiene en sus inputs. Si el EA ya operó, aparece aquí abajo.',
    noPair: 'Sin par', sortNet: 'Neto', noneHere: 'Nada en este filtro.',
  },
  en: {
    title: 'My robots', sub: 'Performance per strategy. Each card shows the pair it trades most. Filter testing vs live.',
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
    portT: 'Live portfolio', portSub: 'How independent your robots are from each other. Cool colors = they diversify; warm = they win and lose together.',
    combined: 'Combined curve', kNet: 'Combined net', kPF: 'Combined PF', kDD: 'Worst drawdown', kDiv: 'Diversification',
    divGood: 'good', divMid: 'medium', divLow: 'low',
    corrLo: 'Independent', corrMid: 'Somewhat linked', corrHi: 'Move together',
    mostCorr: 'Most correlated', leastCorr: 'Least correlated', corrKey: 'Robots (row/column)',
    divTipGood: 'Good: your robots move separately, so they rarely all drop at once.',
    divTipMid: 'Okay: some robots tend to move together. Watch the warm pairs.',
    divTipLow: 'Careful: several robots win and lose at the same time. You are not really diversifying — their drawdowns stack up.',
    emptyT: 'No bots yet', emptyD: 'When an EA trades on a connected account it appears here by its magic number. Reinstall the Onyx Connector or Guardian if it is an old version (they now report the magic).',
    lockT: 'Bots module', lockD: 'Evaluate your algorithmic strategies: per-bot KPIs, testing vs live, graduation criteria, backtest vs live and portfolio correlation.', lockCta: 'See plans',
    addBtn: 'Add for $%/mo', addOr: 'or included in Black Onyx', addNeedSub: 'You need an active paid plan to add the module. Pick one below.',
    statusRun: 'Running', statusWait: 'Active · idle', statusOff: 'Offline',
    addBot: 'Add by magic', addBotT: 'Register a robot', magicL: 'Magic number', accountL: 'Account',
    create: 'Register', cancel: 'Cancel', pendingBadge: 'No trades yet', online: 'EA online', offline: 'EA offline',
    addBotHint: 'Type your EA magic number to see it here right away, even before it trades.', dupBot: 'You already have a bot with that magic in this account.', bots: 'robots',
    openNowLbl: 'open now', floatLbl: 'floating', closedHint: 'The numbers (Net, PF, win) only add up closed trades.', del: 'Delete',
    detectedLbl: 'Magics detected on this account (tap to use):', detectedNone: 'No magic detected on this account yet. If the trade was manual it has no magic (0) and does not count as a robot.', detectedTip: 'Use the exact magic your EA has in its inputs. If the EA already traded, it shows below.',
    noPair: 'No pair', sortNet: 'Net', noneHere: 'Nothing in this filter.',
  },
};

function money(n: number) { return (n >= 0 ? '+' : '') + '$' + Math.round(n).toLocaleString(); }

// Sparkline moderno: área con degradado + línea suave + punto final.
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
  const [d, setD] = useState<any>(null);
  const [port, setPort] = useState<any>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'live' | 'testing'>('all');
  const [addFor, setAddFor] = useState<any>(null);
  const [addForm, setAddForm] = useState<any>({ magic: '', name: '', mode: 'testing' });

  async function load() {
    try { const r = await fetch('/api/bots'); setD(await r.json()); } catch { setD({ bots: [] }); }
    try { const r = await fetch('/api/bots?view=portfolio'); setPort(await r.json()); } catch {}
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, []);

  async function save(b: any, patch: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/bots', { method: 'PATCH', body: JSON.stringify({ magic: b.magic, account_id: b.accountId, ...patch }) });
      if (r.ok) { toast(t.saved, 'ok'); setEdit(null); await load(); }
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
      else { const j = await r.json().catch(() => ({})); toast(j.error || 'error'); }
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
        {/* Cabecera: par + tag + estado */}
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

        <div style={{ fontSize: 22, fontWeight: 800, color: accent, marginBottom: 6 }}>{money(b.net)}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', fontSize: 11.5, marginBottom: b.mode === 'testing' || b.open?.count > 0 ? 8 : 2 }}>
          <span className="muted">{t.pf} <b style={{ color: 'var(--tx)' }}>{b.pf}</b></span>
          <span className="muted">{t.win} <b style={{ color: 'var(--tx)' }}>{b.winRate}%</b></span>
          <span className="muted">{t.dd} <b style={{ color: b.ddPct > (b.criteria?.maxDD ?? 10) ? 'var(--amber)' : 'var(--tx)' }}>{b.ddPct}%</b></span>
          <span className="muted">{t.ops} <b style={{ color: 'var(--tx)' }}>{b.trades}</b></span>
        </div>

        {b.open?.count > 0 && (
          <div style={{ marginBottom: 8, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 32%,transparent)', borderRadius: 8, padding: '5px 8px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 3px color-mix(in srgb,var(--green) 22%,transparent)' }} />
            <span><b>{b.open.count}</b> {t.openNowLbl} · {t.floatLbl} <b style={{ color: b.open.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(b.open.profit)}</b></span>
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
            {b.passed === b.total && b.trades > 0 && <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, fontSize: 12 }} onClick={() => save(b, { mode: 'live' })} disabled={busy}>↗ {t.promote}</button>}
          </div>
        )}
        {b.mode === 'live' && dv && (
          <div style={{ marginBottom: 6, fontSize: 11, color: dv.status === 'diverge' ? 'var(--red)' : dv.status === 'watch' ? 'var(--amber)' : 'var(--green)' }}>
            {dv.status === 'diverge' ? t.divBad : dv.status === 'watch' ? t.divWatch : t.divOk} {dv.deltaPct != null && `(PF ${dv.deltaPct > 0 ? '+' : ''}${dv.deltaPct}%)`}
          </div>
        )}

        <div className="row" style={{ gap: 6, marginTop: 'auto' }}>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => { setDetail(detail === b.key ? null : b.key); setEdit(null); }} disabled={b.trades === 0}><OnyxIcon emoji="📊" size={15} /> {t.detail}</button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => (edit === b.key ? setEdit(null) : openEdit(b))}><OnyxIcon emoji="⚙" size={15} /> {t.config}</button>
          {b.pending && <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px', color: 'var(--red)', marginLeft: 'auto' }} onClick={() => delBot(b)} disabled={busy}><OnyxIcon emoji="🗑" size={14} /></button>}
        </div>

        {detail === b.key && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{t.metrics}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              <Metric k={t.sharpe} v={m.sharpe} /><Metric k={t.sortino} v={m.sortino} /><Metric k={t.mar} v={m.mar} />
              <Metric k={t.sqn} v={m.sqn} /><Metric k={t.payoff} v={m.payoff} /><Metric k={t.ddDur} v={m.ddDur} />
              <Metric k={t.maxLoss} v={m.maxConsecLoss} /><Metric k={t.monthsPos} v={m.monthsPos + '%'} /><Metric k={t.exposure} v={m.exposure + '%'} />
              <Metric k={t.annual} v={money(m.annualNet)} /><Metric k={t.avgWin} v={money(m.avgWin)} /><Metric k={t.avgLoss} v={money(-m.avgLoss)} />
              <Metric k={t.stability} v={m.stability} /><Metric k={t.retDD} v={m.retDD} /><Metric k={t.rec} v={b.recovery} />
            </div>
            {m.mc && (
              <div style={{ marginTop: 10 }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{t.mcT}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                  <Metric k={t.mcDD} v={money(-m.mc.p95dd)} /><Metric k={t.mcRet} v={money(m.mc.p5ret)} />
                </div>
                <p className="muted" style={{ fontSize: 10.5, margin: '4px 0 0' }}>{t.mcNote}</p>
              </div>
            )}
            {Array.isArray(m.wf) && m.wf.length > 0 && (
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

  // Escala de color de correlación (diverging): frío = independiente/negativa
  // (buena diversificación), cálido = se mueven juntos (mala). Intensidad = magnitud.
  const corrCell = (v: number) => {
    if (v >= 0.6) return `rgba(247,107,107,${(0.20 + 0.35 * Math.min(1, (v - 0.6) / 0.4)).toFixed(2)})`;
    if (v >= 0.3) return `rgba(245,181,68,${(0.16 + 0.22 * ((v - 0.3) / 0.3)).toFixed(2)})`;
    if (v >= 0) return `rgba(52,211,168,${(0.10 + 0.16 * (1 - v / 0.3)).toFixed(2)})`;
    return `rgba(52,211,168,${(0.28 + 0.22 * Math.min(1, -v)).toFixed(2)})`; // negativa = muy buena
  };
  const seg = (v: 'all' | 'live' | 'testing', label: string, n: number) => (
    <button onClick={() => setFilter(v)} style={{ background: filter === v ? 'color-mix(in srgb,var(--brand) 20%,transparent)' : 'transparent', border: 'none', color: filter === v ? 'var(--tx)' : 'var(--mut)', fontWeight: filter === v ? 600 : 400, padding: '6px 13px', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>{label} <span style={{ fontSize: 10.5, opacity: .7 }}>{n}</span></button>
  );

  const kp = port?.kpis;
  const divLevel = kp ? (kp.diversification >= 60 ? 'good' : kp.diversification >= 35 ? 'mid' : 'low') : 'good';
  const divColor = divLevel === 'good' ? 'var(--green)' : divLevel === 'mid' ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="wrap" style={{ padding: '24px 0 60px', maxWidth: 1180, fontSize: 15 }}>
      <div className="row between" style={{ padding: '0 4px', marginBottom: 16, flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 24 }}><OnyxIcon emoji="🤖" size={16} /> {t.title}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{t.sub}</p>
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
          <p className="muted" style={{ fontSize: 14, maxWidth: 520, margin: '0 auto' }}>{t.emptyD}</p>
          <p className="muted" style={{ fontSize: 12.5, maxWidth: 520, margin: '10px auto 0', opacity: .8 }}>{lang === 'es'
            ? 'Nota: las operaciones manuales no cuentan como robot. Solo aparecen las que un EA/robot abre con su magic number.'
            : 'Note: manual trades don\'t count as a robot. Only trades opened by an EA/robot with its magic number show up.'}</p>
        </div>
      )}

      {d && !d.locked && !d.needsMigration && !!(d.accounts?.length) && (
        <>
          {/* Filtro global Live / Testing / Todos */}
          <div className="row" style={{ marginBottom: 14, justifyContent: 'flex-start' }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              {seg('all', t.all, bots.length)}
              {seg('live', t.live, bots.filter((b) => b.mode === 'live').length)}
              {seg('testing', t.testing, bots.filter((b) => b.mode === 'testing').length)}
            </div>
          </div>

          {(d.accounts || []).map((acc: any) => {
            const mine = bots.filter((b: any) => b.accountId === acc.id);
            const shown = mine.filter((b: any) => filter === 'all' || b.mode === filter);
            const running = mine.filter((b: any) => b.status === 'operando').length;
            const accNet = mine.reduce((s: number, b: any) => s + (b.net || 0), 0);
            return (
              <div key={acc.id} style={{ marginBottom: 16, border: '1px solid ' + (acc.online ? 'color-mix(in srgb,var(--green) 26%,var(--line))' : 'var(--line)'), borderRadius: 16, background: 'var(--card)', overflow: 'hidden' }}>
                {/* Cabecera de cuenta con resumen */}
                <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '13px 15px', background: 'linear-gradient(180deg, color-mix(in srgb,var(--brand) 7%, var(--card)), var(--card))', borderBottom: '1px solid var(--line)' }}>
                  <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: acc.online ? 'var(--green)' : 'var(--mut)', boxShadow: acc.online ? '0 0 0 4px color-mix(in srgb,var(--green) 20%,transparent)' : 'none' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>{acc.name}
                        <span style={{ fontSize: 10, fontWeight: 700, color: acc.online ? 'var(--green)' : 'var(--mut)', background: acc.online ? 'color-mix(in srgb,var(--green) 12%,transparent)' : 'var(--bg2)', padding: '2px 7px', borderRadius: 99 }}>{acc.online ? t.online : t.offline}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{mine.length} {t.bots} · <b style={{ color: accNet >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(accNet)}</b> {t.net.toLowerCase()}{running > 0 ? ` · ${running} ${t.statusRun.toLowerCase()}` : ''}</div>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => { setAddFor({ accountId: acc.id, accName: acc.name }); setAddForm({ magic: '', name: '', mode: 'testing' }); }}>＋ {t.addBot}</button>
                </div>

                <div style={{ padding: 14 }}>
                  {shown.length === 0
                    ? (mine.length === 0
                        // Cuenta SIN robots: franja que invita a crear el primero (acceso directo
                        // al armador justo donde el trader lo necesita) + opción de añadir por magic.
                        ? <div className="row between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center', border: '1px dashed color-mix(in srgb,var(--brand) 45%,var(--line))', borderRadius: 12, padding: '13px 15px', background: 'color-mix(in srgb,var(--brand) 5%, transparent)' }}>
                            <div className="row" style={{ gap: 11, alignItems: 'center' }}>
                              <span style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb,var(--brand) 15%, transparent)', color: 'var(--brand)' }}><OnyxIcon emoji="🤖" size={18} glow={false} /></span>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{lang === 'es' ? 'Aún sin robots en esta cuenta' : 'No robots on this account yet'}</div>
                                <div className="muted" style={{ fontSize: 12 }}>{lang === 'es' ? 'Arma tu primer robot sin programar y pruébalo en demo.' : 'Build your first robot without coding and test it on demo.'}</div>
                              </div>
                            </div>
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                              <Link href="/dashboard/constructor" className="btn btn-primary" style={{ fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="➕" size={13} glow={false} /> {lang === 'es' ? 'Crear robot' : 'Create robot'}</Link>
                              <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { setAddFor({ accountId: acc.id, accName: acc.name }); setAddForm({ magic: '', name: '', mode: 'testing' }); }}>＋ {t.addBot}</button>
                            </div>
                          </div>
                        : <div className="muted" style={{ fontSize: 12.5, padding: 4 }}>{t.noneHere}</div>)
                    : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(248px,1fr))', gap: 12, alignItems: 'start' }}>
                        {shown.map((b: any) => <Card key={b.key} b={b} />)}
                      </div>}
                </div>
              </div>
            );
          })}

          {/* Portafolio en vivo: KPIs + correlación intuitiva + curva combinada */}
          {port && port.bots && port.bots.length >= 2 && (
            <div className="card" style={{ marginTop: 16, padding: '16px 16px 18px' }}>
              <h3 style={{ marginBottom: 4 }}><OnyxIcon emoji="🧩" size={16} /> {t.portT}</h3>
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.portSub}</p>

              {/* KPIs */}
              {kp && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}>
                    <div className="muted" style={{ fontSize: 11 }}>{t.kNet}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: kp.combinedNet >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(kp.combinedNet)}</div>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}>
                    <div className="muted" style={{ fontSize: 11 }}>{t.kPF}</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{kp.combinedPF}</div>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}>
                    <div className="muted" style={{ fontSize: 11 }}>{t.kDD}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>−${Math.abs(kp.worstDD).toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '11px 13px' }}>
                    <div className="muted" style={{ fontSize: 11 }}>{t.kDiv}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: divColor }}>{kp.diversification}% <span style={{ fontSize: 12, fontWeight: 600 }}>{divLevel === 'good' ? t.divGood : divLevel === 'mid' ? t.divMid : t.divLow}</span></div>
                  </div>
                </div>
              )}

              {/* Heatmap de correlación */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: 11.5, borderCollapse: 'separate', borderSpacing: 3 }}>
                  <thead><tr><th></th>{port.bots.map((b: any, j: number) => <th key={j} style={{ padding: '4px 6px', color: 'var(--mut)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{b.pair || b.name.slice(0, 8)}</th>)}</tr></thead>
                  <tbody>
                    {port.matrix.map((row: number[], i: number) => (
                      <tr key={i}>
                        <td style={{ padding: '4px 8px', color: 'var(--tx)', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 11 }}>{port.bots[i].pair || port.bots[i].name.slice(0, 8)}</td>
                        {row.map((v, j) => (
                          <td key={j} title={`${port.bots[i].pair || port.bots[i].name} ↔ ${port.bots[j].pair || port.bots[j].name}: ${v}`}
                            style={{ padding: '9px 10px', textAlign: 'center', minWidth: 44, background: i === j ? 'var(--bg2)' : corrCell(v), borderRadius: 8, fontWeight: i === j ? 400 : 600, color: i === j ? 'var(--mut)' : 'var(--tx)' }}>{i === j ? '—' : v.toFixed(2)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Leyenda de color */}
              <div className="row" style={{ alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 11 }}>{t.corrLo}</span>
                <div style={{ flex: '1 1 140px', maxWidth: 260, height: 8, borderRadius: 8, background: 'linear-gradient(90deg, rgba(52,211,168,.5), rgba(52,211,168,.16), rgba(245,181,68,.4), rgba(247,107,107,.55))' }} />
                <span className="muted" style={{ fontSize: 11 }}>{t.corrHi}</span>
              </div>

              {/* Interpretación + pares destacados */}
              <div style={{ marginTop: 12, background: `color-mix(in srgb,${divColor} 8%,var(--bg2))`, border: `1px solid color-mix(in srgb,${divColor} 30%,transparent)`, borderRadius: 12, padding: '10px 13px', fontSize: 12.5 }}>
                <b style={{ color: divColor }}>{t.kDiv}: {kp?.diversification}% ({divLevel === 'good' ? t.divGood : divLevel === 'mid' ? t.divMid : t.divLow})</b>
                <div className="muted" style={{ marginTop: 3, lineHeight: 1.5 }}>{divLevel === 'good' ? t.divTipGood : divLevel === 'mid' ? t.divTipMid : t.divTipLow}</div>
                {kp?.mostCorr && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5 }}>
                    <span className="muted">{t.mostCorr}: <b style={{ color: 'var(--tx)' }}>{kp.mostCorr.a} ↔ {kp.mostCorr.b}</b> <span style={{ color: kp.mostCorr.v >= 0.6 ? 'var(--red)' : 'var(--amber)' }}>({kp.mostCorr.v.toFixed(2)})</span></span>
                    {kp.leastCorr && <span className="muted">{t.leastCorr}: <b style={{ color: 'var(--tx)' }}>{kp.leastCorr.a} ↔ {kp.leastCorr.b}</b> <span style={{ color: 'var(--green)' }}>({kp.leastCorr.v.toFixed(2)})</span></span>}
                  </div>
                )}
              </div>

              {/* Curva combinada */}
              <div className="muted" style={{ fontSize: 11.5, marginTop: 14, marginBottom: 2 }}>{t.combined}</div>
              <AreaSpark pts={port.curve} color={(kp?.combinedNet ?? 0) >= 0 ? 'var(--brand)' : 'var(--red)'} h={54} />
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
