'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';
import { fmtDateTime } from '@/lib/fmtDate';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// Admin → Centro de correos. UN solo lugar para TODO el correo:
//   1) Plantillas  — cada correo del sistema, por categorías de colores,
//      editable en ES/EN, con IA para redactar/mejorar y prueba.
//   2) Redactar    — escribir y enviar un correo a un segmento o a direcciones
//      concretas; enviar ahora o programar. Cada quien lo recibe en su idioma.
//   3) Bandeja     — registro de todo lo que ha salido.
// ============================================================

type TplLang = { subject: string; body: string; defSubject: string; defBody: string };
type Tpl = { id: string; cat: string; es_label: string; en_label: string; to: string; vars: string[]; edited: boolean; es: TplLang; en: TplLang };
type Cat = { id: string; es: string; en: string; color: string; icon: string };

export default function Emails() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = (a: string, b: string) => (es ? a : b);
  const [view, setView] = useState<'plantillas' | 'redactar' | 'bandeja'>('plantillas');

  return (
    <>
      <div className="tabhead">
        <div className="th-row"><span className="th-ic"><OnyxIcon emoji="✉" size={15} /></span><span className="th-t">{L('Centro de correos', 'Email center')}</span></div>
        <div className="th-s">{L('Todos los correos en un solo lugar. Cada correo sale en el idioma del perfil del destinatario.', 'Every email in one place. Each one is sent in the recipient\'s profile language.')}</div>
      </div>

      <div className="card" style={{ padding: 6, marginBottom: 14, display: 'inline-flex', gap: 4, borderRadius: 12 }}>
        {([['plantillas', '🗂️', L('Plantillas', 'Templates')], ['redactar', '✍️', L('Redactar y enviar', 'Compose & send')], ['bandeja', '📤', L('Bandeja de salida', 'Outbox')]] as const).map(([k, ic, lab]) => (
          <button key={k} onClick={() => setView(k as any)}
            style={{ border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: view === k ? 700 : 500, padding: '7px 14px', borderRadius: 9, color: view === k ? 'var(--tx)' : 'var(--mut)', background: view === k ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>
            <OnyxIcon emoji={ic} size={13} glow={false} /> {lab}
          </button>
        ))}
      </div>

      {view === 'plantillas' && <Plantillas es={es} L={L} />}
      {view === 'redactar' && <Redactar es={es} L={L} />}
      {view === 'bandeja' && <Bandeja es={es} L={L} lang={lang} />}
    </>
  );
}

// ================= 1) PLANTILLAS ==========================================
function Plantillas({ es, L }: { es: boolean; L: (a: string, b: string) => string }) {
  const [items, setItems] = useState<Tpl[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    try {
      const r = await fetch('/api/admin/email-templates');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j?.error || (r.status === 403 ? 'Sin permiso para ver los correos.' : 'No se pudieron cargar los correos.'));
      setItems(j.items || []); setCats(j.categories || []);
    } catch { setErr('No se pudieron cargar los correos (sin conexión).'); } finally { setLoaded(true); }
  }
  useEffect(() => { load(); }, []);

  const countByCat = useMemo(() => {
    const m: Record<string, { total: number; edited: number }> = {};
    for (const it of items) { const c = (m[it.cat] ||= { total: 0, edited: 0 }); c.total++; if (it.edited) c.edited++; }
    return m;
  }, [items]);

  const open = items.find((i) => i.id === openId) || null;

  if (!loaded) return <div className="card muted">…</div>;

  // Editor de una plantilla
  if (open) return <TplEditor tpl={open} es={es} L={L} onBack={() => setOpenId(null)} onSaved={load} />;

  // Lista de una categoría
  if (cat) {
    const c = cats.find((x) => x.id === cat);
    const list = items.filter((i) => i.cat === cat);
    return (
      <>
        <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => setCat(null)}>← {L('Todas las categorías', 'All categories')}</button>
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: (c?.color || '#888') + '22' }}><OnyxIcon emoji={c?.icon || '✉'} size={15} /></span>
            <b style={{ fontSize: 15 }}>{es ? c?.es : c?.en}</b>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {list.map((it) => (
              <button key={it.id} onClick={() => setOpenId(it.id)}
                style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--tx)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{es ? it.es_label : it.en_label}</div>
                  <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.es.subject}</div>
                </div>
                <span className="muted" style={{ fontSize: 10.5 }}>→ {it.to}</span>
                {it.edited && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'color-mix(in srgb,var(--brand) 14%,transparent)', padding: '2px 7px', borderRadius: 20 }}>{L('editado', 'edited')}</span>}
                <span style={{ color: 'var(--mut)' }}>›</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  // Tarjetas de categorías
  if (!cats.length) return (
    <div className="card muted" style={{ fontSize: 13, textAlign: 'center', padding: 24 }}>
      {err || L('No hay plantillas para mostrar. Recarga la página.', 'No templates to show. Reload the page.')}
      <div><button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 12.5 }} onClick={load}>{L('Reintentar', 'Retry')}</button></div>
    </div>
  );
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
        {cats.map((c) => {
          const n = countByCat[c.id] || { total: 0, edited: 0 };
          return (
            <button key={c.id} onClick={() => setCat(c.id)}
              style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--card)', border: '1px solid var(--line)', borderLeft: `3px solid ${c.color}`, borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--tx)' }}>
              <div className="row between" style={{ alignItems: 'center' }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: c.color + '22', fontSize: 17 }}>{c.icon}</span>
                {n.edited > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'color-mix(in srgb,var(--brand) 14%,transparent)', padding: '2px 8px', borderRadius: 20 }}>{n.edited} {L('editados', 'edited')}</span>}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 4 }}>{es ? c.es : c.en}</div>
              <div className="muted" style={{ fontSize: 12 }}>{n.total} {L('correos', 'emails')}</div>
            </button>
          );
        })}
      </div>

      {/* Correos con editor propio (segmentos/programación/marca por mentor) — con acceso directo. */}
      <div className="muted" style={{ fontSize: 11.5, margin: '18px 0 8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{L('Con su propio editor', 'With their own editor')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
        {([
          ['campanas', '📣', '#993556', L('Campañas de marketing', 'Marketing campaigns'), L('Bienvenida, winback, newsletter…', 'Welcome, winback, newsletter…')],
          ['academy', '🎓', '#378add', L('Academia (por mentor)', 'Academy (per mentor)'), L('Bienvenida y recordatorios del mentor', 'Mentor welcome & reminders')],
        ] as const).map(([hash, icon, color, title, sub]) => (
          <button key={hash} onClick={() => { window.location.hash = hash; }}
            style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg2)', border: '1px dashed var(--line)', borderLeft: `3px solid ${color}`, borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--tx)' }}>
            <div className="row between" style={{ alignItems: 'center' }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: color + '22', fontSize: 17 }}>{icon}</span>
              <span className="muted" style={{ fontSize: 15 }}>↗</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 4 }}>{title}</div>
            <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function TplEditor({ tpl, es, L, onBack, onSaved }: { tpl: Tpl; es: boolean; L: (a: string, b: string) => string; onBack: () => void; onSaved: () => void }) {
  const [l, setL] = useState<'es' | 'en'>(es ? 'es' : 'en');
  const [eEs, setEs] = useState({ subject: tpl.es.subject, body: tpl.es.body });
  const [eEn, setEn] = useState({ subject: tpl.en.subject, body: tpl.en.body });
  const [busy, setBusy] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInstr, setAiInstr] = useState('');
  const cur = l === 'es' ? eEs : eEn;
  const setCur = (patch: any) => (l === 'es' ? setEs({ ...eEs, ...patch }) : setEn({ ...eEn, ...patch }));

  async function save() {
    setBusy('save');
    try {
      const overrides = { [tpl.id]: { es: eEs, en: eEn } };
      const r = await fetch('/api/admin/email-templates', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ overrides }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      toast(L('Correo guardado.', 'Email saved.'), 'ok'); onSaved();
    } finally { setBusy(''); }
  }
  function restore() {
    if (l === 'es') setEs({ subject: tpl.es.defSubject, body: tpl.es.defBody });
    else setEn({ subject: tpl.en.defSubject, body: tpl.en.defBody });
    toast(L('Texto original restaurado (aún sin guardar).', 'Original restored (not saved yet).'), 'ok');
  }
  async function test() {
    setBusy('test');
    try {
      const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test', lang: l, subject_es: eEs.subject, body_es: eEs.body, subject_en: eEn.subject, body_en: eEn.body }) });
      const j = await r.json(); if (!r.ok) toastErr(j); else toast(L('Correo de prueba enviado a tu dirección.', 'Test email sent to your address.'), 'ok');
    } finally { setBusy(''); }
  }
  async function ai(mode: 'draft' | 'rewrite') {
    if (!aiInstr.trim()) { toast(L('Escribe qué quieres que haga la IA.', 'Tell the AI what to do.')); return; }
    setBusy('ai');
    try {
      const r = await fetch('/api/admin/emails/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, instruction: aiInstr, vars: tpl.vars, currentEs: eEs, currentEn: eEn }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      const d = j.draft || {};
      if (d.subject_es || d.body_es) setEs({ subject: d.subject_es || eEs.subject, body: d.body_es || eEs.body });
      if (d.subject_en || d.body_en) setEn({ subject: d.subject_en || eEn.subject, body: d.body_en || eEn.body });
      toast(L('Texto generado por la IA (revísalo y guarda).', 'AI draft ready (review & save).'), 'ok');
    } finally { setBusy(''); }
  }

  return (
    <>
      <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={onBack}>← {L('Volver', 'Back')}</button>
      <div className="card">
        <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          <b style={{ fontSize: 15 }}>{es ? tpl.es_label : tpl.en_label}</b>
          <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            {(['es', 'en'] as const).map((x) => (
              <button key={x} onClick={() => setL(x)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: l === x ? 700 : 500, padding: '5px 12px', color: l === x ? 'var(--tx)' : 'var(--mut)', background: l === x ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{x.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}><OnyxIcon emoji="🌐" size={11} glow={false} /> {L('Se envía automáticamente en el idioma del perfil de quien lo recibe. Edita ambos idiomas.', 'Sent automatically in the recipient\'s profile language. Edit both languages.')} · {L('Va a', 'Goes to')}: <b>{tpl.to}</b></p>

        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Asunto', 'Subject')}</div>
        <input value={cur.subject} onChange={(e) => setCur({ subject: e.target.value })} style={{ margin: '0 0 12px' }} />

        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Cuerpo', 'Body')}</div>
        <textarea value={cur.body} onChange={(e) => setCur({ body: e.target.value })} style={{ width: '100%', minHeight: 150, fontSize: 13.5, lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />

        {tpl.vars.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>{L('Variables', 'Variables')}:</span>
            {tpl.vars.map((v) => (
              <button key={v} onClick={() => setCur({ body: cur.body + ' {' + v + '}' })} title={L('Insertar', 'Insert')}
                style={{ cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, border: '1px solid color-mix(in srgb,var(--brand) 35%,transparent)', background: 'color-mix(in srgb,var(--brand) 10%,transparent)', color: 'var(--brand)' }}>{'{' + v + '}'}</button>
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--line)', margin: '12px 0', paddingTop: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setAiOpen((v) => !v)}><OnyxIcon emoji="✨" size={13} glow={false} /> {L('Redactar/mejorar con IA', 'Draft/improve with AI')} {aiOpen ? '▴' : '▾'}</button>
          {aiOpen && (
            <div style={{ marginTop: 10, background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
              <textarea value={aiInstr} onChange={(e) => setAiInstr(e.target.value)} placeholder={L('Ej. hazlo más cálido y breve, con un botón al panel', 'E.g. make it warmer and shorter, with a button to the dashboard')} style={{ width: '100%', minHeight: 60, fontSize: 13, padding: 9, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', resize: 'vertical' }} />
              <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ fontSize: 12.5 }} disabled={busy === 'ai'} onClick={() => ai('rewrite')}>{busy === 'ai' ? '…' : <>✨ {L('Mejorar este texto', 'Improve this text')}</>}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={busy === 'ai'} onClick={() => ai('draft')}>{L('Escribir desde cero', 'Write from scratch')}</button>
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 7 }}>{L('La IA respeta las variables y genera ES e EN a la vez.', 'The AI keeps the variables and writes ES & EN at once.')}</p>
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={!!busy} onClick={test}><OnyxIcon emoji="📨" size={13} glow={false} /> {busy === 'test' ? '…' : L('Enviarme una prueba', 'Send me a test')}</button>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={restore}><OnyxIcon emoji="↩" size={13} glow={false} /> {L('Restaurar original', 'Restore original')}</button>
          <button className="btn btn-primary" style={{ fontSize: 12.5, marginLeft: 'auto' }} disabled={!!busy} onClick={save}>{busy === 'save' ? '…' : L('Guardar', 'Save')}</button>
        </div>
      </div>
    </>
  );
}

// ================= 2) REDACTAR Y ENVIAR ===================================
function Redactar({ es, L }: { es: boolean; L: (a: string, b: string) => string }) {
  const [segs, setSegs] = useState<{ id: string; es: string; en: string }[]>([]);
  const [mode, setMode] = useState<'segment' | 'emails'>('segment');
  const [seg, setSeg] = useState('all');
  const [emails, setEmails] = useState('');
  const [f, setF] = useState({ subject_es: '', body_es: '', subject_en: '', body_en: '' });
  const [l, setL] = useState<'es' | 'en'>(es ? 'es' : 'en');
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [aiInstr, setAiInstr] = useState('');
  const [when, setWhen] = useState('');

  useEffect(() => { (async () => { try { const r = await fetch('/api/admin/campaigns'); const j = await r.json(); setSegs(j.segments || []); } catch {} })(); }, []);

  const body = () => ({ segment: seg, emails: mode === 'emails' ? emails : '', ...f });
  const curSub = l === 'es' ? 'subject_es' : 'subject_en';
  const curBody = l === 'es' ? 'body_es' : 'body_en';

  async function doCount() {
    setBusy('count');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'count', ...body() }) }); const j = await r.json(); setCount(j.count ?? 0); } finally { setBusy(''); }
  }
  async function test() {
    setBusy('test');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test', lang: l, ...f }) }); const j = await r.json(); if (!r.ok) toastErr(j); else toast(L('Prueba enviada a tu dirección.', 'Test sent to your address.'), 'ok'); } finally { setBusy(''); }
  }
  async function send() {
    if (!f.subject_es && !f.subject_en) { toast(L('Falta el asunto.', 'Subject is missing.')); return; }
    if (mode === 'emails' && !emails.trim()) { toast(L('Añade al menos una dirección.', 'Add at least one address.')); return; }
    if (!window.confirm(L('¿Enviar este correo ahora?', 'Send this email now?'))) return;
    setBusy('send');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'send', ...body() }) }); const j = await r.json(); if (!r.ok) toastErr(j); else toast(L(`Enviado a ${j.sent} destinatario(s).`, `Sent to ${j.sent} recipient(s).`), 'ok'); } finally { setBusy(''); }
  }
  async function schedule() {
    if (mode === 'emails') { toast(L('Para programar, elige un segmento.', 'To schedule, pick a segment.')); return; }
    if (!when) { toast(L('Elige fecha y hora.', 'Pick date and time.')); return; }
    if (!f.subject_es && !f.subject_en) { toast(L('Falta el asunto.', 'Subject is missing.')); return; }
    setBusy('sched');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'schedule', scheduled_at: new Date(when).toISOString(), ...body() }) }); const j = await r.json(); if (!r.ok) toastErr(j); else { toast(L('Correo programado.', 'Email scheduled.'), 'ok'); setWhen(''); } } finally { setBusy(''); }
  }
  async function ai() {
    if (!aiInstr.trim()) { toast(L('Escribe el tema o la instrucción.', 'Write the topic or instruction.')); return; }
    setBusy('ai');
    try {
      const r = await fetch('/api/admin/emails/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'draft', instruction: aiInstr, vars: ['nombre', 'enlace'] }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      const d = j.draft || {};
      setF({ subject_es: d.subject_es || '', body_es: d.body_es || '', subject_en: d.subject_en || '', body_en: d.body_en || '' });
      toast(L('Borrador listo (revísalo).', 'Draft ready (review it).'), 'ok');
    } finally { setBusy(''); }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 14 }}>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('¿A quién va?', 'Who is it for?')}</div>
        <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          {([['segment', L('Un grupo', 'A group')], ['emails', L('Direcciones concretas', 'Specific addresses')]] as const).map(([k, lab]) => (
            <button key={k} onClick={() => setMode(k as any)} style={{ border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: mode === k ? 700 : 500, padding: '6px 14px', color: mode === k ? 'var(--tx)' : 'var(--mut)', background: mode === k ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{lab}</button>
          ))}
        </div>
        {mode === 'segment'
          ? <select value={seg} onChange={(e) => { setSeg(e.target.value); setCount(null); }} style={{ margin: 0 }}>{segs.map((s) => <option key={s.id} value={s.id}>{es ? s.es : s.en}</option>)}</select>
          : <textarea value={emails} onChange={(e) => { setEmails(e.target.value); setCount(null); }} placeholder={L('correo1@ejemplo.com, correo2@ejemplo.com…', 'email1@example.com, email2@example.com…')} style={{ width: '100%', minHeight: 60, fontSize: 13, padding: 9, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />}
      </div>

      <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}><OnyxIcon emoji="✨" size={12} glow={false} /> {L('Redactar con IA', 'Draft with AI')}</div>
        <div className="row" style={{ gap: 8 }}>
          <input value={aiInstr} onChange={(e) => setAiInstr(e.target.value)} placeholder={L('Tema: ej. recordamos la oferta de Black Onyx', 'Topic: e.g. remind about the Black Onyx offer')} style={{ margin: 0, flex: 1 }} />
          <button className="btn btn-primary" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }} disabled={busy === 'ai'} onClick={ai}>{busy === 'ai' ? '…' : L('Generar', 'Generate')}</button>
        </div>
      </div>

      <div>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>{L('Contenido', 'Content')}</span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            {(['es', 'en'] as const).map((x) => <button key={x} onClick={() => setL(x)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: l === x ? 700 : 500, padding: '5px 12px', color: l === x ? 'var(--tx)' : 'var(--mut)', background: l === x ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{x.toUpperCase()}</button>)}
          </div>
        </div>
        <input value={(f as any)[curSub]} onChange={(e) => setF({ ...f, [curSub]: e.target.value })} placeholder={L('Asunto', 'Subject')} style={{ margin: '0 0 8px' }} />
        <textarea value={(f as any)[curBody]} onChange={(e) => setF({ ...f, [curBody]: e.target.value })} placeholder={L('Cuerpo del correo…', 'Email body…')} style={{ width: '100%', minHeight: 130, fontSize: 13.5, lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('Rellena ambos idiomas: cada quien recibe el suyo. Variables: {nombre}, {enlace}.', 'Fill both languages: each person gets theirs. Variables: {nombre}, {enlace}.')}</p>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={!!busy} onClick={doCount}>{busy === 'count' ? '…' : L('Contar', 'Count')}</button>
        {count != null && <span className="muted" style={{ fontSize: 12.5 }}>{count} {L('destinatario(s)', 'recipient(s)')}</span>}
        <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={!!busy} onClick={test}><OnyxIcon emoji="📨" size={13} glow={false} /> {busy === 'test' ? '…' : L('Probar', 'Test')}</button>
        <button className="btn btn-primary" style={{ fontSize: 12.5, marginLeft: 'auto' }} disabled={!!busy} onClick={send}><OnyxIcon emoji="🚀" size={13} glow={false} /> {busy === 'send' ? '…' : L('Enviar ahora', 'Send now')}</button>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
        <span className="muted" style={{ fontSize: 12 }}><OnyxIcon emoji="🕒" size={12} glow={false} /> {L('O programar:', 'Or schedule:')}</span>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ margin: 0, maxWidth: 220 }} />
        <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={!!busy || !when} onClick={schedule}>{busy === 'sched' ? '…' : L('Programar', 'Schedule')}</button>
        <span className="muted" style={{ fontSize: 11 }}>{L('(programar requiere un grupo)', '(scheduling needs a group)')}</span>
      </div>
    </div>
  );
}

// ================= 3) BANDEJA DE SALIDA ===================================
function Bandeja({ es, L, lang }: { es: boolean; L: (a: string, b: string) => string; lang: string }) {
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState('');
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [q]);
  useEffect(() => { const iv = setInterval(load, 15000); return () => clearInterval(iv); }, [q]);
  async function load() { try { const r = await fetch('/api/admin/emails' + (q ? '?q=' + encodeURIComponent(q) : '')); setD(await r.json()); } catch { setD({ emails: [] }); } }
  const kindLabel: any = { billing: L('Cobro', 'Billing'), admin: L('Manual', 'Manual'), support: L('Soporte', 'Support'), challenge: L('Reto', 'Challenge'), onboarding: 'Onboarding', campaign: L('Campaña', 'Campaign') };

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{d ? `${d.total ?? 0} ${L('enviados en total', 'sent in total')}` : '…'}</span>
        <input placeholder={L('Buscar correo o asunto…', 'Search email or subject…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, margin: 0 }} />
      </div>
      {!d && <div className="muted">…</div>}
      {d && !d.emails?.length && <div className="muted" style={{ fontSize: 13 }}>{L('Aún no hay correos registrados. Se llena con cada envío del sistema.', 'No emails yet. It fills up with each system send.')}</div>}
      {d && !!d.emails?.length && (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>{L('Para', 'To')}</th><th>{L('Asunto', 'Subject')}</th><th>{L('Tipo', 'Type')}</th><th>{L('Estado', 'Status')}</th><th>{L('Fecha', 'Date')}</th></tr></thead>
            <tbody>
              {d.emails.map((e: any, i: number) => (
                <tr key={i}>
                  <td>{e.to_email}</td>
                  <td>{e.subject || '—'}</td>
                  <td className="muted">{kindLabel[e.kind] || e.kind || '—'}</td>
                  <td><span className="pill" style={{ color: e.status === 'sent' ? 'var(--green)' : 'var(--red)', background: e.status === 'sent' ? 'rgba(52,226,160,.15)' : 'rgba(255,107,125,.15)' }}>{e.status === 'sent' ? L('Enviado', 'Sent') : L('Falló', 'Failed')}</span></td>
                  <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
