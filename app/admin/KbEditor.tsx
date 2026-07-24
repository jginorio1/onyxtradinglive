'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';

// Base de conocimiento editable: lo que escribas aquí lo lee Onyx AI.
export default function KbEditor() {
  const t = useT();
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null); // artículo en edición (o nuevo)
  const [busy, setBusy] = useState(false);

  async function load() { try { const r = await fetch('/api/admin/kb'); const j = await r.json(); setItems(j.articles || []); } catch {} }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit?.title?.trim() || !edit?.body?.trim()) { alert(t.kb_emptyEdit); return; }
    setBusy(true);
    const method = edit.id ? 'PATCH' : 'POST';
    await fetch('/api/admin/kb', { method, body: JSON.stringify(edit) });
    setBusy(false); setEdit(null); await load();
  }
  async function del(id: string) { if (!confirm(t.kb_confirmDel)) return; await fetch('/api/admin/kb', { method: 'DELETE', body: JSON.stringify({ id }) }); await load(); }
  async function togglePub(a: any) { await fetch('/api/admin/kb', { method: 'PATCH', body: JSON.stringify({ id: a.id, published: !a.published }) }); await load(); }

  return (
    <>
    <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🧠</span><span className="th-t">{t.h_kb_t}</span></div><div className="th-s">{t.h_kb_s}</div></div>
      <button className="btn btn-primary" onClick={() => setEdit({ title: '', body: '', tags: '', published: true })}>{t.kb_new}</button>
    </div>
    <div className="card">
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t.kb_intro}</p>

      {edit && (
        <div style={{ border: '1px solid var(--brand)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t.kb_title}</span>
          <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder={t.kb_titlePh} style={{ margin: '4px 0 10px' }} />
          <span className="muted" style={{ fontSize: 12 }}>{t.kb_body}</span>
          <textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={5} style={{ width: '100%', margin: '4px 0 10px' }} />
          <span className="muted" style={{ fontSize: 12 }}>{t.kb_tags}</span>
          <input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder={t.kb_tagsPh} style={{ margin: '4px 0 10px' }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={edit.published !== false} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} style={{ width: 'auto' }} /> {t.kb_published}
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '...' : t.kb_save}</button>
            <button className="btn btn-ghost" onClick={() => setEdit(null)}>{t.kb_cancel}</button>
          </div>
        </div>
      )}

      {!items.length && !edit && <p className="muted" style={{ fontSize: 14 }}>{t.kb_empty}</p>}
      {items.map((a) => (
        <div key={a.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '11px 0', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600 }}>{a.title} {!a.published && <span className="pill" style={{ color: 'var(--mut)' }}>{t.kb_hidden}</span>}</div>
            <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>{a.body}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => togglePub(a)}>{a.published ? t.kb_hide : t.kb_publish}</button>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEdit(a)}>{t.kb_edit}</button>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => del(a.id)}>{t.kb_delete}</button>
          </div>
        </div>
      ))}
    </div>
    </>
  );
}
