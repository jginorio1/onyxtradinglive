'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Onyx Academy (estilo Skool): comunidad + cursos. Vista de alumno y, para quien
// tenga la capacidad `academy`, panel del mentor para crear contenido e inscribir.

function embed(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return 'https://www.youtube.com/embed/' + yt[1];
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return 'https://player.vimeo.com/video/' + vi[1];
  return null;
}

export default function AcademyClient() {
  const { lang } = useLang();
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [d, setD] = useState<any>(null);
  const [openM, setOpenM] = useState<string | null>(null); // mentor_id abierto
  const [active, setActive] = useState<any>(null);
  const [tab, setTab] = useState<'cursos' | 'comunidad'>('comunidad');
  const [lesson, setLesson] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [post, setPost] = useState('');
  const [manage, setManage] = useState(false);

  async function load() { const r = await fetch('/api/academy'); setD(await r.json()); }
  useEffect(() => {
    (async () => {
      // Auto-inscripción si venimos de un enlace ?join=CODE
      try {
        const jc = new URLSearchParams(window.location.search).get('join');
        if (jc) {
          const r = await fetch('/api/academy/enroll', { method: 'POST', body: JSON.stringify({ code: jc }) });
          const j = await r.json();
          await load();
          if (j.ok) openAcademy(j.mentor_id);
          return;
        }
      } catch {}
      load();
    })();
  }, []);
  async function openAcademy(mid: string) {
    setOpenM(mid); setLesson(null);
    const r = await fetch('/api/academy?m=' + mid); const j = await r.json(); setActive(j.active); setTab('comunidad');
  }
  async function join() {
    if (!joinCode.trim()) return;
    const r = await fetch('/api/academy/enroll', { method: 'POST', body: JSON.stringify({ code: joinCode.trim() }) });
    const j = await r.json(); setJoinCode('');
    if (j.ok) { await load(); openAcademy(j.mentor_id); } else alert(L('Código no válido.', 'Invalid code.'));
  }
  async function toggleLesson(l: any, done: boolean) {
    await fetch('/api/academy', { method: 'POST', body: JSON.stringify({ action: 'lesson', lesson_id: l.id, done }) });
    setActive((a: any) => ({ ...a, progress: done ? [...a.progress, l.id] : a.progress.filter((x: string) => x !== l.id) }));
  }
  async function sendPost() {
    if (!post.trim() || !active) return;
    await fetch('/api/academy', { method: 'POST', body: JSON.stringify({ action: 'post', mentor_id: active.mentor_id, body: post }) });
    setPost(''); openAcademy(active.mentor_id);
  }
  async function comment(pid: string, body: string) {
    await fetch('/api/academy', { method: 'POST', body: JSON.stringify({ action: 'comment', post_id: pid, mentor_id: active.mentor_id, body }) });
    openAcademy(active.mentor_id);
  }

  if (!d) return <div className="card muted">…</div>;
  if (manage && d.canMentor) return <MentorPanel lang={lang} onClose={() => { setManage(false); load(); }} />;

  const totalLessons = active ? active.content.reduce((s: number, m: any) => s + m.lessons.length, 0) : 0;
  const doneCount = active ? active.progress.length : 0;

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon emoji="📚" size={22} /></span> {L('Academia', 'Academy')}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{L('Comunidad y cursos de tu mentor.', 'Community and courses from your mentor.')}</div>
        </div>
        {d.canMentor && <button className="btn btn-primary" onClick={() => setManage(true)}>🎓 {L('Panel del mentor', 'Mentor panel')}</button>}
      </div>

      {/* Unirse a una academia */}
      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <OnyxIcon emoji="🔑" size={16} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{L('Unirme a una academia', 'Join an academy')}</span>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={L('Pega el código del mentor', 'Paste your mentor code')} style={{ margin: 0, flex: 1, minWidth: 160 }} />
          <button className="btn btn-primary" onClick={join}>{L('Unirme', 'Join')}</button>
        </div>
      </div>

      {/* Mis academias */}
      {!active && (
        (d.academies || []).length === 0
          ? <div className="card muted">{L('Todavía no estás en ninguna academia. Únete con el código de tu mentor.', 'You are not in any academy yet. Join with your mentor code.')}</div>
          : <div className="grid g2">{d.academies.map((a: any) => (
            <button key={a.mentor_id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => openAcademy(a.mentor_id)}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{a.academy_name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.mentor_name}{a.tagline ? ' · ' + a.tagline : ''}</div>
            </button>
          ))}</div>
      )}

      {/* Academia abierta */}
      {active && (
        <>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div><b style={{ fontSize: 16 }}>{active.academy_name}</b>{active.tagline && <span className="muted" style={{ fontSize: 12.5 }}> · {active.tagline}</span>}</div>
            <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { setActive(null); setOpenM(null); }}>← {L('Mis academias', 'My academies')}</button>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className={'btn ' + (tab === 'comunidad' ? 'btn-primary' : 'btn-ghost')} onClick={() => setTab('comunidad')}><OnyxIcon emoji="💬" size={14} /> {L('Comunidad', 'Community')}</button>
            <button className={'btn ' + (tab === 'cursos' ? 'btn-primary' : 'btn-ghost')} onClick={() => setTab('cursos')}><OnyxIcon emoji="📚" size={14} /> {L('Cursos', 'Courses')}</button>
          </div>

          {tab === 'comunidad' && (
            <>
              <div className="card">
                <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={2} placeholder={L('Comparte algo con la comunidad…', 'Share something with the community…')} style={{ width: '100%', margin: 0 }} />
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><button className="btn btn-primary" onClick={sendPost} disabled={!post.trim()}>{L('Publicar', 'Post')}</button></div>
              </div>
              {(active.feed || []).map((p: any) => <PostCard key={p.id} p={p} onComment={comment} L={L} />)}
              {(active.feed || []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('Aún no hay publicaciones.', 'No posts yet.')}</div>}
            </>
          )}

          {tab === 'cursos' && (
            <>
              {totalLessons > 0 && (
                <div className="card">
                  <div className="row between" style={{ fontSize: 13, marginBottom: 6 }}><span className="muted">{L('Tu progreso', 'Your progress')}</span><b>{doneCount}/{totalLessons}</b></div>
                  <div className="statbar" style={{ ['--ac' as any]: 'var(--green)' }}><i style={{ width: (totalLessons ? (doneCount / totalLessons) * 100 : 0) + '%' }} /></div>
                </div>
              )}
              {lesson ? <LessonView lesson={lesson} done={active.progress.includes(lesson.id)} onBack={() => setLesson(null)} onToggle={toggleLesson} L={L} /> : (
                (active.content || []).map((m: any) => (
                  <div key={m.id} className="card">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: m.description ? 4 : 10 }}><span className="card-ic"><OnyxIcon emoji="🧩" size={16} /></span> {m.title}</h3>
                    {m.description && <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{m.description}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {m.lessons.map((l: any) => { const done = active.progress.includes(l.id); return (
                        <button key={l.id} className="jrow" onClick={() => setLesson(l)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', textAlign: 'left', cursor: 'pointer' }}>
                          <span style={{ color: done ? 'var(--green)' : 'var(--mut)' }}>{done ? '✓' : '▷'}</span>
                          <span style={{ flex: 1, fontSize: 13.5 }}>{l.title}</span>
                          {l.is_free && <span className="pill" style={{ fontSize: 10, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('gratis', 'free')}</span>}
                          {l.video_url && <OnyxIcon emoji="🎬" size={14} />}
                        </button>
                      ); })}
                      {m.lessons.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{L('Sin lecciones todavía.', 'No lessons yet.')}</span>}
                    </div>
                  </div>
                ))
              )}
              {(active.content || []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('El mentor aún no ha publicado cursos.', 'The mentor has not published courses yet.')}</div>}
            </>
          )}
        </>
      )}
    </div>
  );
}

function LessonView({ lesson, done, onBack, onToggle, L }: any) {
  const emb = embed(lesson.video_url || '');
  return (
    <div className="card">
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Volver a las lecciones', 'Back to lessons')}</button>
      <h3 style={{ marginBottom: 12 }}>{lesson.title}</h3>
      {lesson.video_url && (emb
        ? <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}><iframe src={emb} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
        : <video src={lesson.video_url} controls style={{ width: '100%', borderRadius: 12, marginBottom: 12 }} />)}
      {lesson.content && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{lesson.content}</div>}
      {(lesson.resources || []).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Recursos', 'Resources')}</div>
          {lesson.resources.map((r: any, i: number) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="pill" style={{ marginRight: 8, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.14)' }}>📎 {r.label || r.url}</a>)}
        </div>
      )}
      <button className={'btn ' + (done ? 'btn-ghost' : 'btn-primary')} onClick={() => onToggle(lesson, !done)}>{done ? '✓ ' + L('Completada', 'Completed') : L('Marcar como completada', 'Mark as completed')}</button>
    </div>
  );
}

function PostCard({ p, onComment, L }: any) {
  const [c, setC] = useState('');
  return (
    <div className="card">
      <div className="row" style={{ gap: 9, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--grad)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{(p.author_name || '?').slice(0, 2).toUpperCase()}</span>
        <b style={{ fontSize: 13.5 }}>{p.author_name}</b>{p.pinned && <span className="pill" style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(255,192,77,.15)' }}>📌 {L('fijado', 'pinned')}</span>}
      </div>
      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{p.body}</div>
      {(p.comments || []).length > 0 && <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {p.comments.map((c2: any) => <div key={c2.id} style={{ fontSize: 13 }}><b style={{ fontSize: 12.5 }}>{c2.author_name}:</b> {c2.body}</div>)}
      </div>}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <input value={c} onChange={(e) => setC(e.target.value)} placeholder={L('Comentar…', 'Comment…')} style={{ margin: 0, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter' && c.trim()) { onComment(p.id, c); setC(''); } }} />
        <button className="btn btn-ghost" onClick={() => { if (c.trim()) { onComment(p.id, c); setC(''); } }}>{L('Enviar', 'Send')}</button>
      </div>
    </div>
  );
}

// =================== Panel del mentor ===================
function MentorPanel({ lang, onClose }: { lang: string; onClose: () => void }) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'cursos' | 'alumnos' | 'comunidad' | 'ajustes'>('cursos');
  const [newMod, setNewMod] = useState('');
  const [lessonForm, setLessonForm] = useState<any>(null); // {module_id, ...}
  const [post, setPost] = useState('');

  async function load() { const r = await fetch('/api/academy/mentor'); setD(await r.json()); }
  useEffect(() => { load(); }, []);
  async function api(body: any) { await fetch('/api/academy/mentor', { method: 'POST', body: JSON.stringify(body) }); load(); }

  if (!d) return <div className="card muted">…</div>;
  if (d.error) return <div className="card"><b>{L('Academia no disponible en tu plan', 'Academy not on your plan')}</b><p className="muted" style={{ marginTop: 6 }}>{L('El módulo Mentor está en el plan Mentor o como add-on.', 'The Mentor module is on the Mentor plan or as an add-on.')}</p></div>;

  const link = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/academy?join=${d.mentor.code}` : '';

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div><h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>🎓 {d.mentor.academy_name}</h2><div className="muted" style={{ fontSize: 13 }}>{L('Panel del mentor', 'Mentor panel')}</div></div>
        <button className="btn btn-ghost" onClick={onClose}>← {L('Ver como alumno', 'Student view')}</button>
      </div>

      <div className="card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🔑 {L('Enlace de inscripción (compártelo con tus alumnos)', 'Enrollment link (share with your students)')}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input readOnly value={link} style={{ margin: 0, flex: 1, minWidth: 200 }} />
          <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(link)}>{L('Copiar', 'Copy')}</button>
          <span className="pill" style={{ color: 'var(--soft-brand)', background: 'rgba(124,140,255,.14)' }}>{L('Código', 'Code')}: {d.mentor.code}</span>
        </div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {([['cursos', '📚', L('Cursos', 'Courses')], ['alumnos', '👥', L('Alumnos', 'Students')], ['comunidad', '💬', L('Comunidad', 'Community')], ['ajustes', '⚙️', L('Ajustes', 'Settings')]] as any[]).map(([k, ic, lbl]) => (
          <button key={k} className={'btn ' + (tab === k ? 'btn-primary' : 'btn-ghost')} onClick={() => setTab(k)}><OnyxIcon emoji={ic} size={14} /> {lbl}</button>
        ))}
      </div>

      {tab === 'cursos' && (<>
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <input value={newMod} onChange={(e) => setNewMod(e.target.value)} placeholder={L('Nombre del nuevo módulo', 'New module name')} style={{ margin: 0, flex: 1 }} />
            <button className="btn btn-primary" onClick={() => { if (newMod.trim()) { api({ action: 'module', title: newMod, position: (d.content?.length || 0) }); setNewMod(''); } }}>＋ {L('Módulo', 'Module')}</button>
          </div>
        </div>
        {(d.content || []).map((m: any) => (
          <div key={m.id} className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="🧩" size={16} /></span> {m.title}</h3>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setLessonForm({ module_id: m.id })}>＋ {L('Lección', 'Lesson')}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => confirm(L('¿Borrar módulo?', 'Delete module?')) && api({ action: 'module_delete', id: m.id })}>✕</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {m.lessons.map((l: any) => (
                <div key={l.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                  <span>{l.title}{l.is_free && <span className="pill" style={{ marginLeft: 6, fontSize: 10, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('gratis', 'free')}</span>}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setLessonForm({ ...l })}>✎</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => api({ action: 'lesson_delete', id: l.id })}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {lessonForm && <LessonForm form={lessonForm} setForm={setLessonForm} L={L} onSave={(f: any) => { api({ action: 'lesson', ...f }); setLessonForm(null); }} onCancel={() => setLessonForm(null)} />}
      </>)}

      {tab === 'alumnos' && (
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon emoji="👥" size={16} /></span> {L('Alumnos', 'Students')} · {d.roster.students.length}</h3>
          {d.roster.students.length === 0 ? <p className="muted">{L('Comparte tu enlace para que se inscriban.', 'Share your link so they enroll.')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.roster.students.map((s: any) => (
                <div key={s.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}>
                  <span>{s.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{L('progreso', 'progress')} {s.done}/{d.roster.totalLessons}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'comunidad' && (<>
        <div className="card">
          <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={2} placeholder={L('Publica un anuncio para tus alumnos…', 'Post an announcement for your students…')} style={{ width: '100%', margin: 0 }} />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => { if (post.trim()) { api({ action: 'post', body: post, pinned: true }); setPost(''); } }}>📌 {L('Fijar', 'Pin')}</button>
            <button className="btn btn-primary" onClick={() => { if (post.trim()) { api({ action: 'post', body: post }); setPost(''); } }}>{L('Publicar', 'Post')}</button>
          </div>
        </div>
        {(d.feed || []).map((p: any) => (
          <div key={p.id} className="card">
            <div className="row between"><b style={{ fontSize: 13.5 }}>{p.author_name}{p.pinned && ' 📌'}</b><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => api({ action: 'post_delete', id: p.id })}>✕</button></div>
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', marginTop: 4 }}>{p.body}</div>
          </div>
        ))}
      </>)}

      {tab === 'ajustes' && <MentorSettings mentor={d.mentor} L={L} onSave={(b: any) => api({ action: 'settings', ...b })} />}
    </div>
  );
}

function LessonForm({ form, setForm, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  return (
    <div className="card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{form.id ? L('Editar lección', 'Edit lesson') : L('Nueva lección', 'New lesson')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder={L('Título', 'Title')} style={{ margin: 0 }} />
        <input value={form.video_url || ''} onChange={(e) => set('video_url', e.target.value)} placeholder={L('URL del vídeo (YouTube, Vimeo o .mp4)', 'Video URL (YouTube, Vimeo or .mp4)')} style={{ margin: 0 }} />
        <textarea value={form.content || ''} onChange={(e) => set('content', e.target.value)} rows={4} placeholder={L('Notas de la lección (opcional)', 'Lesson notes (optional)')} style={{ width: '100%', margin: 0 }} />
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={!!form.is_free} onChange={(e) => set('is_free', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Lección gratis (preview sin inscribirse)', 'Free lesson (preview without enrolling)')}</label>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.title}>{L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div>
  );
}

function MentorSettings({ mentor, onSave, L }: any) {
  const [f, setF] = useState({ academy_name: mentor.academy_name, tagline: mentor.tagline || '', about: mentor.about || '' });
  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon emoji="⚙️" size={16} /></span> {L('Ajustes de la academia', 'Academy settings')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Nombre', 'Name')}</span><input value={f.academy_name} onChange={(e) => setF({ ...f, academy_name: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Lema', 'Tagline')}</span><input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Sobre la academia', 'About')}</span><textarea value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} rows={3} style={{ width: '100%', margin: '4px 0 0' }} /></div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onSave(f)}>{L('Guardar', 'Save')}</button>
    </div>
  );
}
