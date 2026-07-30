'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Onyx Academy v2 — comunidad estilo Skool: feed, aulas con secciones y progreso,
// calendario con clase en vivo (countdown + EN VIVO), miembros, ranking, perfil,
// chat privado y barra inferior tipo app. Mentor con plantilla + wizard + cobros.

function embed(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return 'https://www.youtube.com/embed/' + yt[1];
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return 'https://player.vimeo.com/video/' + vi[1];
  return null;
}
const initials = (n: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
function timeAgo(iso: string, es: boolean) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  for (const [sec, a] of [[86400, 'd'], [3600, 'h'], [60, 'm']] as [number, string][]) if (s >= sec) return Math.floor(s / sec) + a;
  return es ? 'ahora' : 'now';
}
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
}
async function uploadImage(file: File): Promise<string | null> {
  const data = await fileToDataUrl(file);
  const r = await fetch('/api/academy/upload', { method: 'POST', body: JSON.stringify({ name: file.name, data }) });
  const j = await r.json();
  return j.url || null;
}

function Avatar({ name, level, size = 40, onClick }: { name: string; level?: number; size?: number; onClick?: () => void }) {
  return (
    <span className="sk-av" style={{ width: size, height: size, fontSize: size * 0.36, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      {initials(name)}{level != null && <span className="sk-lvl">{level}</span>}
    </span>
  );
}
function Ring({ pct, size = 46 }: { pct: number; size?: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(var(--green) ${p * 3.6}deg, color-mix(in srgb, var(--mut) 25%, transparent) 0deg)`, flex: 'none' }}>
      <div style={{ width: size - 8, height: size - 8, borderRadius: '50%', background: 'var(--card)', display: 'grid', placeItems: 'center', fontSize: size * 0.24, fontWeight: 800 }}>{p}%</div>
    </div>
  );
}
function Toast({ msg }: { msg: string }) { return <div className="sk-toast">{msg}</div>; }

// Botón para subir imagen (portada/miniatura).
function ImageUpload({ value, onChange, L, label }: any) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      {label && <span className="muted" style={{ fontSize: 12 }}>{label}</span>}
      <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return; setBusy(true);
          const url = await uploadImage(f); setBusy(false);
          if (url) onChange(url); else alert(L('No se pudo subir la imagen.', 'Could not upload image.'));
        }} />
        <button className="btn btn-ghost" disabled={busy} onClick={() => ref.current?.click()}>{busy ? '…' : (L('Subir imagen', 'Upload image'))}</button>
        {value && <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => onChange('')}>{L('Quitar', 'Remove')}</button>}
      </div>
      {value && <div className="sk-course-cover" style={{ backgroundImage: `url(${value})`, borderRadius: 10, marginTop: 10 }} />}
    </div>
  );
}

export default function AcademyClient() {
  const { lang } = useLang();
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [d, setD] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [manage, setManage] = useState(false);

  async function load() { const r = await fetch('/api/academy'); setD(await r.json()); }
  async function openAcademy(mid: string) { const r = await fetch('/api/academy?m=' + mid); const j = await r.json(); if (j.active) setActive(j.active); }
  useEffect(() => {
    (async () => {
      try {
        const jc = new URLSearchParams(window.location.search).get('join');
        if (jc) { const r = await fetch('/api/academy/enroll', { method: 'POST', body: JSON.stringify({ code: jc }) }); const j = await r.json(); await load(); if (j.ok) openAcademy(j.mentor_id); return; }
      } catch {}
      load();
    })();
  }, []);
  async function join() {
    if (!joinCode.trim()) return;
    const r = await fetch('/api/academy/enroll', { method: 'POST', body: JSON.stringify({ code: joinCode.trim() }) });
    const j = await r.json(); setJoinCode('');
    if (j.ok) { await load(); openAcademy(j.mentor_id); } else alert(L('Código no válido.', 'Invalid code.'));
  }

  if (!d) return <div className="card muted">…</div>;
  if (manage && d.canMentor) return <MentorPanel lang={lang} onClose={() => { setManage(false); load(); }} openStudent={(mid: string) => { setManage(false); openAcademy(mid); }} />;
  if (active) return <Community active={active} lang={lang} reload={() => openAcademy(active.mentor_id)} onExit={() => { setActive(null); load(); }} toMentor={d.canMentor ? () => setManage(true) : undefined} />;

  return (
    <div className="sk-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={24} /></span> Onyx Academy</h2>
          <div className="muted" style={{ fontSize: 13 }}>{L('Comunidades de trading: aprende, comparte y sube de nivel.', 'Trading communities: learn, share and level up.')}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn btn-ghost" href="/academias">{L('Explorar', 'Browse')}</a>
          {d.canMentor && <button className="btn btn-primary" onClick={() => setManage(true)}><OnyxIcon name="graduation" size={15} /> {L('Panel del mentor', 'Mentor panel')}</button>}
        </div>
      </div>

      <div className="sk-card">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <OnyxIcon emoji="🔑" size={16} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{L('Unirme a una academia', 'Join an academy')}</span>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={L('Pega el código del mentor', 'Paste your mentor code')} style={{ margin: 0, flex: 1, minWidth: 160 }} onKeyDown={(e) => e.key === 'Enter' && join()} />
          <button className="btn btn-primary" onClick={join}>{L('Unirme', 'Join')}</button>
        </div>
      </div>

      {d.isMentor && d.myMentorId && (
        <div>
          <div className="sk-sec-title">{L('Mi comunidad', 'My community')}</div>
          <button className="sk-course" style={{ maxWidth: 280 }} onClick={() => openAcademy(d.myMentorId)}>
            <div className="sk-course-cover" style={{ background: 'var(--grad)' }}><OnyxIcon name="graduation" size={30} /></div>
            <div className="sk-course-body">
              <div style={{ fontWeight: 700, fontSize: 15 }}>{d.myAcademyName || 'Onyx Academy'}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{L('Entrar como mentor →', 'Enter as mentor →')}</div>
            </div>
          </button>
        </div>
      )}

      {(d.academies || []).length > 0 && (
        <div>
          <div className="sk-sec-title">{L('Academias en las que estoy', 'Academies I’m in')}</div>
          <div className="sk-grid-courses">{d.academies.map((a: any) => (
            <button key={a.mentor_id} className="sk-course" onClick={() => openAcademy(a.mentor_id)}>
              <div className="sk-course-cover" style={{ background: 'var(--grad)' }}><OnyxIcon name="graduation" size={30} /></div>
              <div className="sk-course-body">
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.academy_name}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.mentor_name}{a.tagline ? ' · ' + a.tagline : ''}</div>
              </div>
            </button>
          ))}</div>
        </div>
      )}
      {!d.isMentor && (d.academies || []).length === 0 && <div className="sk-card muted">{L('Todavía no estás en ninguna academia. Únete con un código o explora el directorio.', 'You are not in any academy yet. Join with a code or browse the directory.')}</div>}
    </div>
  );
}

// Hook de "cuenta regresiva" — devuelve un now que cambia cada segundo.
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!active) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [active]);
  return now;
}
function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function LiveBanner({ ev, lang }: { ev: any; lang: string }) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const now = useNow(true);
  if (!ev) return null;
  const start = new Date(ev.starts_at).getTime();
  const live = now >= start && ev.live;
  return (
    <div className={'sk-live' + (live ? ' on' : '')}>
      {live ? <span className="sk-dot" /> : <OnyxIcon name="calendar" size={18} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {live ? <span style={{ color: 'var(--red)' }}>● {L('EN VIVO AHORA', 'LIVE NOW')}</span> : L('Próxima clase en vivo', 'Next live class')}
          {' · '}{ev.title}
        </div>
        {!live && <div className="muted" style={{ fontSize: 12 }}>{L('Empieza en', 'Starts in')} <span className="sk-count" style={{ fontSize: 13 }}>{fmtCountdown(start - now)}</span></div>}
      </div>
      {ev.join_url && (live || start - now < 15 * 60000) && <a className="btn btn-primary" href={ev.join_url} target="_blank" rel="noreferrer">{L('Entrar', 'Join')}</a>}
    </div>
  );
}

// =================== Comunidad ===================
function Community({ active, lang, reload, onExit, toMentor }: any) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const es = lang !== 'en';
  const [tab, setTab] = useState<'community' | 'classroom' | 'calendar' | 'members' | 'leaderboard' | 'profile' | 'chat'>('community');
  const [openMod, setOpenMod] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [post, setPost] = useState('');
  const [viewUser, setViewUser] = useState<string | null>(null);
  const [dmWith, setDmWith] = useState<string | null>(null);

  const link = typeof window !== 'undefined' ? `${window.location.origin}/academia/${active.code}` : '';
  const totalLessons = (active.content || []).reduce((s: number, m: any) => s + m.lessons.length, 0);
  const doneCount = (active.progress || []).length;

  async function api(body: any) { await fetch('/api/academy', { method: 'POST', body: JSON.stringify(body) }); }
  async function sendPost() { if (!post.trim()) return; await api({ action: 'post', mentor_id: active.mentor_id, body: post }); setPost(''); reload(); }
  async function like(t: string, id: string) { await api({ action: 'like', mentor_id: active.mentor_id, target_type: t, target_id: id }); reload(); }
  async function comment(pid: string, body: string) { await api({ action: 'comment', post_id: pid, mentor_id: active.mentor_id, body }); reload(); }
  async function toggleLesson(l: any, done: boolean) { await api({ action: 'lesson', lesson_id: l.id, done }); reload(); }
  async function buy(productId: string) {
    const r = await fetch('/api/academy/checkout', { method: 'POST', body: JSON.stringify({ product_id: productId }) });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else alert(j.error === 'mentor_not_ready' ? L('El mentor aún no ha activado los cobros.', 'The mentor has not enabled payments yet.') : L('No se pudo iniciar el pago.', 'Could not start checkout.'));
  }
  function openProfile(uid: string) { setViewUser(uid); setTab('profile'); }
  function openDm(uid: string) { setDmWith(uid); setTab('chat'); }

  const TABS: [string, string, string][] = [
    ['community', 'chat', L('Comunidad', 'Community')],
    ['classroom', 'graduation', L('Aulas', 'Classroom')],
    ['calendar', 'calendar', L('Calendario', 'Calendar')],
    ['members', 'users', L('Miembros', 'Members')],
    ['leaderboard', 'trophy', L('Ranking', 'Leaderboard')],
  ];

  return (
    <div className="sk-wrap" style={{ paddingTop: 4 }}>
      <div className="sk-hero">
        <div className="sk-hero-cover" style={active.cover_url ? { backgroundImage: `url(${active.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
        <div className="sk-hero-body">
          <span className="sk-hero-logo"><OnyxIcon name="graduation" size={30} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
              <div><h2 style={{ margin: 0, fontSize: 22 }}>{active.academy_name}</h2>{active.tagline && <div className="muted" style={{ fontSize: 13 }}>{active.tagline}</div>}</div>
              <div className="row" style={{ gap: 6 }}>
                {active.isMentorHere && toMentor && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={toMentor}>{L('Configurar', 'Manage')}</button>}
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={onExit}>← {L('Mis academias', 'My academies')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sk-tabs big" style={{ marginTop: 14 }}>
        {TABS.map(([k, ic, lbl]) => (
          <button key={k} className={'sk-tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k as any); setOpenMod(null); setLesson(null); }}><OnyxIcon name={ic as any} size={16} /> {lbl}</button>
        ))}
      </div>

      {/* Banner de clase en vivo — visible en todos los tabs */}
      <LiveBanner ev={active.live} lang={lang} />

      {tab === 'profile' ? <ProfileView mentorId={active.mentor_id} userId={viewUser || active.myUserId} me={active.myUserId} lang={lang} onDm={openDm} onBack={() => setTab('members')} />
      : tab === 'chat' ? <ChatView mentorId={active.mentor_id} lang={lang} initialWith={dmWith} members={active.members || []} myUserId={active.myUserId} />
      : (
      <div className="sk-grid">
        <div>
          {tab === 'community' && (
            <>
              {totalLessons >= 0 && <OnboardingChecklist active={active} L={L} onGo={(t: any) => setTab(t)} />}
              <div className="sk-card">
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name="•" level={active.me?.level} size={40} />
                  <div style={{ flex: 1 }}>
                    <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={2} placeholder={L('Comparte algo con la comunidad…', 'Share something with the community…')} style={{ width: '100%', margin: 0 }} />
                    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><button className="btn btn-primary" onClick={sendPost} disabled={!post.trim()}>{L('Publicar', 'Post')}</button></div>
                  </div>
                </div>
              </div>
              {(active.feed || []).map((p: any) => <PostCard key={p.id} p={p} onLike={like} onComment={comment} onProfile={openProfile} L={L} es={es} />)}
              {(active.feed || []).length === 0 && <div className="sk-card muted">{L('Sé el primero en publicar en la comunidad.', 'Be the first to post in the community.')}</div>}
            </>
          )}

          {tab === 'classroom' && (
            lesson ? <LessonView lesson={lesson} course={openMod} done={(active.progress || []).includes(lesson.id)} progress={active.progress || []} onBack={() => setLesson(null)} onToggle={toggleLesson} onPick={setLesson} L={L} />
            : openMod ? <CourseView course={openMod} progress={active.progress || []} onBack={() => setOpenMod(null)} onPick={(l: any) => setLesson(l)} L={L} />
            : (
              <>
                {(active.products || []).length > 0 && !active.hasAccessAll && <Tiers products={active.products} purchases={active.purchases || []} onBuy={buy} L={L} />}
                {(active.content || []).length === 0
                  ? <div className="sk-card muted">{L('El mentor aún no ha publicado aulas.', 'The mentor has not published classrooms yet.')}</div>
                  : <div className="sk-grid-courses">
                    {(active.content || []).map((m: any) => {
                      const total = m.lessons.length; const done = m.lessons.filter((l: any) => (active.progress || []).includes(l.id)).length;
                      return (
                        <button key={m.id} className="sk-course" onClick={() => setOpenMod(m)}>
                          <div className="sk-course-cover" style={m.cover_url ? { backgroundImage: `url(${m.cover_url})` } : { background: 'var(--grad)' }}>
                            {!m.cover_url && <OnyxIcon name={m.locked ? 'guardian' : 'modules'} size={28} />}
                            {m.locked && <span className="sk-chip" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.5)', color: 'var(--gold)' }}><OnyxIcon name="guardian" size={11} /> {L('Bloqueado', 'Locked')}</span>}
                          </div>
                          <div className="sk-course-body">
                            <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{total} {L('lecciones', 'lessons')}</div>
                              </div>
                              {total > 0 && !m.locked && <Ring pct={total ? (done / total) * 100 : 0} size={42} />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>}
              </>
            )
          )}

          {tab === 'calendar' && <CalendarTab events={active.events || []} lang={lang} L={L} />}

          {tab === 'members' && (
            <div className="sk-grid-members">
              {(active.members || []).map((mem: any) => (
                <div key={mem.user_id} className="sk-member">
                  <Avatar name={mem.name} level={mem.level} size={44} onClick={() => openProfile(mem.user_id)} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => openProfile(mem.user_id)}>
                      {mem.name}{mem.is_mentor && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 18%,transparent)', color: 'var(--gold)' }}>{L('Mentor', 'Mentor')}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{L('Nivel', 'Level')} {mem.level} · {mem.points} {L('pts', 'pts')}</div>
                  </div>
                  {mem.user_id !== active.myUserId && <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openDm(mem.user_id)}><OnyxIcon name="chat" size={14} /></button>}
                </div>
              ))}
            </div>
          )}

          {tab === 'leaderboard' && <Leaderboard mentorId={active.mentor_id} initial={active.leaderboard || []} L={L} />}
        </div>

        <div className="sk-side">
          <div className="sk-side-card">
            <div style={{ fontWeight: 800, fontSize: 16 }}>{active.academy_name}</div>
            {active.about && <p className="muted" style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{active.about}</p>}
            <div className="row" style={{ gap: 16, margin: '12px 0', textAlign: 'center' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18 }}>{active.membersCount ?? (active.members || []).length}</div><div className="muted" style={{ fontSize: 11 }}>{L('Miembros', 'Members')}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18 }}>{(active.content || []).length}</div><div className="muted" style={{ fontSize: 11 }}>{L('Aulas', 'Classrooms')}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>{active.me?.level ?? 1}</div><div className="muted" style={{ fontSize: 11 }}>{L('Tu nivel', 'Your level')}</div></div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { navigator.clipboard.writeText(link); alert(L('Enlace de invitación copiado.', 'Invite link copied.')); }}><OnyxIcon emoji="🔗" size={14} /> {L('Invitar', 'Invite')}</button>
          </div>
          {totalLessons > 0 && (
            <div className="sk-side-card">
              <div className="row between" style={{ fontSize: 13, marginBottom: 8 }}><b>{L('Tu progreso', 'Your progress')}</b><span className="muted">{doneCount}/{totalLessons}</span></div>
              <div className="statbar" style={{ ['--ac' as any]: 'var(--green)' }}><i style={{ width: (totalLessons ? (doneCount / totalLessons) * 100 : 0) + '%' }} /></div>
            </div>
          )}
          <div className="sk-side-card">
            <div className="row between" style={{ marginBottom: 6 }}><b style={{ fontSize: 14 }}>{L('Ranking', 'Leaderboard')}</b><OnyxIcon name="trophy" size={15} /></div>
            {(active.leaderboard || []).length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>{L('Aún sin actividad. ¡Da likes y publica para sumar puntos!', 'No activity yet. Like and post to earn points!')}</div>}
            {(active.leaderboard || []).slice(0, 5).map((r: any) => (
              <div key={r.user_id} className="sk-board-row">
                <span className="sk-rank" style={r.rank <= 3 ? { color: 'var(--gold)' } : undefined}>{r.rank}</span>
                <Avatar name={r.name} level={r.level} size={30} onClick={() => openProfile(r.user_id)} />
                <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <b style={{ fontSize: 12.5 }}>{r.points}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Barra inferior tipo app (móvil) */}
      <div className="sk-bottom">
        <button className={'sk-bnav' + (['community', 'classroom', 'calendar', 'members', 'leaderboard'].includes(tab) ? ' on' : '')} onClick={() => setTab('community')}><OnyxIcon name="chat" size={20} /> {L('Inicio', 'Home')}</button>
        <button className={'sk-bnav' + (tab === 'chat' ? ' on' : '')} onClick={() => { setDmWith(null); setTab('chat'); }}><OnyxIcon name="mail" size={20} />{active.dmUnread > 0 && <span className="sk-bdot">{active.dmUnread}</span>} {L('Chat', 'Chat')}</button>
        <button className="sk-bnav" onClick={() => setTab('leaderboard')}><OnyxIcon name="trophy" size={20} /> {L('Ranking', 'Rank')}</button>
        <button className={'sk-bnav' + (tab === 'profile' ? ' on' : '')} onClick={() => { setViewUser(active.myUserId); setTab('profile'); }}><OnyxIcon name="users" size={20} /> {L('Perfil', 'Profile')}</button>
      </div>
    </div>
  );
}

function OnboardingChecklist({ active, L, onGo }: any) {
  const [hide, setHide] = useState(false);
  const watched = (active.progress || []).length > 0;
  const items = [
    [L('Mira la lección de bienvenida', 'Watch the welcome lesson'), watched, () => onGo('classroom')],
    [L('Encuentra un post y comenta', 'Find a post and comment'), false, () => onGo('community')],
    [L('Preséntate a la comunidad', 'Introduce yourself'), false, () => onGo('community')],
  ] as [string, boolean, () => void][];
  if (hide) return null;
  return (
    <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--brand) 40%,transparent)' }}>
      <div className="row between" style={{ marginBottom: 8 }}><b>{L('¡Bienvenido! Empieza aquí', 'Welcome! Start here')}</b><button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setHide(true)}>{L('Ocultar', 'Dismiss')}</button></div>
      {items.map(([lbl, done, go], i) => (
        <button key={i} className="row" style={{ gap: 10, alignItems: 'center', width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '6px 0' }} onClick={go}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid ' + (done ? 'var(--green)' : 'var(--mut)'), color: 'var(--green)', display: 'grid', placeItems: 'center', fontSize: 12 }}>{done ? '✓' : ''}</span>
          <span style={{ fontSize: 13.5, color: 'var(--soft-brand)' }}>{lbl}</span>
        </button>
      ))}
    </div>
  );
}

// Calendario en cuadrícula (vista de mes) con las clases/eventos marcados.
function MonthCalendar({ events, lang }: any) {
  const now = useNow(true);
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const first = new Date(cur.y, cur.m, 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const todayKey = new Date().toDateString();
  const byDay: Record<string, any[]> = {};
  (events || []).forEach((e: any) => { const k = new Date(e.starts_at).toDateString(); (byDay[k] ||= []).push(e); });
  Object.values(byDay).forEach((arr) => arr.sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at)));
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) { const n = i - startOffset + 1; cells.push({ date: new Date(cur.y, cur.m, n), inMonth: n >= 1 && n <= daysInMonth }); }
  const monthLabel = first.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });
  const dows = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
  function shift(n: number) { let m = cur.m + n, y = cur.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setCur({ y, m }); }
  return (
    <div className="sk-card">
      <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => shift(-1)}>←</button>
        <b style={{ textTransform: 'capitalize', fontSize: 15 }}>{monthLabel}</b>
        <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => shift(1)}>→</button>
      </div>
      <div className="sk-cal-head">{dows.map((d) => <div key={d} className="sk-cal-dow">{d}</div>)}</div>
      <div className="sk-cal-grid">
        {cells.map((c, i) => {
          const key = c.date.toDateString(); const evs = byDay[key] || []; const isToday = key === todayKey;
          return (
            <div key={i} className={'sk-cal-cell' + (c.inMonth ? '' : ' dim') + (isToday ? ' today' : '')}>
              <div className="sk-cal-day">{c.date.getDate()}</div>
              {evs.slice(0, 3).map((e: any) => {
                const start = new Date(e.starts_at).getTime(); const end = start + (e.duration_min || 60) * 60000; const live = now >= start && now < end;
                return <div key={e.id} className={'sk-cal-ev' + (live ? ' live' : '')} title={`${hhmm(e.starts_at)} · ${e.title}`} onClick={() => e.join_url && window.open(e.join_url, '_blank')}>{live ? '● ' : ''}{hhmm(e.starts_at)} {e.title}</div>;
              })}
              {evs.length > 3 && <div className="muted" style={{ fontSize: 10 }}>+{evs.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarTab({ events, lang, L }: any) {
  const now = useNow(true);
  const upcoming = (events || []).filter((e: any) => new Date(e.starts_at).getTime() + (e.duration_min || 60) * 60000 > now);
  const past = (events || []).filter((e: any) => new Date(e.starts_at).getTime() + (e.duration_min || 60) * 60000 <= now);
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const Row = (e: any) => {
    const start = new Date(e.starts_at).getTime(); const end = start + (e.duration_min || 60) * 60000; const live = now >= start && now < end;
    return (
      <div key={e.id} className="sk-card" style={{ margin: 0 }}>
        <div className="row between" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{live && <span className="sk-dot" />}{e.title}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{fmt(e.starts_at)} · {e.duration_min} min</div>
            {e.description && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{e.description}</div>}
          </div>
          {e.join_url && (live || start - now < 15 * 60000) ? <a className="btn btn-primary" href={e.join_url} target="_blank" rel="noreferrer">{live ? L('Entrar EN VIVO', 'Join LIVE') : L('Entrar', 'Join')}</a>
            : <span className="sk-chip">{fmtCountdown(start - now)}</span>}
        </div>
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MonthCalendar events={events} lang={lang} />
      <div className="sk-sec-title">{L('Próximas clases en vivo', 'Upcoming live classes')}</div>
      {upcoming.length === 0 && <div className="sk-card muted">{L('No hay clases programadas por ahora.', 'No classes scheduled right now.')}</div>}
      {upcoming.map(Row)}
      {past.length > 0 && <><div className="sk-sec-title">{L('Anteriores', 'Past')}</div>{past.slice(0, 10).map(Row)}</>}
    </div>
  );
}

function CourseView({ course, progress, onBack, onPick, L }: any) {
  // Agrupa lecciones por sección.
  const groups: Record<string, any[]> = {};
  const order: string[] = [];
  (course.lessons || []).forEach((l: any) => { const s = l.section || L('Lecciones', 'Lessons'); if (!groups[s]) { groups[s] = []; order.push(s); } groups[s].push(l); });
  const total = course.lessons.length; const done = course.lessons.filter((l: any) => progress.includes(l.id)).length;
  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Aulas', 'Classroom')}</button>
      <div className="sk-card">
        {course.cover_url && <div className="sk-course-cover" style={{ backgroundImage: `url(${course.cover_url})`, borderRadius: 12, marginBottom: 12 }} />}
        <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{course.title}</h3>
          <Ring pct={total ? (done / total) * 100 : 0} size={46} />
        </div>
        {course.description && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{course.description}</p>}
        {order.map((sec) => (
          <div key={sec}>
            <div className="sk-sec-title">{sec}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups[sec].map((l: any) => { const isDone = progress.includes(l.id); const open = !course.locked || l.is_free; return (
                <button key={l.id} onClick={() => open && onPick(l)} disabled={!open} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', textAlign: 'left', cursor: open ? 'pointer' : 'not-allowed', opacity: open ? 1 : .6 }}>
                  <span style={{ color: !open ? 'var(--gold)' : isDone ? 'var(--green)' : 'var(--mut)', display: 'inline-flex' }}>{!open ? <OnyxIcon name="guardian" size={14} /> : isDone ? '✓' : '○'}</span>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{l.title}</span>
                  {l.is_free && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>{L('gratis', 'free')}</span>}
                  {l.video_url && open && <OnyxIcon emoji="🎬" size={14} />}
                </button>
              ); })}
            </div>
          </div>
        ))}
        {total === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{L('Sin lecciones todavía.', 'No lessons yet.')}</span>}
      </div>
    </div>
  );
}

function LessonView({ lesson, course, done, progress, onBack, onToggle, onPick, L }: any) {
  const emb = embed(lesson.video_url || '');
  const list = (course?.lessons || []).filter((l: any) => !course.locked || l.is_free);
  return (
    <div className="sk-grid" style={{ gridTemplateColumns: '1fr 260px' }}>
      <div className="sk-card">
        <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Volver', 'Back')}</button>
        <h3 style={{ marginBottom: 12 }}>{lesson.title}</h3>
        {lesson.video_url && (emb
          ? <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}><iframe src={emb} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
          : <video src={lesson.video_url} controls style={{ width: '100%', borderRadius: 12, marginBottom: 12 }} />)}
        {lesson.content && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{lesson.content}</div>}
        {(lesson.resources || []).length > 0 && <div style={{ marginBottom: 12 }}>{lesson.resources.map((r: any, i: number) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="sk-chip" style={{ marginRight: 8 }}>📎 {r.label || r.url}</a>)}</div>}
        <button className={'btn ' + (done ? 'btn-ghost' : 'btn-primary')} onClick={() => onToggle(lesson, !done)}>{done ? '✓ ' + L('Completada', 'Completed') : L('Marcar como completada', 'Mark as completed')}</button>
      </div>
      <div className="sk-side">
        <div className="sk-side-card">
          <b style={{ fontSize: 13.5 }}>{course?.title}</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {list.map((l: any) => { const isDone = (progress || []).includes(l.id); const cur = l.id === lesson.id; return (
              <button key={l.id} onClick={() => onPick(l)} style={{ display: 'flex', gap: 8, alignItems: 'center', background: cur ? 'var(--bg2)' : 'none', border: 'none', borderRadius: 8, padding: '7px 8px', textAlign: 'left', cursor: 'pointer', fontSize: 12.5, color: cur ? 'var(--tx)' : 'var(--mut)' }}>
                <span style={{ color: isDone ? 'var(--green)' : 'var(--mut)' }}>{isDone ? '✓' : '○'}</span> {l.title}
              </button>
            ); })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileView({ mentorId, userId, me, lang, onDm, onBack }: any) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [p, setP] = useState<any>(null);
  function reloadP() { fetch(`/api/academy/profile?m=${mentorId}&u=${userId}`).then((r) => r.json()).then((j) => setP(j.profile)); }
  useEffect(() => { setP(null); reloadP(); }, [mentorId, userId]);
  async function toggleShare(on: boolean) { await fetch('/api/academy/profile', { method: 'POST', body: JSON.stringify({ share: on }) }); reloadP(); }
  if (!p) return <div className="sk-card muted">…</div>;
  const v = p.verified || {};
  const isSelf = userId === me;
  const lv = p.level;
  // Mapa de actividad: últimas 18 semanas.
  const cells: { key: string; n: number }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startDow = (today.getDay() + 6) % 7; // lunes=0
  const daysBack = 17 * 7 + startDow;
  for (let i = daysBack; i >= 0; i--) { const dt = new Date(today.getTime() - i * 864e5); const key = dt.toISOString().slice(0, 10); cells.push({ key, n: p.activity?.[key] || 0 }); }
  const shade = (n: number) => n === 0 ? 'color-mix(in srgb,var(--mut) 18%,transparent)' : n === 1 ? 'color-mix(in srgb,var(--green) 40%,transparent)' : n <= 3 ? 'color-mix(in srgb,var(--green) 65%,transparent)' : 'var(--green)';
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Miembros', 'Members')}</button>
      <div className="sk-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={p.name} size={84} />
            <span className="sk-lvl" style={{ width: 26, height: 26, fontSize: 13, right: 0, bottom: 0 }}>{lv.level}</span>
          </div>
          <div><div style={{ fontWeight: 800, fontSize: 20 }}>{p.name}</div><div style={{ color: 'var(--brand)', fontWeight: 700 }}>{L('Nivel', 'Level')} {lv.level}</div></div>
          {lv.next != null && <div className="muted" style={{ fontSize: 13 }}>{lv.next - p.points} {L('puntos para subir', 'points to level up')}</div>}
          {userId !== me && <button className="btn btn-primary" onClick={() => onDm(userId)}><OnyxIcon name="chat" size={14} /> {L('Enviar mensaje', 'Message')}</button>}
        </div>
        <div className="row" style={{ gap: 16, margin: '16px 0 0', textAlign: 'center', justifyContent: 'center' }}>
          <div><div style={{ fontWeight: 800, fontSize: 18 }}>{p.contributions}</div><div className="muted" style={{ fontSize: 11 }}>{L('Contribuciones', 'Contributions')}</div></div>
          <div><div style={{ fontWeight: 800, fontSize: 18 }}>{p.points}</div><div className="muted" style={{ fontSize: 11 }}>{L('Puntos', 'Points')}</div></div>
        </div>
      </div>
      {/* Trader verificado — track record real (opt-in, sin promesas) */}
      {(v.hasData || isSelf) && (
        <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--green) 35%,transparent)' }}>
          <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
            <b style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--green)', display: 'inline-flex' }}><OnyxIcon name="guardian" size={16} /></span> {L('Trader verificado', 'Verified trader')}</b>
            {v.hasData && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Verificado por Onyx', 'Verified by Onyx')}</span>}
          </div>
          {v.hasData ? (
            <>
              <div className="row" style={{ gap: 16, textAlign: 'center', justifyContent: 'space-around' }}>
                <div><div style={{ fontWeight: 800, fontSize: 18 }}>{v.winRate}%</div><div className="muted" style={{ fontSize: 11 }}>{L('Aciertos', 'Win rate')}</div></div>
                <div><div style={{ fontWeight: 800, fontSize: 18 }}>{v.profitFactor}</div><div className="muted" style={{ fontSize: 11 }}>{L('Profit factor', 'Profit factor')}</div></div>
                <div><div style={{ fontWeight: 800, fontSize: 18 }}>{v.trades}</div><div className="muted" style={{ fontSize: 11 }}>{L('Operaciones', 'Trades')}</div></div>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 10, textAlign: 'center' }}>{L(`Rendimiento histórico real de los últimos ${v.days} días. No es una promesa de resultados futuros.`, `Real historical performance over the last ${v.days} days. Not a promise of future results.`)}</div>
            </>
          ) : isSelf ? (
            <p className="muted" style={{ fontSize: 13 }}>{v.shared ? L('Aún no tienes suficientes operaciones registradas para mostrar tu track record.', 'You don’t have enough recorded trades yet to show your track record.') : L('Activa esto para mostrar tu track record real (aciertos, profit factor y nº de operaciones) en tu perfil de la comunidad.', 'Turn this on to show your real track record (win rate, profit factor and trades) on your community profile.')}</p>
          ) : null}
          {isSelf && (
            <label className="row" style={{ gap: 8, fontSize: 13, marginTop: 10 }}>
              <input type="checkbox" checked={!!v.shared} onChange={(e) => toggleShare(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
              {L('Mostrar mi track record verificado a la comunidad', 'Show my verified track record to the community')}
            </label>
          )}
        </div>
      )}

      <div className="sk-card">
        <div className="sk-sec-title" style={{ marginTop: 0 }}>{L('Actividad', 'Activity')}</div>
        <div className="sk-heat">{cells.map((c) => <i key={c.key} title={c.key} style={{ background: shade(c.n) }} />)}</div>
      </div>
    </div>
  );
}

function ChatView({ mentorId, lang, initialWith, members, myUserId }: any) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [threads, setThreads] = useState<any[]>([]);
  const [withId, setWithId] = useState<string | null>(initialWith || null);
  const [conv, setConv] = useState<any>(null);
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);

  async function loadThreads() { const r = await fetch(`/api/academy/dm?m=${mentorId}`); const j = await r.json(); setThreads(j.threads || []); }
  async function loadConv(uid: string) { const r = await fetch(`/api/academy/dm?m=${mentorId}&with=${uid}`); const j = await r.json(); setConv(j); }
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { if (withId) loadConv(withId); }, [withId]);
  useEffect(() => { if (!withId) return; const t = setInterval(() => loadConv(withId), 5000); return () => clearInterval(t); }, [withId]);

  async function send() {
    if (!text.trim() || !withId) return;
    await fetch('/api/academy/dm', { method: 'POST', body: JSON.stringify({ m: mentorId, to: withId, body: text }) });
    setText(''); loadConv(withId); loadThreads();
  }
  const others = (members || []).filter((mem: any) => mem.user_id !== myUserId);

  if (withId && conv) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={() => { setWithId(null); setConv(null); loadThreads(); }}>← {L('Mensajes', 'Messages')}</button>
        <div className="sk-card">
          <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}><Avatar name={conv.name} size={38} /><b>{conv.name}</b></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto', marginBottom: 12 }}>
            {(conv.messages || []).map((msg: any) => {
              const mine = msg.from_id === myUserId;
              return <div key={msg.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%', background: mine ? 'var(--brand)' : 'var(--bg2)', color: mine ? '#111726' : 'var(--tx)', padding: '8px 12px', borderRadius: 12, fontSize: 14 }}>{msg.body}</div>;
            })}
            {(conv.messages || []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('Escribe el primer mensaje.', 'Write the first message.')}</div>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Mensaje…', 'Message…')} style={{ margin: 0, flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="btn btn-primary" onClick={send}>{L('Enviar', 'Send')}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>{L('Mensajes', 'Messages')}</h3><button className="btn btn-primary" onClick={() => setPicking((v) => !v)}>＋ {L('Nuevo', 'New')}</button></div>
      {picking && (
        <div className="sk-card" style={{ marginBottom: 12 }}>
          <div className="sk-sec-title" style={{ marginTop: 0 }}>{L('Escribir a…', 'Message…')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
            {others.map((mem: any) => <button key={mem.user_id} className="row" style={{ gap: 10, alignItems: 'center', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '6px 4px' }} onClick={() => { setPicking(false); setWithId(mem.user_id); }}><Avatar name={mem.name} level={mem.level} size={32} /> {mem.name}</button>)}
          </div>
        </div>
      )}
      {threads.length === 0 && !picking && <div className="sk-card muted">{L('No tienes conversaciones. Toca «Nuevo» para escribir a un miembro.', 'No conversations yet. Tap “New” to message a member.')}</div>}
      {threads.map((t: any) => (
        <button key={t.user_id} className="sk-card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', margin: '0 0 10px' }} onClick={() => setWithId(t.user_id)}>
          <Avatar name={t.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{t.name}</div><div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last}</div></div>
          {t.unread > 0 && <span className="sk-bdot" style={{ position: 'static' }}>{t.unread}</span>}
        </button>
      ))}
    </div>
  );
}

function PostCard({ p, onLike, onComment, onProfile, L, es }: any) {
  const [c, setC] = useState(''); const [openC, setOpenC] = useState(false);
  return (
    <div className="sk-card">
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <Avatar name={p.author_name} level={p.author_level} size={38} onClick={() => onProfile(p.author_id)} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }} onClick={() => onProfile(p.author_id)}>{p.author_name}</div><div className="muted" style={{ fontSize: 11.5 }}>{timeAgo(p.created_at, es)}</div></div>
        {p.pinned && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>📌 {L('fijado', 'pinned')}</span>}
      </div>
      <div style={{ fontSize: 14.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{p.body}</div>
      <div className="sk-post-actions">
        <button className={'sk-like' + (p.liked ? ' on' : '')} onClick={() => onLike('post', p.id)}><OnyxIcon name="heart" size={15} glow={false} /> {p.likes || 0}</button>
        <button className="sk-like" onClick={() => setOpenC((v) => !v)}><OnyxIcon name="chat" size={15} glow={false} /> {(p.comments || []).length}</button>
      </div>
      {(openC || (p.comments || []).length > 0) && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(p.comments || []).map((c2: any) => (
            <div key={c2.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <Avatar name={c2.author_name} level={c2.author_level} size={28} onClick={() => onProfile(c2.author_id)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}><b style={{ fontSize: 12.5 }}>{c2.author_name}</b> {c2.body}</div>
                <button className={'sk-like' + (c2.liked ? ' on' : '')} style={{ fontSize: 11.5, padding: '2px 4px' }} onClick={() => onLike('comment', c2.id)}><OnyxIcon name="heart" size={12} glow={false} /> {c2.likes || 0}</button>
              </div>
            </div>
          ))}
          <div className="row" style={{ gap: 8 }}>
            <input value={c} onChange={(e) => setC(e.target.value)} placeholder={L('Comentar…', 'Comment…')} style={{ margin: 0, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter' && c.trim()) { onComment(p.id, c); setC(''); } }} />
            <button className="btn btn-ghost" onClick={() => { if (c.trim()) { onComment(p.id, c); setC(''); } }}>{L('Enviar', 'Send')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ mentorId, initial, L }: any) {
  const [range, setRange] = useState<'7d' | '30d' | 'all' | 'traders'>('all');
  const [rows, setRows] = useState<any[]>(initial); const [loading, setLoading] = useState(false);
  async function pick(r: '7d' | '30d' | 'all' | 'traders') {
    setRange(r); setLoading(true);
    const res = await fetch(`/api/academy?m=${mentorId}&board=${r}`); const j = await res.json();
    setRows(r === 'traders' ? (j.traders || []) : (j.leaderboard || [])); setLoading(false);
  }
  const isTraders = range === 'traders';
  return (
    <div className="sk-card">
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <b style={{ fontSize: 15 }}>{isTraders ? L('Traders verificados', 'Verified traders') : L('Ranking de la comunidad', 'Community leaderboard')}</b>
        <div className="sk-seg">
          {(['7d', '30d', 'all'] as const).map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => pick(r)}>{r === 'all' ? L('Total', 'All-time') : r}</button>)}
          <button className={isTraders ? 'on' : ''} onClick={() => pick('traders')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><OnyxIcon name="guardian" size={12} glow={false} /> {L('Traders', 'Traders')}</button>
        </div>
      </div>
      {loading && <div className="muted" style={{ fontSize: 13 }}>…</div>}
      {!loading && rows.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{isTraders ? L('Aún no hay traders que compartan su track record verificado.', 'No traders sharing a verified track record yet.') : L('Todavía nadie ha sumado puntos en este periodo.', 'Nobody has earned points in this period yet.')}</div>}
      {!loading && !isTraders && rows.map((r: any) => (
        <div key={r.user_id} className="sk-board-row" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="sk-rank" style={r.rank <= 3 ? { color: 'var(--gold)', fontSize: 15 } : undefined}>{r.rank}</span>
          <Avatar name={r.name} level={r.level} size={34} />
          <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
          <b>{r.points} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{L('pts', 'pts')}</span></b>
        </div>
      ))}
      {!loading && isTraders && rows.map((r: any) => (
        <div key={r.user_id} className="sk-board-row" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="sk-rank" style={r.rank <= 3 ? { color: 'var(--gold)', fontSize: 15 } : undefined}>{r.rank}</span>
          <Avatar name={r.name} size={34} />
          <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
          <span className="muted" style={{ fontSize: 12.5 }}>{r.winRate}% · PF {r.profitFactor} · {r.trades} ops</span>
        </div>
      ))}
      {!loading && isTraders && rows.length > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{L('Rendimiento histórico real (90 días). No es promesa de resultados.', 'Real historical performance (90 days). Not a promise of results.')}</div>}
    </div>
  );
}

function priceLabel(p: any, L: (a: string, b: string) => string) {
  const amount = (p.price_cents / 100).toLocaleString(undefined, { minimumFractionDigits: p.price_cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const cur = (p.currency || 'usd').toUpperCase(); const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '';
  const base = sym ? sym + amount : amount + ' ' + cur;
  if (p.kind === 'one_time') return base + ' · ' + L('pago único', 'one-time');
  return base + '/' + (p.interval === 'year' ? L('año', 'yr') : L('mes', 'mo'));
}

function Tiers({ products, purchases, onBuy, L }: any) {
  const ownedIds = new Set((purchases || []).map((x: any) => x.product_id));
  return (
    <div className="sk-card" style={{ border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)', marginBottom: 12 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><span style={{ color: 'var(--gold)', display: 'inline-flex' }}><OnyxIcon name="gem" size={18} /></span> {L('Desbloquea más con estos niveles', 'Unlock more with these tiers')}</h3>
      <div className="sk-grid-courses">
        {products.map((p: any) => {
          const owned = ownedIds.has(p.id);
          return (
            <div key={p.id} className="sk-card" style={{ margin: 0, background: 'var(--bg2)' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              {p.description && <div className="muted" style={{ fontSize: 12.5, margin: '4px 0 8px' }}>{p.description}</div>}
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)', marginBottom: 8 }}>{priceLabel(p, L)}</div>
              {(p.perks?.copy || p.perks?.guardian) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                  {p.perks?.copy && <span style={{ fontSize: 12, color: 'var(--soft-green)' }}>✓ {L('Copy trading del mentor', 'Mentor copy trading')}</span>}
                  {p.perks?.guardian && <span style={{ fontSize: 12, color: 'var(--soft-green)' }}>✓ Onyx Guardian</span>}
                </div>
              )}
              {owned ? <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Ya lo tienes', 'You have it')}</span>
                : <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onBuy(p.id)}>{L('Desbloquear', 'Unlock')}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== Panel del mentor ===================
function MentorPanel({ lang, onClose, openStudent }: { lang: string; onClose: () => void; openStudent: (mid: string) => void }) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'cursos' | 'envivo' | 'cobros' | 'alumnos' | 'comunidad' | 'ajustes'>('cursos');
  const [newMod, setNewMod] = useState('');
  const [lessonForm, setLessonForm] = useState<any>(null);
  const [modForm, setModForm] = useState<any>(null);
  const [evForm, setEvForm] = useState<any>(null);
  const [post, setPost] = useState('');
  const [toast, setToast] = useState('');

  async function load() { const r = await fetch('/api/academy/mentor'); setD(await r.json()); }
  useEffect(() => { load(); }, []);
  async function api(body: any, done?: string) { await fetch('/api/academy/mentor', { method: 'POST', body: JSON.stringify(body) }); if (done) { setToast(done); setTimeout(() => setToast(''), 2200); } load(); }

  if (!d) return <div className="card muted">…</div>;
  if (d.error) return <div className="sk-card"><b>{L('Academia no disponible en tu plan', 'Academy not on your plan')}</b><p className="muted" style={{ marginTop: 6 }}>{L('El módulo Mentor está en el plan Mentor o como add-on.', 'The Mentor module is on the Mentor plan or as an add-on.')}</p></div>;

  const link = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/academy?join=${d.mentor.code}` : '';
  const empty = (d.content || []).length === 0;

  return (
    <div className="sk-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      {toast && <Toast msg={toast} />}
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div><h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={22} /></span> {d.mentor.academy_name}</h2><div className="muted" style={{ fontSize: 13 }}>{L('Panel del mentor · Onyx Academy', 'Mentor panel · Onyx Academy')}</div></div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-primary" onClick={() => openStudent(d.mentor.user_id)}>{L('Ver mi comunidad', 'View my community')}</button>
          <button className="btn btn-ghost" onClick={onClose}>← {L('Salir', 'Exit')}</button>
        </div>
      </div>

      {/* Wizard de configuración cuando la academia está vacía */}
      {empty && <SetupWizard d={d} L={L} api={api} setModForm={setModForm} setEvForm={setEvForm} goTab={setTab} />}

      <div className="sk-card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🔑 {L('Enlace de inscripción (compártelo con tus alumnos)', 'Enrollment link (share with your students)')}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input readOnly value={link} style={{ margin: 0, flex: 1, minWidth: 200 }} />
          <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(link); setToast(L('Copiado', 'Copied')); setTimeout(() => setToast(''), 1500); }}>{L('Copiar', 'Copy')}</button>
          <span className="sk-chip">{L('Código', 'Code')}: {d.mentor.code}</span>
        </div>
      </div>

      <div className="sk-tabs big">
        {([['cursos', 'graduation', L('Aulas', 'Classroom')], ['envivo', 'calendar', L('En vivo', 'Live')], ['cobros', 'coins', L('Cobros', 'Payments')], ['alumnos', 'users', L('Alumnos', 'Students')], ['comunidad', 'chat', L('Comunidad', 'Community')], ['ajustes', 'settings', L('Ajustes', 'Settings')]] as any[]).map(([k, ic, lbl]) => (
          <button key={k} className={'sk-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><OnyxIcon name={ic} size={16} /> {lbl}</button>
        ))}
      </div>

      {tab === 'cursos' && (<>
        <div className="sk-card">
          <div className="row" style={{ gap: 8 }}>
            <input value={newMod} onChange={(e) => setNewMod(e.target.value)} placeholder={L('Nombre del nuevo curso/aula', 'New course/classroom name')} style={{ margin: 0, flex: 1 }} />
            <button className="btn btn-primary" onClick={() => { if (newMod.trim()) { api({ action: 'module', title: newMod, position: (d.content?.length || 0) }, L('Aula creada', 'Classroom created')); setNewMod(''); } }}>＋ {L('Aula', 'Classroom')}</button>
          </div>
          <div className="row" style={{ marginTop: 8, alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>{L('¿Empezar rápido? Añade aulas de ejemplo con la plantilla Academia Onyx.', 'Want a quick start? Add sample classrooms with the Onyx Academy template.')}</span>
            <button className="btn btn-ghost" onClick={() => { if (confirm(L('Se añadirán aulas de ejemplo (Empieza aquí, Fundamentos, Estrategia) a tu academia. ¿Continuar?', 'Sample classrooms (Start here, Fundamentals, Strategy) will be added to your academy. Continue?'))) api({ action: 'template', force: true }, L('Plantilla aplicada', 'Template applied')); }}><OnyxIcon name="graduation" size={14} /> {L('Usar plantilla Academia Onyx', 'Use Onyx Academy template')}</button>
          </div>
        </div>
        {(d.content || []).map((m: any) => (
          <div key={m.id} className="sk-card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon name="modules" size={16} /></span> {m.title}</h3>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setModForm({ ...m })}>{L('Portada', 'Cover')}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setLessonForm({ module_id: m.id })}>＋ {L('Lección', 'Lesson')}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => confirm(L('¿Borrar aula?', 'Delete classroom?')) && api({ action: 'module_delete', id: m.id })}>✕</button>
              </div>
            </div>
            {m.cover_url && <div className="sk-course-cover" style={{ backgroundImage: `url(${m.cover_url})`, borderRadius: 10, marginBottom: 10 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {m.lessons.map((l: any) => (
                <div key={l.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                  <span>{l.section && <span className="muted" style={{ marginRight: 6 }}>[{l.section}]</span>}{l.title}{l.is_free && <span className="sk-chip" style={{ marginLeft: 6, background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>{L('gratis', 'free')}</span>}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setLessonForm({ ...l })}>✎</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => api({ action: 'lesson_delete', id: l.id })}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {modForm && <CoverForm form={modForm} setForm={setModForm} L={L} onSave={(f: any) => { api({ action: 'module', id: f.id, title: f.title, description: f.description, cover_url: f.cover_url }, L('Portada guardada', 'Cover saved')); setModForm(null); }} onCancel={() => setModForm(null)} />}
        {lessonForm && <LessonForm form={lessonForm} setForm={setLessonForm} L={L} onSave={(f: any) => { api({ action: 'lesson', ...f }, L('Lección guardada', 'Lesson saved')); setLessonForm(null); }} onCancel={() => setLessonForm(null)} />}
      </>)}

      {tab === 'envivo' && (<>
        <div className="sk-card">
          <div className="row between"><h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon name="calendar" size={16} /></span> {L('Clases en vivo', 'Live classes')}</h3><button className="btn btn-primary" onClick={() => setEvForm({ title: '', join_url: '', starts_at: '', duration_min: 60 })}>＋ {L('Programar', 'Schedule')}</button></div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{L('Programa tus sesiones Zoom/Meet. El alumno verá una cuenta regresiva fija y un aviso EN VIVO cuando empieces.', 'Schedule your Zoom/Meet sessions. Students see a fixed countdown and a LIVE banner when you start.')}</p>
        </div>
        {(d.events || []).length > 0 && <MonthCalendar events={d.events} lang={lang} />}
        {(d.events || []).map((e: any) => (
          <div key={e.id} className="sk-card">
            <div className="row between" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div><b>{e.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{new Date(e.starts_at).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES')} · {e.duration_min} min</div></div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEvForm({ ...e, starts_at: e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 16) : '' })}>✎</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => api({ action: 'event_delete', id: e.id })}>✕</button>
              </div>
            </div>
          </div>
        ))}
        {(d.events || []).length === 0 && <div className="sk-card muted">{L('Aún no has programado clases.', 'No classes scheduled yet.')}</div>}
        {evForm && <EventForm form={evForm} setForm={setEvForm} L={L} onSave={(f: any) => { api({ action: 'event', ...f }, L('Clase programada', 'Class scheduled')); setEvForm(null); }} onCancel={() => setEvForm(null)} />}
      </>)}

      {tab === 'cobros' && <MentorPayments modules={d.content || []} L={L} />}

      {tab === 'alumnos' && (
        <div className="sk-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon name="users" size={16} /></span> {L('Alumnos', 'Students')} · {d.roster.students.length}</h3>
          {d.roster.students.length === 0 ? <p className="muted">{L('Comparte tu enlace para que se inscriban.', 'Share your link so they enroll.')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.roster.students.map((s: any) => (<div key={s.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}><span>{s.name}</span><span className="muted" style={{ fontSize: 12 }}>{L('progreso', 'progress')} {s.done}/{d.roster.totalLessons}</span></div>))}
            </div>
          )}
        </div>
      )}

      {tab === 'comunidad' && (<>
        <div className="sk-card">
          <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={2} placeholder={L('Publica un anuncio para tus alumnos…', 'Post an announcement for your students…')} style={{ width: '100%', margin: 0 }} />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => { if (post.trim()) { api({ action: 'post', body: post, pinned: true }); setPost(''); } }}>📌 {L('Fijar', 'Pin')}</button>
            <button className="btn btn-primary" onClick={() => { if (post.trim()) { api({ action: 'post', body: post }); setPost(''); } }}>{L('Publicar', 'Post')}</button>
          </div>
        </div>
        {(d.feed || []).map((p: any) => (
          <div key={p.id} className="sk-card">
            <div className="row between"><b style={{ fontSize: 13.5 }}>{p.author_name}{p.pinned && ' 📌'}</b><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => api({ action: 'post_delete', id: p.id })}>✕</button></div>
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', marginTop: 4 }}>{p.body}</div>
          </div>
        ))}
      </>)}

      {tab === 'ajustes' && <MentorSettings mentor={d.mentor} L={L} onSave={(b: any) => api({ action: 'settings', ...b }, L('Ajustes guardados', 'Settings saved'))} />}
    </div>
  );
}

function SetupWizard({ d, L, api, setModForm, setEvForm, goTab }: any) {
  const hasContent = (d.content || []).length > 0;
  const hasCover = !!d.mentor.cover_url;
  const hasTier = false; // no lo sabemos aquí; se anima igual
  const steps = [
    { done: hasContent, label: L('Usa la plantilla Academia Onyx (crea aulas base)', 'Use the Onyx Academy template (creates starter classrooms)'), action: () => api({ action: 'template' }, L('¡Plantilla aplicada! Tu academia ya tiene aulas.', 'Template applied! Your academy now has classrooms.')) },
    { done: hasCover, label: L('Sube la portada de tu comunidad (Ajustes)', 'Upload your community cover (Settings)'), action: () => goTab('ajustes') },
    { done: false, label: L('Programa tu primera clase en vivo', 'Schedule your first live class'), action: () => { goTab('envivo'); setEvForm({ title: '', join_url: '', starts_at: '', duration_min: 60 }); } },
    { done: false, label: L('Crea tu nivel de pago y conecta Stripe (Cobros)', 'Create your paid tier and connect Stripe (Payments)'), action: () => goTab('cobros') },
  ];
  return (
    <div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={18} /></span> {L('Configura tu academia en 4 pasos', 'Set up your academy in 4 steps')}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Empieza con la plantilla y en minutos tendrás tu academia lista.', 'Start with the template and your academy will be ready in minutes.')}</p>
      {steps.map((s: any, i: number) => (
        <div key={i} className={'sk-wizard-step' + (s.done ? ' done' : (i === steps.findIndex((x: any) => !x.done) ? ' active' : ''))}>
          <span className="sk-wizard-num">{s.done ? '✓' : i + 1}</span>
          <span style={{ flex: 1, fontSize: 13.5 }}>{s.label}</span>
          {!s.done && <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={s.action}>{i === 0 ? L('Aplicar', 'Apply') : L('Ir', 'Go')}</button>}
        </div>
      ))}
    </div>
  );
}

function EventForm({ form, setForm, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  return (
    <div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{form.id ? L('Editar clase', 'Edit class') : L('Programar clase en vivo', 'Schedule live class')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder={L('Título', 'Title')} style={{ margin: 0 }} />
        <input value={form.join_url || ''} onChange={(e) => set('join_url', e.target.value)} placeholder={L('Link de Zoom/Meet', 'Zoom/Meet link')} style={{ margin: 0 }} />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div><span className="muted" style={{ fontSize: 12 }}>{L('Fecha y hora', 'Date & time')}</span><input type="datetime-local" value={form.starts_at || ''} onChange={(e) => set('starts_at', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
          <div><span className="muted" style={{ fontSize: 12 }}>{L('Duración (min)', 'Duration (min)')}</span><input type="number" value={form.duration_min ?? 60} onChange={(e) => set('duration_min', Number(e.target.value))} style={{ margin: '4px 0 0', width: 100 }} /></div>
        </div>
        <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={2} placeholder={L('Descripción (opcional)', 'Description (optional)')} style={{ width: '100%', margin: 0 }} />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.title || !form.starts_at}>{L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div>
  );
}

function CoverForm({ form, setForm, onSave, onCancel, L }: any) {
  return (
    <div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{L('Portada del aula', 'Classroom cover')} · {form.title}</h3>
      <ImageUpload value={form.cover_url || ''} onChange={(v: string) => setForm({ ...form, cover_url: v })} L={L} label={L('Miniatura del curso (sube una imagen)', 'Course thumbnail (upload an image)')} />
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)}>{L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div>
  );
}

function LessonForm({ form, setForm, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  return (
    <div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{form.id ? L('Editar lección', 'Edit lesson') : L('Nueva lección', 'New lesson')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder={L('Título de la lección', 'Lesson title')} style={{ margin: 0 }} />
        <input value={form.section || ''} onChange={(e) => set('section', e.target.value)} placeholder={L('Sección/tema (ej: Fundamentos) — opcional', 'Section/topic (e.g. Fundamentals) — optional')} style={{ margin: 0 }} />
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
  const [f, setF] = useState({ academy_name: mentor.academy_name, tagline: mentor.tagline || '', about: mentor.about || '', cover_url: mentor.cover_url || '' });
  return (
    <div className="sk-card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon name="settings" size={16} /></span> {L('Ajustes de la academia', 'Academy settings')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Nombre', 'Name')}</span><input value={f.academy_name} onChange={(e) => setF({ ...f, academy_name: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Lema', 'Tagline')}</span><input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <ImageUpload value={f.cover_url} onChange={(v: string) => setF({ ...f, cover_url: v })} L={L} label={L('Portada de la comunidad', 'Community cover')} />
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Sobre la academia', 'About')}</span><textarea value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} rows={3} style={{ width: '100%', margin: '4px 0 0' }} /></div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onSave(f)}>{L('Guardar', 'Save')}</button>
    </div>
  );
}

// =================== Cobros del mentor ===================
function MentorPayments({ modules, L }: { modules: any[]; L: (a: string, b: string) => string }) {
  const [conn, setConn] = useState<any>(null);
  const [prods, setProds] = useState<any[]>([]);
  const [earn, setEarn] = useState<any>(null);
  const [ents, setEnts] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState<any>(null);

  async function load() {
    const [c, p] = await Promise.all([fetch('/api/academy/connect').then((r) => r.json()).catch(() => ({})), fetch('/api/academy/products').then((r) => r.json()).catch(() => ({}))]);
    setConn(c); setProds(p.products || []); setEarn(p.earnings || null); setEnts(p.entitlements || []);
  }
  useEffect(() => { load(); }, []);
  async function connect() { setBusy('connect'); const r = await fetch('/api/academy/connect', { method: 'POST' }); const j = await r.json(); if (j.url) window.location.href = j.url; else { setBusy(''); alert(L('No se pudo conectar Stripe.', 'Could not connect Stripe.')); } }
  async function saveProd(f: any) { setBusy('prod'); const body: any = { ...f, price_cents: Math.round(Number(f.price) * 100) }; delete body.price; await fetch('/api/academy/products', { method: 'POST', body: JSON.stringify(body) }); setBusy(''); setForm(null); load(); }
  async function delProd(id: string) { if (!confirm(L('¿Borrar este nivel?', 'Delete this tier?'))) return; await fetch('/api/academy/products', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) }); load(); }

  if (!conn) return <div className="sk-card muted">…</div>;
  const money = (c: number) => '$' + (Math.round((c || 0) / 100)).toLocaleString();

  return (
    <>
      <div className="sk-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}><span className="card-ic"><OnyxIcon name="card" size={16} /></span> {L('Cobros con Stripe', 'Payments with Stripe')}</h3>
        {conn.configured === false ? <p className="muted" style={{ fontSize: 13 }}>{L('Los cobros aún no están habilitados en la plataforma.', 'Payments are not enabled on the platform yet.')}</p>
          : conn.chargesEnabled ? <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Conectado y cobrando', 'Connected & charging')}</span>{conn.dashboard && <a className="btn btn-ghost" href={conn.dashboard} target="_blank" rel="noreferrer">{L('Abrir mi panel de Stripe', 'Open my Stripe dashboard')}</a>}</div>
          : <><p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{conn.connected ? L('Termina de verificar tu cuenta de Stripe para empezar a cobrar.', 'Finish verifying your Stripe account to start charging.') : L('Conecta una cuenta de Stripe para cobrar a tus alumnos.', 'Connect a Stripe account to charge your students.')}</p><button className="btn btn-primary" disabled={busy === 'connect'} onClick={connect}>{busy === 'connect' ? '…' : (conn.connected ? L('Continuar verificación', 'Continue verification') : L('Conectar Stripe', 'Connect Stripe'))}</button></>}
      </div>
      {earn && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, margin: '12px 0' }}>
          {[[L('Ventas', 'Sales'), String(earn.sales || 0), 'cart'], [L('Bruto', 'Gross'), money(earn.grossCents), 'coins'], [L('Comisión Onyx', 'Onyx fee'), money(earn.feeCents), 'gem'], [L('Tu neto', 'Your net'), money(earn.netCents), 'money']].map(([lbl, val, ic]) => (
            <div key={lbl} className="statcard"><div className="statcard-ic"><OnyxIcon name={ic as any} /></div><div><div className="sc-lbl">{lbl}</div><div className="sc-val">{val}</div></div></div>
          ))}
        </div>
      )}
      <div className="sk-card">
        <div className="row between" style={{ marginBottom: 10 }}><h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic" style={{ color: 'var(--gold)' }}><OnyxIcon name="gem" size={16} /></span> {L('Niveles', 'Tiers')}</h3><button className="btn btn-primary" onClick={() => setForm({ name: '', kind: 'subscription', interval: 'month', price: '', currency: 'usd', grants: 'all', active: true })}>＋ {L('Nivel', 'Tier')}</button></div>
        {prods.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{L('Crea niveles como “Curso básico”, “VIP” o “Bootcamp”.', 'Create tiers like “Basic”, “VIP” or “Bootcamp”.')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prods.map((p) => (
            <div key={p.id} className="row between" style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div><b style={{ fontSize: 14 }}>{p.name}</b>{!p.active && <span className="sk-chip" style={{ marginLeft: 6, color: 'var(--mut)', background: 'var(--card2)' }}>{L('inactivo', 'inactive')}</span>}<div className="muted" style={{ fontSize: 12 }}>{priceLabel(p, L)} · {p.grants === 'all' ? L('todas las aulas', 'all classrooms') : (Array.isArray(p.grants) ? p.grants.length : 0) + ' ' + L('aulas', 'classrooms')}</div></div>
              <div className="row" style={{ gap: 6 }}><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setForm({ ...p, price: (p.price_cents / 100).toString() })}>✎</button><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => delProd(p.id)}>✕</button></div>
            </div>
          ))}
        </div>
        {form && <TierForm form={form} setForm={setForm} modules={modules} busy={busy === 'prod'} onSave={saveProd} onCancel={() => setForm(null)} L={L} />}
      </div>

      {ents.length > 0 && (
        <div className="sk-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}><span className="card-ic"><OnyxIcon name="guardian" size={16} /></span> {L('Accesos a dar (Copy / Guardian)', 'Access to grant (Copy / Guardian)')}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('Estos alumnos compraron un nivel con extras. Dales el acceso manualmente (Copy trading / Guardian) desde sus módulos — por seguridad no se activa solo.', 'These students bought a tier with perks. Grant them access manually (Copy trading / Guardian) — for safety it is not auto-enabled.')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ents.map((e: any, i: number) => (
              <div key={i} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}>
                <span>{e.name} <span className="muted">· {e.tier}</span></span>
                <span className="row" style={{ gap: 6 }}>
                  {e.perks?.copy && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--brand) 15%,transparent)', color: 'var(--soft-brand)' }}>Copy</span>}
                  {e.perks?.guardian && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>Guardian</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TierForm({ form, setForm, modules, busy, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const grantsAll = form.grants === 'all';
  const grantIds: string[] = Array.isArray(form.grants) ? form.grants : [];
  const toggleMod = (id: string) => set('grants', grantIds.includes(id) ? grantIds.filter((x) => x !== id) : [...grantIds, id]);
  return (
    <div className="sk-card" style={{ border: '1px solid var(--brand)', marginTop: 12 }}>
      <h3 style={{ marginBottom: 12 }}>{form.id ? L('Editar nivel', 'Edit tier') : L('Nuevo nivel', 'New tier')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder={L('Nombre (Curso básico, VIP, Bootcamp…)', 'Name (Basic, VIP, Bootcamp…)')} style={{ margin: 0 }} />
        <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={2} placeholder={L('Descripción (opcional)', 'Description (optional)')} style={{ width: '100%', margin: 0 }} />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={form.kind} onChange={(e) => set('kind', e.target.value)} style={{ margin: 0 }}><option value="subscription">{L('Suscripción', 'Subscription')}</option><option value="one_time">{L('Pago único', 'One-time')}</option></select>
          {form.kind === 'subscription' && <select value={form.interval} onChange={(e) => set('interval', e.target.value)} style={{ margin: 0 }}><option value="month">{L('Mensual', 'Monthly')}</option><option value="year">{L('Anual', 'Yearly')}</option></select>}
          <input type="number" min={0} step="0.01" value={form.price ?? ''} onChange={(e) => set('price', e.target.value)} placeholder={L('Precio', 'Price')} style={{ margin: 0, width: 120 }} />
          <select value={form.currency} onChange={(e) => set('currency', e.target.value)} style={{ margin: 0 }}><option value="usd">USD</option><option value="eur">EUR</option><option value="mxn">MXN</option></select>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('¿Qué desbloquea?', 'What does it unlock?')}</div>
          <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 6 }}><input type="radio" checked={grantsAll} onChange={() => set('grants', 'all')} style={{ width: 'auto', margin: 0 }} /> {L('Todas las aulas', 'All classrooms')}</label>
          <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="radio" checked={!grantsAll} onChange={() => set('grants', [])} style={{ width: 'auto', margin: 0 }} /> {L('Aulas concretas', 'Specific classrooms')}</label>
          {!grantsAll && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, paddingLeft: 22 }}>{(modules || []).map((m: any) => <label key={m.id} className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={grantIds.includes(m.id)} onChange={() => toggleMod(m.id)} style={{ width: 'auto', margin: 0 }} /> {m.title}</label>)}{(modules || []).length === 0 && <span className="muted" style={{ fontSize: 12 }}>{L('Primero crea aulas.', 'First create classrooms.')}</span>}</div>}
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Extras incluidos (opcional)', 'Included perks (optional)')}</div>
          <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 4 }}><input type="checkbox" checked={!!form.perks?.copy} onChange={(e) => set('perks', { ...(form.perks || {}), copy: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {L('Copy trading del mentor', 'Mentor copy trading')}</label>
          <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={!!form.perks?.guardian} onChange={(e) => set('perks', { ...(form.perks || {}), guardian: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> Onyx Guardian</label>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{L('Se muestran al alumno como incluidos; tú das el acceso desde la lista de abajo (por seguridad no se activa solo).', 'Shown to the student as included; you grant access from the list below (not auto-enabled, for safety).')}</div>
        </div>
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Activo (visible para alumnos)', 'Active (visible to students)')}</label>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name || !form.price || busy}>{busy ? '…' : L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div>
  );
}
