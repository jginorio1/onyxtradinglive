'use client';
import { useEffect, useState } from 'react';

// ============================================================
// ADMIN · Centro de formación interno (empleados + vendedores).
// Personas (activar/desactivar acceso + rendimiento), Rutas (cursos, lecciones,
// examen) y Ajustes. Aislado de las academias de los mentores.
// ============================================================

const ROLES = ['vendedor', 'staff', 'support', 'instalador'];

const box: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 16, marginBottom: 14 };
const inp: React.CSSProperties = { background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx,#e8ecf5)', fontSize: 13.5, width: '100%' };
const btnP: React.CSSProperties = { background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btn: React.CSSProperties = { background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', border: '1px solid var(--line,#2a3350)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const lab: React.CSSProperties = { fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 40, height: 22, borderRadius: 20, border: 'none', background: on ? 'var(--accent,#8b93ff)' : 'var(--card,#1b2338)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
    <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} /></button>;
}

export default function Training({ canManage, lang = 'es' }: { canManage: boolean; lang?: 'es' | 'en' }) {
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [tab, setTab] = useState<'personas' | 'rutas' | 'cumplimiento' | 'ajustes'>('personas');
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<any>(null); // { track, lessons, questions }

  useEffect(() => { load(); }, []);
  async function load() {
    const r = await fetch('/api/admin/training').then((x) => x.json()).catch(() => null);
    if (r) setD(r);
  }
  async function post(body: any) {
    const r = await fetch('/api/admin/training', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
    return r;
  }
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2500); }

  if (!d) return <div style={{ color: 'var(--mut,#9aa6bd)', padding: 20 }}>{L('Cargando…', 'Loading…')}</div>;
  const s = d.settings || {};

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 2 }}>{L('Centro de formación', 'Training center')}</div>
      <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 14 }}>{L('Academia interna para empleados y vendedores · aislada de las academias de mentores.', 'Internal academy for employees and reps · isolated from mentor academies.')}</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['personas', 'rutas', 'cumplimiento', 'ajustes'] as const).map((tt) => (
          <button key={tt} onClick={() => { setTab(tt); setEditing(null); }} style={{ ...btn, ...(tab === tt ? { background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none' } : {}) }}>
            {tt === 'personas' ? L('Personas', 'People') : tt === 'rutas' ? L('Rutas y exámenes', 'Tracks & exams') : tt === 'cumplimiento' ? L('Cumplimiento', 'Compliance') : L('Ajustes', 'Settings')}
          </button>
        ))}
      </div>
      {msg && <div style={{ ...box, background: 'rgba(139,147,255,.1)', borderColor: 'var(--accent,#8b93ff)', color: 'var(--tx,#e8ecf5)', fontSize: 13.5 }}>{msg}</div>}

      {tab === 'personas' && <Personas d={d} canManage={canManage} L={L} post={post} reload={load} flash={flash} />}
      {tab === 'rutas' && !editing && <Rutas d={d} canManage={canManage} L={L} post={post} reload={load} open={(t: any) => openTrack(t)} />}
      {tab === 'rutas' && editing && <TrackEditor data={editing} tracks={d.tracks} canManage={canManage} L={L} post={post} onClose={() => { setEditing(null); load(); }} refresh={openTrack} />}
      {tab === 'cumplimiento' && <Cumplimiento L={L} post={post} lang={lang} canManage={canManage} />}
      {tab === 'ajustes' && <Ajustes s={s} canManage={canManage} L={L} post={post} reload={load} flash={flash} />}
    </div>
  );

  async function openTrack(t: any) {
    const r = await post({ action: 'track_full', id: t.id });
    if (r?.track) setEditing({ track: r.track, lessons: r.lessons, questions: r.questions });
  }
}

// -------- PERSONAS --------
function Personas({ d, canManage, L, post, reload, flash }: any) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const roster = d.roster || [];
  async function toggle(p: any) {
    if (!canManage) return;
    await post({ action: 'set_access', user_id: p.user_id, active: !p.active, role: p.role });
    reload();
  }
  async function chRole(p: any, r: string) {
    await post({ action: 'set_access', user_id: p.user_id, active: p.active, role: r });
    reload();
  }
  async function add() {
    if (!email) return;
    const r = await post({ action: 'enroll_email', email, role });
    if (r?.ok) { setEmail(''); flash(L('Persona añadida.', 'Person added.')); reload(); }
    else flash(r?.error || 'Error');
  }
  async function auto() {
    const r = await post({ action: 'auto_enroll' });
    flash(L(`Sincronizado: ${r?.added || 0} altas nuevas.`, `Synced: ${r?.added || 0} new.`)); reload();
  }

  return (
    <div>
      {canManage && (
        <div style={box}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 10 }}>{L('Dar acceso', 'Grant access')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}><span style={lab}>{L('Correo de la persona', 'Person email')}</span><input style={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" /></div>
            <div style={{ width: 150 }}><span style={lab}>{L('Rol', 'Role')}</span>
              <select style={inp} value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <button style={btnP} onClick={add}>{L('Añadir', 'Add')}</button>
            <button style={btn} onClick={auto} title={L('Trae automáticamente a vendedores y empleados activos.', 'Auto-enroll active reps and staff.')}>{L('Auto-alta ventas/equipo', 'Auto-enroll sales/staff')}</button>
          </div>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 10 }}>{L('Rendimiento por persona', 'Performance by person')} · {roster.length}</div>
        {roster.length === 0 && <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 13 }}>{L('Nadie tiene acceso todavía. Añade a alguien arriba o usa auto-alta.', 'No one has access yet. Add someone above or use auto-enroll.')}</div>}
        {roster.map((p: any) => (
          <div key={p.user_id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.7fr 0.7fr 0.9fr', gap: 8, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line,#2a3350)', fontSize: 13 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--tx,#e8ecf5)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || p.email || p.user_id.slice(0, 8)}</div>
              <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
            </div>
            <select style={{ ...inp, padding: '5px 7px', fontSize: 12 }} value={p.role} disabled={!canManage} onChange={(e) => chRole(p, e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <div style={{ color: 'var(--mut,#9aa6bd)' }}>{p.progress}%</div>
            <div style={{ color: 'var(--tx,#e8ecf5)' }}>{p.avgScore || '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, color: p.active ? '#4bbd7c' : 'var(--mut,#9aa6bd)' }}>{p.active ? L('Activo', 'On') : L('Inactivo', 'Off')}</span>
              <Toggle on={p.active} onClick={() => toggle(p)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------- RUTAS (lista) --------
function Rutas({ d, canManage, L, post, reload, open }: any) {
  async function nueva() {
    const r = await post({ action: 'save_track', track: { title_es: L('Nueva ruta', 'New track'), title_en: 'New track', sort: (d.tracks?.length || 0) } });
    if (r?.id) { await reload(); open({ id: r.id }); }
  }
  return (
    <div>
      {canManage && <button style={{ ...btnP, marginBottom: 12 }} onClick={nueva}>+ {L('Nueva ruta', 'New track')}</button>}
      {(d.tracks || []).map((t: any) => (
        <div key={t.id} style={{ ...box, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{t.title_es || t.slug}{!t.active && <span style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', marginLeft: 8 }}>({L('inactiva', 'inactive')})</span>}</div>
            <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>{t.lessons} {L('lecciones', 'lessons')} · {t.questions} {L('preguntas', 'questions')} · {L('nota', 'pass')} {t.pass_score} · {t.required_for?.length ? t.required_for.join(', ') : L('todos', 'all')}{t.gate_leads ? ' · ' + L('requisito para leads', 'lead gate') : ''}</div>
          </div>
          <button style={btn} onClick={() => open(t)}>{canManage ? L('Editar', 'Edit') : L('Ver', 'View')}</button>
        </div>
      ))}
      {(d.tracks || []).length === 0 && <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 13, padding: 10 }}>{L('Aún no hay rutas. Crea la primera.', 'No tracks yet. Create the first one.')}</div>}
    </div>
  );
}

// -------- EDITOR DE RUTA --------
function TrackEditor({ data, tracks, canManage, L, post, onClose, refresh }: any) {
  const [t, setT] = useState<any>(data.track);
  const lessons = data.lessons; const questions = data.questions;
  const up = (k: string, v: any) => setT((p: any) => ({ ...p, [k]: v }));
  const toggleRole = (r: string) => { const cur = t.required_for || []; up('required_for', cur.includes(r) ? cur.filter((x: string) => x !== r) : [...cur, r]); };

  async function saveTrack() { await post({ action: 'save_track', track: t }); onClose(); }
  async function del() { if (confirm(L('¿Eliminar la ruta completa?', 'Delete the whole track?'))) { await post({ action: 'del_track', id: t.id }); onClose(); } }
  async function addLesson() { await post({ action: 'save_lesson', lesson: { track_id: t.id, title_es: L('Nueva lección', 'New lesson'), sort: lessons.length } }); refresh({ id: t.id }); }
  async function saveLesson(l: any) { await post({ action: 'save_lesson', lesson: l }); refresh({ id: t.id }); }
  async function delLesson(id: string) { await post({ action: 'del_lesson', id }); refresh({ id: t.id }); }
  async function addQ() { await post({ action: 'save_question', question: { track_id: t.id, prompt_es: '', options_es: ['', ''], correct: 0, sort: questions.length } }); refresh({ id: t.id }); }
  async function saveQ(q: any) { await post({ action: 'save_question', question: q }); refresh({ id: t.id }); }
  async function delQ(id: string) { await post({ action: 'del_question', id }); refresh({ id: t.id }); }
  const [aiBusy, setAiBusy] = useState(false);
  async function aiGen() {
    if (!lessons.length) { alert(L('Añade lecciones con contenido primero.', 'Add lessons with content first.')); return; }
    setAiBusy(true);
    const r = await post({ action: 'ai_questions', track_id: t.id, n: 8 });
    setAiBusy(false);
    if (r?.ok) { alert(L(`Se generaron ${r.added} preguntas.`, `${r.added} questions generated.`)); refresh({ id: t.id }); }
    else alert(r?.error || 'Error');
  }

  return (
    <div>
      <button style={{ ...btn, marginBottom: 12 }} onClick={onClose}>← {L('Volver', 'Back')}</button>
      <div style={box}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={lab}>{L('Título (ES)', 'Title (ES)')}</span><input style={inp} value={t.title_es || ''} onChange={(e) => up('title_es', e.target.value)} /></div>
          <div><span style={lab}>{L('Título (EN)', 'Title (EN)')}</span><input style={inp} value={t.title_en || ''} onChange={(e) => up('title_en', e.target.value)} /></div>
          <div><span style={lab}>{L('Resumen (ES)', 'Summary (ES)')}</span><input style={inp} value={t.summary_es || ''} onChange={(e) => up('summary_es', e.target.value)} /></div>
          <div><span style={lab}>{L('Resumen (EN)', 'Summary (EN)')}</span><input style={inp} value={t.summary_en || ''} onChange={(e) => up('summary_en', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 10 }}>
          <div><span style={lab}>{L('Icono', 'Icon')}</span><input style={inp} value={t.icon || ''} onChange={(e) => up('icon', e.target.value)} placeholder="link, guardian, chat…" /></div>
          <div><span style={lab}>{L('Nota mínima', 'Pass score')}</span><input style={inp} type="number" value={t.pass_score ?? 80} onChange={(e) => up('pass_score', +e.target.value)} /></div>
          <div><span style={lab}>{L('Intentos (0=∞)', 'Attempts (0=∞)')}</span><input style={inp} type="number" value={t.max_attempts ?? 3} onChange={(e) => up('max_attempts', +e.target.value)} /></div>
          <div><span style={lab}>{L('Preguntas al azar', 'Random questions')}</span><input style={inp} type="number" value={t.exam_count ?? 0} onChange={(e) => up('exam_count', +e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 10 }}>
          <div><span style={lab}>{L('Certificado caduca (meses, 0=nunca)', 'Cert expires (months, 0=never)')}</span><input style={inp} type="number" value={t.cert_months ?? 0} onChange={(e) => up('cert_months', +e.target.value)} /></div>
          <div><span style={lab}>{L('Prerrequisito', 'Prerequisite')}</span>
            <select style={inp} value={t.prereq_track_id || ''} onChange={(e) => up('prereq_track_id', e.target.value || null)}>
              <option value="">{L('Ninguno', 'None')}</option>
              {(tracks || []).filter((x: any) => x.id !== t.id).map((x: any) => <option key={x.id} value={x.id}>{x.title_es || x.slug}</option>)}
            </select></div>
        </div>
        <div style={{ marginTop: 12 }}><span style={lab}>{L('Obligatoria para los roles', 'Required for roles')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{ROLES.map((r) => (
            <button key={r} onClick={() => toggleRole(r)} style={{ ...btn, ...(t.required_for?.includes(r) ? { background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none' } : {}) }}>{r}</button>
          ))}<span style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', alignSelf: 'center' }}>{L('(ninguno = para todos)', '(none = everyone)')}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13, color: 'var(--tx,#e8ecf5)' }}><Toggle on={!!t.gate_leads} onClick={() => up('gate_leads', !t.gate_leads)} /> {L('Requisito para recibir leads', 'Required to receive leads')}</label>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13, color: 'var(--tx,#e8ecf5)' }}><Toggle on={t.active !== false} onClick={() => up('active', !(t.active !== false))} /> {L('Activa', 'Active')}</label>
        </div>
        {canManage && <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button style={btnP} onClick={saveTrack}>{L('Guardar ruta', 'Save track')}</button><button style={{ ...btn, color: '#e2555a' }} onClick={del}>{L('Eliminar', 'Delete')}</button></div>}
      </div>

      {/* LECCIONES */}
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{L('Lecciones', 'Lessons')} · {lessons.length}</div>
          {canManage && <button style={btn} onClick={addLesson}>+ {L('Lección', 'Lesson')}</button>}
        </div>
        {lessons.map((l: any) => <LessonRow key={l.id} l={l} L={L} canManage={canManage} onSave={saveLesson} onDel={delLesson} inp={inp} lab={lab} btn={btn} btnP={btnP} />)}
      </div>

      {/* EXAMEN */}
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{L('Preguntas del examen', 'Exam questions')} · {questions.length}</div>
          {canManage && <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', opacity: aiBusy ? 0.6 : 1 }} disabled={aiBusy} onClick={aiGen} title={L('Genera 8 preguntas con IA a partir de las lecciones.', 'Generate 8 AI questions from the lessons.')}>{aiBusy ? L('Generando…', 'Generating…') : '✨ ' + L('Generar con IA', 'Generate with AI')}</button>
            <button style={btn} onClick={addQ}>+ {L('Pregunta', 'Question')}</button>
          </div>}
        </div>
        {canManage && <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginBottom: 8 }}>{L('Tip anti-trampa: ten 10–15 preguntas por ruta y pon “Preguntas al azar” en la ficha de la ruta para que cada examen sea distinto.', 'Anti-cheat tip: keep 10–15 questions per track and set “Random questions” so each exam differs.')}</div>}
        {questions.map((q: any) => <QuestionRow key={q.id} q={q} L={L} canManage={canManage} onSave={saveQ} onDel={delQ} inp={inp} lab={lab} btn={btn} btnP={btnP} />)}
      </div>
    </div>
  );
}

function LessonRow({ l, L, canManage, onSave, onDel, inp, lab, btn, btnP }: any) {
  const [x, setX] = useState(l);
  const up = (k: string, v: any) => setX((p: any) => ({ ...p, [k]: v }));
  const [upBusy, setUpBusy] = useState(false);
  async function upload(file: File) {
    setUpBusy(true);
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/admin/training/upload', { method: 'POST', body: fd }).then((z) => z.json()).catch(() => null);
    setUpBusy(false);
    if (r?.url) up('video_url', r.url); else alert(r?.error || 'Error');
  }
  return (
    <div style={{ borderTop: '1px solid var(--line,#2a3350)', padding: '10px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input style={inp} value={x.title_es || ''} onChange={(e) => up('title_es', e.target.value)} placeholder={L('Título ES', 'Title ES')} />
        <input style={inp} value={x.title_en || ''} onChange={(e) => up('title_en', e.target.value)} placeholder={L('Título EN', 'Title EN')} />
      </div>
      <textarea style={{ ...inp, marginTop: 8, minHeight: 90, resize: 'vertical' }} value={x.body_es || ''} onChange={(e) => up('body_es', e.target.value)} placeholder={L('Contenido ES (texto / listas con - )', 'Content ES')} />
      <textarea style={{ ...inp, marginTop: 8, minHeight: 60, resize: 'vertical' }} value={x.body_en || ''} onChange={(e) => up('body_en', e.target.value)} placeholder={L('Contenido EN (opcional)', 'Content EN (optional)')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <input style={inp} value={x.video_url || ''} onChange={(e) => up('video_url', e.target.value)} placeholder={L('URL de video (YouTube/Vimeo/mp4)', 'Video URL (YouTube/Vimeo/mp4)')} />
        {canManage && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ ...btn, cursor: 'pointer', opacity: upBusy ? 0.6 : 1 }}>{upBusy ? L('Subiendo…', 'Uploading…') : L('Subir video', 'Upload video')}
            <input type="file" accept="video/*,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} /></label>
          <button style={btnP} onClick={() => onSave(x)}>{L('Guardar', 'Save')}</button><button style={{ ...btn, color: '#e2555a' }} onClick={() => onDel(l.id)}>✕</button>
        </div>}
      </div>
    </div>
  );
}

function QuestionRow({ q, L, canManage, onSave, onDel, inp, lab, btn, btnP }: any) {
  const [x, setX] = useState({ ...q, options_es: q.options_es?.length ? q.options_es : ['', ''] });
  const up = (k: string, v: any) => setX((p: any) => ({ ...p, [k]: v }));
  const setOpt = (i: number, v: string) => { const o = [...(x.options_es || [])]; o[i] = v; up('options_es', o); };
  const addOpt = () => up('options_es', [...(x.options_es || []), '']);
  const rmOpt = (i: number) => up('options_es', (x.options_es || []).filter((_: any, j: number) => j !== i));
  return (
    <div style={{ borderTop: '1px solid var(--line,#2a3350)', padding: '10px 0' }}>
      <input style={inp} value={x.prompt_es || ''} onChange={(e) => up('prompt_es', e.target.value)} placeholder={L('Pregunta (ES)', 'Question (ES)')} />
      <input style={{ ...inp, marginTop: 6 }} value={x.prompt_en || ''} onChange={(e) => up('prompt_en', e.target.value)} placeholder={L('Pregunta (EN, opcional)', 'Question (EN, optional)')} />
      <div style={{ marginTop: 8 }}>
        {(x.options_es || []).map((op: string, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input type="radio" checked={x.correct === i} onChange={() => up('correct', i)} title={L('Correcta', 'Correct')} />
            <input style={inp} value={op} onChange={(e) => setOpt(i, e.target.value)} placeholder={L('Opción', 'Option') + ' ' + (i + 1)} />
            {(x.options_es || []).length > 2 && <button style={{ ...btn, padding: '5px 9px', color: '#e2555a' }} onClick={() => rmOpt(i)}>✕</button>}
          </div>
        ))}
        <button style={{ ...btn, padding: '5px 10px' }} onClick={addOpt}>+ {L('Opción', 'Option')}</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 6 }}>{L('Marca el círculo de la respuesta correcta. Las opciones EN se copian de ES si las dejas vacías.', 'Mark the correct answer. EN options fall back to ES.')}</div>
      {canManage && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}><button style={btnP} onClick={() => onSave({ ...x, options_en: x.options_en?.length ? x.options_en : x.options_es })}>{L('Guardar', 'Save')}</button><button style={{ ...btn, color: '#e2555a' }} onClick={() => onDel(q.id)}>{L('Eliminar', 'Delete')}</button></div>}
    </div>
  );
}

// -------- CUMPLIMIENTO (auditoría) --------
function Cumplimiento({ L, post, lang, canManage }: any) {
  const [rep, setRep] = useState<any>(null);
  const load = async () => { const r = await post({ action: 'compliance' }); if (r?.report) setRep(r.report); };
  useEffect(() => { load(); }, []);
  async function reset(p: any, t: any) {
    if (!canManage) return;
    if (!confirm(L(`¿Reabrir el examen de "${t.title}" para ${p.name || p.email}? Se borran sus intentos.`, `Reopen "${t.title}" exam for ${p.name || p.email}? Their attempts are cleared.`))) return;
    await post({ action: 'reset_attempts', user_id: p.user_id, track_id: t.id });
    load();
  }
  if (!rep) return <div style={{ color: 'var(--mut,#9aa6bd)', padding: 20 }}>{L('Cargando…', 'Loading…')}</div>;
  const su = rep.summary || {};
  const cell = (st: string) => {
    const map: any = { ok: ['rgba(70,190,120,.16)', '#4bbd7c', L('Al día', 'OK')], expired: ['rgba(224,160,58,.18)', '#e0a03a', L('Vencido', 'Expired')], pending: ['rgba(226,85,90,.14)', '#e2555a', L('Pendiente', 'Pending')] };
    const [bg, fg, txt] = map[st] || map.pending;
    return <span style={{ fontSize: 11, background: bg, color: fg, padding: '2px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>{txt}</span>;
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[[L('Personas', 'People'), su.total, 'var(--tx,#e8ecf5)'], [L('Al día', 'Compliant'), su.compliant, '#4bbd7c'], [L('Vencidos', 'Overdue'), su.overdue, '#e0a03a'], [L('Pendientes', 'Pending'), su.pending, '#e2555a']].map((c: any, i) => (
          <div key={i} style={{ ...box, marginBottom: 0, flex: 1, minWidth: 120, padding: '12px 14px' }}><div style={{ fontSize: 24, fontWeight: 600, color: c[2] }}>{c[1]}</div><div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>{c[0]}</div></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <a href={`/api/admin/training/report?lang=${lang}`} target="_blank" rel="noreferrer" style={{ ...btn, display: 'inline-block', textDecoration: 'none' }}>↓ {L('Exportar CSV', 'Export CSV')}</a>
        <a href={`/api/admin/training/report?format=pdf&lang=${lang}`} target="_blank" rel="noreferrer" style={{ ...btn, display: 'inline-block', textDecoration: 'none' }}>↓ {L('Exportar PDF', 'Export PDF')}</a>
        {canManage && <span style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', alignSelf: 'center' }}>{L('Clic en una casilla para reabrir ese examen.', 'Click a cell to reopen that exam.')}</span>}
      </div>
      <div style={{ ...box, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--mut,#9aa6bd)', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--panel,#161c2e)' }}>{L('Persona', 'Person')}</th>
            {rep.tracks.map((t: any) => <th key={t.id} style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--mut,#9aa6bd)', fontWeight: 500, minWidth: 90 }}>{t.title}</th>)}
          </tr></thead>
          <tbody>
            {rep.people.map((p: any) => (
              <tr key={p.user_id} style={{ borderTop: '1px solid var(--line,#2a3350)', opacity: p.active ? 1 : 0.55 }}>
                <td style={{ padding: '8px', position: 'sticky', left: 0, background: 'var(--panel,#161c2e)' }}>
                  <div style={{ color: 'var(--tx,#e8ecf5)', fontWeight: 600 }}>{p.name || p.email || p.user_id.slice(0, 8)} {p.compliant && <span title={L('Al día', 'Compliant')}>✓</span>}</div>
                  <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 11 }}>{p.role}</div>
                </td>
                {rep.tracks.map((t: any) => <td key={t.id} style={{ textAlign: 'center', padding: '8px', cursor: canManage && p.items[t.id] ? 'pointer' : 'default' }} onClick={() => p.items[t.id] && reset(p, t)} title={canManage && p.items[t.id] ? L('Clic para reabrir', 'Click to reopen') : ''}>{p.items[t.id] ? cell(p.items[t.id].status) : <span style={{ color: 'var(--mut,#9aa6bd)' }}>—</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rep.people.length === 0 && <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 13, padding: 10 }}>{L('Sin personas con acceso todavía.', 'No people with access yet.')}</div>}
      </div>
    </div>
  );
}

// -------- AJUSTES --------
function Ajustes({ s, canManage, L, post, reload, flash }: any) {
  const [f, setF] = useState(s);
  const up = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  async function save() { await post({ action: 'save_settings', settings: f }); flash(L('Ajustes guardados.', 'Settings saved.')); reload(); }
  const row = (label: string, node: React.ReactNode) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--line,#2a3350)' }}><span style={{ fontSize: 13.5, color: 'var(--tx,#e8ecf5)' }}>{label}</span>{node}</div>;
  return (
    <div style={box}>
      <div><span style={lab}>{L('Nombre visible del área', 'Area display name')}</span><input style={inp} value={f.brand_name || ''} onChange={(e) => up('brand_name', e.target.value)} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 10 }}>
        <div><span style={lab}>{L('Nota mínima por defecto', 'Default pass score')}</span><input style={inp} type="number" value={f.pass_score ?? 80} onChange={(e) => up('pass_score', +e.target.value)} /></div>
        <div><span style={lab}>{L('Intentos por defecto', 'Default attempts')}</span><input style={inp} type="number" value={f.max_attempts ?? 3} onChange={(e) => up('max_attempts', +e.target.value)} /></div>
        <div><span style={lab}>{L('Aviso cert. (días antes)', 'Cert reminder (days)')}</span><input style={inp} type="number" value={f.remind_cert_days ?? 15} onChange={(e) => up('remind_cert_days', +e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 8 }}>
        {row(L('Módulo activo', 'Module enabled'), <Toggle on={f.enabled !== false} onClick={() => up('enabled', !(f.enabled !== false))} />)}
        {row(L('Recordar cursos pendientes', 'Remind pending courses'), <Toggle on={!!f.remind_pending} onClick={() => up('remind_pending', !f.remind_pending)} />)}
        {row(L('Auto-alta de vendedores', 'Auto-enroll reps'), <Toggle on={!!f.auto_enroll_sales} onClick={() => up('auto_enroll_sales', !f.auto_enroll_sales)} />)}
        {row(L('Auto-alta de empleados', 'Auto-enroll staff'), <Toggle on={!!f.auto_enroll_staff} onClick={() => up('auto_enroll_staff', !f.auto_enroll_staff)} />)}
        {row(L('Bloquear leads sin certificar (gating)', 'Gate leads until certified'), <Toggle on={!!f.gating_enabled} onClick={() => up('gating_enabled', !f.gating_enabled)} />)}
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', margin: '16px 0 4px' }}>{L('Anti-trampa', 'Anti-cheat')}</div>
      <div>
        {row(L('Exigir lecciones antes del examen', 'Require lessons before exam'), <Toggle on={!!f.require_lessons} onClick={() => up('require_lessons', !f.require_lessons)} />)}
        {row(L('Barajar el orden de las opciones', 'Shuffle option order'), <Toggle on={!!f.shuffle_options} onClick={() => up('shuffle_options', !f.shuffle_options)} />)}
        {row(L('Ocultar respuestas si reprueba', 'Hide answers on fail'), <Toggle on={!!f.hide_answers_on_fail} onClick={() => up('hide_answers_on_fail', !f.hide_answers_on_fail)} />)}
        {row(L('Exigir declaración de honestidad', 'Require honesty attestation'), <Toggle on={!!f.require_attestation} onClick={() => up('require_attestation', !f.require_attestation)} />)}
        {row(L('Aviso de onboarding obligatorio', 'Mandatory onboarding notice'), <Toggle on={!!f.onboarding_block} onClick={() => up('onboarding_block', !f.onboarding_block)} />)}
        {row(L('Enviar certificado por correo', 'Email the certificate'), <Toggle on={!!f.email_cert} onClick={() => up('email_cert', !f.email_cert)} />)}
        {row(L('Espera entre intentos (min)', 'Cooldown between attempts (min)'), <input style={{ ...inp, width: 90 }} type="number" value={f.attempt_cooldown_min ?? 5} onChange={(e) => up('attempt_cooldown_min', +e.target.value)} />)}
        {row(L('Lectura mínima por lección (seg)', 'Min read per lesson (sec)'), <input style={{ ...inp, width: 90 }} type="number" value={f.min_read_sec ?? 15} onChange={(e) => up('min_read_sec', +e.target.value)} />)}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 6 }}>{L('Consejo: para que barajar y elegir al azar sean efectivos, carga más preguntas por ruta y usa “Preguntas al azar” en el examen.', 'Tip: for shuffling/random to matter, add more questions per track and use “Random questions”.')}</div>
      <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 8 }}>{L('Con el gating activo, un vendedor no recibe leads automáticos hasta aprobar las rutas marcadas como “requisito para leads”.', 'With gating on, a rep gets no auto-assigned leads until they pass the tracks marked as lead requirements.')}</div>
      {canManage && <button style={{ ...btnP, marginTop: 14 }} onClick={save}>{L('Guardar ajustes', 'Save settings')}</button>}
    </div>
  );
}
