'use client';
import { useEffect, useState } from 'react';

// Base de conocimiento editable: lo que escribas aquí lo lee Onyx AI.
export default function KbEditor() {
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null); // artículo en edición (o nuevo)
  const [busy, setBusy] = useState(false);

  async function load() { try { const r = await fetch('/api/admin/kb'); const j = await r.json(); setItems(j.articles || []); } catch {} }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit?.title?.trim() || !edit?.body?.trim()) { alert('Pon título y contenido.'); return; }
    setBusy(true);
    const method = edit.id ? 'PATCH' : 'POST';
    await fetch('/api/admin/kb', { method, body: JSON.stringify(edit) });
    setBusy(false); setEdit(null); await load();
  }
  async function del(id: string) { if (!confirm('¿Borrar este artículo de la base IA?')) return; await fetch('/api/admin/kb', { method: 'DELETE', body: JSON.stringify({ id }) }); await load(); }
  async function togglePub(a: any) { await fetch('/api/admin/kb', { method: 'PATCH', body: JSON.stringify({ id: a.id, published: !a.published }) }); await load(); }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <h3>🧠 Base de conocimiento de Onyx AI</h3>
        <button className="btn btn-primary" onClick={() => setEdit({ title: '', body: '', tags: '', published: true })}>+ Nuevo artículo</button>
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Lo que escribas aquí lo usa la IA para responder, además de la Guía. Ideal para precios, promociones, políticas o preguntas frecuentes que cambian.</p>

      {edit && (
        <div style={{ border: '1px solid var(--brand)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <span className="muted" style={{ fontSize: 12 }}>Título</span>
          <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Ej: ¿Ofrecen prueba gratis?" style={{ margin: '4px 0 10px' }} />
          <span className="muted" style={{ fontSize: 12 }}>Contenido (la respuesta)</span>
          <textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={5} style={{ width: '100%', margin: '4px 0 10px' }} />
          <span className="muted" style={{ fontSize: 12 }}>Palabras clave (separadas por coma, ayudan a encontrarlo)</span>
          <input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="prueba, gratis, demo, trial" style={{ margin: '4px 0 10px' }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={edit.published !== false} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} style={{ width: 'auto' }} /> Publicado (la IA lo usa)
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '...' : 'Guardar'}</button>
            <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {!items.length && !edit && <p className="muted" style={{ fontSize: 14 }}>Aún no hay artículos. Crea el primero para que la IA sepa más.</p>}
      {items.map((a) => (
        <div key={a.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '11px 0', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600 }}>{a.title} {!a.published && <span className="pill" style={{ color: 'var(--mut)' }}>oculto</span>}</div>
            <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>{a.body}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => togglePub(a)}>{a.published ? 'Ocultar' : 'Publicar'}</button>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEdit(a)}>Editar</button>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => del(a.id)}>Borrar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
