'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import EmailPreview from './previews/EmailPreview';

// Editor de plantillas de correo transaccional (dueño). Cambia asunto y cuerpo
// en ES/EN; deja un campo vacío para volver al texto por defecto. Variables
// disponibles por plantilla ({academia}, {enlace}, {dias}).
export default function EmailTemplatesControl() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState('');
  const [warnDays, setWarnDays] = useState(5);   // aviso de "prueba por vencer"
  const [wdMsg, setWdMsg] = useState('');

  useEffect(() => { fetch('/api/admin/email-templates').then((r) => r.json()).then((d) => { if (!d.error) setItems(d.items || []); }).catch(() => {}); }, []);
  useEffect(() => { fetch('/api/admin/comp-settings').then((r) => r.json()).then((d) => { if (d?.warnDays) setWarnDays(d.warnDays); }).catch(() => {}); }, []);
  async function saveWarnDays() {
    setWdMsg('');
    try { const r = await fetch('/api/admin/comp-settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ warnDays }) }); const d = await r.json(); if (d?.warnDays) setWarnDays(d.warnDays); setWdMsg(L('Guardado ✓', 'Saved ✓')); } catch { setWdMsg('Error'); }
  }
  const set = (id: string, l: 'es' | 'en', k: 'subject' | 'body', v: string) =>
    setItems((its) => its.map((it) => (it.id === id ? { ...it, [l]: { ...it[l], [k]: v } } : it)));

  async function save() {
    setBusy(true); setMsg('');
    try {
      const overrides: any = {};
      for (const it of items) overrides[it.id] = { es: { subject: it.es.subject, body: it.es.body }, en: { subject: it.en.subject, body: it.en.body } };
      const r = await fetch('/api/admin/email-templates', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ overrides }) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'Error'); else setMsg(L('Guardado ✓', 'Saved ✓'));
    } finally { setBusy(false); }
  }

  if (!items.length) return null;
  const inp: any = { width: '100%', margin: 0, fontSize: 13 };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 4 }}>✉️ {L('Plantillas de correo', 'Email templates')}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        {L('Edita el asunto y el cuerpo de los correos automáticos (ES/EN). Deja un campo vacío para usar el texto por defecto. Variables: {academia}, {enlace}, {dias}.',
           'Edit the subject and body of automated emails (ES/EN). Leave a field empty to use the default text. Variables: {academia}, {enlace}, {dias}.')}
      </p>

      {/* Ajuste de la prueba de pago: días de antelación del aviso (email + popup). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, padding: 10, border: '1px dashed var(--line)', borderRadius: 10 }}>
        <span style={{ fontSize: 12.5 }}>🎁 {L('Prueba de pago: avisar', 'Paid trial: notify')}</span>
        <input type="number" min={1} max={60} value={warnDays} onChange={(e) => setWarnDays(Math.max(1, Math.min(60, Number(e.target.value) || 5)))} style={{ width: 70, margin: 0 }} />
        <span style={{ fontSize: 12.5 }}>{L('día(s) antes (email y popup)', 'day(s) before (email & popup)')}</span>
        <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={saveWarnDays}>{L('Guardar', 'Save')}</button>
        {wdMsg && <span className="muted" style={{ fontSize: 12 }}>{wdMsg}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
            <button onClick={() => setOpen((o) => (o === it.id ? '' : it.id))} className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>{open === it.id ? '▾ ' : '▸ '}{it.label}</span>
              <span className="muted" style={{ fontSize: 11 }}>{(it.vars || []).map((v: string) => `{${v}}`).join(' ')}</span>
            </button>
            {open === it.id && (
              <div style={{ padding: '0 12px 12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {(['es', 'en'] as const).map((l) => (
                    <div key={l}>
                      <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, margin: '4px 0 6px' }}>{l.toUpperCase()}</div>
                      <span className="muted" style={{ fontSize: 11 }}>{L('Asunto', 'Subject')}</span>
                      <input value={it[l].subject} onChange={(e) => set(it.id, l, 'subject', e.target.value)} style={{ ...inp, margin: '3px 0 8px' }} placeholder={it[l].defSubject} />
                      <span className="muted" style={{ fontSize: 11 }}>{L('Cuerpo', 'Body')}</span>
                      <textarea value={it[l].body} onChange={(e) => set(it.id, l, 'body', e.target.value)} rows={5} style={{ ...inp, margin: '3px 0 0', fontFamily: 'inherit' }} placeholder={it[l].defBody} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 5 }}>{L('Vista previa (como llega el correo)', 'Preview (as the email arrives)')}</div>
                  {(() => { const l = lang === 'en' ? 'en' : 'es'; return (
                    <EmailPreview subject={it[l].subject || it[l].defSubject} body={it[l].body || it[l].defBody} es={l === 'es'} />
                  ); })()}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 12, marginTop: 12, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : L('Guardar plantillas', 'Save templates')}</button>
        {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
      </div>
    </div>
  );
}
