'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { toast } from '@/lib/toast';

type Lang = 'es' | 'en';
const T: any = {
  es: {
    title: 'Bots', sub: 'Rendimiento por estrategia. Separa las que están en pruebas de las que ya operan en vivo.',
    testing: 'En pruebas', live: 'En vivo', running: 'activo', idle: 'inactivo',
    net: 'Neto', pf: 'PF', dd: 'DD', win: 'Aciertos', ops: 'Ops', exp: 'Exp', rec: 'Recovery', opsDay: 'Ops/día',
    ready: 'Listo para vivo', promote: 'Promover a vivo', config: 'Configurar', save: 'Guardar', saved: 'Guardado',
    name: 'Nombre del bot', mode: 'Modo', mAuto: 'Automático', mTest: 'Forzar pruebas', mLive: 'Forzar vivo',
    crit: 'Criterios para graduar a vivo', cDays: 'Días mín.', cTrades: 'Ops mín.', cPf: 'PF mín.', cDd: 'DD máx. %',
    emptyT: 'Aún no vemos bots', emptyD: 'Cuando un EA opere en una cuenta conectada, aquí aparecerá por su magic number. Asegúrate de tener el Onyx Connector instalado y reinstálalo si es una versión vieja (ahora reporta el magic).',
    lockT: 'Módulo de bots', lockD: 'Evalúa tus estrategias algorítmicas: KPIs por bot, pruebas vs vivo y criterios de graduación. Disponible en planes superiores.', lockCta: 'Ver planes',
    soon: 'vs backtest · pronto',
  },
  en: {
    title: 'Bots', sub: 'Performance per strategy. Split the ones in testing from the ones already live.',
    testing: 'Testing', live: 'Live', running: 'active', idle: 'idle',
    net: 'Net', pf: 'PF', dd: 'DD', win: 'Win', ops: 'Trades', exp: 'Exp', rec: 'Recovery', opsDay: 'Trades/day',
    ready: 'Ready for live', promote: 'Promote to live', config: 'Configure', save: 'Save', saved: 'Saved',
    name: 'Bot name', mode: 'Mode', mAuto: 'Automatic', mTest: 'Force testing', mLive: 'Force live',
    crit: 'Criteria to graduate to live', cDays: 'Min days', cTrades: 'Min trades', cPf: 'Min PF', cDd: 'Max DD %',
    emptyT: 'No bots yet', emptyD: 'When an EA trades on a connected account, it will appear here by its magic number. Make sure the Onyx Connector is installed and reinstall it if it is an old version (it now reports the magic).',
    lockT: 'Bots module', lockD: 'Evaluate your algorithmic strategies: per-bot KPIs, testing vs live and graduation criteria. Available on higher plans.', lockCta: 'See plans',
    soon: 'vs backtest · soon',
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
  const t = T[lang];
  const [d, setD] = useState<any>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const r = await fetch('/api/bots'); setD(await r.json()); } catch { setD({ bots: [] }); }
  }
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  async function save(magic: number, patch: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/bots', { method: 'PATCH', body: JSON.stringify({ magic, ...patch }) });
      if (r.ok) { toast(t.saved, 'ok'); setEdit(null); await load(); }
    } finally { setBusy(false); }
  }
  function openEdit(b: any) {
    setEdit(b.magic);
    setForm({ name: b.name, mode: 'auto', ...b.criteria });
  }

  const bots: any[] = d?.bots || [];
  const testing = bots.filter((b) => b.mode === 'testing');
  const live = bots.filter((b) => b.mode === 'live');

  const Card = ({ b }: { b: any }) => {
    const up = b.net >= 0;
    return (
      <div className="card" style={{ padding: 12, marginBottom: 8 }}>
        <div className="row between" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 7, minWidth: 0 }}>
            <b style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</b>
          </div>
          <span style={{ fontSize: 11, color: b.running ? 'var(--green)' : 'var(--mut)', whiteSpace: 'nowrap' }}>
            {b.running ? '● ' + t.running : '○ ' + t.idle}
          </span>
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
            {b.passed === b.total && (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, fontSize: 12.5 }} onClick={() => save(b.magic, { mode: 'live' })} disabled={busy}>↗ {t.promote}</button>
            )}
          </div>
        )}
        {b.mode === 'live' && (
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{t.exp} <b style={{ color: 'var(--tx)' }}>{money(b.expectancy)}</b> · {t.rec} <b style={{ color: 'var(--tx)' }}>{b.recovery}</b> · <span style={{ opacity: .7 }}>{t.soon}</span></div>
        )}

        <button className="btn btn-ghost" style={{ fontSize: 11.5, marginTop: 8, padding: '5px 10px' }} onClick={() => (edit === b.magic ? setEdit(null) : openEdit(b))}>⚙️ {t.config}</button>

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
                <div key={k} style={{ flex: '1 1 44%' }}><span className="muted" style={{ fontSize: 10.5 }}>{lab}</span>
                  <input type="number" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ margin: '2px 0 0', fontSize: 13 }} /></div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12.5 }} disabled={busy}
              onClick={() => save(b.magic, { name: form.name, mode: form.mode, criteria: { minDays: form.minDays, minTrades: form.minTrades, pf: form.pf, maxDD: form.maxDD } })}>{t.save}</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wrap" style={{ padding: '24px 0 60px', maxWidth: 900 }}>
      <div style={{ padding: '0 4px', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>🤖 {t.title}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{t.sub}</p>
      </div>

      {!d && <div className="card muted">…</div>}

      {d?.locked && (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🤖</div>
          <h3 style={{ marginBottom: 6 }}>{t.lockT}</h3>
          <p className="muted" style={{ fontSize: 14, maxWidth: 460, margin: '0 auto 14px' }}>{t.lockD}</p>
          <Link className="btn btn-primary" href="/pricing">{t.lockCta}</Link>
        </div>
      )}

      {d && !d.locked && !bots.length && (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>📡</div>
          <h3 style={{ marginBottom: 6 }}>{t.emptyT}</h3>
          <p className="muted" style={{ fontSize: 14, maxWidth: 520, margin: '0 auto' }}>{t.emptyD}</p>
        </div>
      )}

      {d && !d.locked && !!bots.length && (
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
      )}
    </div>
  );
}
