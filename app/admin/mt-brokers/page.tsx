'use client';
import { useEffect, useState } from 'react';

// Catálogo de brókers/prop firms MatchTrader (Platform API), editable por el dueño.
// El trader luego elige uno de aquí y conecta con su email+contraseña.
// La API (/api/admin/mt-brokers) exige permiso de módulos; si no eres admin, no carga.
export default function MtBrokersAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>({ name: '', base_url: '', is_prop: true, copy_allowed: true, enabled: true, sort: 0 });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [dq, setDq] = useState('');
  const [dbusy, setDbusy] = useState(false);
  const [dmsg, setDmsg] = useState('');
  const load = async () => { try { const r = await fetch('/api/admin/mt-brokers'); const j = await r.json(); setRows(j.brokers || []); } catch {} };
  useEffect(() => { load(); }, []);
  const discover = async () => {
    setDbusy(true); setDmsg('Buscando…');
    try {
      const r = await fetch('/api/admin/mt-brokers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'discover', query: dq || f.name }) });
      const j = await r.json();
      if (j.found) {
        setF((prev: any) => ({ ...prev, base_url: j.base_url, name: prev.name || j.brokerName || '' }));
        setDmsg('✓ Encontrada: ' + j.base_url + (j.brokerName ? ' (' + j.brokerName + ')' : ''));
      } else setDmsg('No se encontró automáticamente (probé ' + j.tried + ' dominios). Pégala a mano desde el Network del web trader.');
    } catch { setDmsg('Error buscando'); } finally { setDbusy(false); }
  };
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/mt-brokers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json();
      setMsg(r.ok ? (j.reachable ? '✓ Guardado · API responde (brokerId ' + j.brokerId + ')' : '✓ Guardado · aviso: no se pudo verificar la URL') : ('Error: ' + (j.error || '')));
      if (r.ok) { setF({ name: '', base_url: '', is_prop: true, copy_allowed: true, enabled: true, sort: 0 }); load(); }
    } finally { setBusy(false); }
  };
  const edit = (b: any) => setF({ ...b });
  const del = async (code: string) => { if (!confirm('¿Borrar ' + code + '?')) return; await fetch('/api/admin/mt-brokers', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }); load(); };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 20 }}>
      <h2 style={{ marginBottom: 4 }}>Brókers MatchTrader (Platform API)</h2>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
        Añade aquí cada bróker/prop firm que use MatchTrader. La URL base es la de su Platform API
        (mírala en la pestaña Network del web trader del bróker: algo como <code>https://mtr.subroker.com</code>).
        Marca <b>Prop firm</b> para que el trader vea el aviso de reglas antes de conectar.
      </p>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, marginBottom: 18 }}>
        <label className="muted" style={{ fontSize: 12 }}>Nombre<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="FundedNext" style={{ marginTop: 4 }} /></label>
        <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: 10 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🔎 Autodetectar API (dominio o nombre del bróker)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={dq} onChange={(e) => setDq(e.target.value)} placeholder="fundednext.com" style={{ flex: 1 }} />
            <button className="btn btn-ghost" disabled={dbusy || (!dq && !f.name)} onClick={discover}>{dbusy ? '…' : 'Buscar'}</button>
          </div>
          {dmsg ? <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{dmsg}</div> : null}
        </div>
        <label className="muted" style={{ fontSize: 12 }}>URL base de la Platform API<input value={f.base_url} onChange={(e) => setF({ ...f, base_url: e.target.value })} placeholder="https://mtr.fundednext.com" style={{ marginTop: 4 }} /></label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.is_prop} onChange={(e) => setF({ ...f, is_prop: e.target.checked })} /> Prop firm (aviso)</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.copy_allowed} onChange={(e) => setF({ ...f, copy_allowed: e.target.checked })} /> Permitir Copy</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Activo</label>
        </div>
        <button className="btn btn-primary" disabled={busy || !f.name || !f.base_url} onClick={save}>{busy ? '…' : 'Guardar bróker'}</button>
        {msg ? <div className="muted" style={{ fontSize: 12.5 }}>{msg}</div> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((b) => (
          <div key={b.code} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
            <b>{b.name}</b>
            <span className="muted" style={{ fontSize: 11 }}>{b.base_url}</span>
            {b.is_prop ? <span style={{ fontSize: 11, color: 'var(--warn, #e0a800)' }}>prop</span> : null}
            {!b.enabled ? <span className="muted" style={{ fontSize: 11 }}>(off)</span> : null}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => edit(b)}>Editar</button>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => del(b.code)}>Borrar</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="muted" style={{ fontSize: 13 }}>Sin brókers todavía (o no tienes permiso de admin).</p> : null}
      </div>
    </div>
  );
}
