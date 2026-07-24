'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';

export default function Retention() {
  const t = useT();
  const REASON: any = {
    price: t.reason_price, unused: t.reason_unused, missing: t.reason_missing, stopped: t.reason_stopped, other: t.reason_other,
  };
  const OUTCOME: any = {
    saved_discount: [t.out_discount, '#34e2a0'],
    saved_pause: [t.out_pause, '#34e2a0'],
    saved_downgrade: [t.out_downgrade, '#ffd45e'],
    canceled: [t.out_canceled, '#ff6b7d'],
    pending: [t.out_pending, '#9aa6bd'],
  };
  const [d, setD] = useState<any>(null);
  const [r, setR] = useState<any>({});
  const [a, setA] = useState<any>({});
  const [busy, setBusy] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    const res = await fetch('/api/admin/retention');
    const j = await res.json();
    setD(j); setR(j.retention || {}); setA(j.addons || {});
  }
  async function save(key: string, value: any) {
    setBusy(key);
    const res = await fetch('/api/admin/retention', { method: 'PATCH', body: JSON.stringify({ key, value }) });
    const j = await res.json(); setBusy('');
    if (!res.ok) { alert(j.error || 'error'); return; }
    load();
  }

  if (!d) return <div className="card muted">…</div>;
  const total = Object.values(d.byReason || {}).reduce((s: any, n: any) => s + n, 0) as number;
  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const num = { margin: 0, width: 90, padding: '6px 8px' } as any;

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🛟</span><span className="th-t">{t.h_retencion_t}</span></div><div className="th-s">{t.h_retencion_s}</div></div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="lbl">{t.re_attempts}</div><div className="val">{d.total}</div></div>
        <div className="card kpi"><div className="lbl">{t.re_saved}</div><div className="val pos">{d.saved}</div></div>
        <div className="card kpi"><div className="lbl">{t.re_lost}</div><div className="val neg">{d.canceled}</div></div>
        <div className="card kpi"><div className="lbl">{t.re_rate}</div><div className="val" style={{ color: d.saveRate >= 30 ? 'var(--green)' : 'var(--amber)' }}>{d.saveRate}%</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>{t.re_whyLeave}</h3>
        {!total && <p className="muted" style={{ fontSize: 14 }}>{t.re_noneYet}</p>}
        {Object.keys(d.byReason || {}).sort((x, y) => d.byReason[y] - d.byReason[x]).map((k) => {
          const n = d.byReason[k];
          const pct = Math.round((n / Math.max(total, 1)) * 100);
          return (
            <div key={k} style={{ marginBottom: 10 }}>
              <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}><span>{REASON[k] || k}</span><span className="muted">{n} · {pct}%</span></div>
              <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: 'var(--grad)' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>{t.re_offers}</h3>
        <div className="grid g4" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.re_discPct}</span><input type="number" value={r.discount_percent ?? 50} onChange={(e) => setR({ ...r, discount_percent: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.re_discMonths}</span><input type="number" value={r.discount_months ?? 3} onChange={(e) => setR({ ...r, discount_months: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.re_pauseMonths}</span><input type="number" value={r.pause_months ?? 2} onChange={(e) => setR({ ...r, pause_months: Number(e.target.value) })} style={num} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={r.allow_downgrade !== false} onChange={(e) => setR({ ...r, allow_downgrade: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_allowDown}
        </label>
        <label className="row" style={{ gap: 8, marginTop: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={r.enabled !== false} onChange={(e) => setR({ ...r, enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_flowOn}
        </label>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => save('retention', r)} disabled={busy === 'retention'}>{t.re_saveOffers}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 4 }}>{t.re_extra}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.re_extraDesc}</p>
        <div className="grid g2" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.re_extraPrice}</span><input type="number" value={a.extra_account_price ?? 4} onChange={(e) => setA({ ...a, extra_account_price: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.re_extraId}</span><input value={a.extra_account_price_id || ''} onChange={(e) => setA({ ...a, extra_account_price_id: e.target.value })} placeholder="price_..." style={{ margin: 0 }} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={a.extra_account_enabled !== false} onChange={(e) => setA({ ...a, extra_account_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
        </label>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => save('addons', a)} disabled={busy === 'addons'}>{t.re_saveAddon}</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>{t.re_recent}</h3>
        {!d.recent?.length && <p className="muted" style={{ fontSize: 14 }}>{t.re_recentEmpty}</p>}
        {(d.recent || []).map((c: any) => {
          const [txt, col] = OUTCOME[c.outcome] || OUTCOME.pending;
          return (
            <div key={c.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
              <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b style={{ fontSize: 14 }}>{c.email || '—'}</b> <span className="muted" style={{ fontSize: 13 }}>· {REASON[c.reason] || c.reason} · {c.plan}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="pill" style={{ color: col, background: col + '22' }}>{txt}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              {c.detail && <div className="muted" style={{ fontSize: 13, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>“{c.detail}”</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
