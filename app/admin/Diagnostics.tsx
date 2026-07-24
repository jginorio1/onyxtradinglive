'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';

function dot(color: string) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: color, display: 'inline-block' }} />;
}
function statColor(s: any) { return s.ok && !s.warn ? '#34e2a0' : s.warn ? '#ffc04d' : s.ok ? '#34e2a0' : '#ff6b7d'; }

export default function Diagnostics() {
  const t = useT();
  const GUIDE = [
    { t: t.dg1t, d: t.dg1d }, { t: t.dg2t, d: t.dg2d }, { t: t.dg3t, d: t.dg3d },
    { t: t.dg4t, d: t.dg4d }, { t: t.dg5t, d: t.dg5d }, { t: t.dg6t, d: t.dg6d },
  ];
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [test, setTest] = useState<any>({});

  async function load() {
    try { const r = await fetch('/api/admin/diag'); setD(await r.json()); } catch {}
  }
  // Auto-refresco en vivo cada 20 s (además del botón Refrescar).
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, []);

  async function runTest(action: string) {
    setBusy(action); setTest({ ...test, [action]: null });
    try {
      const r = await fetch('/api/admin/diag', { method: 'POST', body: JSON.stringify({ action }) });
      const j = await r.json();
      setTest({ ...test, [action]: j });
    } catch { setTest({ ...test, [action]: { ok: false, message: 'Error de red.' } }); }
    setBusy('');
  }

  if (!d) return <p className="muted">{t.d_loading}</p>;
  const missing = (d.migrations || []).filter((m: any) => !m.ok);

  return (
    <div>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="tabhead" style={{ marginBottom: 12 }}><div className="th-row"><span className="th-ic">🩺</span><span className="th-t">{t.h_diag_t}</span></div><div className="th-s">{t.h_diag_s}</div></div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#7fe9c0', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{t.d_liveBadge}</span>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={load}>{t.d_refresh}</button>
        </div>
      </div>

      {/* Semáforo */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 20 }}>
        {(d.services || []).map((s: any) => (
          <div key={s.key} className="tile" style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            {statColor(s) === '#34e2a0' ? <span className="livedot" /> : dot(statColor(s))}
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{s.name}</b>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pruebas rápidas */}
      <h3 style={{ marginBottom: 10 }}>{t.d_quickTests}</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => runTest('test_ai')} disabled={busy === 'test_ai'}>{busy === 'test_ai' ? '...' : t.d_testAI}</button>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => runTest('test_email')} disabled={busy === 'test_email'}>{busy === 'test_email' ? '...' : t.d_testEmail}</button>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => runTest('test_telegram')} disabled={busy === 'test_telegram'}>{busy === 'test_telegram' ? '...' : t.d_testTG}</button>
      </div>
      {['test_ai', 'test_email', 'test_telegram'].map((k) => test[k] && (
        <div key={k} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', fontSize: 12, marginBottom: 6, color: test[k].ok ? 'var(--green)' : 'var(--amber)', border: '1px solid ' + (test[k].ok ? 'var(--green)' : 'var(--amber)') }}>
          {test[k].ok ? '✓ ' : '⚠ '}{test[k].message}
        </div>
      ))}

      {/* Base de datos */}
      <h3 style={{ margin: '20px 0 10px' }}>{t.d_db}</h3>
      <div className="card" style={{ padding: '4px 14px', marginBottom: missing.length ? 8 : 20 }}>
        {(d.migrations || []).map((m: any, i: number) => (
          <div key={m.id} className="row between" style={{ padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
            <span>{m.label} <span className="muted" style={{ fontSize: 11 }}>({m.id}.sql)</span></span>
            {m.ok ? <span className="pill" style={{ color: 'var(--green)', background: 'rgba(52,226,160,.15)' }}>{t.d_applied}</span> : <span className="pill red">{t.d_missing}</span>}
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div style={{ background: 'rgba(255,107,125,.08)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 12px', marginBottom: 20, fontSize: 13 }}>
          {t.d_missingMsg}<b>{missing.map((m: any) => m.id + '.sql').join(', ')}</b>
        </div>
      )}

      {/* Errores recientes */}
      <h3 style={{ marginBottom: 10 }}>{t.d_recentErrors}</h3>
      {!(d.errors || []).length && <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>{t.d_noErrors}</p>}
      {!!(d.errors || []).length && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {d.errors.map((e: any, i: number) => (
            <div key={i} className="card" style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13 }}>
                {e.code && <span style={{ color: 'var(--red)' }}>{e.code} · </span>}
                <b>{e.source}</b> <span className="muted" style={{ fontSize: 11 }}>{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{e.message}</div>
              {e.hint && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--amber)' }}>→ {e.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Guía de errores comunes */}
      <h3 style={{ marginBottom: 10 }}>{t.d_commonErrors}</h3>
      <div className="card" style={{ padding: '4px 14px' }}>
        {GUIDE.map((g, i) => (
          <div key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{g.t}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{g.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
