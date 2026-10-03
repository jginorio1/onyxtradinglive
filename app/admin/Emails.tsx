'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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

type TplLang = { subject: string; body: string; html: string; defSubject: string; defBody: string };
type Tpl = { id: string; cat: string; es_label: string; en_label: string; to: string; vars: string[]; edited: boolean; sig: string; es: TplLang; en: TplLang };
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
  const [sigs, setSigs] = useState<Sig[]>([]);
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
      setItems(j.items || []); setCats(j.categories || []); setSigs(j.signatures || []);
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
  if (open) return <TplEditor tpl={open} es={es} L={L} sigs={sigs} onBack={() => setOpenId(null)} onSaved={load} />;

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

      {/* Leyenda: qué correos se controlan en otra parte y por qué. */}
      <div style={{ marginTop: 20, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
          <OnyxIcon emoji="ℹ️" size={13} glow={false} /> {L('¿Dónde está cada correo?', 'Where is each email?')}
        </div>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: '0 0 8px' }}>
          {L('Las tarjetas de arriba son los correos automáticos del sistema (bienvenida, pagos, becas, seguridad…). Cada uno se edita aquí en ES/EN, con IA, y sale en el idioma del perfil de quien lo recibe.',
             'The cards above are the system\'s automatic emails (welcome, billing, scholarships, security…). Each is edited here in ES/EN, with AI, and goes out in the recipient\'s profile language.')}
        </p>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          {L('Algunos correos NO aparecen como plantilla porque no tienen un texto fijo: se escriben en el momento. Son las ', 'A few emails don\'t appear as a template because they have no fixed text: they\'re written on the fly. These are ')}
          <b>{L('invitaciones a embajadores', 'ambassador invites')}</b>{L(' y las ', ' and the ')}
          <b>{L('respuestas de soporte y a leads', 'support & lead replies')}</b>{L(' (las redacta la IA o tú al responder), y las ', ' (written by the AI or by you when replying), and ')}
          <b>{L('propuestas de ventas y de anuncios', 'sales & ad proposals')}</b>{L(' (son PDFs con los datos de cada cliente). Las ', ' (PDFs with each client\'s data). ')}
          <b>{L('campañas de marketing', 'Marketing campaigns')}</b>{L(' y los correos de la ', ' and the ')}
          <b>{L('academia por mentor', 'per-mentor academy')}</b>{L(' tienen su propio editor (los dos botones de arriba), porque usan segmentos, programación y la marca de cada mentor.', ' emails have their own editor (the two buttons above), because they use segments, scheduling and each mentor\'s branding.')}
        </p>
      </div>
    </>
  );
}

function TplEditor({ tpl, es, L, sigs, onBack, onSaved }: { tpl: Tpl; es: boolean; L: (a: string, b: string) => string; sigs: Sig[]; onBack: () => void; onSaved: () => void }) {
  const [l, setL] = useState<'es' | 'en'>(es ? 'es' : 'en');
  const [eEs, setEs] = useState({ subject: tpl.es.subject, body: tpl.es.body, html: tpl.es.html });
  const [eEn, setEn] = useState({ subject: tpl.en.subject, body: tpl.en.body, html: tpl.en.html });
  // Si la plantilla YA tiene HTML en algún idioma, abre en modo HTML.
  const [htmlMode, setHtmlMode] = useState(!!(tpl.es.html || tpl.en.html));
  const [sig, setSig] = useState(tpl.sig || '');
  const [busy, setBusy] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInstr, setAiInstr] = useState('');
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<HistEntry[]>([]);
  useEffect(() => { setHist(histLoad(tpl.id)); }, [tpl.id]);
  const cur = l === 'es' ? eEs : eEn;
  const setCur = (patch: any) => (l === 'es' ? setEs({ ...eEs, ...patch }) : setEn({ ...eEn, ...patch }));

  async function save() {
    setBusy('save');
    try {
      // Guarda una versión en el historial local ANTES de enviar (para poder volver).
      histPush(tpl.id, { ts: Date.now(), es: eEs, en: eEn, sig }); setHist(histLoad(tpl.id));
      const overrides = { [tpl.id]: { sig, es: eEs, en: eEn } };
      const r = await fetch('/api/admin/email-templates', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ overrides }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      toast(L('Correo guardado.', 'Email saved.'), 'ok'); onSaved();
    } finally { setBusy(''); }
  }
  function restoreHist(h: HistEntry) {
    setEs(h.es); setEn(h.en); setSig(h.sig || ''); setHistOpen(false);
    toast(L('Versión restaurada (revisa y guarda).', 'Version restored (review & save).'), 'ok');
  }
  function restore() {
    if (l === 'es') setEs({ subject: tpl.es.defSubject, body: tpl.es.defBody, html: '' });
    else setEn({ subject: tpl.en.defSubject, body: tpl.en.defBody, html: '' });
    toast(L('Texto original restaurado (aún sin guardar).', 'Original restored (not saved yet).'), 'ok');
  }
  async function test() {
    const to = window.prompt(L('¿A qué correo envío la prueba?', 'Which email should I send the test to?'), '');
    if (to === null) return;                 // canceló
    const dest = (to || '').trim();
    setBusy('test');
    try {
      const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test', to: dest || undefined, lang: l, subject_es: eEs.subject, body_es: eEs.body, subject_en: eEn.subject, body_en: eEn.body, ...(htmlMode ? { html_es: eEs.html, html_en: eEn.html } : {}), signature_id: sig || undefined }) });
      const j = await r.json(); if (!r.ok) toastErr(j); else toast(L(`Prueba enviada a ${dest || L('tu dirección', 'your address')}.`, `Test sent to ${dest || 'your address'}.`), 'ok');
    } finally { setBusy(''); }
  }
  async function ai(mode: 'draft' | 'rewrite') {
    if (!aiInstr.trim()) { toast(L('Escribe qué quieres que haga la IA.', 'Tell the AI what to do.')); return; }
    setBusy('ai');
    try {
      const r = await fetch('/api/admin/emails/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, instruction: aiInstr, vars: tpl.vars, format: htmlMode ? 'html' : 'text', currentEs: eEs, currentEn: eEn }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      const d = j.draft || {};
      // Texto siempre. En modo HTML, el texto se DERIVA del HTML para que ambos
      // digan lo mismo (el HTML generado es la fuente de verdad).
      if (d.subject_es || d.body_es || d.html_es) setEs((p) => ({ ...p, subject: d.subject_es || p.subject, body: (htmlMode && d.html_es) ? htmlToText(d.html_es) : (d.body_es || p.body), ...(htmlMode && d.html_es ? { html: d.html_es } : {}) }));
      if (d.subject_en || d.body_en || d.html_en) setEn((p) => ({ ...p, subject: d.subject_en || p.subject, body: (htmlMode && d.html_en) ? htmlToText(d.html_en) : (d.body_en || p.body), ...(htmlMode && d.html_en ? { html: d.html_en } : {}) }));
      toast(htmlMode ? L('HTML generado por la IA (revísalo y guarda).', 'AI HTML ready (review & save).') : L('Texto generado por la IA (revísalo y guarda).', 'AI draft ready (review & save).'), 'ok');
    } finally { setBusy(''); }
  }
  async function uploadImage(file: File) {
    if (file.size > 6 * 1024 * 1024) { toast(L('Imagen demasiado grande (máx 6 MB).', 'Image too large (6 MB max).')); return; }
    setBusy('img');
    try {
      const data: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(file); });
      const r = await fetch('/api/admin/emails/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upload_image', name: file.name, data }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      setCur({ html: cur.html + `\n<img src="${j.url}" alt="" style="max-width:100%;border-radius:8px;" />` });
      toast(L('Imagen subida e insertada.', 'Image uploaded and inserted.'), 'ok');
    } finally { setBusy(''); }
  }

  return (
    <>
      <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={onBack}>← {L('Volver', 'Back')}</button>
      <div className="card">
        <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          <b style={{ fontSize: 15 }}>{es ? tpl.es_label : tpl.en_label}</b>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {([['text', L('Texto', 'Text')], ['html', 'HTML']] as const).map(([k, lab]) => (
                <button key={k} onClick={() => setHtmlMode(k === 'html')} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: (htmlMode === (k === 'html')) ? 700 : 500, padding: '5px 11px', color: (htmlMode === (k === 'html')) ? 'var(--tx)' : 'var(--mut)', background: (htmlMode === (k === 'html')) ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{lab}</button>
              ))}
            </div>
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {(['es', 'en'] as const).map((x) => (
                <button key={x} onClick={() => setL(x)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: l === x ? 700 : 500, padding: '5px 12px', color: l === x ? 'var(--tx)' : 'var(--mut)', background: l === x ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{x.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}><OnyxIcon emoji="🌐" size={11} glow={false} /> {L('Se envía automáticamente en el idioma del perfil de quien lo recibe. Edita ambos idiomas.', 'Sent automatically in the recipient\'s profile language. Edit both languages.')} · {L('Va a', 'Goes to')}: <b>{tpl.to}</b></p>

        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Asunto', 'Subject')}</div>
        <input value={cur.subject} onChange={(e) => setCur({ subject: e.target.value })} style={{ margin: '0 0 12px' }} />

        {!htmlMode ? (
          <>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Cuerpo', 'Body')}</div>
            <textarea value={cur.body} onChange={(e) => setCur({ body: e.target.value })} style={{ width: '100%', minHeight: 150, fontSize: 13.5, lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />
            {tpl.vars.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>{L('Variables', 'Variables')}:</span>
                {tpl.vars.map((v) => <button key={v} onClick={() => setCur({ body: cur.body + ' {' + v + '}' })} style={chip}>{'{' + v + '}'}</button>)}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
              <select value="" onChange={(e) => { const s = EMAIL_STARTERS.find((x) => x.id === e.target.value); if (s && (!cur.html || window.confirm(L('¿Reemplazar el HTML actual con esta plantilla?', 'Replace the current HTML with this starter?')))) setCur({ html: s.html }); e.currentTarget.value = ''; }} style={{ margin: 0, maxWidth: 170, fontSize: 12 }} title={L('Plantilla de arranque', 'Starter template')}>
                <option value="">✦ {L('Arranque…', 'Starter…')}</option>
                {EMAIL_STARTERS.map((s) => <option key={s.id} value={s.id}>{L(s.es, s.en)}</option>)}
              </select>
              {tpl.vars.map((v) => <button key={v} onClick={() => setCur({ html: cur.html + ' {' + v + '}' })} style={chip}>{'{' + v + '}'}</button>)}
              <button onClick={() => setCur({ html: cur.html + '\n<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td bgcolor="#7a5cff" style="border-radius:9px;"><a href="{enlace}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:9px;">Botón</a></td></tr></table>' })} style={chip}>+ {L('Botón', 'Button')}</button>
              <button onClick={() => setCur({ html: preheaderSnippet() + cur.html })} style={chip} title={L('Línea de vista previa en la bandeja (oculta en el correo)', 'Inbox preview line (hidden in the email)')}>+ {L('Preheader', 'Preheader')}</button>
              <button onClick={() => setCur({ html: cur.html + '\n{firma}' })} style={chip} title={L('Inserta la firma elegida abajo', 'Inserts the chosen signature below')}>+ {L('Firma', 'Signature')}</button>
              <label style={{ ...chip, cursor: 'pointer' }}>+ {L('Imagen', 'Image')}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadImage(fl); e.currentTarget.value = ''; }} />
              </label>
              <button onClick={() => { if (cur.html && (!cur.body || window.confirm(L('¿Sobrescribir el texto con el contenido del HTML?', 'Overwrite the text with the HTML content?')))) setCur({ body: htmlToText(cur.html) }); }} style={chip} title={L('Pasa el contenido del HTML a la versión de texto', 'Copies the HTML content into the text version')}>↻ {L('Texto desde HTML', 'Text from HTML')}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
              <textarea value={cur.html} onChange={(e) => setCur({ html: e.target.value })} spellCheck={false} placeholder={L('Pega aquí tu HTML profesional…', 'Paste your professional HTML here…')}
                style={{ width: '100%', minHeight: 230, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />
              <PreviewFrame L={L} inner={fillSample(cur.html.replace(/\{\{?\s*firma\s*\}?\}/gi, sig ? (sigs.find((s) => s.id === sig)?.html || '') : ''))} />
            </div>
            <CtaEditor html={cur.html} onChange={(h) => setCur({ html: h })} L={L} />
            {(() => { const warns = lintEmail(cur.html, cur.subject, cur.body); return warns.length ? (
              <div style={{ marginTop: 8, background: 'color-mix(in srgb,#f5a623 12%,transparent)', border: '1px solid color-mix(in srgb,#f5a623 35%,transparent)', borderRadius: 8, padding: '8px 11px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>⚠ {L('Revisa antes de enviar', 'Check before sending')}</div>
                {warns.map((wn, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--mut)', lineHeight: 1.5 }}>• {L(wn[0], wn[1])}</div>)}
              </div>
            ) : null; })()}
            <p className="muted" style={{ fontSize: 11, marginTop: 6 }}><OnyxIcon emoji="👁" size={11} glow={false} /> {L('Vista previa con datos de ejemplo (prueba escritorio/móvil y claro/oscuro). Si dejas el HTML vacío, se envía la versión de texto.', 'Preview with sample data (try desktop/mobile and light/dark). If you leave HTML empty, the text version is sent.')}</p>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--line)', margin: '12px 0', paddingTop: 12 }} className="row">
          <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}><OnyxIcon emoji="✒️" size={12} glow={false} /> {L('Firma', 'Signature')}:</span>
          <select value={sig} onChange={(e) => setSig(e.target.value)} style={{ margin: 0, maxWidth: 240 }}>
            <option value="">{L('Sin firma', 'No signature')}</option>
            {sigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!sigs.length && <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>{L('(crea firmas en Redactar → Gestionar firmas)', '(create signatures in Compose → Manage signatures)')}</span>}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', margin: '12px 0', paddingTop: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setAiOpen((v) => !v)}><OnyxIcon emoji="✨" size={13} glow={false} /> {L('Redactar/mejorar con IA', 'Draft/improve with AI')} {aiOpen ? '▴' : '▾'}</button>
          {aiOpen && (
            <div style={{ marginTop: 10, background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
              <textarea value={aiInstr} onChange={(e) => setAiInstr(e.target.value)} placeholder={L('Ej. hazlo más cálido y breve, con un botón al panel', 'E.g. make it warmer and shorter, with a button to the dashboard')} style={{ width: '100%', minHeight: 60, fontSize: 13, padding: 9, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', resize: 'vertical' }} />
              <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ fontSize: 12.5 }} disabled={busy === 'ai'} onClick={() => ai('rewrite')}>{busy === 'ai' ? '…' : <>✨ {L('Mejorar este texto', 'Improve this text')}</>}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={busy === 'ai'} onClick={() => ai('draft')}>{L('Escribir desde cero', 'Write from scratch')}</button>
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 7 }}>{htmlMode ? L('Estás en modo HTML: la IA genera HTML profesional (compatible con Gmail, Outlook/Hotmail, claro y oscuro) en ES/EN.', 'HTML mode: the AI generates professional HTML (works in Gmail, Outlook/Hotmail, light & dark) in ES/EN.') : L('Estás en modo Texto: la IA redacta el texto (ES/EN). Cambia a HTML arriba para que genere el diseño HTML.', 'Text mode: the AI writes the text (ES/EN). Switch to HTML above to have it generate the HTML design.')}</p>
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={!!busy} onClick={test}><OnyxIcon emoji="📨" size={13} glow={false} /> {busy === 'test' ? '…' : L('Enviarme una prueba', 'Send me a test')}</button>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={restore}><OnyxIcon emoji="↩" size={13} glow={false} /> {L('Restaurar original', 'Restore original')}</button>
          {hist.length > 0 && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setHistOpen((v) => !v)}><OnyxIcon emoji="🕑" size={13} glow={false} /> {L('Historial', 'History')} ({hist.length}) {histOpen ? '▴' : '▾'}</button>}
          <button className="btn btn-primary" style={{ fontSize: 12.5, marginLeft: 'auto' }} disabled={!!busy} onClick={save}>{busy === 'save' ? '…' : L('Guardar', 'Save')}</button>
        </div>
        {histOpen && hist.length > 0 && (
          <div style={{ marginTop: 10, background: 'var(--bg2)', borderRadius: 10, padding: 10 }}>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{L('Versiones guardadas en este navegador (clic para restaurar):', 'Versions saved in this browser (click to restore):')}</div>
            {hist.map((h, i) => (
              <button key={i} onClick={() => restoreHist(h)} style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', borderRadius: 7, padding: '7px 10px', marginBottom: 5, cursor: 'pointer', fontSize: 12 }}>
                ↩ {fmtDateTime(new Date(h.ts).toISOString())} — <span className="muted">{(h.es?.subject || h.en?.subject || '').slice(0, 50) || L('(sin asunto)', '(no subject)')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ================= 2) REDACTAR Y ENVIAR ===================================
type Sig = { id: string; name: string; html: string };

// Rellena las variables con datos de EJEMPLO para el preview en vivo (soporta
// {{var}} y {var}). Así ves cómo quedará el correo ya personalizado.
function fillSample(s: string): string {
  const sample: any = { nombre: 'Jerry', name: 'Jerry', enlace: '#', plan: 'Pro', sitio: 'onyxtradinglive.com', site: 'onyxtradinglive.com' };
  return String(s || '')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => (sample[k] != null ? sample[k] : ''))
    .replace(/\{\s*(\w+)\s*\}/g, (_m, k) => (sample[k] != null ? sample[k] : _m));
}

// Convierte el HTML del correo a TEXTO limpio, para mantener la versión de texto
// en sincronía con la de HTML (mismo contenido, sin etiquetas). Conserva las
// variables {var}/{{var}} y respeta saltos de párrafo, listas y botones (como enlace).
function htmlToText(html: string): string {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  // Un botón/enlace "Texto {enlace}" → "Texto: url"
  s = s.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, txt) => {
    const t = txt.replace(/<[^>]+>/g, '').trim(); const h = String(href).trim();
    return h && h !== '#' ? (t ? `${t}: ${h}` : h) : t;
  });
  s = s.replace(/<li\b[^>]*>/gi, '\n• ').replace(/<\/li>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|tr|table|ul|ol|h[1-6])>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');                                   // resto de etiquetas
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}

// Lee el href de TODOS los botones del HTML (anclas con display:inline-block).
function allButtonHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*style=["'][^"']*display:inline-block[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(html || '')))) { const h = m[0].match(/href=["']([^"']*)["']/i); out.push(h ? h[1] : ''); }
  return out;
}
// Reemplaza el href del botón número `index` por una URL nueva.
function setButtonHrefAt(html: string, index: number, url: string): string {
  let i = -1;
  return String(html || '').replace(/<a\b[^>]*style=["'][^"']*display:inline-block[^"']*["'][^>]*>/gi, (tag) => {
    i++; if (i !== index) return tag;
    return /href=["'][^"']*["']/i.test(tag) ? tag.replace(/href=["'][^"']*["']/i, `href="${url}"`) : tag.replace(/<a\b/i, `<a href="${url}"`);
  });
}
// ¿El enlace es válido? OK si es variable de plantilla ({enlace}), https:// o mailto:.
function isLinkOk(u: string): boolean {
  const s = (u || '').trim();
  if (!s) return false;
  if (/^\{\{?\s*\w+\s*\}?\}$/.test(s)) return true;            // {enlace} / {{enlace}}
  return /^https:\/\//i.test(s) || /^mailto:/i.test(s);
}
// Editor de enlaces de los botones: ver / editar / aplicar cada uno, con validación.
function CtaEditor({ html, onChange, L }: { html: string; onChange: (h: string) => void; L: (a: string, b: string) => string }) {
  const hrefs = allButtonHrefs(html);
  const [vals, setVals] = useState<string[]>(hrefs);
  useEffect(() => { setVals(hrefs); /* re-sincroniza al cambiar el HTML */ }, [html]);
  if (!hrefs.length) return null;
  return (
    <div style={{ marginTop: 8, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
      {hrefs.map((h, i) => {
        const cur = vals[i] ?? h; const ok = isLinkOk(cur);
        return (
          <div key={i} style={{ marginBottom: i < hrefs.length - 1 ? 8 : 0 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 11.5, minWidth: 92 }}>🔗 {hrefs.length > 1 ? L(`Botón ${i + 1}`, `Button ${i + 1}`) : L('Enlace del botón', 'Button link')}:</span>
              <input value={cur} onChange={(e) => setVals((p) => { const n = [...p]; n[i] = e.target.value; return n; })} placeholder="https://www.onyxtradinglive.com/…" style={{ margin: 0, flex: 1, minWidth: 200, fontSize: 12.5, borderColor: ok ? 'var(--line)' : '#e5484d' }} />
              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={cur.trim() === h || !ok} onClick={() => onChange(setButtonHrefAt(html, i, cur.trim()))}>{L('Aplicar', 'Apply')}</button>
            </div>
            {!ok && <div style={{ fontSize: 11, color: '#e5484d', marginTop: 2, marginLeft: 100 }}>{L('Usa https:// (o una variable como {enlace}).', 'Use https:// (or a variable like {enlace}).')}</div>}
          </div>
        );
      })}
    </div>
  );
}

// Preheader: línea oculta que los clientes (Gmail/Outlook) muestran junto al asunto
// en la bandeja. Va al PRINCIPIO del cuerpo y no se ve dentro del correo.
function preheaderSnippet(text = 'Escribe aquí el texto de vista previa…'): string {
  return `<span style="display:none !important;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${text}</span>\n`;
}

// Plantillas de ARRANQUE: estructuras HTML profesionales listas (inline, compatibles
// con clientes de correo, claro/oscuro) para no empezar de cero. {nombre}/{enlace}.
const EMAIL_STARTERS: { id: string; es: string; en: string; html: string }[] = [
  {
    id: 'welcome', es: 'Bienvenida', en: 'Welcome',
    html: `<p style="margin:0 0 14px;color:#1a1d24;font-size:16px;line-height:1.6;">Hola <strong style="color:#1a1d24;">{nombre}</strong>,</p>
<p style="margin:0 0 16px;color:#1a1d24;font-size:15px;line-height:1.6;">¡Bienvenido a Onyx Trading Live! Ya tienes todo listo para empezar.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-radius:10px;"><tr><td bgcolor="#f4f1ff" style="padding:16px 18px;border-radius:10px;border:1px solid #e7e1ff;">
<p style="margin:0;color:#1a1d24;font-size:14px;line-height:1.6;">Conecta tu plataforma, activa Guardian y empieza a ver tus resultados en un solo lugar.</p>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td bgcolor="#7a5cff" style="border-radius:9px;"><a href="{enlace}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:9px;">Abrir mi panel</a></td></tr></table>
<p style="margin:0;color:#596070;font-size:13px;line-height:1.6;">¿Dudas? Responde a este correo y te ayudamos.</p>`,
  },
  {
    id: 'announce', es: 'Anuncio', en: 'Announcement',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-radius:10px;"><tr><td bgcolor="#121829" style="padding:18px 20px;border-radius:10px;">
<p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;line-height:1.4;">Novedad en Onyx</p></td></tr></table>
<p style="margin:0 0 14px;color:#1a1d24;font-size:15px;line-height:1.6;">Hola {nombre}, tenemos algo nuevo que queremos contarte.</p>
<p style="margin:0 0 16px;color:#1a1d24;font-size:15px;line-height:1.6;">Describe aquí la novedad en 2-3 frases claras y directas.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;"><tr><td bgcolor="#7a5cff" style="border-radius:9px;"><a href="{enlace}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:9px;">Ver más</a></td></tr></table>`,
  },
  {
    id: 'promo', es: 'Promoción', en: 'Promotion',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-radius:10px;"><tr><td bgcolor="#fff6e9" style="padding:18px 20px;border-radius:10px;border:1px solid #f3e4c6;text-align:center;">
<p style="margin:0 0 4px;color:#8a5a00;font-size:13px;font-weight:700;letter-spacing:.5px;">OFERTA POR TIEMPO LIMITADO</p>
<p style="margin:0;color:#1a1d24;font-size:22px;font-weight:800;line-height:1.3;">Tu título de oferta aquí</p></td></tr></table>
<p style="margin:0 0 16px;color:#1a1d24;font-size:15px;line-height:1.6;">Hola {nombre}, por tiempo limitado puedes aprovechar esta oferta. Explica el beneficio en una frase.</p>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 10px;"><tr><td bgcolor="#7a5cff" style="border-radius:9px;"><a href="{enlace}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;border-radius:9px;">Aprovechar ahora</a></td></tr></table>
<p style="margin:0;color:#596070;font-size:12px;line-height:1.6;text-align:center;">La oferta termina pronto.</p>`,
  },
  {
    id: 'notice', es: 'Aviso', en: 'Notice',
    html: `<p style="margin:0 0 14px;color:#1a1d24;font-size:15px;line-height:1.6;">Hola {nombre},</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-radius:10px;"><tr><td bgcolor="#eef6ff" style="padding:16px 18px;border-radius:10px;border:1px solid #d7e8fb;">
<p style="margin:0;color:#1a1d24;font-size:15px;line-height:1.6;">Escribe aquí el aviso importante que el usuario debe conocer.</p></td></tr></table>
<p style="margin:0 0 18px;color:#1a1d24;font-size:15px;line-height:1.6;">Si necesitas ayuda, estamos para apoyarte.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#7a5cff" style="border-radius:9px;"><a href="{enlace}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:9px;">Ir a mi cuenta</a></td></tr></table>`,
  },
];

// Linter: revisa el HTML (y el asunto) y devuelve avisos [es,en] de cosas que rompen
// en algunos clientes o disparan spam. No bloquea; solo advierte.
const SPAM_WORDS = ['gratis', '100%', 'garantizado', 'sin riesgo', 'dinero fácil', 'urgente', 'clic aquí', 'ganador', '$$$', 'free money', 'guaranteed', 'risk-free', 'act now', 'click here', 'winner', 'cash bonus'];
function lintEmail(html: string, subject: string, body: string): [string, string][] {
  const w: [string, string][] = [];
  const h = String(html || '');
  if (/\sclass=/.test(h)) w.push(['Hay class="…": Gmail/Outlook ignoran clases CSS. Usa estilos en línea.', 'Found class="…": Gmail/Outlook strip CSS classes. Use inline styles.']);
  if (/<style[\s>]/i.test(h)) w.push(['Hay <style>: muchos clientes lo eliminan. Pon los estilos en línea.', 'Found <style>: many clients strip it. Use inline styles.']);
  if (/position\s*:/i.test(h)) w.push(['Usas position: no funciona en correo.', 'You use position: it does not work in email.']);
  if (/display\s*:\s*(flex|grid)/i.test(h)) w.push(['Usas flex/grid: no funciona en Outlook. Usa tablas.', 'You use flex/grid: not supported in Outlook. Use tables.']);
  if (/background-image/i.test(h)) w.push(['background-image no se ve en Outlook. Usa bgcolor.', 'background-image is not shown in Outlook. Use bgcolor.']);
  if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(h)) w.push(['Hay imágenes sin alt: añade alt="" para accesibilidad y vista previa.', 'Images without alt: add alt="" for accessibility and preview.']);
  if (/href=["']http:\/\//i.test(h)) w.push(['Hay enlaces http:// (no seguros): usa https://.', 'There are http:// links (insecure): use https://.']);
  const blob = (subject + ' ' + body).toLowerCase();
  const hits = SPAM_WORDS.filter((k) => blob.includes(k));
  if (hits.length >= 3) w.push([`Varias palabras "gancho" (${hits.slice(0, 4).join(', ')}): pueden caer en spam.`, `Several spammy words (${hits.slice(0, 4).join(', ')}): may hit the spam folder.`]);
  if ((subject || '').length > 70) w.push(['El asunto es largo (>70): se corta en el móvil.', 'Subject is long (>70): it gets cut off on mobile.']);
  return w;
}

// Historial de versiones por plantilla (local, por navegador). Permite volver atrás
// si un cambio no gustó. Guarda las últimas 10.
type HistEntry = { ts: number; es: any; en: any; sig: string };
function histKey(id: string) { return 'onyx_mailhist_' + id; }
function histLoad(id: string): HistEntry[] {
  try { const r = JSON.parse(localStorage.getItem(histKey(id)) || '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
}
function histPush(id: string, e: HistEntry) {
  try { const arr = [e, ...histLoad(id)].slice(0, 10); localStorage.setItem(histKey(id), JSON.stringify(arr)); } catch { /* sin localStorage, no pasa nada */ }
}

// Marco de marca (igual al del servidor) para que el preview se vea como el correo real.
// dark=true simula un cliente en modo oscuro: el fondo ALREDEDOR de la tarjeta se
// oscurece, pero la tarjeta sigue clara (así es como se ve un correo transaccional
// bien hecho en Gmail/Outlook oscuro: la tarjeta mantiene su fondo explícito).
function previewDoc(innerHtml: string, dark = false): string {
  const outer = dark ? '#0d0f14' : '#eef0f4';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;background:${outer};padding:16px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e3e6ec;">
<tr><td style="background:#121829;padding:14px 24px;"><span style="color:#fff;font-size:17px;font-weight:700;">Onyx Trading Live</span></td></tr>
<tr><td style="padding:22px 24px;font-size:15px;color:#1a1d24;">${innerHtml}</td></tr>
<tr><td style="background:#f6f7f9;padding:14px 24px;color:#8a90a0;font-size:12px;border-top:1px solid #eceef2;">Onyx Trading Live · onyxtradinglive.com</td></tr>
</table></td></tr></table></body></html>`;
}

// Vista previa que se AUTOAJUSTA a la altura real del correo (no se corta) y permite
// ver ESCRITORIO / MÓVIL y CLARO / OSCURO. Recibe el HTML interno ya con datos de
// ejemplo; arma el documento según el ancho y el tema elegidos.
function PreviewFrame({ inner, L, minHeight = 260 }: { inner: string; L: (a: string, b: string) => string; minHeight?: number }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [h, setH] = useState(minHeight);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const fit = () => {
    try {
      const d = ref.current?.contentDocument;
      const body = d?.body, html = d?.documentElement;
      const sh = Math.max(body?.scrollHeight || 0, html?.scrollHeight || 0, body?.offsetHeight || 0);
      if (sh) setH(Math.max(minHeight, sh + 4));
    } catch { /* same-origin srcDoc; si falla, queda el mínimo */ }
  };
  const srcDoc = previewDoc(inner, dark);
  useEffect(() => { const t = setTimeout(fit, 60); return () => clearTimeout(t); }, [srcDoc, mobile]);
  const pill = (on: boolean): any => ({ border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: on ? 700 : 500, padding: '4px 10px', color: on ? 'var(--tx)' : 'var(--mut)', background: on ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' });
  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 7, overflow: 'hidden' }}>
          <button onClick={() => setMobile(false)} style={pill(!mobile)}>🖥 {L('Escritorio', 'Desktop')}</button>
          <button onClick={() => setMobile(true)} style={pill(mobile)}>📱 {L('Móvil', 'Mobile')}</button>
        </div>
        <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 7, overflow: 'hidden' }}>
          <button onClick={() => setDark(false)} style={pill(!dark)}>☀ {L('Claro', 'Light')}</button>
          <button onClick={() => setDark(true)} style={pill(dark)}>🌙 {L('Oscuro', 'Dark')}</button>
        </div>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: dark ? '#0d0f14' : '#eef0f4', display: 'flex', justifyContent: 'center' }}>
        <iframe ref={ref} title="preview" onLoad={fit} srcDoc={srcDoc} style={{ width: mobile ? 380 : '100%', maxWidth: '100%', height: h, minHeight, border: 'none', display: 'block', transition: 'width .15s' }} />
      </div>
    </div>
  );
}

function Redactar({ es, L }: { es: boolean; L: (a: string, b: string) => string }) {
  const [segs, setSegs] = useState<{ id: string; es: string; en: string }[]>([]);
  const [mode, setMode] = useState<'segment' | 'emails'>('segment');
  const [seg, setSeg] = useState('all');
  const [emails, setEmails] = useState('');
  const [f, setF] = useState({ subject_es: '', body_es: '', subject_en: '', body_en: '' });
  const [fh, setFh] = useState({ html_es: '', html_en: '' });     // cuerpo HTML por idioma
  const [htmlMode, setHtmlMode] = useState(false);                 // editor HTML + preview
  const [l, setL] = useState<'es' | 'en'>(es ? 'es' : 'en');
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [aiInstr, setAiInstr] = useState('');
  const [when, setWhen] = useState('');
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [sigId, setSigId] = useState('');
  const [sigMgr, setSigMgr] = useState(false);
  const [atts, setAtts] = useState<{ filename: string; content: string; size: number }[]>([]);
  const [utmOn, setUtmOn] = useState(false);          // añadir UTM a los botones
  const [shortOn, setShortOn] = useState(false);      // acortar enlaces (marca /r/)
  const [campaign, setCampaign] = useState('');       // nombre de campaña (utm_campaign)

  useEffect(() => { (async () => {
    try { const r = await fetch('/api/admin/campaigns'); const j = await r.json(); setSegs(j.segments || []); } catch {}
    try { const r = await fetch('/api/admin/emails/assets'); const j = await r.json(); setSigs(j.signatures || []); } catch {}
  })(); }, []);

  const curSub = l === 'es' ? 'subject_es' : 'subject_en';
  const curBody = l === 'es' ? 'body_es' : 'body_en';
  const curHtml = l === 'es' ? 'html_es' : 'html_en';
  // Payload común para la API (texto o HTML según el modo).
  const payload = () => ({
    segment: seg, emails: mode === 'emails' ? emails : '',
    subject_es: f.subject_es, subject_en: f.subject_en,
    body_es: f.body_es, body_en: f.body_en,
    ...(htmlMode ? { html_es: fh.html_es, html_en: fh.html_en } : {}),
    signature_id: sigId || undefined,
    attachments: atts.map((a) => ({ filename: a.filename, content: a.content })),
    utm: utmOn || undefined, short_links: shortOn || undefined,
    campaign: (campaign || f.subject_es || f.subject_en || '').slice(0, 60) || undefined,
  });

  async function doCount() {
    setBusy('count');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'count', ...payload() }) }); const j = await r.json(); setCount(j.count ?? 0); } finally { setBusy(''); }
  }
  async function test() {
    const to = window.prompt(L('¿A qué correo envío la prueba?', 'Which email should I send the test to?'), '');
    if (to === null) return;
    const dest = (to || '').trim();
    setBusy('test');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test', to: dest || undefined, lang: l, ...payload() }) }); const j = await r.json(); if (!r.ok) toastErr(j); else toast(L(`Prueba enviada a ${dest || L('tu dirección', 'your address')}.`, `Test sent to ${dest || 'your address'}.`), 'ok'); } finally { setBusy(''); }
  }
  async function send() {
    if (!f.subject_es && !f.subject_en) { toast(L('Falta el asunto.', 'Subject is missing.')); return; }
    if (mode === 'emails' && !emails.trim()) { toast(L('Añade al menos una dirección.', 'Add at least one address.')); return; }
    if (!window.confirm(L('¿Enviar este correo ahora?', 'Send this email now?'))) return;
    setBusy('send');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'send', ...payload() }) }); const j = await r.json(); if (!r.ok) toastErr(j); else toast(L(`Enviado a ${j.sent} destinatario(s).`, `Sent to ${j.sent} recipient(s).`), 'ok'); } finally { setBusy(''); }
  }
  async function schedule() {
    if (mode === 'emails') { toast(L('Para programar, elige un segmento.', 'To schedule, pick a segment.')); return; }
    if (!when) { toast(L('Elige fecha y hora.', 'Pick date and time.')); return; }
    if (!f.subject_es && !f.subject_en) { toast(L('Falta el asunto.', 'Subject is missing.')); return; }
    setBusy('sched');
    try { const r = await fetch('/api/admin/emails/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'schedule', scheduled_at: new Date(when).toISOString(), ...payload() }) }); const j = await r.json(); if (!r.ok) toastErr(j); else { toast(L('Correo programado.', 'Email scheduled.'), 'ok'); setWhen(''); } } finally { setBusy(''); }
  }
  async function ai() {
    if (!aiInstr.trim()) { toast(L('Escribe el tema o la instrucción.', 'Write the topic or instruction.')); return; }
    setBusy('ai');
    try {
      const r = await fetch('/api/admin/emails/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'draft', instruction: aiInstr, vars: ['nombre', 'enlace'], format: htmlMode ? 'html' : 'text' }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      const d = j.draft || {};
      // En modo HTML el texto se deriva del HTML para que ambos coincidan.
      setF({
        subject_es: d.subject_es || '', subject_en: d.subject_en || '',
        body_es: (htmlMode && d.html_es) ? htmlToText(d.html_es) : (d.body_es || ''),
        body_en: (htmlMode && d.html_en) ? htmlToText(d.html_en) : (d.body_en || ''),
      });
      if (htmlMode) setFh({ html_es: d.html_es || '', html_en: d.html_en || '' });
      toast(htmlMode ? L('HTML generado por la IA (revísalo).', 'AI HTML ready (review it).') : L('Borrador listo (revísalo).', 'Draft ready (review it).'), 'ok');
    } finally { setBusy(''); }
  }

  // Subir una imagen al Storage y pegar su etiqueta <img> en el HTML.
  async function uploadImage(file: File) {
    if (file.size > 6 * 1024 * 1024) { toast(L('Imagen demasiado grande (máx 6 MB).', 'Image too large (6 MB max).')); return; }
    setBusy('img');
    try {
      const data: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(file); });
      const r = await fetch('/api/admin/emails/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upload_image', name: file.name, data }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      const tag = `<img src="${j.url}" alt="" style="max-width:100%;border-radius:8px;" />`;
      setFh((p) => ({ ...p, [curHtml]: (p as any)[curHtml] + '\n' + tag }));
      toast(L('Imagen subida e insertada.', 'Image uploaded and inserted.'), 'ok');
    } finally { setBusy(''); }
  }
  // Adjuntar un archivo cualquiera (se manda en base64).
  async function addAttachment(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast(L('Adjunto demasiado grande (máx 8 MB).', 'Attachment too large (8 MB max).')); return; }
    const b64: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1] || ''); rd.onerror = rej; rd.readAsDataURL(file); });
    setAtts((p) => [...p, { filename: file.name, content: b64, size: file.size }].slice(0, 10));
  }

  const ins = (txt: string) => setFh((p) => ({ ...p, [curHtml]: (p as any)[curHtml] + txt }));
  const insText = (txt: string) => setF((p) => ({ ...p, [curBody]: (p as any)[curBody] + txt }));

  return (
    <div className="card" style={{ display: 'grid', gap: 14 }}>
      {sigMgr && <SignatureManager es={es} L={L} sigs={sigs} onClose={() => setSigMgr(false)} onSaved={(s) => { setSigs(s); setSigMgr(false); }} />}

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
        <div className="row between" style={{ alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>{L('Contenido', 'Content')}</span>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {/* Modo Texto / HTML */}
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {([['text', L('Texto', 'Text')], ['html', 'HTML']] as const).map(([k, lab]) => (
                <button key={k} onClick={() => setHtmlMode(k === 'html')} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: (htmlMode === (k === 'html')) ? 700 : 500, padding: '5px 11px', color: (htmlMode === (k === 'html')) ? 'var(--tx)' : 'var(--mut)', background: (htmlMode === (k === 'html')) ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{lab}</button>
              ))}
            </div>
            {/* Idioma */}
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {(['es', 'en'] as const).map((x) => <button key={x} onClick={() => setL(x)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: l === x ? 700 : 500, padding: '5px 12px', color: l === x ? 'var(--tx)' : 'var(--mut)', background: l === x ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent' }}>{x.toUpperCase()}</button>)}
            </div>
          </div>
        </div>
        <input value={(f as any)[curSub]} onChange={(e) => setF({ ...f, [curSub]: e.target.value })} placeholder={L('Asunto', 'Subject')} style={{ margin: '0 0 8px' }} />

        {!htmlMode ? (
          <>
            <textarea value={(f as any)[curBody]} onChange={(e) => setF({ ...f, [curBody]: e.target.value })} placeholder={L('Cuerpo del correo…', 'Email body…')} style={{ width: '100%', minHeight: 130, fontSize: 13.5, lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>{L('Variables', 'Variables')}:</span>
              {['nombre', 'enlace'].map((v) => <button key={v} onClick={() => insText(' {{' + v + '}}')} style={chip}>{'{{' + v + '}}'}</button>)}
            </div>
          </>
        ) : (
          <>
            {/* Barra del editor HTML */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
              <select value="" onChange={(e) => { const s = EMAIL_STARTERS.find((x) => x.id === e.target.value); if (s && (!(fh as any)[curHtml] || window.confirm(L('¿Reemplazar el HTML actual con esta plantilla?', 'Replace the current HTML with this starter?')))) setFh((p) => ({ ...p, [curHtml]: s.html.replace(/\{(nombre|enlace)\}/g, '{{$1}}') })); e.currentTarget.value = ''; }} style={{ margin: 0, maxWidth: 170, fontSize: 12 }} title={L('Plantilla de arranque', 'Starter template')}>
                <option value="">✦ {L('Arranque…', 'Starter…')}</option>
                {EMAIL_STARTERS.map((s) => <option key={s.id} value={s.id}>{L(s.es, s.en)}</option>)}
              </select>
              {['nombre', 'enlace'].map((v) => <button key={v} onClick={() => ins(' {{' + v + '}}')} style={chip}>{'{{' + v + '}}'}</button>)}
              <button onClick={() => ins('\n<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td bgcolor="#7a5cff" style="border-radius:9px;"><a href="https://www.onyxtradinglive.com/dashboard" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:9px;">Botón</a></td></tr></table>')} style={chip}>+ {L('Botón', 'Button')}</button>
              <button onClick={() => setFh((p) => ({ ...p, [curHtml]: preheaderSnippet() + (p as any)[curHtml] }))} style={chip} title={L('Línea de vista previa en la bandeja (oculta en el correo)', 'Inbox preview line (hidden in the email)')}>+ {L('Preheader', 'Preheader')}</button>
              <label style={{ ...chip, cursor: 'pointer' }}>+ {L('Imagen', 'Image')}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadImage(fl); e.currentTarget.value = ''; }} />
              </label>
              <button onClick={() => { const h = (fh as any)[curHtml]; if (h && (!(f as any)[curBody] || window.confirm(L('¿Sobrescribir el texto con el contenido del HTML?', 'Overwrite the text with the HTML content?')))) setF((p) => ({ ...p, [curBody]: htmlToText(h) })); }} style={chip} title={L('Pasa el contenido del HTML a la versión de texto', 'Copies the HTML content into the text version')}>↻ {L('Texto desde HTML', 'Text from HTML')}</button>
            </div>
            {/* Editor + preview en vivo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
              <textarea value={(fh as any)[curHtml]} onChange={(e) => setFh({ ...fh, [curHtml]: e.target.value })} placeholder={L('Pega aquí tu HTML profesional…', 'Paste your professional HTML here…')} spellCheck={false}
                style={{ width: '100%', minHeight: 230, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />
              <PreviewFrame L={L} inner={fillSample((fh as any)[curHtml]) + (sigId ? (sigs.find((s) => s.id === sigId)?.html ? '<br><br>' + sigs.find((s) => s.id === sigId)!.html : '') : '')} />
            </div>
            <CtaEditor html={(fh as any)[curHtml]} onChange={(h) => setFh({ ...fh, [curHtml]: h })} L={L} />
            {/* Seguimiento de enlaces */}
            <div style={{ marginTop: 8, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', display: 'grid', gap: 6 }}>
              <label className="row" style={{ gap: 7, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={utmOn} onChange={(e) => setUtmOn(e.target.checked)} /> {L('Añadir seguimiento UTM a los enlaces', 'Add UTM tracking to links')}
              </label>
              <label className="row" style={{ gap: 7, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={shortOn} onChange={(e) => setShortOn(e.target.checked)} /> {L('Usar enlace corto de marca (onyxtradinglive.com/r/…) y contar clics', 'Use branded short link (onyxtradinglive.com/r/…) and count clicks')}
              </label>
              {(utmOn || shortOn) && <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder={L('Nombre de campaña (p. ej. promo-black-onyx)', 'Campaign name (e.g. promo-black-onyx)')} style={{ margin: 0, fontSize: 12.5 }} />}
            </div>
            {(() => { const warns = lintEmail((fh as any)[curHtml], (f as any)[curSub], (f as any)[curBody]); return warns.length ? (
              <div style={{ marginTop: 8, background: 'color-mix(in srgb,#f5a623 12%,transparent)', border: '1px solid color-mix(in srgb,#f5a623 35%,transparent)', borderRadius: 8, padding: '8px 11px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>⚠ {L('Revisa antes de enviar', 'Check before sending')}</div>
                {warns.map((wn, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--mut)', lineHeight: 1.5 }}>• {L(wn[0], wn[1])}</div>)}
              </div>
            ) : null; })()}
            <p className="muted" style={{ fontSize: 11, marginTop: 6 }}><OnyxIcon emoji="👁" size={11} glow={false} /> {L('Vista previa en vivo (prueba escritorio/móvil y claro/oscuro). El correo saldrá dentro del marco de Onyx.', 'Live preview (try desktop/mobile and light/dark). The email ships inside the Onyx frame.')}</p>
          </>
        )}
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('Rellena ambos idiomas (ES/EN): cada quien recibe el suyo.', 'Fill both languages (ES/EN): each person gets theirs.')}</p>
      </div>

      {/* Firma + adjuntos */}
      <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}><OnyxIcon emoji="✒️" size={12} glow={false} /> {L('Firma', 'Signature')}:</span>
          <select value={sigId} onChange={(e) => setSigId(e.target.value)} style={{ margin: 0, maxWidth: 240 }}>
            <option value="">{L('Sin firma', 'No signature')}</option>
            {sigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setSigMgr(true)}>{L('Gestionar firmas', 'Manage signatures')}</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}><OnyxIcon emoji="📎" size={12} glow={false} /> {L('Adjuntos', 'Attachments')}:</span>
          <label className="btn btn-ghost" style={{ fontSize: 12, cursor: 'pointer' }}>+ {L('Añadir archivo', 'Add file')}
            <input type="file" style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) addAttachment(fl); e.currentTarget.value = ''; }} />
          </label>
          {atts.map((a, i) => (
            <span key={i} style={{ fontSize: 11.5, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: '3px 6px 3px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {a.filename} <button onClick={() => setAtts(atts.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--mut)', fontSize: 14, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
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

const chip: any = { cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, border: '1px solid color-mix(in srgb,var(--brand) 35%,transparent)', background: 'color-mix(in srgb,var(--brand) 10%,transparent)', color: 'var(--brand)' };

// ---- Gestor de firmas (crear/editar/borrar, con preview) ----
function SignatureManager({ es, L, sigs, onClose, onSaved }: { es: boolean; L: (a: string, b: string) => string; sigs: Sig[]; onClose: () => void; onSaved: (s: Sig[]) => void }) {
  const [list, setList] = useState<Sig[]>(sigs.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);
  const add = () => setList([...list, { id: Date.now() + '' + Math.random().toString(36).slice(2, 6), name: L('Nueva firma', 'New signature'), html: '' }]);
  const upd = (i: number, patch: Partial<Sig>) => setList(list.map((s, j) => j === i ? { ...s, ...patch } : s));
  const del = (i: number) => setList(list.filter((_, j) => j !== i));
  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/emails/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save_signatures', signatures: list }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      toast(L('Firmas guardadas.', 'Signatures saved.'), 'ok'); onSaved(j.signatures || list);
    } finally { setBusy(false); }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 80, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflow: 'auto' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 680, width: '100%', marginTop: 30 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 12 }}>
          <b style={{ fontSize: 15 }}><OnyxIcon emoji="✒️" size={14} glow={false} /> {L('Firmas guardadas', 'Saved signatures')}</b>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{L('Escribe cada firma en HTML (nombre, cargo, logo con URL, enlaces, redes). Se insertan al final del correo.', 'Write each signature in HTML (name, role, logo via URL, links, socials). Added at the end of the email.')}</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {list.map((s, i) => (
            <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <input value={s.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder={L('Nombre de la firma', 'Signature name')} style={{ margin: 0, flex: 1 }} />
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => del(i)}>{L('Borrar', 'Delete')}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
                <textarea value={s.html} onChange={(e) => upd(i, { html: e.target.value })} spellCheck={false} placeholder={'<strong>Jerry</strong><br>Fundador · Onyx'} style={{ width: '100%', minHeight: 110, fontFamily: 'monospace', fontSize: 11.5, padding: 9, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', resize: 'vertical' }} />
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: '#fff', padding: 10, fontSize: 13, color: '#1a1d24', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: s.html || '<span style="color:#999">preview…</span>' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={add}>+ {L('Añadir firma', 'Add signature')}</button>
          <button className="btn btn-primary" style={{ fontSize: 12.5, marginLeft: 'auto' }} disabled={busy} onClick={save}>{busy ? '…' : L('Guardar firmas', 'Save signatures')}</button>
        </div>
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
