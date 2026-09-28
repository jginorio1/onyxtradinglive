'use client';
import { useEffect, useState } from 'react';

// Catálogo de brókers/servers de TradeLocker, editable por el dueño.
// Se llena de DOS formas: (1) automáticamente cuando un trader conecta con un server
// nuevo escrito a mano (se añade solo, prefijo "auto_"); (2) a mano desde aquí.
// TradeLocker NO tiene URL de API que buscar: solo el "server" (el mismo que el trader
// usa para entrar a TradeLocker). La API (/api/admin/tl-servers) exige permiso de módulos.
export default function TlServers() {
  const blank = { name: '', server: '', demo_default: false, is_prop: false, copy_allowed: true, enabled: true, sort: 0 };
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>({ ...blank });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { try { const r = await fetch('/api/admin/tl-servers'); const j = await r.json(); setRows(j.servers || []); } catch {} };
  useEffect(() => { load(); }, []);
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/tl-servers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json();
      setMsg(r.ok ? '✓ Guardado' : ('Error: ' + (j.error || '')));
      if (r.ok) { setF({ ...blank }); load(); }
    } finally { setBusy(false); }
  };
  const edit = (b: any) => setF({ ...b });
  const del = async (code: string) => { if (!confirm('¿Borrar ' + code + '?')) return; await fetch('/api/admin/tl-servers', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }); load(); };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 20 }}>
      <h2 style={{ marginBottom: 4 }}>Brókers TradeLocker</h2>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
        Estos son los brókers que TradeLocker ofrece en el menú al conectar. Se añaden solos
        cuando un trader conecta con un server nuevo (aparecen con prefijo <code>auto_</code>),
        y también puedes añadirlos o editarlos a mano aquí. El <b>server</b> es el mismo texto
        que el trader usa para entrar a TradeLocker (p.ej. <code>YourBroker-Live</code>). No hay
        ninguna URL de API que buscar. Marca <b>Prop firm</b> para mostrar el aviso de reglas.
      </p>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, marginBottom: 18 }}>
        <label className="muted" style={{ fontSize: 12 }}>Nombre visible<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="FundingPips" style={{ marginTop: 4 }} /></label>
        <label className="muted" style={{ fontSize: 12 }}>Server (el de TradeLocker)<input value={f.server} onChange={(e) => setF({ ...f, server: e.target.value })} placeholder="FundingPips-Live" style={{ marginTop: 4 }} /></label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.demo_default} onChange={(e) => setF({ ...f, demo_default: e.target.checked })} /> Demo por defecto</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.is_prop} onChange={(e) => setF({ ...f, is_prop: e.target.checked })} /> Prop firm (aviso)</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.copy_allowed} onChange={(e) => setF({ ...f, copy_allowed: e.target.checked })} /> Permitir Copy</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Activo</label>
        </div>
        <button className="btn btn-primary" disabled={busy || !f.name || !f.server} onClick={save}>{busy ? '…' : 'Guardar bróker'}</button>
        {msg ? <div className="muted" style={{ fontSize: 12.5 }}>{msg}</div> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((b) => (
          <div key={b.code} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
            <b>{b.name}</b>
            <span className="muted" style={{ fontSize: 11 }}>server: {b.server}</span>
            {b.demo_default ? <span className="muted" style={{ fontSize: 11 }}>demo</span> : null}
            {b.is_prop ? <span style={{ fontSize: 11, color: 'var(--warn, #e0a800)' }}>prop</span> : null}
            {String(b.code || '').startsWith('auto_') ? <span style={{ fontSize: 11, color: 'var(--soft-brand, #7c8cff)' }}>auto</span> : null}
            {!b.enabled ? <span className="muted" style={{ fontSize: 11 }}>(off)</span> : null}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => edit(b)}>Editar</button>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => del(b.code)}>Borrar</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="muted" style={{ fontSize: 13 }}>Sin brókers todavía (se añaden solos cuando un trader conecta, o añádelos a mano arriba).</p> : null}
      </div>
    </div>
  );
}
