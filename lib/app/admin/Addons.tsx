'use client';
import { toast, toastErr } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';

// ============================================================
// Complementos (add-ons) de precio: cuenta extra, slave extra, master extra.
// Viven aquí, en Planes, porque son parte de PRECIOS (no de Retención).
// Se guardan bajo la clave 'addons' del mismo endpoint de ajustes.
// ============================================================
export default function Addons() {
  const t = useT();
  const [a, setA] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const r = await fetch('/api/admin/retention');
    const j = await r.json();
    setA(j.addons || {});
  }
  async function save() {
    setBusy(true);
    const r = await fetch('/api/admin/retention', { method: 'PATCH', body: JSON.stringify({ key: 'addons', value: a }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { toastErr(j); return; }
    toast(t.re_saveAddon, 'ok'); load();
  }

  if (!a) return null;
  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const num = { margin: 0, width: 90, padding: '6px 8px' } as any;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 4 }}>🧩 {t.re_extra}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.re_extraDesc}</p>
      <div className="grid g2" style={{ gap: 12 }}>
        <div><span style={lbl}>{t.re_extraPrice}</span><input type="number" value={a.extra_account_price ?? 4} onChange={(e) => setA({ ...a, extra_account_price: Number(e.target.value) })} style={num} /></div>
        <div><span style={lbl}>{t.re_extraId}</span><input value={a.extra_account_price_id || ''} onChange={(e) => setA({ ...a, extra_account_price_id: e.target.value })} placeholder="price_..." style={{ margin: 0 }} /></div>
      </div>
      <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={a.extra_account_enabled !== false} onChange={(e) => setA({ ...a, extra_account_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
      </label>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>🔁 {t.re_slaveTitle}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.re_slaveDesc}</p>
        <div className="grid g2" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.re_extraPrice}</span><input type="number" value={a.extra_slave_price ?? 9} onChange={(e) => setA({ ...a, extra_slave_price: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.re_extraId}</span><input value={a.extra_slave_price_id || ''} onChange={(e) => setA({ ...a, extra_slave_price_id: e.target.value })} placeholder="price_..." style={{ margin: 0 }} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!a.extra_slave_enabled} onChange={(e) => setA({ ...a, extra_slave_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
        </label>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>🔁 {t.re_masterTitle}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.re_masterDesc}</p>
        <div className="grid g2" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.re_extraPrice}</span><input type="number" value={a.extra_master_price ?? 15} onChange={(e) => setA({ ...a, extra_master_price: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.re_extraId}</span><input value={a.extra_master_price_id || ''} onChange={(e) => setA({ ...a, extra_master_price_id: e.target.value })} placeholder="price_..." style={{ margin: 0 }} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!a.extra_master_enabled} onChange={(e) => setA({ ...a, extra_master_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
        </label>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>🤖 {(t as any).re_algoTitle || 'Módulo de bots'}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{(t as any).re_algoDesc || 'Add-on de $/mes para traders algorítmicos. Va incluido en los planes con la capacidad "algo".'}</p>
        <div className="grid g2" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.re_extraPrice}</span><input type="number" value={a.algo_price ?? 15} onChange={(e) => setA({ ...a, algo_price: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.re_extraId}</span><input value={a.algo_price_id || ''} onChange={(e) => setA({ ...a, algo_price_id: e.target.value })} placeholder="price_..." style={{ margin: 0 }} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!a.algo_enabled} onChange={(e) => setA({ ...a, algo_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
        </label>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={busy}>{t.re_saveAddon}</button>
    </div>
  );
}
