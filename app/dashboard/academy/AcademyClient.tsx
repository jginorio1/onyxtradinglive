'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Onyx Academy — comunidad estilo Skool: feed, classroom con portadas y progreso,
// miembros, leaderboard con niveles, y panel de mentor con cobros.

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
  const u: [number, string, string][] = [[86400, 'd', 'd'], [3600, 'h', 'h'], [60, 'm', 'm']];
  for (const [sec, a] of u) if (s >= sec) return Math.floor(s / sec) + a;
  return es ? 'ahora' : 'now';
}

// Avatar con inicial + insignia de nivel.
function Avatar({ name, level, size = 40 }: { name: string; level?: number; size?: number }) {
  return (
    <span className="sk-av" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
      {level != null && <span className="sk-lvl">{level}</span>}
    </span>
  );
}
// Anillo de progreso (conic-gradient).
function Ring({ pct, size = 46 }: { pct: number; size?: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(var(--green) ${p * 3.6}deg, color-mix(in srgb, var(--mut) 25%, transparent) 0deg)`, flex: 'none' }}>
      <div style={{ width: size - 8, height: size - 8, borderRadius: '50%', background: 'var(--card)', display: 'grid', placeItems: 'center', fontSize: size * 0.24, fontWeight: 800 }}>{p}%</div>
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
  async function openAcademy(mid: string) {
    const r = await fetch('/api/academy?m=' + mid); const j = await r.json();
    if (j.active) setActive(j.active);
  }
  useEffect(() => {
    (async () => {
      try {
        const jc = new URLSearchParams(window.location.search).get('join');
        if (jc) {
          const r = await fetch('/api/academy/enroll', { method: 'POST', body: JSON.stringify({ code: jc }) });
          const j = await r.json(); await load();
          if (j.ok) openAcademy(j.mentor_id);
          return;
        }
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
  if (manage && d.canMentor) return <MentorPanel lang={lang} onClose={() => { setManage(false); load(); }} />;
  if (active) return <Community active={active} lang={lang} reload={() => openAcademy(active.mentor_id)} onExit={() => { setActive(null); load(); }} />;

  // ---- Portada: mis academias + unirme ----
  return (
    <div className="sk-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={24} /></span> Onyx Academy</h2>
          <div className="muted" style={{ fontSize: 13 }}>{L('Comunidades de trading: aprende, comparte y sube de nivel.', 'Trading communities: learn, share and level up.')}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn btn-ghost" href="/academias">{L('Explorar academias', 'Browse academies')}</a>
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

      {/* Mi propia comunidad (mentor): entra a verla estilo Skool */}
      {d.isMentor && d.myMentorId && (
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, margin: '4px 2px 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{L('Mi comunidad', 'My community')}</div>
          <button className="sk-course" style={{ maxWidth: 280 }} onClick={() => openAcademy(d.myMentorId)}>
            <div className="sk-course-cover" style={{ background: 'var(--grad)' }}><OnyxIcon name="graduation" size={30} /></div>
            <div className="sk-course-body">
              <div style={{ fontWeight: 700, fontSize: 15 }}>{d.myAcademyName || 'Onyx Academy'}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{L('Entrar como mentor →', 'Enter as mentor →')}</div>
            </div>
          </button>
        </div>
      )}

      {(d.academies || []).length === 0
        ? (!d.isMentor && <div className="sk-card muted">{L('Todavía no estás en ninguna academia. Únete con un código o explora el directorio.', 'You are not in any academy yet. Join with a code or browse the directory.')}</div>)
        : <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, margin: '4px 2px 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{L('Academias en las que estoy', 'Academies I’m in')}</div>
          <div className="sk-grid-courses">{d.academies.map((a: any) => (
          <button key={a.mentor_id} className="sk-course" onClick={() => openAcademy(a.mentor_id)}>
            <div className="sk-course-cover" style={{ background: 'var(--grad)' }}><OnyxIcon name="graduation" size={30} /></div>
            <div className="sk-course-body">
              <div style={{ fontWeight: 700, fontSize: 15 }}>{a.academy_name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.mentor_name}{a.tagline ? ' · ' + a.tagline : ''}</div>
            </div>
          </button>
        ))}</div></div>}
    </div>
  );
}

// =================== Comunidad (vista estilo Skool) ===================
function Community({ active, lang, reload, onExit }: any) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const es = lang !== 'en';
  const [tab, setTab] = useState<'community' | 'classroom' | 'members' | 'leaderboard'>('community');
  const [openMod, setOpenMod] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [post, setPost] = useState('');

  const link = typeof window !== 'undefined' ? `${window.location.origin}/academia/${active.code}` : '';
  const totalLessons = (active.content || []).reduce((s: number, m: any) => s + m.lessons.length, 0);
  const doneCount = (active.progress || []).length;

  async function api(body: any) { await fetch('/api/academy', { method: 'POST', body: JSON.stringify(body) }); }
  async function sendPost() {
    if (!post.trim()) return;
    await api({ action: 'post', mentor_id: active.mentor_id, body: post }); setPost(''); reload();
  }
  async function like(target_type: string, target_id: string) {
    await api({ action: 'like', mentor_id: active.mentor_id, target_type, target_id }); reload();
  }
  async function comment(pid: string, body: string) {
    await api({ action: 'comment', post_id: pid, mentor_id: active.mentor_id, body }); reload();
  }
  async function toggleLesson(l: any, done: boolean) {
    await api({ action: 'lesson', lesson_id: l.id, done }); reload();
  }
  async function buy(productId: string) {
    const r = await fetch('/api/academy/checkout', { method: 'POST', body: JSON.stringify({ product_id: productId }) });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else alert(j.error === 'mentor_not_ready' ? L('El mentor aún no ha activado los cobros.', 'The mentor has not enabled payments yet.') : L('No se pudo iniciar el pago.', 'Could not start checkout.'));
  }

  const TABS: [string, string, string][] = [
    ['community', 'chat', L('Comunidad', 'Community')],
    ['classroom', 'graduation', L('Aulas', 'Classroom')],
    ['members', 'users', L('Miembros', 'Members')],
    ['leaderboard', 'trophy', L('Ranking', 'Leaderboard')],
  ];

  return (
    <div className="sk-wrap" style={{ paddingTop: 4 }}>
      {/* Hero */}
      <div className="sk-hero">
        <div className="sk-hero-cover" style={active.cover_url ? { backgroundImage: `url(${active.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
        <div className="sk-hero-body">
          <span className="sk-hero-logo"><OnyxIcon name="graduation" size={30} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>{active.academy_name}</h2>
                {active.tagline && <div className="muted" style={{ fontSize: 13 }}>{active.tagline}</div>}
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={onExit}>← {L('Mis academias', 'My academies')}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sk-tabs">
        {TABS.map(([k, ic, lbl]) => (
          <button key={k} className={'sk-tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k as any); setOpenMod(null); setLesson(null); }}>
            <OnyxIcon name={ic as any} size={15} /> {lbl}
          </button>
        ))}
      </div>

      <div className="sk-grid">
        {/* ---- Columna principal ---- */}
        <div>
          {tab === 'community' && (
            <>
              <div className="sk-card">
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name="•" level={active.me?.level} size={40} />
                  <div style={{ flex: 1 }}>
                    <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={2} placeholder={L('Comparte algo con la comunidad…', 'Share something with the community…')} style={{ width: '100%', margin: 0 }} />
                    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><button className="btn btn-primary" onClick={sendPost} disabled={!post.trim()}>{L('Publicar', 'Post')}</button></div>
                  </div>
                </div>
              </div>
              {(active.feed || []).map((p: any) => <PostCard key={p.id} p={p} onLike={like} onComment={comment} L={L} es={es} />)}
              {(active.feed || []).length === 0 && <div className="sk-card muted">{L('Sé el primero en publicar en la comunidad.', 'Be the first to post in the community.')}</div>}
            </>
          )}

          {tab === 'classroom' && (
            lesson ? <LessonView lesson={lesson} done={(active.progress || []).includes(lesson.id)} onBack={() => setLesson(null)} onToggle={toggleLesson} L={L} />
            : openMod ? (
              <div>
                <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={() => setOpenMod(null)}>← {L('Aulas', 'Classroom')}</button>
                <div className="sk-card">
                  <h3 style={{ marginBottom: 4 }}>{openMod.title}</h3>
                  {openMod.description && <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{openMod.description}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {openMod.lessons.map((l: any) => { const done = (active.progress || []).includes(l.id); const open = !openMod.locked || l.is_free; return (
                      <button key={l.id} onClick={() => open && setLesson(l)} disabled={!open} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', textAlign: 'left', cursor: open ? 'pointer' : 'not-allowed', opacity: open ? 1 : .6 }}>
                        <span style={{ color: !open ? 'var(--gold)' : done ? 'var(--green)' : 'var(--mut)', display: 'inline-flex' }}>{!open ? <OnyxIcon name="guardian" size={14} /> : done ? '✓' : '▷'}</span>
                        <span style={{ flex: 1, fontSize: 13.5 }}>{l.title}</span>
                        {l.is_free && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>{L('gratis', 'free')}</span>}
                        {l.video_url && open && <OnyxIcon emoji="🎬" size={14} />}
                      </button>
                    ); })}
                    {openMod.lessons.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{L('Sin lecciones todavía.', 'No lessons yet.')}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {(active.products || []).length > 0 && !active.hasAccessAll && <Tiers products={active.products} purchases={active.purchases || []} onBuy={buy} L={L} />}
                {(active.content || []).length === 0
                  ? <div className="sk-card muted">{L('El mentor aún no ha publicado aulas.', 'The mentor has not published classrooms yet.')}</div>
                  : <div className="sk-grid-courses">
                    {(active.content || []).map((m: any) => {
                      const total = m.lessons.length;
                      const done = m.lessons.filter((l: any) => (active.progress || []).includes(l.id)).length;
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

          {tab === 'members' && (
            <div className="sk-grid-members">
              {(active.members || []).map((mem: any) => (
                <div key={mem.user_id} className="sk-member">
                  <Avatar name={mem.name} level={mem.level} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {mem.name}{mem.is_mentor && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 18%,transparent)', color: 'var(--gold)' }}>{L('Mentor', 'Mentor')}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{L('Nivel', 'Level')} {mem.level} · {mem.points} {L('pts', 'pts')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'leaderboard' && <Leaderboard mentorId={active.mentor_id} initial={active.leaderboard || []} L={L} />}
        </div>

        {/* ---- Sidebar ---- */}
        <div className="sk-side">
          <div className="sk-side-card">
            <div style={{ fontWeight: 800, fontSize: 16 }}>{active.academy_name}</div>
            {active.about && <p className="muted" style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{active.about}</p>}
            <div className="row" style={{ gap: 16, margin: '12px 0', textAlign: 'center' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18 }}>{active.membersCount ?? (active.members || []).length}</div><div className="muted" style={{ fontSize: 11 }}>{L('Miembros', 'Members')}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18 }}>{(active.content || []).length}</div><div className="muted" style={{ fontSize: 11 }}>{L('Aulas', 'Classrooms')}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>{active.me?.level ?? 1}</div><div className="muted" style={{ fontSize: 11 }}>{L('Tu nivel', 'Your level')}</div></div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { navigator.clipboard.writeText(link); alert(L('Enlace de invitación copiado.', 'Invite link copied.')); }}>
              <OnyxIcon emoji="🔗" size={14} /> {L('Invitar', 'Invite')}
            </button>
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
                <Avatar name={r.name} level={r.level} size={30} />
                <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <b style={{ fontSize: 12.5 }}>{r.points}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PostCard({ p, onLike, onComment, L, es }: any) {
  const [c, setC] = useState('');
  const [openC, setOpenC] = useState(false);
  return (
    <div className="sk-card">
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <Avatar name={p.author_name} level={p.author_level} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.author_name}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{timeAgo(p.created_at, es)}</div>
        </div>
        {p.pinned && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>📌 {L('fijado', 'pinned')}</span>}
      </div>
      <div style={{ fontSize: 14.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{p.body}</div>
      <div className="sk-post-actions">
        <button className={'sk-like' + (p.liked ? ' on' : '')} onClick={() => onLike('post', p.id)}>
          <OnyxIcon emoji="❤" size={15} glow={false} /> {p.likes || 0}
        </button>
        <button className="sk-like" onClick={() => setOpenC((v) => !v)}><OnyxIcon name="chat" size={15} glow={false} /> {(p.comments || []).length}</button>
      </div>
      {(openC || (p.comments || []).length > 0) && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(p.comments || []).map((c2: any) => (
            <div key={c2.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <Avatar name={c2.author_name} level={c2.author_level} size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}><b style={{ fontSize: 12.5 }}>{c2.author_name}</b> {c2.body}</div>
                <button className={'sk-like' + (c2.liked ? ' on' : '')} style={{ fontSize: 11.5, padding: '2px 4px' }} onClick={() => onLike('comment', c2.id)}><OnyxIcon emoji="❤" size={12} glow={false} /> {c2.likes || 0}</button>
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
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('all');
  const [rows, setRows] = useState<any[]>(initial);
  const [loading, setLoading] = useState(false);
  async function pick(r: '7d' | '30d' | 'all') {
    setRange(r); setLoading(true);
    const res = await fetch(`/api/academy?m=${mentorId}&board=${r}`); const j = await res.json();
    setRows(j.leaderboard || []); setLoading(false);
  }
  return (
    <div className="sk-card">
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <b style={{ fontSize: 15 }}>{L('Ranking de la comunidad', 'Community leaderboard')}</b>
        <div className="sk-seg">
          {(['7d', '30d', 'all'] as const).map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => pick(r)}>{r === 'all' ? L('Total', 'All-time') : r}</button>)}
        </div>
      </div>
      {loading && <div className="muted" style={{ fontSize: 13 }}>…</div>}
      {!loading && rows.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('Todavía nadie ha sumado puntos en este periodo.', 'Nobody has earned points in this period yet.')}</div>}
      {!loading && rows.map((r: any) => (
        <div key={r.user_id} className="sk-board-row" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="sk-rank" style={r.rank <= 3 ? { color: 'var(--gold)', fontSize: 15 } : undefined}>{r.rank}</span>
          <Avatar name={r.name} level={r.level} size={34} />
          <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
          <b>{r.points} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{L('pts', 'pts')}</span></b>
        </div>
      ))}
    </div>
  );
}

function LessonView({ lesson, done, onBack, onToggle, L }: any) {
  const emb = embed(lesson.video_url || '');
  return (
    <div className="sk-card">
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Volver', 'Back')}</button>
      <h3 style={{ marginBottom: 12 }}>{lesson.title}</h3>
      {lesson.video_url && (emb
        ? <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}><iframe src={emb} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
        : <video src={lesson.video_url} controls style={{ width: '100%', borderRadius: 12, marginBottom: 12 }} />)}
      {lesson.content && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{lesson.content}</div>}
      {(lesson.resources || []).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Recursos', 'Resources')}</div>
          {lesson.resources.map((r: any, i: number) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="sk-chip" style={{ marginRight: 8 }}>📎 {r.label || r.url}</a>)}
        </div>
      )}
      <button className={'btn ' + (done ? 'btn-ghost' : 'btn-primary')} onClick={() => onToggle(lesson, !done)}>{done ? '✓ ' + L('Completada', 'Completed') : L('Marcar como completada', 'Mark as completed')}</button>
    </div>
  );
}

// Precio formateado.
function priceLabel(p: any, L: (a: string, b: string) => string) {
  const amount = (p.price_cents / 100).toLocaleString(undefined, { minimumFractionDigits: p.price_cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const cur = (p.currency || 'usd').toUpperCase();
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '';
  const base = sym ? sym + amount : amount + ' ' + cur;
  if (p.kind === 'one_time') return base + ' · ' + L('pago único', 'one-time');
  return base + '/' + (p.interval === 'year' ? L('año', 'yr') : L('mes', 'mo'));
}

function Tiers({ products, purchases, onBuy, L }: any) {
  const ownedIds = new Set((purchases || []).map((x: any) => x.product_id));
  return (
    <div className="sk-card" style={{ border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)', marginBottom: 12 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={{ color: 'var(--gold)', display: 'inline-flex' }}><OnyxIcon name="gem" size={18} /></span>
        {L('Desbloquea más con estos niveles', 'Unlock more with these tiers')}
      </h3>
      <div className="sk-grid-courses">
        {products.map((p: any) => {
          const owned = ownedIds.has(p.id);
          return (
            <div key={p.id} className="sk-card" style={{ margin: 0, background: 'var(--bg2)' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              {p.description && <div className="muted" style={{ fontSize: 12.5, margin: '4px 0 8px' }}>{p.description}</div>}
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>{priceLabel(p, L)}</div>
              {owned
                ? <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Ya lo tienes', 'You have it')}</span>
                : <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onBuy(p.id)}>{L('Desbloquear', 'Unlock')}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== Panel del mentor ===================
function MentorPanel({ lang, onClose }: { lang: string; onClose: () => void }) {
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'cursos' | 'cobros' | 'alumnos' | 'comunidad' | 'ajustes'>('cursos');
  const [newMod, setNewMod] = useState('');
  const [lessonForm, setLessonForm] = useState<any>(null);
  const [modForm, setModForm] = useState<any>(null);
  const [post, setPost] = useState('');

  async function load() { const r = await fetch('/api/academy/mentor'); setD(await r.json()); }
  useEffect(() => { load(); }, []);
  async function api(body: any) { await fetch('/api/academy/mentor', { method: 'POST', body: JSON.stringify(body) }); load(); }

  if (!d) return <div className="card muted">…</div>;
  if (d.error) return <div className="sk-card"><b>{L('Academia no disponible en tu plan', 'Academy not on your plan')}</b><p className="muted" style={{ marginTop: 6 }}>{L('El módulo Mentor está en el plan Mentor o como add-on.', 'The Mentor module is on the Mentor plan or as an add-on.')}</p></div>;

  const link = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/academy?join=${d.mentor.code}` : '';

  return (
    <div className="sk-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div><h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={22} /></span> {d.mentor.academy_name}</h2><div className="muted" style={{ fontSize: 13 }}>{L('Panel del mentor · Onyx Academy', 'Mentor panel · Onyx Academy')}</div></div>
        <button className="btn btn-ghost" onClick={onClose}>← {L('Ver como alumno', 'Student view')}</button>
      </div>

      <div className="sk-card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🔑 {L('Enlace de inscripción (compártelo con tus alumnos)', 'Enrollment link (share with your students)')}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input readOnly value={link} style={{ margin: 0, flex: 1, minWidth: 200 }} />
          <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(link)}>{L('Copiar', 'Copy')}</button>
          <span className="sk-chip">{L('Código', 'Code')}: {d.mentor.code}</span>
        </div>
      </div>

      <div className="sk-tabs">
        {([['cursos', 'graduation', L('Aulas', 'Classroom')], ['cobros', 'coins', L('Cobros', 'Payments')], ['alumnos', 'users', L('Alumnos', 'Students')], ['comunidad', 'chat', L('Comunidad', 'Community')], ['ajustes', 'settings', L('Ajustes', 'Settings')]] as any[]).map(([k, ic, lbl]) => (
          <button key={k} className={'sk-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><OnyxIcon name={ic} size={15} /> {lbl}</button>
        ))}
      </div>

      {tab === 'cursos' && (<>
        <div className="sk-card">
          <div className="row" style={{ gap: 8 }}>
            <input value={newMod} onChange={(e) => setNewMod(e.target.value)} placeholder={L('Nombre del nuevo aula/módulo', 'New classroom/module name')} style={{ margin: 0, flex: 1 }} />
            <button className="btn btn-primary" onClick={() => { if (newMod.trim()) { api({ action: 'module', title: newMod, position: (d.content?.length || 0) }); setNewMod(''); } }}>＋ {L('Aula', 'Classroom')}</button>
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
                  <span>{l.title}{l.is_free && <span className="sk-chip" style={{ marginLeft: 6, background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>{L('gratis', 'free')}</span>}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setLessonForm({ ...l })}>✎</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => api({ action: 'lesson_delete', id: l.id })}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {modForm && <CoverForm form={modForm} setForm={setModForm} L={L} onSave={(f: any) => { api({ action: 'module', id: f.id, title: f.title, description: f.description, cover_url: f.cover_url }); setModForm(null); }} onCancel={() => setModForm(null)} />}
        {lessonForm && <LessonForm form={lessonForm} setForm={setLessonForm} L={L} onSave={(f: any) => { api({ action: 'lesson', ...f }); setLessonForm(null); }} onCancel={() => setLessonForm(null)} />}
      </>)}

      {tab === 'cobros' && <MentorPayments modules={d.content || []} L={L} />}

      {tab === 'alumnos' && (
        <div className="sk-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon name="users" size={16} /></span> {L('Alumnos', 'Students')} · {d.roster.students.length}</h3>
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

      {tab === 'ajustes' && <MentorSettings mentor={d.mentor} L={L} onSave={(b: any) => api({ action: 'settings', ...b })} />}
    </div>
  );
}

function CoverForm({ form, setForm, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  return (
    <div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{L('Portada del aula', 'Classroom cover')} · {form.title}</h3>
      <span className="muted" style={{ fontSize: 12 }}>{L('URL de imagen (portada del curso)', 'Image URL (course cover)')}</span>
      <input value={form.cover_url || ''} onChange={(e) => set('cover_url', e.target.value)} placeholder="https://…" style={{ margin: '4px 0 0' }} />
      {form.cover_url && <div className="sk-course-cover" style={{ backgroundImage: `url(${form.cover_url})`, borderRadius: 10, marginTop: 10 }} />}
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
  const [f, setF] = useState({ academy_name: mentor.academy_name, tagline: mentor.tagline || '', about: mentor.about || '', cover_url: mentor.cover_url || '' });
  return (
    <div className="sk-card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon name="settings" size={16} /></span> {L('Ajustes de la academia', 'Academy settings')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Nombre', 'Name')}</span><input value={f.academy_name} onChange={(e) => setF({ ...f, academy_name: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Lema', 'Tagline')}</span><input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Portada (URL de imagen)', 'Cover (image URL)')}</span><input value={f.cover_url} onChange={(e) => setF({ ...f, cover_url: e.target.value })} placeholder="https://…" style={{ margin: '4px 0 0' }} /></div>
        <div><span className="muted" style={{ fontSize: 12 }}>{L('Sobre la academia', 'About')}</span><textarea value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} rows={3} style={{ width: '100%', margin: '4px 0 0' }} /></div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onSave(f)}>{L('Guardar', 'Save')}</button>
    </div>
  );
}

// =================== Cobros del mentor (Stripe Connect + niveles) ===================
function MentorPayments({ modules, L }: { modules: any[]; L: (a: string, b: string) => string }) {
  const [conn, setConn] = useState<any>(null);
  const [prods, setProds] = useState<any[]>([]);
  const [earn, setEarn] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState<any>(null);

  async function load() {
    const [c, p] = await Promise.all([
      fetch('/api/academy/connect').then((r) => r.json()).catch(() => ({})),
      fetch('/api/academy/products').then((r) => r.json()).catch(() => ({})),
    ]);
    setConn(c); setProds(p.products || []); setEarn(p.earnings || null);
  }
  useEffect(() => { load(); }, []);

  async function connect() {
    setBusy('connect');
    const r = await fetch('/api/academy/connect', { method: 'POST' }); const j = await r.json();
    if (j.url) window.location.href = j.url; else { setBusy(''); alert(L('No se pudo conectar Stripe.', 'Could not connect Stripe.')); }
  }
  async function saveProd(f: any) {
    setBusy('prod');
    const body: any = { ...f, price_cents: Math.round(Number(f.price) * 100) }; delete body.price;
    await fetch('/api/academy/products', { method: 'POST', body: JSON.stringify(body) });
    setBusy(''); setForm(null); load();
  }
  async function delProd(id: string) {
    if (!confirm(L('¿Borrar este nivel?', 'Delete this tier?'))) return;
    await fetch('/api/academy/products', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) }); load();
  }

  if (!conn) return <div className="sk-card muted">…</div>;
  const money = (c: number) => '$' + (Math.round((c || 0) / 100)).toLocaleString();

  return (
    <>
      <div className="sk-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}><span className="card-ic"><OnyxIcon name="card" size={16} /></span> {L('Cobros con Stripe', 'Payments with Stripe')}</h3>
        {conn.configured === false ? (
          <p className="muted" style={{ fontSize: 13 }}>{L('Los cobros aún no están habilitados en la plataforma.', 'Payments are not enabled on the platform yet.')}</p>
        ) : conn.chargesEnabled ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Conectado y cobrando', 'Connected & charging')}</span>
            {conn.dashboard && <a className="btn btn-ghost" href={conn.dashboard} target="_blank" rel="noreferrer">{L('Abrir mi panel de Stripe', 'Open my Stripe dashboard')}</a>}
          </div>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{conn.connected ? L('Termina de verificar tu cuenta de Stripe para empezar a cobrar.', 'Finish verifying your Stripe account to start charging.') : L('Conecta una cuenta de Stripe para cobrar a tus alumnos. Onyx cobra su comisión automáticamente en cada venta.', 'Connect a Stripe account to charge your students. Onyx takes its commission automatically on each sale.')}</p>
            <button className="btn btn-primary" disabled={busy === 'connect'} onClick={connect}>{busy === 'connect' ? '…' : (conn.connected ? L('Continuar verificación', 'Continue verification') : L('Conectar Stripe', 'Connect Stripe'))}</button>
          </>
        )}
      </div>

      {earn && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, margin: '12px 0' }}>
          {[[L('Ventas', 'Sales'), String(earn.sales || 0), 'cart'], [L('Bruto', 'Gross'), money(earn.grossCents), 'coins'], [L('Comisión Onyx', 'Onyx fee'), money(earn.feeCents), 'gem'], [L('Tu neto', 'Your net'), money(earn.netCents), 'money']].map(([lbl, val, ic]) => (
            <div key={lbl} className="statcard"><div className="statcard-ic"><OnyxIcon name={ic as any} /></div><div><div className="sc-lbl">{lbl}</div><div className="sc-val">{val}</div></div></div>
          ))}
        </div>
      )}

      <div className="sk-card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic" style={{ color: 'var(--gold)' }}><OnyxIcon name="gem" size={16} /></span> {L('Niveles', 'Tiers')}</h3>
          <button className="btn btn-primary" onClick={() => setForm({ name: '', kind: 'subscription', interval: 'month', price: '', currency: 'usd', grants: 'all', active: true })}>＋ {L('Nivel', 'Tier')}</button>
        </div>
        {prods.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{L('Crea niveles como “Curso básico”, “VIP” o “Bootcamp”. Elige suscripción o pago único y qué aulas desbloquea cada uno.', 'Create tiers like “Basic”, “VIP” or “Bootcamp”. Pick subscription or one-time and which classrooms each unlocks.')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prods.map((p) => (
            <div key={p.id} className="row between" style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div>
                <b style={{ fontSize: 14 }}>{p.name}</b>{!p.active && <span className="sk-chip" style={{ marginLeft: 6, color: 'var(--mut)', background: 'var(--card2)' }}>{L('inactivo', 'inactive')}</span>}
                <div className="muted" style={{ fontSize: 12 }}>{priceLabel(p, L)} · {p.grants === 'all' ? L('todas las aulas', 'all classrooms') : (Array.isArray(p.grants) ? p.grants.length : 0) + ' ' + L('aulas', 'classrooms')}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setForm({ ...p, price: (p.price_cents / 100).toString() })}>✎</button>
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => delProd(p.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
        {form && <TierForm form={form} setForm={setForm} modules={modules} busy={busy === 'prod'} onSave={saveProd} onCancel={() => setForm(null)} L={L} />}
      </div>
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
          <select value={form.kind} onChange={(e) => set('kind', e.target.value)} style={{ margin: 0 }}>
            <option value="subscription">{L('Suscripción', 'Subscription')}</option>
            <option value="one_time">{L('Pago único', 'One-time')}</option>
          </select>
          {form.kind === 'subscription' && (
            <select value={form.interval} onChange={(e) => set('interval', e.target.value)} style={{ margin: 0 }}>
              <option value="month">{L('Mensual', 'Monthly')}</option>
              <option value="year">{L('Anual', 'Yearly')}</option>
            </select>
          )}
          <input type="number" min={0} step="0.01" value={form.price ?? ''} onChange={(e) => set('price', e.target.value)} placeholder={L('Precio', 'Price')} style={{ margin: 0, width: 120 }} />
          <select value={form.currency} onChange={(e) => set('currency', e.target.value)} style={{ margin: 0 }}>
            <option value="usd">USD</option><option value="eur">EUR</option><option value="mxn">MXN</option>
          </select>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('¿Qué desbloquea?', 'What does it unlock?')}</div>
          <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 6 }}><input type="radio" checked={grantsAll} onChange={() => set('grants', 'all')} style={{ width: 'auto', margin: 0 }} /> {L('Todas las aulas', 'All classrooms')}</label>
          <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="radio" checked={!grantsAll} onChange={() => set('grants', [])} style={{ width: 'auto', margin: 0 }} /> {L('Aulas concretas', 'Specific classrooms')}</label>
          {!grantsAll && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, paddingLeft: 22 }}>
              {(modules || []).map((m: any) => (
                <label key={m.id} className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={grantIds.includes(m.id)} onChange={() => toggleMod(m.id)} style={{ width: 'auto', margin: 0 }} /> {m.title}</label>
              ))}
              {(modules || []).length === 0 && <span className="muted" style={{ fontSize: 12 }}>{L('Primero crea aulas en la pestaña Aulas.', 'First create classrooms in the Classroom tab.')}</span>}
            </div>
          )}
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
