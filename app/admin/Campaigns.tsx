'use client';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';

// ============================================================
// Admin → Campañas. Correos de seguimiento automáticos a la base de traders +
// envío manual de promos/noticias, con plantillas editables y borrador IA.
// Bilingüe por su cuenta (no depende del diccionario del panel).
// ============================================================

type Campaign = {
  id: string; key: string | null; name: string; kind: 'trigger' | 'scheduled' | 'manual';
  segment: string; subject_es: string; body_es: string; subject_en: string; body_en: string;
  enabled: boolean; trigger: any; schedule: string; last_run_at: string | null;
};
type Seg = { id: string; es: string; en: string; auto?: boolean };

export default function Campaigns() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [segs, setSegs] = useState<Seg[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const segLabel = (id: string) => { const s = segs.find((x) => x.id === id); return s ? s[lang === 'en' ? 'en' : 'es'] : id; };

  async function load() {
    const r = await fetch('/api/admin/campaigns'); const j = await r.json();
    setCamps(j.campaigns || []); setSegs(j.segments || []); setStats(j.stats || null);
  }
  useEffect(() => { load(); }, []);

  async function toggle(c: Campaign) {
    const r = await fetch('/api/admin/campaigns', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: c.id, enabled: !c.enabled }) });
    if (!r.ok) { toastErr(await r.json()); return; }
    setCamps((list) => list.map((x) => x.id === c.id ? { ...x, enabled: !x.enabled } : x));
  }

  const autos = camps.filter((c) => c.kind !== 'manual');
  const manuals = camps.filter((c) => c.kind === 'manual');

  const kindBadge = (k: string) => k === 'scheduled'
    ? <span className="pill" style={{ color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{L('Programada', 'Scheduled')}</span>
    : <span className="pill" style={{ color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('Por evento', 'Triggered')}</span>;

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">📣</span><span className="th-t">{L('Campañas', 'Campaigns')}</span></div>
        <div className="th-s">{L('Correos de seguimiento automáticos a tus traders + envíos manuales de promos y noticias.', 'Automated follow-up emails to your traders + manual promos and news.')}</div></div>

      {/* Métricas 30 días */}
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Enviados (30d)', 'Sent (30d)')}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{(stats?.sent30 ?? 0).toLocaleString()}</div></div>
        <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Fallidos (30d)', 'Failed (30d)')}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: (stats?.failed30 ?? 0) > 0 ? 'var(--amber)' : 'var(--tx)' }}>{(stats?.failed30 ?? 0).toLocaleString()}</div></div>
        <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Campañas activas', 'Active campaigns')}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: 'var(--green)' }}>{camps.filter((c) => c.enabled).length}</div></div>
      </div>

      {/* Automáticas */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 4 }}>🤖 {L('Campañas automáticas', 'Automatic campaigns')}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{L('El sistema las envía solo, a diario, al segmento correcto. Cada trader recibe cada campaña una sola vez y siempre se respeta la baja.', 'The system sends these on its own, daily, to the right segment. Each trader gets each campaign once and opt-out is always respected.')}</p>
        {autos.map((c, i) => (
          <div key={c.id} className="row between" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '12px 0', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{c.name}</b>{kindBadge(c.kind)}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                {L('Segmento', 'Segment')}: {segLabel(c.segment)}
                {c.kind === 'trigger' && c.trigger?.days ? ` · ${L('tras', 'after')} ${c.trigger.days} ${L('días', 'days')}` : ''}
                {c.kind === 'scheduled' ? ` · ${L('semanal', 'weekly')}` : ''}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setEditing(c)}>✏️ {L('Editar', 'Edit')}</button>
              <span className="toggle" onClick={() => toggle(c)} style={{ background: c.enabled ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: c.enabled ? 21 : 3 }} /></span>
            </div>
          </div>
        ))}
      </div>

      {/* Envío manual */}
      <ManualComposer segs={segs} manuals={manuals} L={L} lang={lang} segLabel={segLabel} reload={load} onEdit={setEditing} />

      {editing && <Editor c={editing} segs={segs} L={L} lang={lang} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

// ---- Compositor de promos/noticias (envío manual inmediato) ----
function ManualComposer({ segs, manuals, L, lang, segLabel, reload, onEdit }: any) {
  const [seg, setSeg] = useState('all');
  const [topic, setTopic] = useState('');
  const [f, setF] = useState({ subject_es: '', body_es: '', subject_en: '', body_en: '' });
  const [busy, setBusy] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));

  async function draft() {
    if (!topic.trim()) { toast(L('Escribe de qué trata el correo.', 'Write what the email is about.')); return; }
    setBusy('draft');
    try {
      const r = await fetch('/api/admin/campaigns/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, segment: seg }) });
      const j = await r.json();
      if (!r.ok) { toastErr(j); return; }
      setF({ subject_es: j.draft.subject_es, body_es: j.draft.body_es, subject_en: j.draft.subject_en, body_en: j.draft.body_en });
      toast(L('Borrador listo. Revísalo y edítalo antes de enviar.', 'Draft ready. Review and edit before sending.'), 'ok');
    } finally { setBusy(''); }
  }
  async function preview() {
    setBusy('count');
    try { const r = await fetch('/api/admin/campaigns/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'count', segment: seg }) }); const j = await r.json(); setCount(j.count ?? 0); } finally { setBusy(''); }
  }
  async function test() {
    setBusy('test');
    try { const r = await fetch('/api/admin/campaigns/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test', lang, ...f }) }); const j = await r.json(); if (!r.ok) toastErr(j); else toast(L('Correo de prueba enviado a tu dirección.', 'Test email sent to your address.'), 'ok'); } finally { setBusy(''); }
  }
  async function send() {
    if (!f.subject_es && !f.subject_en) { toast(L('Falta el asunto.', 'Subject is missing.')); return; }
    const n = count ?? '—';
    if (!confirm(L(`¿Enviar esta campaña ahora a ${n} traders del segmento "${segLabel(seg)}"?`, `Send this campaign now to ${n} traders in "${segLabel(seg)}"?`))) return;
    setBusy('send');
    try { const r = await fetch('/api/admin/campaigns/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'send', segment: seg, ...f }) }); const j = await r.json(); if (!r.ok) toastErr(j); else { toast(L(`Enviado a ${j.sent} traders.`, `Sent to ${j.sent} traders.`), 'ok'); reload(); } } finally { setBusy(''); }
  }

  const ta = { width: '100%', minHeight: 90, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', marginTop: 4, fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical' } as any;
  const inp = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', marginTop: 4 } as any;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>✉️ {L('Envío manual (promos y noticias)', 'Manual send (promos & news)')}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Elige a quién, escribe (o deja que la IA te dé un borrador), mira cuántos lo recibirán, prueba y envía.', 'Pick who, write (or let AI draft it), preview the count, test, and send.')}</p>

      <div className="grid g2" style={{ gap: 12, marginBottom: 12 }}>
        <label className="muted" style={{ fontSize: 12 }}>{L('Segmento', 'Segment')}
          <select value={seg} onChange={(e) => { setSeg(e.target.value); setCount(null); }} style={inp}>
            {segs.map((s: Seg) => <option key={s.id} value={s.id}>{s[lang === 'en' ? 'en' : 'es']}</option>)}
          </select>
        </label>
        <label className="muted" style={{ fontSize: 12 }}>{L('Tema para la IA (opcional)', 'Topic for AI (optional)')}
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={L('Ej: −30% en Pro por 48h', 'e.g. −30% on Pro for 48h')} style={{ ...inp, marginTop: 0 }} />
            <button className="btn btn-ghost" onClick={draft} disabled={busy === 'draft'} style={{ whiteSpace: 'nowrap' }}>{busy === 'draft' ? '…' : '✨ ' + L('Borrador', 'Draft')}</button>
          </div>
        </label>
      </div>

      <div className="grid g2" style={{ gap: 12 }}>
        <div>
          <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (ES)', 'Subject (ES)')}<input value={f.subject_es} onChange={(e) => set('subject_es', e.target.value)} style={inp} /></label>
          <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (ES)', 'Body (ES)')}<textarea value={f.body_es} onChange={(e) => set('body_es', e.target.value)} style={ta} /></label>
        </div>
        <div>
          <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (EN)', 'Subject (EN)')}<input value={f.subject_en} onChange={(e) => set('subject_en', e.target.value)} style={inp} /></label>
          <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (EN)', 'Body (EN)')}<textarea value={f.body_en} onChange={(e) => set('body_en', e.target.value)} style={ta} /></label>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{L('Variables: {{nombre}} {{plan}} {{sitio}}. El pie con enlace de baja se añade solo.', 'Variables: {{nombre}} {{plan}} {{sitio}}. The unsubscribe footer is added automatically.')}</p>

      <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={preview} disabled={busy === 'count'}>{busy === 'count' ? '…' : '👁 ' + L('Ver cuántos', 'Preview count')}</button>
        {count !== null && <span className="pill" style={{ color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{count.toLocaleString()} {L('destinatarios', 'recipients')}</span>}
        <button className="btn btn-ghost" onClick={test} disabled={busy === 'test'}>{busy === 'test' ? '…' : '📧 ' + L('Prueba', 'Test')}</button>
        <button className="btn btn-primary" onClick={send} disabled={busy === 'send'} style={{ marginLeft: 'auto' }}>{busy === 'send' ? '…' : '🚀 ' + L('Enviar ahora', 'Send now')}</button>
      </div>
    </div>
  );
}

// ---- Editor de plantilla (automáticas y manuales guardadas) ----
function Editor({ c, segs, L, lang, onClose, onSaved }: any) {
  const [f, setF] = useState<Campaign>({ ...c });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((o) => ({ ...o, [k]: v }));
  const isAuto = c.kind !== 'manual';

  async function save() {
    setBusy(true);
    try {
      const body: any = { id: c.id, name: f.name, segment: f.segment, subject_es: f.subject_es, body_es: f.body_es, subject_en: f.subject_en, body_en: f.body_en };
      if (c.kind === 'trigger') body.trigger = { days: f.trigger?.days || 0, maxDays: f.trigger?.maxDays || 0 };
      const r = await fetch('/api/admin/campaigns', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { toastErr(await r.json()); return; }
      toast(L('Plantilla guardada.', 'Template saved.'), 'ok'); onSaved();
    } finally { setBusy(false); }
  }

  const ta = { width: '100%', minHeight: 120, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', marginTop: 4, fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical' } as any;
  const inp = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', marginTop: 4 } as any;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 12px' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 720, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>✏️ {L('Editar campaña', 'Edit campaign')}</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <label className="muted" style={{ fontSize: 12 }}>{L('Nombre', 'Name')}<input value={f.name} onChange={(e) => set('name', e.target.value)} style={inp} /></label>

        <div className="grid g2" style={{ gap: 12, marginTop: 10 }}>
          <label className="muted" style={{ fontSize: 12 }}>{L('Segmento', 'Segment')}
            <select value={f.segment} onChange={(e) => set('segment', e.target.value)} style={inp}>
              {segs.map((s: Seg) => <option key={s.id} value={s.id}>{s[lang === 'en' ? 'en' : 'es']}</option>)}
            </select>
          </label>
          {c.kind === 'trigger' && (
            <div className="grid g2" style={{ gap: 8 }}>
              <label className="muted" style={{ fontSize: 12 }}>{L('Enviar tras (días)', 'Send after (days)')}<input type="number" min={0} value={f.trigger?.days ?? 0} onChange={(e) => set('trigger', { ...f.trigger, days: Number(e.target.value) })} style={inp} /></label>
              <label className="muted" style={{ fontSize: 12 }}>{L('Tope (días)', 'Cap (days)')}<input type="number" min={0} value={f.trigger?.maxDays ?? 0} onChange={(e) => set('trigger', { ...f.trigger, maxDays: Number(e.target.value) })} style={inp} /></label>
            </div>
          )}
        </div>

        <div className="grid g2" style={{ gap: 12, marginTop: 10 }}>
          <div>
            <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (ES)', 'Subject (ES)')}<input value={f.subject_es} onChange={(e) => set('subject_es', e.target.value)} style={inp} /></label>
            <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (ES)', 'Body (ES)')}<textarea value={f.body_es} onChange={(e) => set('body_es', e.target.value)} style={ta} /></label>
          </div>
          <div>
            <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (EN)', 'Subject (EN)')}<input value={f.subject_en} onChange={(e) => set('subject_en', e.target.value)} style={inp} /></label>
            <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (EN)', 'Body (EN)')}<textarea value={f.body_en} onChange={(e) => set('body_en', e.target.value)} style={ta} /></label>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{L('Variables: {{nombre}} {{plan}} {{sitio}}.', 'Variables: {{nombre}} {{plan}} {{sitio}}.')}{isAuto ? '' : ''}</p>

        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : L('Guardar plantilla', 'Save template')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{L('Cancelar', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}
