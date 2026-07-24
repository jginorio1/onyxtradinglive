'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';

const METHOD: any = { paypal: 'PayPal', usdt: 'USDT', credit: 'Credit' };

export default function Ambassadors() {
  const t = useT();
  const ST: any = {
    pending: { t: t.st_pending, c: '#ffc04d' },
    approved: { t: t.st_approved, c: '#34e2a0' },
    rejected: { t: t.st_rejected, c: '#ff6b7d' },
    paused: { t: t.st_paused, c: '#9aa6bd' },
  };
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [s, setS] = useState<any>({});

  useEffect(() => { load(); }, []);
  async function load() {
    const r = await fetch('/api/admin/ambassadors');
    const j = await r.json();
    setD(j); setS(j.settings || {});
  }
  async function act(action: string, id?: string, value?: any, note?: string) {
    setBusy(String(id || action));
    const r = await fetch('/api/admin/ambassadors', { method: 'PATCH', body: JSON.stringify({ action, id, value, note }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(j.error || 'error'); return; }
    if (action === 'approve' && j.promo === false) alert(t.am_promoFail);
    load();
  }

  if (!d) return <div className="card muted">…</div>;
  const list: any[] = d.ambassadors || [];
  const pend = list.filter((a) => a.status === 'pending');
  const payouts: any[] = d.payouts || [];
  const totalOwed = list.reduce((t, a) => t + (a.balances?.available || 0), 0);
  const totalActive = list.reduce((t, a) => t + (a.active || 0), 0);
  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const num = { margin: 0, width: 90, padding: '6px 8px' } as any;

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🎁</span><span className="th-t">{t.h_embajadores_t}</span></div><div className="th-s">{t.h_embajadores_s}</div></div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="lbl">{t.am_ambassadors}</div><div className="val">{list.filter((a) => a.status === 'approved').length}</div></div>
        <div className="card kpi"><div className="lbl">{t.am_requests}</div><div className="val" style={{ color: pend.length ? 'var(--amber)' : undefined }}>{pend.length}</div></div>
        <div className="card kpi"><div className="lbl">{t.am_brought}</div><div className="val pos">{totalActive}</div></div>
        <div className="card kpi"><div className="lbl">{t.am_toPay}</div><div className="val">${Math.round(totalOwed * 100) / 100}</div></div>
      </div>

      {/* Pagos solicitados */}
      {!!payouts.length && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--amber)' }}>
          <h3 style={{ marginBottom: 10, color: 'var(--amber)' }}>{t.am_payouts} ({payouts.length})</h3>
          {payouts.map((p) => {
            const amb = list.find((a) => a.id === p.ambassador_id);
            return (
              <div key={p.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '10px 0', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b>${p.amount}</b> · {amb?.email || '—'} <span className="muted">({METHOD[p.method] || p.method})</span>
                  <div className="muted" style={{ fontSize: 12 }}>{p.details}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { if (confirm(`${t.am_confirmPaid} $${p.amount}?`)) act('pay', p.id); }} disabled={busy === p.id}>{t.am_markPaid}</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { const n = prompt(t.am_rejectReason) || ''; act('reject_payout', p.id, null, n); }}>{t.am_reject}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ajustes del programa */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>{t.am_rules}</h3>
        <div className="grid g4" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.am_baseRate}</span><input type="number" value={s.base_rate ?? 20} onChange={(e) => setS({ ...s, base_rate: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_goldRate}</span><input type="number" value={s.tier_rate ?? 30} onChange={(e) => setS({ ...s, tier_rate: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_goldActive}</span><input type="number" value={s.tier_threshold ?? 10} onChange={(e) => setS({ ...s, tier_threshold: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_holdDays}</span><input type="number" value={s.hold_days ?? 30} onChange={(e) => setS({ ...s, hold_days: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_minPayout}</span><input type="number" value={s.min_payout ?? 50} onChange={(e) => setS({ ...s, min_payout: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_couponPct}</span><input type="number" value={s.coupon_percent ?? 20} onChange={(e) => setS({ ...s, coupon_percent: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_couponMonths}</span><input type="number" value={s.coupon_months ?? 1} onChange={(e) => setS({ ...s, coupon_months: Number(e.target.value) })} style={num} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.enabled !== false} onChange={(e) => setS({ ...s, enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.am_open}
        </label>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => act('settings', undefined, s)} disabled={busy === 'settings'}>{t.am_saveRules}</button>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.am_couponNote}</p>
      </div>

      {/* Lista */}
      <h3 style={{ marginBottom: 12 }}>{t.am_list} ({list.length})</h3>
      {!list.length && <div className="card muted">{t.am_empty}</div>}
      {list.map((a) => {
        const st = ST[a.status] || ST.pending;
        return (
          <div key={a.id} className="card" style={{ marginBottom: 12, borderLeft: '3px solid ' + st.c }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b>{a.email || '—'}</b>
                  <span className="pill" style={{ color: st.c, background: st.c + '22' }}>{st.t}</span>
                  {a.status === 'approved' && <span className="pill" style={{ color: a.tier === 'gold' ? '#ffd45e' : '#c7ccd6' }}>{a.tier === 'gold' ? t.am_gold : t.am_silver} · {a.rate}%</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {t.am_code} <b>{a.code}</b> · {METHOD[a.payout_method] || '—'} {a.payout_details ? `· ${a.payout_details}` : ''} {a.followers ? `· ${Number(a.followers).toLocaleString()} ${t.am_followers}` : ''}
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {a.status === 'pending' && <>
                  <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('approve', a.id)} disabled={busy === a.id}>{t.am_approve}</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('status', a.id, 'rejected')}>{t.am_reject}</button>
                </>}
                {a.status === 'approved' && <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('status', a.id, 'paused')}>{t.am_pause}</button>}
                {(a.status === 'paused' || a.status === 'rejected') && <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('status', a.id, 'approved')}>{t.am_reactivate}</button>}
              </div>
            </div>

            {a.audience && <div className="muted" style={{ fontSize: 13, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>{a.audience}</div>}

            {a.status === 'approved' && (
              <>
                <div className="grid g4" style={{ gap: 10, marginBottom: 10 }}>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_clicks}</div><b>{a.clicks}</b></div>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_signups}</div><b>{a.signups}</b></div>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_active}</div><b style={{ color: 'var(--green)' }}>{a.active}</b></div>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_conversion}</div><b>{a.clicks ? Math.round((a.signups / a.clicks) * 100) : 0}%</b></div>
                </div>
                <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <span className="muted">{t.am_pending} <b style={{ color: 'var(--tx)' }}>${a.balances?.pending || 0}</b></span>
                  <span className="muted">{t.am_available} <b style={{ color: 'var(--green)' }}>${a.balances?.available || 0}</b></span>
                  <span className="muted">{t.am_paid} <b style={{ color: 'var(--tx)' }}>${a.balances?.paid || 0}</b></span>
                  <span style={{ flex: 1 }} />
                  <span className="muted" style={{ fontSize: 12 }}>{t.am_ownRate}</span>
                  <input defaultValue={a.rate ?? ''} placeholder="auto" onBlur={(e) => { const v = e.target.value.trim(); act('rate', a.id, v === '' ? null : Number(v)); }} style={{ margin: 0, width: 70, padding: '4px 8px' }} />
                  <span className="muted" style={{ fontSize: 12 }}>{t.am_ownRateHint}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
