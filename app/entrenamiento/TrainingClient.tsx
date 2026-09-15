'use client';
import { useEffect, useRef, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

const AC = 'var(--accent,#8b93ff)';
const OK = '#3ecf8e';
const WARN = '#e0a03a';
const BAD = '#f2555a';

// ---- Anillo de progreso (SVG) ----
function Ring({ pct, size = 46, stroke = 5, color = AC, children }: { pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line,#2a3350)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 60 ? 15 : 11, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{children}</div>
    </div>
  );
}

// ---- Cuerpo de lección (markdown ligero, robusto ante \n literal) ----
function Body({ text }: { text: string }) {
  const lines = String(text || '').replace(/\\n/g, '\n').split('\n');
  return (
    <div style={{ fontSize: 14.5, color: 'var(--tx,#e8ecf5)', lineHeight: 1.75 }}>
      {lines.map((ln, i) => {
        const t = ln.trim();
        if (!t) return <div key={i} style={{ height: 9 }} />;
        if (/^#{1,3}\s/.test(t)) return <div key={i} style={{ fontWeight: 600, fontSize: 15.5, margin: '12px 0 2px' }}>{t.replace(/^#{1,3}\s/, '')}</div>;
        if (/^[-*•]\s/.test(t)) return <div key={i} style={{ display: 'flex', gap: 9, marginTop: 5 }}><span style={{ color: AC, marginTop: 1 }}>•</span><span>{t.replace(/^[-*•]\s/, '')}</span></div>;
        if (/^\d+[.)]\s/.test(t)) return <div key={i} style={{ display: 'flex', gap: 9, marginTop: 5 }}><span style={{ color: AC, fontWeight: 700, minWidth: 16 }}>{t.match(/^\d+/)?.[0]}.</span><span>{t.replace(/^\d+[.)]\s/, '')}</span></div>;
        return <div key={i} style={{ marginTop: 4 }}>{t}</div>;
      })}
    </div>
  );
}

// ---- Video embebido (mp4/webm nativo, YouTube/Vimeo iframe) ----
function Video({ url }: { url: string }) {
  const u = url.trim();
  if (/\.(mp4|webm|mov|ogg)(\?|$)/i.test(u)) return <video src={u} controls style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 380 }} />;
  let embed = '';
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(\d+)/);
  if (vm) embed = `https://player.vimeo.com/video/${vm[1]}`;
  if (embed) return <div style={{ position: 'relative', paddingBottom: '56%', height: 0, borderRadius: 12, overflow: 'hidden' }}><iframe src={embed} allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} /></div>;
  return <a href={u} target="_blank" rel="noreferrer" style={{ color: AC, fontSize: 14, fontWeight: 600 }}>▶ Ver video</a>;
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 860, margin: '0 auto', padding: '18px 16px 90px' },
  card: { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 16, padding: 18 },
  stat: { background: 'var(--card,#1b2338)', borderRadius: 14, padding: '14px 16px', flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', gap: 12 },
  btnP: { background: AC, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 },
  btn: { background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  pill: (bg: string, fg: string): React.CSSProperties => ({ fontSize: 12, background: bg, color: fg, padding: '4px 11px', borderRadius: 30, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }),
};
const tint = (hex: string, a = 0.15) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

export default function TrainingClient() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const L = (es: string, en: string) => (lang === 'es' ? es : en);
  const [home, setHome] = useState<any>(null);
  const [access, setAccess] = useState<'loading' | 'no' | 'off' | 'yes'>('loading');
  const [detail, setDetail] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null); // lección abierta
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attested, setAttested] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { try { const m = document.cookie.match(/onyx_lang=(\w+)/); if (m && m[1] === 'en') setLang('en'); } catch {} }, []);
  useEffect(() => { loadHome(); }, [lang]);

  async function loadHome() {
    const r = await fetch('/api/training?lang=' + lang).then((x) => x.json()).catch(() => null);
    if (!r) { setAccess('no'); return; }
    if (r.enabled === false) { setAccess('off'); return; }
    if (!r.access) { setAccess('no'); return; }
    setAccess('yes'); setHome(r);
  }
  async function openTrack(id: string) {
    setBusy(true); setResult(null); setAnswers({}); setAttested(false); setErr(''); setOpen(null);
    const r = await fetch('/api/training?lang=' + lang + '&track=' + id).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.detail) { setDetail(r.detail); setOpen(r.detail.lessons.find((l: any) => !l.done)?.id || r.detail.lessons[0]?.id || null); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
  async function toggleLesson(id: string, done: boolean) {
    setDetail((d: any) => ({ ...d, lessons: d.lessons.map((l: any) => l.id === id ? { ...l, done } : l) }));
    await fetch('/api/training', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'mark_lesson', lesson_id: id, done, lang }) });
    if (done) { const ls = detail.lessons; const idx = ls.findIndex((l: any) => l.id === id); const next = ls.slice(idx + 1).find((l: any) => !l.done); setOpen(next ? next.id : null); }
  }
  async function submitExam() {
    const qs = detail?.exam?.questions || [];
    if (Object.keys(answers).length < qs.length) { setErr(L('Responde todas las preguntas.', 'Answer every question.')); return; }
    if (detail.exam.attestRequired && !attested) { setErr(L('Marca la casilla de honestidad.', 'Check the honesty box.')); return; }
    setErr(''); setBusy(true);
    const r = await fetch('/api/training', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit_exam', track_id: detail.track.id, answers, attested, lang }) }).then((x) => x.json());
    setBusy(false);
    if (!r?.ok) { setErr(r?.error || 'Error'); return; }
    setResult(r); loadHome();
  }

  if (access === 'loading') return <div style={S.wrap}><div style={{ color: 'var(--mut,#9aa6bd)', textAlign: 'center', padding: 50 }}>{L('Cargando…', 'Loading…')}</div></div>;
  if (access === 'off') return <Notice title={L('Formación no disponible', 'Training unavailable')} body={L('El área está temporalmente desactivada.', 'The area is temporarily disabled.')} />;
  if (access === 'no') return <Notice title={L('Sin acceso a la formación', 'No training access')} body={L('Tu cuenta aún no tiene acceso. Pídele a tu supervisor que te active.', 'Ask your supervisor to enable your access.')} />;

  // ============ DETALLE DE RUTA ============
  if (detail) {
    const ex = detail.exam || {};
    const doneN = detail.lessons.filter((l: any) => l.done).length;
    const prog = detail.lessons.length ? Math.round((doneN / detail.lessons.length) * 100) : 0;
    // Candado del examen calculado EN VIVO (no con el estado viejo del servidor):
    // al marcar la última lección, el examen se desbloquea al instante.
    const doneAll = detail.lessons.length === 0 || detail.lessons.every((l: any) => l.done);
    const canTake = ex.passed || (ex.attemptsLeft !== 0 && ex.cooldownLeft === 0 && (!ex.requireLessons || doneAll));
    return (
      <div style={S.wrap}>
        <button style={{ ...S.btn, marginBottom: 14 }} onClick={() => { setDetail(null); setResult(null); }}>← {L('Volver', 'Back')}</button>

        <div style={{ ...S.card, background: `linear-gradient(135deg, ${tint('#8b93ff', 0.16)}, var(--panel,#161c2e))`, borderColor: tint('#8b93ff', 0.4), display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <Ring pct={prog} size={64} stroke={6}>{prog}%</Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{detail.track.title}</div>
            {detail.track.summary && <div style={{ fontSize: 13.5, color: 'var(--mut,#9aa6bd)', marginTop: 4 }}>{detail.track.summary}</div>}
            <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginTop: 6 }}>{doneN}/{detail.lessons.length} {L('lecciones', 'lessons')}</div>
          </div>
        </div>

        {/* Lecciones (stepper) */}
        <div style={{ position: 'relative' }}>
          {detail.lessons.map((l: any, i: number) => (
            <LessonStep key={l.id} l={l} i={i} last={i === detail.lessons.length - 1} isOpen={open === l.id} L={L}
              minRead={detail.minReadSec || 0} onToggleOpen={() => setOpen(open === l.id ? null : l.id)} onDone={(v: boolean) => toggleLesson(l.id, v)} />
          ))}
        </div>

        {/* Examen */}
        {ex.questions?.length > 0 && (
          <div style={{ ...S.card, marginTop: 18, borderColor: tint('#8b93ff', 0.5) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ color: AC }}><OnyxIcon name="check" size={20} /></span>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{L('Examen', 'Exam')}</div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 16 }}>
              {L('Nota mínima', 'Pass score')} {detail.track.passScore} · {ex.attemptsLeft === -1 ? L('intentos ilimitados', 'unlimited attempts') : `${ex.attemptsLeft} ${L('intentos restantes', 'attempts left')}`}
            </div>

            {result ? (
              <ResultView result={result} trackId={detail.track.id} lang={lang} L={L} onBack={() => { setDetail(null); setResult(null); }} />
            ) : !canTake ? (
              <div style={{ ...S.pill(tint(WARN, 0.15), WARN), padding: '12px 14px', display: 'block', textAlign: 'center' }}>
                {ex.requireLessons && !doneAll ? L('Completa todas las lecciones para desbloquear el examen.', 'Finish all lessons to unlock the exam.')
                  : ex.cooldownLeft > 0 ? L(`Espera ${ex.cooldownLeft} min antes de reintentar.`, `Wait ${ex.cooldownLeft} min before retrying.`)
                    : L('Sin intentos disponibles. Contacta a tu supervisor.', 'No attempts left. Contact your supervisor.')}
              </div>
            ) : (
              <div>
                {ex.questions.map((q: any, qi: number) => (
                  <div key={q.id} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 10 }}>{qi + 1}. {q.prompt}</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {(q.options || []).map((op: any, oi: number) => {
                        const val = typeof op === 'object' ? op.i : oi;
                        const txt = typeof op === 'object' ? op.text : op;
                        const sel = answers[q.id] === val;
                        return (
                          <div key={oi} onClick={() => setAnswers((a) => ({ ...a, [q.id]: val }))}
                            style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 14.5,
                              border: '1.5px solid ' + (sel ? AC : 'var(--line,#2a3350)'), background: sel ? tint('#8b93ff', 0.1) : 'var(--card,#1b2338)', transition: 'all .12s' }}>
                            <span style={{ width: 20, height: 20, borderRadius: '50%', flex: '0 0 20px', border: '2px solid ' + (sel ? AC : 'var(--mut,#9aa6bd)'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {sel && <span style={{ width: 10, height: 10, borderRadius: '50%', background: AC }} />}
                            </span>
                            <span style={{ color: 'var(--tx,#e8ecf5)', flex: 1 }}>{txt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {ex.attestRequired && (
                  <label onClick={() => setAttested(!attested)} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', cursor: 'pointer', marginBottom: 14 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, flex: '0 0 20px', border: '2px solid ' + (attested ? AC : 'var(--mut,#9aa6bd)'), background: attested ? AC : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>{attested ? '✓' : ''}</span>
                    <span style={{ fontSize: 13, color: 'var(--tx,#e8ecf5)', lineHeight: 1.5 }}>{L('Declaro que respondo este examen por mí mismo, sin ayuda externa.', 'I declare I am taking this exam myself, without outside help.')}</span>
                  </label>
                )}

                {err && <div style={{ color: BAD, fontSize: 13.5, marginBottom: 10 }}>{err}</div>}
                <button style={{ ...S.btnP, width: '100%', justifyContent: 'center', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submitExam}>{busy ? L('Enviando…', 'Submitting…') : L('Enviar examen', 'Submit exam')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============ HOME ============
  const st = home?.stats || {};
  const pendingReq = (home?.tracks || []).filter((t: any) => t.required && t.examStatus !== 'passed');
  return (
    <div style={S.wrap}>
      {/* Hero */}
      <div style={{ ...S.card, background: `linear-gradient(135deg, ${tint('#8b93ff', 0.18)}, var(--panel,#161c2e))`, borderColor: tint('#8b93ff', 0.35), display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 15, background: tint('#8b93ff', 0.22), color: AC, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><OnyxIcon name="graduation" size={28} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{home?.brand || 'Onyx Academy'}</div>
          <div style={{ fontSize: 13.5, color: 'var(--mut,#9aa6bd)' }}>{L('Tu área de estudio y certificación', 'Your study and certification area')}</div>
        </div>
        <Ring pct={st.progress || 0} size={62} stroke={6}>{st.progress || 0}%</Ring>
      </div>

      {/* Onboarding banner */}
      {pendingReq.length > 0 && (
        <div style={{ ...S.card, padding: '13px 16px', marginBottom: 14, borderColor: tint(WARN, 0.5), background: tint(WARN, 0.08), display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ color: WARN, flexShrink: 0 }}><OnyxIcon emoji="⚠️" name="warn" size={20} /></span>
          <div style={{ fontSize: 13.5, color: 'var(--tx,#e8ecf5)' }}>{L(`Tienes ${pendingReq.length} curso(s) obligatorio(s) por aprobar para completar tu onboarding.`, `You have ${pendingReq.length} required course(s) left to finish onboarding.`)}</div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={S.stat}><Ring pct={st.avgScore || 0} size={44} color={OK}>{st.avgScore || 0}</Ring><div><div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>{L('Promedio', 'Average')}</div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{L('exámenes', 'exams')}</div></div></div>
        <div style={S.stat}><div style={{ width: 44, height: 44, borderRadius: 12, background: tint('#8b93ff', 0.15), color: AC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, flexShrink: 0 }}>{st.certs || 0}</div><div><div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>{L('Certificados', 'Certificates')}</div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{L('de', 'of')} {st.tracks || 0}</div></div></div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', margin: '4px 0 11px', fontWeight: 600, letterSpacing: 0.3 }}>{L('RUTAS DE ESTUDIO', 'STUDY TRACKS')}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {(home?.tracks || []).map((t: any) => {
          const st2 = t.examStatus;
          const ringColor = st2 === 'passed' ? OK : st2 === 'failed' ? BAD : AC;
          return (
            <div key={t.id} style={{ ...S.card, opacity: t.locked ? 0.65 : 1, display: 'flex', gap: 15, alignItems: 'center' }}>
              <Ring pct={t.progress} size={52} stroke={5} color={ringColor}>
                <span style={{ color: ringColor }}><OnyxIcon name={t.icon || 'book'} emoji="📘" size={18} /></span>
              </Ring>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{t.title}</div>
                  {t.required && <span style={S.pill(tint(WARN, 0.15), WARN)}>{L('obligatoria', 'required')}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginTop: 3 }}>{t.done}/{t.lessons} {L('lecciones', 'lessons')} · {t.progress}%</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {t.locked ? (
                    <span style={S.pill('var(--card,#1b2338)', 'var(--mut,#9aa6bd)')}>🔒 {L('Aprueba', 'Pass')}: {t.prereqTitle}</span>
                  ) : (
                    <button style={{ ...S.btnP, padding: '9px 16px', fontSize: 13.5 }} onClick={() => openTrack(t.id)}>
                      {st2 === 'passed' ? L('Repasar', 'Review') : t.progress > 0 || st2 !== 'none' ? L('Continuar', 'Continue') : L('Empezar', 'Start')} →
                    </button>
                  )}
                  {st2 === 'passed' && <span style={S.pill(tint(OK, 0.15), OK)}>✓ {t.bestScore}</span>}
                  {st2 === 'failed' && <span style={S.pill(tint(BAD, 0.15), BAD)}>{L('Reintentar', 'Retry')} {t.bestScore}</span>}
                  {t.cert && !t.cert.expired && <a href={`/api/training/cert?track=${t.id}&lang=${lang}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: AC, fontWeight: 600, textDecoration: 'none' }}>↓ {L('Certificado', 'Certificate')}</a>}
                  {t.cert && t.cert.expired && <span style={S.pill(tint(WARN, 0.15), WARN)}>{L('Recertifica', 'Recertify')}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {(home?.tracks || []).length === 0 && <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 14, padding: 24, textAlign: 'center' }}>{L('Aún no hay rutas asignadas a tu rol.', 'No tracks assigned to your role yet.')}</div>}
    </div>
  );
}

// ---- Paso de lección (acordeón + temporizador de lectura) ----
function LessonStep({ l, i, last, isOpen, L, minRead, onToggleOpen, onDone }: any) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen || l.done) return;
    startRef.current = Date.now() - elapsed * 1000;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (startRef.current || Date.now())) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isOpen, l.done]);
  const remain = Math.max(0, minRead - elapsed);
  const canMark = l.done || remain === 0;
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
      {/* rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: l.done ? OK : isOpen ? AC : 'var(--card,#1b2338)', color: l.done || isOpen ? '#fff' : 'var(--mut,#9aa6bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, border: '2px solid ' + (l.done ? OK : isOpen ? AC : 'var(--line,#2a3350)') }}>{l.done ? '✓' : i + 1}</div>
        {!last && <div style={{ width: 2, flex: 1, background: 'var(--line,#2a3350)', marginTop: 2, minHeight: 14 }} />}
      </div>
      {/* card */}
      <div style={{ flex: 1, minWidth: 0, ...S.card, padding: 0, overflow: 'hidden', marginBottom: 2 }}>
        <div onClick={onToggleOpen} style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{l.title}</div>
          {l.done && <span style={S.pill(tint(OK, 0.15), OK)}>{L('Visto', 'Done')}</span>}
          <span style={{ color: 'var(--mut,#9aa6bd)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', fontSize: 12 }}>▾</span>
        </div>
        {isOpen && (
          <div style={{ padding: '0 16px 16px' }}>
            {l.video && <div style={{ marginBottom: 12 }}><Video url={l.video} /></div>}
            <Body text={l.body} />
            {l.doc && <a href={l.doc} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', color: AC, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}><i /> 📄 {l.docName || L('Descargar material', 'Download material')}</a>}
            <button disabled={!canMark} onClick={() => onDone(!l.done)}
              style={{ ...(l.done ? S.btn : S.btnP), marginTop: 14, opacity: canMark ? 1 : 0.55, cursor: canMark ? 'pointer' : 'default' }}>
              {l.done ? L('✓ Visto (deshacer)', '✓ Done (undo)') : canMark ? L('Marcar como visto', 'Mark as done') : L(`Lee ${remain}s…`, `Read ${remain}s…`)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Resultado del examen ----
function ResultView({ result, trackId, lang, L, onBack }: any) {
  const passed = result.passed;
  const color = passed ? OK : BAD;
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
        <Ring pct={result.score} size={110} stroke={9} color={color}><span style={{ fontSize: 26 }}>{result.score}</span></Ring>
        <div style={{ fontSize: 17, fontWeight: 700, color, marginTop: 12 }}>{passed ? L('¡Aprobado!', 'Passed!') : L('No alcanzaste la nota', 'Not enough to pass')}</div>
        <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginTop: 3 }}>{result.correct}/{result.total} {L('correctas', 'correct')}{result.certIssued ? ' · ' + L('Certificado emitido', 'Certificate issued') : ''}</div>
        {!passed && result.hidden && <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginTop: 8, maxWidth: 380, margin: '8px auto 0' }}>{L('Repasa las lecciones y vuelve a intentarlo. No mostramos las respuestas correctas para cuidar la integridad del examen.', 'Review the lessons and try again. Correct answers are hidden to protect exam integrity.')}</div>}
      </div>
      {result.certIssued && <a href={`/api/training/cert?track=${trackId}&lang=${lang}`} target="_blank" rel="noreferrer" style={{ ...S.btnP, width: '100%', justifyContent: 'center', textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' }}>↓ {L('Descargar certificado (PDF)', 'Download certificate (PDF)')}</a>}
      <button style={{ ...S.btn, width: '100%' }} onClick={onBack}>{L('Volver a mis rutas', 'Back to my tracks')}</button>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div style={S.wrap}><div style={{ ...S.card, textAlign: 'center', padding: 34 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--mut,#9aa6bd)', marginTop: 8 }}>{body}</div>
    </div></div>
  );
}
