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
    title: 'Mis robots', sub: 'Rendimiento por estrategia. Separa las que están en pruebas de las que ya operan en vivo.',
    testing: 'En pruebas', live: 'En vivo', running: 'activo', idle: 'inactivo',
    net: 'Neto', pf: 'PF', dd: 'DD', win: 'Aciertos', ops: 'Ops', exp: 'Exp', rec: 'Recovery', opsDay: 'Ops/día',
    ready: 'Listo para vivo', promote: 'Promover a vivo', config: 'Config', detail: 'Métricas', save: 'Guardar', saved: 'Guardado',
    name: 'Nombre del bot', mode: 'Modo', mAuto: 'Automático', mTest: 'Forzar pruebas', mLive: 'Forzar vivo',
    crit: 'Criterios para graduar a vivo', cDays: 'Días mín.', cTrades: 'Ops mín.', cPf: 'PF mín.', cDd: 'DD máx. %',
    metrics: 'Métricas avanzadas', sharpe: 'Sharpe', sortino: 'Sortino', mar: 'MAR/Calmar', sqn: 'SQN', payoff: 'Payoff',
    ddDur: 'DD (días)', maxLoss: 'Máx. pérdidas seg.', monthsPos: '% meses +', exposure: 'Exposición', annual: 'Anualizado', avgWin: 'Gan. media', avgLoss: 'Pérd. media',
    btT: 'Backtest esperado (para comparar el vivo)', btPf: 'PF esperado', btWin: 'Win % esperado', btDd: 'DD % esperado', btHint: 'Copia los números del reporte del Strategy Tester.',
    divOk: '✓ en línea con el backtest', divWatch: '~ algo por debajo del backtest', divBad: '⚠ divergencia — revisa sobreajuste',
    portT: 'Portafolio en vivo', portSub: 'Correlación entre tus bots (baja = diversifican; alta = bajan juntos) y curva combinada.', combined: 'Curva combinada',
    emptyT: 'Aún no vemos bots', emptyD: 'Cuando un EA opere en una cuenta conectada, aquí aparecerá por su magic number. Reinstala el Onyx Connector o el Guardian si es una versión vieja (ahora reportan el magic).',
    lockT: 'Módulo de bots', lockD: 'Evalúa tus estrategias algorítmicas: KPIs por bot, pruebas vs vivo, criterios de graduación, backtest vs vivo y correlación de portafolio.', lockCta: 'Ver planes',
    addBtn: 'Añadir por $%/mes', addOr: 'o incluido en Black Onyx', addNeedSub: 'Necesitas un plan de pago activo para añadir el módulo. Elige uno abajo.',
  },
  en: {
    title: 'My robots', sub: 'Performance per strategy. Split the ones in testing from the ones already live.',
    testing: 'Testing', live: 'Live', running: 'active', idle: 'idle',
    net: 'Net', pf: 'PF', dd: 'DD', win: 'Win', ops: 'Trades', exp: 'Exp', rec: 'Recovery', opsDay: 'Trades/day',
    ready: 'Ready for live', promote: 'Promote to live', config: 'Config', detail: 'Metrics', save: 'Save', saved: 'Saved',
    name: 'Bot name', mode: 'Mode', mAuto: 'Automatic', mTest: 'Force testing', mLive: 'Force live',
    crit: 'Criteria to graduate to live', cDays: 'Min days', cTrades: 'Min trades', cPf: 'Min PF', cDd: 'Max DD %',
    metrics: 'Advanced metrics', sharpe: 'Sharpe', sortino: 'Sortino', mar: 'MAR/Calmar', sqn: 'SQN', payoff: 'Payoff',
    ddDur: 'DD (days)', maxLoss: 'Max consec. losses', monthsPos: '% months +', exposure: 'Exposure', annual: 'Annualized', avgWin: 'Avg win', avgLoss: 'Avg loss',
    btT: 'Expected backtest (to compare live)', btPf: 'Expected PF', btWin: 'Expected win %', btDd: 'Expected DD %', btHint: 'Copy the numbers from your Strategy Tester report.',
    divOk: '✓ in line with backtest', divWatch: '~ a bit below backtest', divBad: '⚠ diverging — check overfitting',
    portT: 'Live portfolio', portSub: 'Correlation between your bots (low = they diversify; high = they drop together) and combined curve.', combined: 'Combined curve',
    emptyT: 'No bots yet', emptyD: 'When an EA trades on a connected account it appears here by its magic number. Reinstall the Onyx Connector or Guardian if it is an old version (they now report the magic).',
    lockT: 'Bots module', lockD: 'Evaluate your algorithmic strategies: per-bot KPIs, testing vs live, graduation criteria, backtest vs live and portfolio correlation.', lockCta: 'See plans',
    addBtn: 'Add for $%/mo', addOr: 'or included in Black Onyx', addNeedSub: 'You need an active paid plan to add the module. Pick one below.',
  },
};

function money(n: number) { return (n >= 0 ? '+' : '') + '$' + Math.round(n).toLocaleString(); }

function Spark({ pts, color }: { pts: number[]; color: string }) {
  if (!pts || pts.length < 2) return <div style={{ height: 26 }} />;
  const w = 120, h = 26, min = Math.min(...pts), max = Math.max(...pts), range = (max - min) || 1;
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - ((p - min) / range) * h).toFixed(1)}`).join(' ');
  return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ margin: '6px 0' }}><path d={path} fill="none" stroke={color} strokeWidth="2" /></svg>;
}

export default function Bots() {
  const { lang } = useLang() as { lang: Lang };
  const t = dictFor(T, lang);
  const [d, setD] = useState<any>(null);
  const [port, setPort] = useState<any>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const r = await fetch('/api/bots'); setD(await r.json()); } catch { setD({ bots: [] }); }
    try { const r = await fetch('/api/bots?view=portfolio'); setPort(await r.json()); } catch {}
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, []);

  async function save(magic: number, patch: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/bots', { method: 'PATCH', body: JSON.stringify({ magic, ...patch }) });
      if (r.ok) { toast(t.saved, 'ok'); setEdit(null); await load(); }
    } finally { setBusy(false); }
  }
  function openEdit(b: any) {
    setEdit(b.magic); setDetail(null);
    setForm({ name: b.name, mode: 'auto', ...b.criteria, btPf: b.backtest?.pf ?? '', btWin: b.backtest?.winRate ?? '', btDd: b.backtest?.maxDD ?? '' });
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
  const testing = bots.filter((b) => b.mode === 'testing');
  const live = bots.filter((b) => b.mode === 'live');

  const Metric = ({ k, v }: { k: string; v: any }) => (
    <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '6px 8px' }}>
      <div className="muted" style={{ fontSize: 10 }}>{k}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{v}</div>
    </div>
  );

  const Card = ({ b }: { b: any }) => {
    const up = b.net >= 0; const m = b.metrics || {};
    const dv = b.divergence;
    return (
      <div className="card" style={{ padding: 12, marginBottom: 8 }}>
        <div className="row between" style={{ gap: 8 }}>
          <b style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</b>
          <span style={{ fontSize: 11, color: b.running ? 'var(--green)' : 'var(--mut)', whiteSpace: 'nowrap' }}>{b.running ? '● ' + t.running : '○ ' + t.idle}</span>
        </div>
        <div className="muted" style={{ fontSize: 10.5 }}>#{b.magic}</div>
        <Spark pts={b.spark} color={up ? 'var(--green)' : 'var(--red)'} />
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', fontSize: 11.5 }}>
          <span className="muted">{t.net} <b style={{ color: up ? 'var(--green)' : 'var(--red)' }}>{money(b.net)}</b></span>
          <span className="muted">{t.pf} <b style={{ color: 'var(--tx)' }}>{b.pf}</b></span>
          <span className="muted">{t.dd} <b style={{ color: b.ddPct > b.criteria.maxDD ? 'var(--red)' : 'var(--tx)' }}>{b.ddPct}%</b></span>
          <span className="muted">{t.win} <b style={{ color: 'var(--tx)' }}>{b.winRate}%</b></span>
          <span className="muted">{t.ops} <b style={{ color: 'var(--tx)' }}>{b.trades}</b></span>
        </div>

        {b.mode === 'testing' && (
          <div style={{ marginTop: 8 }}>
            <div className="row between" style={{ fontSize: 11, marginBottom: 4 }}>
              <span className="muted">{t.ready}</span>
              <span style={{ color: b.passed === b.total ? 'var(--green)' : 'var(--amber)' }}>{b.passed}/{b.total}</span>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: 'var(--bg2)', overflow: 'hidden' }}>
              <div style={{ width: `${(b.passed / b.total) * 100}%`, height: '100%', background: b.passed === b.total ? 'var(--green)' : 'var(--amber)' }} />
            </div>
            {b.passed === b.total && <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, fontSize: 12.5 }} onClick={() => save(b.magic, { mode: 'live' })} disabled={busy}>↗ {t.promote}</button>}
          </div>
        )}
        {b.mode === 'live' && dv && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: dv.status === 'diverge' ? 'var(--red)' : dv.status === 'watch' ? 'var(--amber)' : 'var(--green)' }}>
            {dv.status === 'diverge' ? t.divBad : dv.status === 'watch' ? t.divWatch : t.divOk} {dv.deltaPct != null && `(PF ${dv.deltaPct > 0 ? '+' : ''}${dv.deltaPct}%)`}
          </div>
        )}

        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => { setDetail(detail === b.magic ? null : b.magic); setEdit(null); }}><OnyxIcon emoji="📊" size={16} /> {t.detail}</button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => (edit === b.magic ? setEdit(null) : openEdit(b))}><OnyxIcon emoji="⚙" size={16} /> {t.config}</button>
        </div>

        {detail === b.magic && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{t.metrics}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              <Metric k={t.sharpe} v={m.sharpe} /><Metric k={t.sortino} v={m.sortino} /><Metric k={t.mar} v={m.mar} />
              <Metric k={t.sqn} v={m.sqn} /><Metric k={t.payoff} v={m.payoff} /><Metric k={t.ddDur} v={m.ddDur} />
              <Metric k={t.maxLoss} v={m.maxConsecLoss} /><Metric k={t.monthsPos} v={m.monthsPos + '%'} /><Metric k={t.exposure} v={m.exposure + '%'} />
              <Metric k={t.annual} v={money(m.annualNet)} /><Metric k={t.avgWin} v={money(m.avgWin)} /><Metric k={t.avgLoss} v={money(-m.avgLoss)} />
            </div>
          </div>
        )}

        {edit === b.magic && (
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
              onClick={() => save(b.magic, { name: form.name, mode: form.mode, criteria: { minDays: form.minDays, minTrades: form.minTrades, pf: form.pf, maxDD: form.maxDD }, backtest: { pf: form.btPf, winRate: form.btWin, maxDD: form.btDd } })}>{t.save}</button>
          </div>
        )}
      </div>
    );
  };

  const corrColor = (v: number) => v >= 0.7 ? 'rgba(255,107,125,.28)' : v >= 0.3 ? 'rgba(255,192,77,.25)' : 'rgba(52,226,160,.22)';

  return (
    <div className="wrap" style={{ padding: '24px 0 60px', maxWidth: 920 }}>
      <div style={{ padding: '0 4px', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}><OnyxIcon emoji="🤖" size={16} /> {t.title}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{t.sub}</p>
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

      {d && !d.locked && !bots.length && (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}><OnyxIcon emoji="📡" size={16} /></div>
          <h3 style={{ marginBottom: 6 }}>{t.emptyT}</h3>
          <p className="muted" style={{ fontSize: 14, maxWidth: 520, margin: '0 auto' }}>{t.emptyD}</p>
        </div>
      )}

      {d && !d.locked && !!bots.length && (
        <>
          <div className="grid g2" style={{ gap: 14, alignItems: 'start' }}>
            <div>
              <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
                <b style={{ fontSize: 13 }}>{t.testing}</b><span className="muted" style={{ fontSize: 12 }}>{testing.length}</span>
              </div>
              {testing.map((b) => <Card key={b.magic} b={b} />)}
              {!testing.length && <div className="muted" style={{ fontSize: 12.5, padding: 4 }}>—</div>}
            </div>
            <div>
              <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
                <b style={{ fontSize: 13 }}>{t.live}</b><span className="muted" style={{ fontSize: 12 }}>{live.length}</span>
              </div>
              {live.map((b) => <Card key={b.magic} b={b} />)}
              {!live.length && <div className="muted" style={{ fontSize: 12.5, padding: 4 }}>—</div>}
            </div>
          </div>

          {port && port.bots && port.bots.length >= 2 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 4 }}><OnyxIcon emoji="🧩" size={16} /> {t.portT}</h3>
              <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.portSub}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: 11.5, borderCollapse: 'collapse' }}>
                  <thead><tr><th></th>{port.bots.map((b: any) => <th key={b.magic} style={{ padding: '4px 8px', color: 'var(--mut)', fontWeight: 500, whiteSpace: 'nowrap' }}>{b.name.slice(0, 10)}</th>)}</tr></thead>
                  <tbody>
                    {port.matrix.map((row: number[], i: number) => (
                      <tr key={i}>
                        <td style={{ padding: '4px 8px', color: 'var(--mut)', whiteSpace: 'nowrap' }}>{port.bots[i].name.slice(0, 10)}</td>
                        {row.map((v, j) => <td key={j} style={{ padding: '6px 8px', textAlign: 'center', background: i === j ? 'transparent' : corrColor(v), borderRadius: 6 }}>{i === j ? '—' : v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 12, marginBottom: 2 }}>{t.combined}</div>
              <Spark pts={port.curve} color="var(--brand)" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
