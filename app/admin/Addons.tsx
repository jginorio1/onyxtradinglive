'use client';
import { toast, toastErr } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// Complementos (add-ons) de precio: cuenta extra, slave extra, master extra.
// Viven aquí, en Planes, porque son parte de PRECIOS (no de Retención).
// Se guardan bajo la clave 'addons' del mismo endpoint de ajustes.
// ============================================================
export default function Addons() {
  const t = useT();
  const [a, setA] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  // Soporte remoto de pago (servicio) — vive en su propia clave de ajustes.
  const [rem, setRem] = useState<any>(null);
  const [remBusy, setRemBusy] = useState(false);

  useEffect(() => { load(); loadRemote(); }, []);
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
  async function loadRemote() { try { const r = await fetch('/api/admin/support/remote'); setRem(await r.json()); } catch {} }
  async function saveRemote() {
    setRemBusy(true);
    const r = await fetch('/api/admin/support/remote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rem) });
    const j = await r.json(); setRemBusy(false);
    if (!r.ok) { toastErr(j); return; }
    toast(t.re_saveAddon, 'ok'); loadRemote();
  }

  if (!a) return null;
  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const num = { margin: 0, width: 90, padding: '6px 8px' } as any;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 4 }}><OnyxIcon emoji="🧩" size={15} /> {t.re_extra}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.re_extraDesc}</p>
      <div className="grid g2" style={{ gap: 12 }}>
        <div><span style={lbl}>{t.re_extraPrice}</span><input type="number" value={a.extra_account_price ?? 4} onChange={(e) => setA({ ...a, extra_account_price: Number(e.target.value) })} style={num} /></div>
        <div><span style={lbl}>{t.re_extraId}</span><input value={a.extra_account_price_id || ''} onChange={(e) => setA({ ...a, extra_account_price_id: e.target.value })} placeholder="price_..." style={{ margin: 0 }} /></div>
      </div>
      <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={a.extra_account_enabled !== false} onChange={(e) => setA({ ...a, extra_account_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
      </label>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        <h3 style={{ marginBottom: 4, fontSize: 15 }}><OnyxIcon emoji="🔁" size={15} /> {t.re_slaveTitle}</h3>
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
        <h3 style={{ marginBottom: 4, fontSize: 15 }}><OnyxIcon emoji="🔁" size={15} /> {t.re_masterTitle}</h3>
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
        <h3 style={{ marginBottom: 4, fontSize: 15 }}><OnyxIcon emoji="🤖" size={15} /> {(t as any).re_algoTitle || 'Módulo de bots'}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{(t as any).re_algoDesc || 'Add-on de $/mes para traders algorítmicos. Va incluido en los planes con la capacidad "algo".'}</p>
        <div className="grid g2" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.re_extraPrice}</span><input type="number" value={a.algo_price ?? 15} onChange={(e) => setA({ ...a, algo_price: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.re_extraId}</span><input value={a.algo_price_id || ''} onChange={(e) => setA({ ...a, algo_price_id: e.target.value })} placeholder="price_..." style={{ margin: 0 }} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!a.algo_enabled} onChange={(e) => setA({ ...a, algo_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
        </label>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        <h3 style={{ marginBottom: 4, fontSize: 15 }}><OnyxIcon emoji="⚡" size={15} /> Paquete de consultas de Onyx AI</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Pago único (no recurrente): suma consultas al tope del mes en curso. Se cobra una vez a la tarjeta guardada; el mes siguiente arranca sin extra. Define cuántas consultas da cada paquete y su precio.</p>
        <div className="grid g2" style={{ gap: 12 }}>
          <div><span style={lbl}>Precio (pago único)</span><input type="number" value={a.ai_pack_price ?? 5} onChange={(e) => setA({ ...a, ai_pack_price: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>Consultas por paquete</span><input type="number" value={a.ai_pack_qty ?? 100} onChange={(e) => setA({ ...a, ai_pack_qty: Number(e.target.value) })} style={num} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={a.ai_pack_enabled !== false} onChange={(e) => setA({ ...a, ai_pack_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
        </label>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={busy}>{t.re_saveAddon}</button>
      <p className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>El tope mensual de consultas de Onyx AI de cada plan se configura en cada tarjeta de plan, arriba (campo "Consultas de Onyx AI / mes").</p>

      {/* Soporte remoto de pago (sesión 1 a 1). Guardado aparte, con su propio botón.
          El texto del correo de confirmación se edita en Admin → Correos ('remote_support'). */}
      {rem && (
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 14 }}>
          <h3 style={{ marginBottom: 4, fontSize: 15 }}><OnyxIcon emoji="🖥️" size={15} /> Soporte remoto (sesión de pago)</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Sesión 1 a 1 por pantalla compartida (pago único). No se ofrece en iPhone (regla de Apple). El correo de confirmación se edita en Admin → Correos → “Soporte remoto · sesión reservada”.</p>
          <div className="grid g2" style={{ gap: 12 }}>
            <div><span style={lbl}>Precio (USD)</span><input type="number" value={rem.price ?? 25} onChange={(e) => setRem({ ...rem, price: Number(e.target.value) })} style={num} /></div>
            <div><span style={lbl}>Duración (min)</span><input type="number" value={rem.minutes ?? 30} onChange={(e) => setRem({ ...rem, minutes: Number(e.target.value) })} style={num} /></div>
            <div><span style={lbl}>Herramienta</span><input value={rem.tool || ''} onChange={(e) => setRem({ ...rem, tool: e.target.value })} placeholder="AnyDesk" style={{ margin: 0 }} /></div>
            <div><span style={lbl}>Enlace de descarga</span><input value={rem.link || ''} onChange={(e) => setRem({ ...rem, link: e.target.value })} placeholder="https://anydesk.com/download" style={{ margin: 0 }} /></div>
          </div>
          <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!rem.on} onChange={(e) => setRem({ ...rem, on: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.re_addonOn}
          </label>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={saveRemote} disabled={remBusy}>{t.re_saveAddon}</button>
        </div>
      )}
    </div>
  );
}
