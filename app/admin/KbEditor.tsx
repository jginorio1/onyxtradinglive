'use client';
import { toast } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';
import { useLang } from '@/lib/lang';

// Base de conocimiento editable: lo que escribas aquí lo lee Onyx AI.
export default function KbEditor() {
  const t = useT();
  const { lang } = useLang();
  const es = lang !== 'en';
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null); // artículo en edición (o nuevo)
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  // Editor del prompt de Onyx AI (instrucciones + conocimiento de marca).
  const [pfOpen, setPfOpen] = useState(false);
  const [pf, setPf] = useState<any>(null);
  const [pfBusy, setPfBusy] = useState(false);

  async function load() { try { const r = await fetch('/api/admin/kb'); const j = await r.json(); setItems(j.articles || []); } catch {} }
  async function loadPrompt() { try { const r = await fetch('/api/admin/ai-prompt'); setPf(await r.json()); } catch {} }
  useEffect(() => { load(); loadPrompt(); }, []);

  async function savePrompt() {
    setPfBusy(true);
    try {
      const r = await fetch('/api/admin/ai-prompt', { method: 'POST', body: JSON.stringify({ brief_es: pf.brief_es || '', brief_en: pf.brief_en || '', extra_es: pf.extra_es || '', extra_en: pf.extra_en || '' }) });
      toast(r.ok ? (es ? 'Prompt guardado. La IA lo usa al instante.' : 'Prompt saved. The AI uses it right away.') : (es ? 'No se pudo guardar.' : 'Could not save.'));
    } finally { setPfBusy(false); }
  }

  // Importa toda la Guía a la Base IA (idempotente). Así la IA la tiene aquí y
  // puedes editarla desde el panel sin desplegar.
  async function importGuide() {
    if (!confirm(es ? 'Sincronizar la Guía con la Base IA? Actualiza las que ya existen, añade las nuevas y quita duplicados. No toca tus artículos escritos a mano.' : 'Sync the Guide into the Knowledge Base? Updates existing ones, adds new ones and removes duplicates. Your hand-written articles are untouched.')) return;
    setImporting(true);
    try {
      const r = await fetch('/api/admin/kb/import-guide', { method: 'POST' });
      const j = await r.json();
      if (r.ok) toast(es ? `Guía sincronizada: ${j.added || 0} nuevas, ${j.updated || 0} actualizadas${j.removed ? `, ${j.removed} limpiadas` : ''}.` : `Guide synced: ${j.added || 0} new, ${j.updated || 0} updated${j.removed ? `, ${j.removed} cleaned` : ''}.`);
      else toast(es ? `No se pudo importar: ${j.error || ''}` : `Could not import: ${j.error || ''}`);
    } catch { toast(es ? 'No se pudo importar.' : 'Could not import.'); }
    setImporting(false); await load();
  }

  async function save() {
    if (!edit?.title?.trim() || !edit?.body?.trim()) { toast(t.kb_emptyEdit); return; }
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
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={importGuide} disabled={importing}>{importing ? '…' : (es ? '📥 Importar Guía' : '📥 Import Guide')}</button>
        <button className="btn btn-primary" onClick={() => setEdit({ title: '', body: '', tags: '', published: true })}>{t.kb_new}</button>
      </div>
    </div>
    {/* Editor del PROMPT de Onyx AI: instrucciones (tono/reglas) + conocimiento de marca. */}
    <div className="card" style={{ borderColor: 'var(--brand)' }}>
      <div className="row between" style={{ alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }} onClick={() => setPfOpen(!pfOpen)}>
        <div>
          <b style={{ fontSize: 15 }}>🧩 {es ? 'Instrucciones de Onyx AI (prompt)' : 'Onyx AI instructions (prompt)'}</b>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{es ? 'Ajusta cómo responde el chat y qué sabe de Onyx, sin tocar código. Se aplica al instante.' : 'Tune how the chat replies and what it knows about Onyx, no code needed. Applies instantly.'}</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }}>{pfOpen ? (es ? 'Ocultar' : 'Hide') : (es ? 'Editar' : 'Edit')}</button>
      </div>

      {pfOpen && pf && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{es ? 'Instrucciones extra (tono, reglas propias)' : 'Extra instructions (tone, your own rules)'}</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{es ? 'Se AÑADEN a las reglas base (que no dé consejo financiero, texto plano, etc. siguen activas). Ej: "Sé más breve", "Ofrece el plan Pro cuando encaje".' : 'These ADD to the base rules (no financial advice, plain text, etc. stay on). E.g. "Be more concise", "Suggest the Pro plan when it fits".'}</div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px' }}><span className="muted" style={{ fontSize: 12 }}>Español</span><textarea value={pf.extra_es || ''} onChange={(e) => setPf({ ...pf, extra_es: e.target.value })} rows={4} style={{ width: '100%', margin: '4px 0 0' }} placeholder={es ? 'Instrucciones extra en español…' : ''} /></div>
              <div style={{ flex: '1 1 300px' }}><span className="muted" style={{ fontSize: 12 }}>English</span><textarea value={pf.extra_en || ''} onChange={(e) => setPf({ ...pf, extra_en: e.target.value })} rows={4} style={{ width: '100%', margin: '4px 0 0' }} placeholder="Extra instructions in English…" /></div>
            </div>
          </div>

          <div>
            <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{es ? 'Conocimiento de marca (qué es Onyx, funciones, cómo conectar)' : 'Brand knowledge (what Onyx is, features, how to connect)'}</div>
              <button className="btn btn-ghost" style={{ fontSize: 11.5 }} onClick={() => { if (confirm(es ? '¿Cargar el texto por defecto? Reemplaza lo que haya en estos dos campos.' : 'Load the default text? It replaces what is in these two fields.')) setPf({ ...pf, brief_es: pf.defaultBrief_es || '', brief_en: pf.defaultBrief_en || '' }); }}>{es ? '↺ Cargar el texto por defecto' : '↺ Load the default text'}</button>
            </div>
            <div className="muted" style={{ fontSize: 12, margin: '4px 0 6px' }}>{es ? 'Si lo dejas VACÍO, la IA usa el texto interno por defecto. Si escribes aquí, REEMPLAZA ese texto (tú controlas los hechos que da sobre Onyx).' : 'If you leave it EMPTY, the AI uses the built-in default. If you write here, it REPLACES that text (you control the facts it gives about Onyx).'}</div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px' }}><span className="muted" style={{ fontSize: 12 }}>Español</span><textarea value={pf.brief_es || ''} onChange={(e) => setPf({ ...pf, brief_es: e.target.value })} rows={8} style={{ width: '100%', margin: '4px 0 0', fontSize: 12.5 }} placeholder={es ? '(vacío = usa el texto por defecto). Pulsa "Cargar el texto por defecto" para editarlo.' : ''} /></div>
              <div style={{ flex: '1 1 300px' }}><span className="muted" style={{ fontSize: 12 }}>English</span><textarea value={pf.brief_en || ''} onChange={(e) => setPf({ ...pf, brief_en: e.target.value })} rows={8} style={{ width: '100%', margin: '4px 0 0', fontSize: 12.5 }} placeholder="(empty = uses the default text). Click “Load the default text” to edit it." /></div>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={savePrompt} disabled={pfBusy}>{pfBusy ? '…' : (es ? 'Guardar prompt' : 'Save prompt')}</button>
          </div>
        </div>
      )}
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
