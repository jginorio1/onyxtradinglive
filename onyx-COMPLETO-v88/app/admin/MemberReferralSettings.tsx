'use client';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// Ajustes del programa "Invita y gana" (referidos del usuario común, en crédito).
export default function MemberReferralSettings() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [r, setR] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    try { const res = await fetch('/api/admin/member-referral'); const j = await res.json(); setR(j.settings || {}); setStats(j.stats || null); } catch {}
  }
  async function save() {
    setBusy(true);
    const res = await fetch('/api/admin/member-referral', { method: 'PATCH', body: JSON.stringify(r) });
    const j = await res.json(); setBusy(false);
    if (!res.ok) { toastErr(j); return; }
    toast(es ? 'Guardado.' : 'Saved.'); load();
  }
  if (!r) return null;

  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const num = { margin: 0, width: 100, padding: '6px 8px' } as any;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 15 }}>🎁 {es ? 'Invita y gana (usuarios comunes)' : 'Invite & earn (regular users)'}</b>
        {stats && <span className="pill" style={{ fontSize: 12, color: 'var(--mut)', background: 'var(--bg2)' }}>${stats.credited} {es ? 'acreditado' : 'credited'} · ${stats.pending} {es ? 'en camino' : 'pending'}</span>}
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
        {es ? 'Cada usuario tiene su enlace propio. Recompensa en CRÉDITO de cuenta cuando el amigo paga y pasa la ventana. Convive con Embajadores (efectivo).'
            : 'Every user has their own link. Reward is account CREDIT when the friend pays and clears the window. Runs alongside Ambassadors (cash).'}
      </p>
      <div className="grid g4" style={{ gap: 12 }}>
        <div><span style={lbl}>{es ? 'Crédito al invitador ($)' : 'Referrer credit ($)'}</span><input type="number" value={r.referrer_credit ?? 10} onChange={(e) => setR({ ...r, referrer_credit: Number(e.target.value) })} style={num} /></div>
        <div><span style={lbl}>{es ? 'Crédito al amigo ($)' : 'Friend credit ($)'}</span><input type="number" value={r.friend_credit ?? 10} onChange={(e) => setR({ ...r, friend_credit: Number(e.target.value) })} style={num} /></div>
        <div><span style={lbl}>{es ? 'Ventana anti-reembolso (días)' : 'Refund window (days)'}</span><input type="number" value={r.hold_days ?? 21} onChange={(e) => setR({ ...r, hold_days: Number(e.target.value) })} style={num} /></div>
        <div><span style={lbl}>{es ? 'Umbral a Embajador' : 'Ambassador threshold'}</span><input type="number" value={r.bridge_threshold ?? 5} onChange={(e) => setR({ ...r, bridge_threshold: Number(e.target.value) })} style={num} /></div>
        <div><span style={lbl}>{es ? 'Máx. por mes / invitador' : 'Max per month / referrer'}</span><input type="number" value={r.max_per_month ?? 0} onChange={(e) => setR({ ...r, max_per_month: Number(e.target.value) })} style={num} /></div>
        <div><span style={lbl}>{es ? 'Máx. de por vida / invitador' : 'Max lifetime / referrer'}</span><input type="number" value={r.max_lifetime ?? 0} onChange={(e) => setR({ ...r, max_lifetime: Number(e.target.value) })} style={num} /></div>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{es ? '0 = sin límite.' : '0 = no limit.'}</div>
      <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={r.enabled !== false} onChange={(e) => setR({ ...r, enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {es ? 'Programa activo' : 'Program enabled'}
      </label>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={busy}>{busy ? '…' : (es ? 'Guardar' : 'Save')}</button>
    </div>
  );
}
