'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { useLang } from '@/lib/lang';
import ConfirmNote from './ConfirmNote';
import DateTimePicker from '@/app/components/DateTimePicker';

// ============================================================
// Admin → Campañas. Correos de seguimiento automáticos a la base de traders +
// envío manual de promos/noticias, con plantillas editables y borrador IA.
// Bilingüe por su cuenta (no depende del diccionario del panel).
// ============================================================

// Variables que la IA integra y que el owner puede insertar a mano.
const VARS = ['{{nombre}}', '{{plan}}', '{{sitio}}'];
// Tonos para controlar la voz que genera la IA.
const TONES: Array<[string, string, string]> = [
  ['friendly', 'Cercano', 'Friendly'], ['urgent', 'Urgente', 'Urgent'],
  ['promo', 'Promocional', 'Promo'], ['informative', 'Informativo', 'Informative'],
];
// Renderiza las variables con un trader de ejemplo (para la vista previa).
function fillPreview(text: string): string {
  return String(text || '')
    .replace(/\{\{\s*(nombre|name)\s*\}\}/gi, 'Jerry')
    .replace(/\{\{\s*plan\s*\}\}/gi, 'Pro')
    .replace(/\{\{\s*(sitio|site)\s*\}\}/gi, 'onyxtradinglive.com');
}

// Fila de chips de variables: inserta el token en el campo indicado.
function VarChips({ onInsert, L }: { onInsert: (v: string) => void; L: (a: string, b: string) => string }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '2px 0 4px' }}>
      <span className="muted" style={{ fontSize: 11.5 }}>{L('Variables:', 'Variables:')}</span>
      {VARS.map((v) => (
        <button key={v} type="button" onClick={() => onInsert(v)}
          style={{ background: 'rgba(124,140,255,.16)', color: 'var(--soft-brand,#7c8cff)', border: '1px solid color-mix(in srgb,var(--soft-brand,#7c8cff) 40%,transparent)', borderRadius: 7, padding: '3px 9px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {v}
        </button>
      ))}
    </div>
  );
}

type Campaign = {
  id: string; key: string | null; name: string; kind: 'trigger' | 'scheduled' | 'manual';
  segment: string; subject_es: string; body_es: string; subject_en: string; body_en: string;
  enabled: boolean; trigger: any; schedule: string; scheduled_at: string | null; last_run_at: string | null;
};
type Seg = { id: string; es: string; en: string; auto?: boolean };

export default function Campaigns() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [segs, setSegs] = useState<Seg[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [cf, setCf] = useState<any>(null);
  const segLabel = (id: string) => { const s = segs.find((x) => x.id === id); return s ? s[lang === 'en' ? 'en' : 'es'] : id; };

  async function load() {
    const r = await fetch('/api/admin/campaigns'); const j = await r.json();
    setCamps(j.campaigns || []); setSegs(j.segments || []); setStats(j.stats || null);
  }
  // Auto-refresco: los números (aperturas/clics) suben solos sin pulsar nada.
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  async function toggle(c: Campaign) {
    const r = await fetch('/api/admin/campaigns', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: c.id, enabled: !c.enabled }) });
    if (!r.ok) { toastErr(await r.json()); return; }
    setCamps((list) => list.map((x) => x.id === c.id ? { ...x, enabled: !x.enabled } : x));
  }

  const autos = camps.filter((c) => c.kind !== 'manual');
  const manuals = camps.filter((c) => c.kind === 'manual');
  const scheduled = manuals.filter((c) => c.scheduled_at);
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
  const openRate = pct(stats?.opened30 ?? 0, stats?.sent30 ?? 0);
  const clickRate = pct(stats?.clicked30 ?? 0, stats?.sent30 ?? 0);

  function cancelSchedule(c: Campaign) {
    setCf({ title: L('¿Cancelar esta promo programada?', 'Cancel this scheduled promo?'), detail: c.name, danger: true, run: async (note: string) => {
      await fetch('/api/admin/campaigns', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: c.id, note }) });
      load();
    } });
  }
  const fmtWhen = (iso: string | null) => iso ? new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const kindBadge = (k: string) => k === 'scheduled'
    ? <span className="pill" style={{ color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{L('Programada', 'Scheduled')}</span>
    : <span className="pill" style={{ color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('Por evento', 'Triggered')}</span>;

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">📣</span><span className="th-t">{L('Campañas', 'Campaigns')}</span></div>
        <div className="th-s">{L('Correos de seguimiento automáticos a tus traders + envíos manuales de promos y noticias.', 'Automated follow-up emails to your traders + manual promos and news.')}</div></div>

      {/* Métricas 30 días (aperturas/clics reales del webhook de Resend) */}
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Enviados (30d)', 'Sent (30d)')}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{(stats?.sent30 ?? 0).toLocaleString()}</div></div>
        <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Tasa de apertura', 'Open rate')}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: 'var(--soft-brand)' }}>{openRate}%</div><div className="muted" style={{ fontSize: 11 }}>{(stats?.opened30 ?? 0).toLocaleString()} {L('aperturas', 'opens')}</div></div>
        <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Tasa de clic', 'Click rate')}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: 'var(--green)' }}>{clickRate}%</div><div className="muted" style={{ fontSize: 11 }}>{(stats?.clicked30 ?? 0).toLocaleString()} {L('clics', 'clicks')}</div></div>
        <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{L('Activas', 'Active')}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{camps.filter((c) => c.enabled).length}</div></div>
      </div>

      {/* Estado del webhook de Resend (prueba de que llegan las aperturas) */}
      {stats && (
        <div className="row" style={{ gap: 8, marginBottom: 14, fontSize: 12.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {stats.lastOpenAt
            ? <span className="pill" style={{ color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>✓ {L('Webhook recibiendo aperturas', 'Webhook receiving opens')}</span>
            : <span className="pill" style={{ color: 'var(--amber)', background: 'rgba(255,192,77,.16)' }}>⚠ {L('Aún sin aperturas registradas', 'No opens recorded yet')}</span>}
          <span className="muted">{stats.lastOpenAt ? `${L('última', 'last')}: ${fmtWhen(stats.lastOpenAt)}` : L('Manda una Prueba, ábrela y espera ~1 min. Si no sube, revisa el webhook de Resend + el open tracking.', 'Send a Test, open it and wait ~1 min. If it stays at zero, check the Resend webhook + open tracking.')}</span>
          <span className="muted" style={{ marginLeft: 'auto', opacity: .7 }}>↻ {L('auto', 'auto')}</span>
        </div>
      )}

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
              {(() => { const k = stats?.byKey?.[c.key || '']; if (!k || !k.sent) return null; return (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>📬 {k.sent} · 👁 {pct(k.opened, k.sent)}% · 🖱 {pct(k.clicked, k.sent)}% <span style={{ opacity: .6 }}>({L('30d', '30d')})</span></div>
              ); })()}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setEditing(c)}>✏️ {L('Editar', 'Edit')}</button>
              <span className="toggle" onClick={() => toggle(c)} style={{ background: c.enabled ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: c.enabled ? 21 : 3 }} /></span>
            </div>
          </div>
        ))}
      </div>

      {/* Cola de programación */}
      {scheduled.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginBottom: 4 }}>🕒 {L('Promos programadas', 'Scheduled promos')}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{L('Saldrán solas a su fecha y hora. Puedes editarlas o cancelarlas antes.', 'They go out on their own at the set date/time. You can edit or cancel before then.')}</p>
          {scheduled.map((c, i) => (
            <div key={c.id} className="row between" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '11px 0', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 200 }}>
                <b>{c.name}</b>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>🕒 {fmtWhen(c.scheduled_at)} · {segLabel(c.segment)}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setEditing(c)}>✏️ {L('Editar', 'Edit')}</button>
                <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => cancelSchedule(c)}>{L('Cancelar', 'Cancel')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Envío manual */}
      <ManualComposer segs={segs} manuals={manuals} L={L} lang={lang} segLabel={segLabel} reload={load} onEdit={setEditing} ask={setCf} />

      {editing && <Editor c={editing} segs={segs} L={L} lang={lang} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmNote act={cf} onClose={() => setCf(null)} />
    </>
  );
}

// ---- Compositor de promos/noticias (envío manual inmediato) ----
function ManualComposer({ segs, manuals, L, lang, segLabel, reload, onEdit, ask }: any) {
  const [seg, setSeg] = useState('all');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('friendly');
  const [f, setF] = useState({ subject_es: '', body_es: '', subject_en: '', body_en: '' });
  const [busy, setBusy] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [when, setWhen] = useState('');
  const [titles, setTitles] = useState<Array<{ es: string; en: string }>>([]);
  const [showPrev, setShowPrev] = useState(false);
  const [lastField, setLastField] = useState<'subject_es' | 'body_es' | 'subject_en' | 'body_en'>('body_es');
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));
  const insertVar = (v: string) => setF((o) => ({ ...o, [lastField]: (o as any)[lastField] + (((o as any)[lastField] && !(o as any)[lastField].endsWith(' ')) ? ' ' : '') + v }));

  // IA: sugerir 5 títulos (como el blog).
  async function genTitles() {
    if (!topic.trim()) { toast(L('Escribe de qué trata el correo.', 'Write what the email is about.')); return; }
    setBusy('titles');
    try {
      const r = await fetch('/api/admin/campaigns/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'titles', topic, segment: seg, tone }) });
      const j = await r.json();
      if (!r.ok) { toastErr(j); return; }
      setTitles(j.titles || []);
    } finally { setBusy(''); }
  }
  // IA: escribir cuerpo (respeta el asunto ya elegido si lo hay), integrando variables.
  async function draft(chosen?: { es: string; en: string }) {
    if (!topic.trim()) { toast(L('Escribe de qué trata el correo.', 'Write what the email is about.')); return; }
    setBusy('draft');
    try {
      const body: any = { topic, segment: seg, tone };
      if (chosen) { body.subject_es = chosen.es; body.subject_en = chosen.en; }
      const r = await fetch('/api/admin/campaigns/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { toastErr(j); return; }
      setF({ subject_es: j.draft.subject_es, body_es: j.draft.body_es, subject_en: j.draft.subject_en, body_en: j.draft.body_en });
      setTitles([]);
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
  function send() {
    if (!f.subject_es && !f.subject_en) { toast(L('Falta el asunto.', 'Subject is missing.')); return; }
    const n = count ?? '—';
    ask({
      title: L(`Enviar esta campaña AHORA a ${n} traders del segmento "${segLabel(seg)}"`, `Send this campaign NOW to ${n} traders in "${segLabel(seg)}"`),
      detail: (f.subject_es || f.subject_en),
      danger: true,
      run: async (note: string) => {
        setBusy('send');
        try { const r = await fetch('/api/admin/campaigns/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'send', segment: seg, note, ...f }) }); const j = await r.json(); if (!r.ok) toastErr(j); else { toast(L(`Enviado a ${j.sent} traders.`, `Sent to ${j.sent} traders.`), 'ok'); reload(); } } finally { setBusy(''); }
      },
    });
  }
  async function schedule() {
    if (!f.subject_es && !f.subject_en) { toast(L('Falta el asunto.', 'Subject is missing.')); return; }
    if (!when) { toast(L('Elige fecha y hora.', 'Pick a date and time.')); return; }
    if (new Date(when).getTime() < Date.now()) { toast(L('Esa fecha ya pasó.', 'That date is in the past.')); return; }
    setBusy('sched');
    try {
      const name = (f.subject_es || f.subject_en).slice(0, 60);
      const r = await fetch('/api/admin/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, segment: seg, scheduled_at: new Date(when).toISOString(), ...f }) });
      const j = await r.json();
      if (!r.ok) toastErr(j);
      else { toast(L('Promo programada ✓', 'Promo scheduled ✓'), 'ok'); setWhen(''); setF({ subject_es: '', body_es: '', subject_en: '', body_en: '' }); reload(); }
    } finally { setBusy(''); }
  }

  const ta = { width: '100%', minHeight: 90, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', marginTop: 4, fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical' } as any;
  const inp = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', marginTop: 4 } as any;
  const fld = (k: any) => ({ onFocus: () => setLastField(k) });

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>✉️ {L('Envío manual (promos y noticias)', 'Manual send (promos & news)')}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Elige a quién, deja que la IA proponga títulos y escriba el copy en ambos idiomas con tus variables, prueba y envía.', 'Pick who, let AI suggest titles and write the copy in both languages with your variables, test and send.')}</p>

      <div className="grid g2" style={{ gap: 12, marginBottom: 12 }}>
        <label className="muted" style={{ fontSize: 12 }}>{L('Segmento', 'Segment')}
          <select value={seg} onChange={(e) => { setSeg(e.target.value); setCount(null); }} style={inp}>
            {segs.map((s: Seg) => <option key={s.id} value={s.id}>{s[lang === 'en' ? 'en' : 'es']}</option>)}
          </select>
        </label>
        <label className="muted" style={{ fontSize: 12 }}>{L('Tono de la IA', 'AI tone')}
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={inp}>
            {TONES.map(([id, es, en]) => <option key={id} value={id}>{lang === 'en' ? en : es}</option>)}
          </select>
        </label>
      </div>

      {/* Tema + IA (títulos y borrador, como el blog) */}
      <div style={{ marginBottom: 12 }}>
        <label className="muted" style={{ fontSize: 12 }}>{L('Tema para la IA', 'Topic for AI')}
          <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={L('Ej: −30% en Pro por 48h', 'e.g. −30% on Pro for 48h')} style={{ ...inp, marginTop: 0, flex: 1, minWidth: 180 }} />
            <button className="btn btn-ghost" onClick={genTitles} disabled={busy === 'titles'} style={{ whiteSpace: 'nowrap' }}>{busy === 'titles' ? '…' : '💡 ' + L('Sugerir títulos', 'Suggest titles')}</button>
            <button className="btn btn-primary" onClick={() => draft()} disabled={busy === 'draft'} style={{ whiteSpace: 'nowrap' }}>{busy === 'draft' ? '…' : '✨ ' + L('Escribir copy', 'Write copy')}</button>
          </div>
        </label>
        {titles.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="muted" style={{ fontSize: 11.5 }}>{L('Toca un título para usarlo y que la IA escriba el cuerpo:', 'Tap a title to use it and let AI write the body:')}</span>
            {titles.map((t, i) => (
              <button key={i} type="button" onClick={() => { set('subject_es', t.es); set('subject_en', t.en); draft(t); }}
                style={{ textAlign: 'left', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 11px', background: 'var(--bg2)', color: 'var(--tx)', cursor: 'pointer', fontSize: 13 }}>
                {t.es}<span className="muted" style={{ marginLeft: 6 }}>· EN: {t.en}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <VarChips onInsert={insertVar} L={L} />

      <div className="grid g2" style={{ gap: 12 }}>
        <div>
          <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (ES)', 'Subject (ES)')}<input value={f.subject_es} onChange={(e) => set('subject_es', e.target.value)} style={inp} {...fld('subject_es')} /></label>
          <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (ES)', 'Body (ES)')}<textarea value={f.body_es} onChange={(e) => set('body_es', e.target.value)} style={ta} {...fld('body_es')} /></label>
        </div>
        <div>
          <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (EN)', 'Subject (EN)')}<input value={f.subject_en} onChange={(e) => set('subject_en', e.target.value)} style={inp} {...fld('subject_en')} /></label>
          <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (EN)', 'Body (EN)')}<textarea value={f.body_en} onChange={(e) => set('body_en', e.target.value)} style={ta} {...fld('body_en')} /></label>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowPrev((v) => !v)}>👁 {showPrev ? L('Ocultar vista previa', 'Hide preview') : L('Vista previa', 'Preview')}</button>
        <span className="muted" style={{ fontSize: 11 }}>{L('El pie con enlace de baja se añade solo.', 'The unsubscribe footer is added automatically.')}</span>
      </div>
      {showPrev && (
        <div style={{ marginTop: 8, background: 'var(--card)', border: '1px solid var(--brand)', borderRadius: 10, padding: '10px 12px' }}>
          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{L('Ejemplo con Jerry · plan Pro', 'Example with Jerry · Pro plan')}</div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fillPreview(lang === 'en' ? (f.subject_en || f.subject_es) : f.subject_es) || '—'}</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, marginTop: 4 }}>{fillPreview(lang === 'en' ? (f.body_en || f.body_es) : f.body_es)}</div>
        </div>
      )}

      <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={preview} disabled={busy === 'count'}>{busy === 'count' ? '…' : '👁 ' + L('Ver cuántos', 'Preview count')}</button>
        {count !== null && <span className="pill" style={{ color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{count.toLocaleString()} {L('destinatarios', 'recipients')}</span>}
        <button className="btn btn-ghost" onClick={test} disabled={busy === 'test'}>{busy === 'test' ? '…' : '📧 ' + L('Prueba', 'Test')}</button>
        <button className="btn btn-primary" onClick={send} disabled={busy === 'send'} style={{ marginLeft: 'auto' }}>{busy === 'send' ? '…' : '🚀 ' + L('Enviar ahora', 'Send now')}</button>
      </div>

      {/* Programar para más tarde (calendario intuitivo) */}
      <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="muted" style={{ fontSize: 12.5 }}>🕒 {L('O prográmala para más tarde:', 'Or schedule it for later:')}</span>
        <div style={{ marginTop: 6, maxWidth: 360 }}>
          <DateTimePicker value={when} onChange={setWhen} es={lang !== 'en'} minNow />
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={schedule} disabled={busy === 'sched'}>{busy === 'sched' ? '…' : L('Programar promo', 'Schedule promo')}</button>
      </div>
    </div>
  );
}

// ---- Editor de plantilla (automáticas y manuales guardadas) ----
function Editor({ c, segs, L, lang, onClose, onSaved }: any) {
  const [f, setF] = useState<Campaign>({ ...c });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState('');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('friendly');
  const [titles, setTitles] = useState<Array<{ es: string; en: string }>>([]);
  const [showPrev, setShowPrev] = useState(false);
  const [lastField, setLastField] = useState<'subject_es' | 'body_es' | 'subject_en' | 'body_en'>('body_es');
  const set = (k: string, v: any) => setF((o) => ({ ...o, [k]: v }));
  const insertVar = (v: string) => setF((o) => ({ ...o, [lastField]: (o as any)[lastField] + (((o as any)[lastField] && !String((o as any)[lastField]).endsWith(' ')) ? ' ' : '') + v }));
  const fld = (k: any) => ({ onFocus: () => setLastField(k) });
  const isAuto = c.kind !== 'manual';

  async function genTitles() {
    if (!topic.trim()) { toast(L('Escribe de qué trata el correo.', 'Write what the email is about.')); return; }
    setAiBusy('titles');
    try {
      const r = await fetch('/api/admin/campaigns/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'titles', topic, segment: f.segment, tone }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; } setTitles(j.titles || []);
    } finally { setAiBusy(''); }
  }
  async function draft(chosen?: { es: string; en: string }) {
    if (!topic.trim()) { toast(L('Escribe de qué trata el correo.', 'Write what the email is about.')); return; }
    setAiBusy('draft');
    try {
      const body: any = { topic, segment: f.segment, tone };
      if (chosen) { body.subject_es = chosen.es; body.subject_en = chosen.en; }
      const r = await fetch('/api/admin/campaigns/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      setF((o) => ({ ...o, subject_es: j.draft.subject_es, body_es: j.draft.body_es, subject_en: j.draft.subject_en, body_en: j.draft.body_en }));
      setTitles([]); toast(L('Copy generado. Revísalo antes de guardar.', 'Copy generated. Review before saving.'), 'ok');
    } finally { setAiBusy(''); }
  }

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

        {/* IA: mismos superpoderes que el envío manual (títulos + copy bilingüe con variables) */}
        <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={L('Tema para la IA (ej: bienvenida cálida)', 'Topic for AI (e.g. warm welcome)')} style={{ ...inp, marginTop: 0, flex: 1, minWidth: 170 }} />
            <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ ...inp, marginTop: 0, width: 'auto' }}>
              {TONES.map(([id, es, en]) => <option key={id} value={id}>{lang === 'en' ? en : es}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={genTitles} disabled={aiBusy === 'titles'} style={{ whiteSpace: 'nowrap' }}>{aiBusy === 'titles' ? '…' : '💡 ' + L('Títulos', 'Titles')}</button>
            <button className="btn btn-primary" onClick={() => draft()} disabled={aiBusy === 'draft'} style={{ whiteSpace: 'nowrap' }}>{aiBusy === 'draft' ? '…' : '✨ ' + L('Copy', 'Copy')}</button>
          </div>
          {titles.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {titles.map((t, i) => (
                <button key={i} type="button" onClick={() => { set('subject_es', t.es); set('subject_en', t.en); draft(t); }}
                  style={{ textAlign: 'left', border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', background: 'var(--card)', color: 'var(--tx)', cursor: 'pointer', fontSize: 12.5 }}>
                  {t.es}<span className="muted" style={{ marginLeft: 6 }}>· EN: {t.en}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10 }}><VarChips onInsert={insertVar} L={L} /></div>
        <div className="grid g2" style={{ gap: 12 }}>
          <div>
            <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (ES)', 'Subject (ES)')}<input value={f.subject_es} onChange={(e) => set('subject_es', e.target.value)} style={inp} {...fld('subject_es')} /></label>
            <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (ES)', 'Body (ES)')}<textarea value={f.body_es} onChange={(e) => set('body_es', e.target.value)} style={ta} {...fld('body_es')} /></label>
          </div>
          <div>
            <label className="muted" style={{ fontSize: 12 }}>{L('Asunto (EN)', 'Subject (EN)')}<input value={f.subject_en} onChange={(e) => set('subject_en', e.target.value)} style={inp} {...fld('subject_en')} /></label>
            <label className="muted" style={{ fontSize: 12 }}>{L('Cuerpo (EN)', 'Body (EN)')}<textarea value={f.body_en} onChange={(e) => set('body_en', e.target.value)} style={ta} {...fld('body_en')} /></label>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowPrev((v) => !v)}>👁 {showPrev ? L('Ocultar vista previa', 'Hide preview') : L('Vista previa', 'Preview')}</button>
          <span className="muted" style={{ fontSize: 11 }}>{L('Variables: {{nombre}} {{plan}} {{sitio}}', 'Variables: {{nombre}} {{plan}} {{sitio}}')}</span>
        </div>
        {showPrev && (
          <div style={{ marginTop: 8, background: 'var(--card)', border: '1px solid var(--brand)', borderRadius: 10, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{L('Ejemplo con Jerry · plan Pro', 'Example with Jerry · Pro plan')}</div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fillPreview(lang === 'en' ? (f.subject_en || f.subject_es) : f.subject_es) || '—'}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, marginTop: 4 }}>{fillPreview(lang === 'en' ? (f.body_en || f.body_es) : f.body_es)}</div>
          </div>
        )}

        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : L('Guardar plantilla', 'Save template')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{L('Cancelar', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}
