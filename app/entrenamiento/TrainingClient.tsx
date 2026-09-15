'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Convierte un texto sencillo (markdown ligero) en párrafos y listas legibles.
function Body({ text }: { text: string }) {
  const lines = String(text || '').split('\n');
  return (
    <div style={{ fontSize: 14.5, color: 'var(--tx,#e8ecf5)', lineHeight: 1.7 }}>
      {lines.map((ln, i) => {
        const t = ln.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (/^#{1,3}\s/.test(t)) return <div key={i} style={{ fontWeight: 600, fontSize: 15.5, margin: '10px 0 2px' }}>{t.replace(/^#{1,3}\s/, '')}</div>;
        if (/^[-*]\s/.test(t)) return <div key={i} style={{ display: 'flex', gap: 8, marginTop: 3 }}><span style={{ color: 'var(--accent,#8b93ff)' }}>•</span><span>{t.replace(/^[-*]\s/, '')}</span></div>;
        if (/^\d+[.)]\s/.test(t)) return <div key={i} style={{ display: 'flex', gap: 8, marginTop: 3 }}><span style={{ color: 'var(--accent,#8b93ff)', fontWeight: 600 }}>{t.match(/^\d+/)?.[0]}.</span><span>{t.replace(/^\d+[.)]\s/, '')}</span></div>;
        return <div key={i} style={{ marginTop: 3 }}>{t}</div>;
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 900, margin: '0 auto', padding: '20px 16px 80px' },
  card: { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 16 },
  stat: { background: 'var(--card,#1b2338)', borderRadius: 12, padding: '12px 14px', flex: 1, minWidth: 120 },
  statN: { fontSize: 24, fontWeight: 600, color: 'var(--tx,#e8ecf5)' },
  statL: { fontSize: 12.5, color: 'var(--mut,#9aa6bd)' },
  bar: { height: 7, background: 'var(--bg,#0e1322)', borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  btnP: { background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' },
  btn: { background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  badge: (bg: string, fg: string): React.CSSProperties => ({ fontSize: 12, background: bg, color: fg, padding: '3px 10px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }),
};

export default function TrainingClient() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const L = (es: string, en: string) => (lang === 'es' ? es : en);
  const [home, setHome] = useState<any>(null);
  const [access, setAccess] = useState<'loading' | 'no' | 'off' | 'yes'>('loading');
  const [detail, setDetail] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try { const m = document.cookie.match(/onyx_lang=(\w+)/); if (m && m[1] === 'en') setLang('en'); } catch {}
  }, []);
  useEffect(() => { loadHome(); }, [lang]);

  async function loadHome() {
    const r = await fetch('/api/training?lang=' + lang).then((x) => x.json()).catch(() => null);
    if (!r) { setAccess('no'); return; }
    if (r.enabled === false) { setAccess('off'); return; }
    if (!r.access) { setAccess('no'); return; }
    setAccess('yes'); setHome(r);
  }

  async function openTrack(id: string) {
    setBusy(true); setResult(null); setAnswers({}); setErr('');
    const r = await fetch('/api/training?lang=' + lang + '&track=' + id).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.detail) { setDetail(r.detail); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  async function toggleLesson(lessonId: string, done: boolean) {
    setDetail((d: any) => ({ ...d, lessons: d.lessons.map((l: any) => l.id === lessonId ? { ...l, done } : l) }));
    await fetch('/api/training', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'mark_lesson', lesson_id: lessonId, done, lang }) });
  }

  async function submitExam() {
    const qs = detail?.exam?.questions || [];
    if (Object.keys(answers).length < qs.length) { setErr(L('Responde todas las preguntas antes de enviar.', 'Answer every question before submitting.')); return; }
    setErr(''); setBusy(true);
    const r = await fetch('/api/training', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit_exam', track_id: detail.track.id, answers, lang }) }).then((x) => x.json());
    setBusy(false);
    if (!r?.ok) { setErr(r?.error || 'Error'); return; }
    setResult(r); loadHome();
  }

  if (access === 'loading') return <div style={S.wrap}><div style={{ color: 'var(--mut,#9aa6bd)', textAlign: 'center', padding: 40 }}>{L('Cargando…', 'Loading…')}</div></div>;
  if (access === 'off') return <Notice title={L('Formación no disponible', 'Training unavailable')} body={L('El área de formación está temporalmente desactivada.', 'The training area is temporarily disabled.')} />;
  if (access === 'no') return <Notice title={L('Sin acceso a la formación', 'No training access')} body={L('Tu cuenta aún no tiene acceso al centro de formación. Pídele a tu supervisor que te active.', 'Your account has no training access yet. Ask your supervisor to enable it.')} />;

  // -------- DETALLE DE RUTA --------
  if (detail) {
    const ex = detail.exam || {};
    const allDone = detail.lessons.length > 0 && detail.lessons.every((l: any) => l.done);
    return (
      <div style={S.wrap}>
        <button style={{ ...S.btn, marginBottom: 14 }} onClick={() => { setDetail(null); setResult(null); }}>← {L('Volver', 'Back')}</button>
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{detail.track.title}</div>
          {detail.track.summary && <div style={{ fontSize: 14, color: 'var(--mut,#9aa6bd)', marginTop: 6 }}>{detail.track.summary}</div>}
        </div>

        {detail.lessons.map((l: any, i: number) => (
          <div key={l.id} style={{ ...S.card, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: l.done ? 'var(--accent,#8b93ff)' : 'var(--card,#1b2338)', color: l.done ? '#fff' : 'var(--mut,#9aa6bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{l.done ? '✓' : i + 1}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{l.title}</div>
            </div>
            {l.video && <div style={{ marginBottom: 10 }}><a href={l.video} target="_blank" rel="noreferrer" style={{ color: 'var(--accent,#8b93ff)', fontSize: 13.5 }}>▶ {L('Ver video', 'Watch video')}</a></div>}
            <Body text={l.body} />
            <button style={{ ...(l.done ? S.btn : S.btnP), marginTop: 12 }} onClick={() => toggleLesson(l.id, !l.done)}>
              {l.done ? L('✓ Visto (deshacer)', '✓ Done (undo)') : L('Marcar como visto', 'Mark as done')}
            </button>
          </div>
        ))}

        {/* EXAMEN */}
        {ex.questions?.length > 0 && (
          <div style={{ ...S.card, marginTop: 16, borderColor: 'var(--accent,#8b93ff)' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 4 }}>{L('Examen', 'Exam')}</div>
            <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 14 }}>
              {L('Nota mínima', 'Pass score')}: {detail.track.passScore}/100 · {ex.attemptsLeft === -1 ? L('intentos ilimitados', 'unlimited attempts') : `${ex.attemptsLeft} ${L('intentos restantes', 'attempts left')}`}
            </div>

            {result ? (
              <div>
                <div style={{ textAlign: 'center', padding: '18px 0' }}>
                  <div style={{ fontSize: 42, fontWeight: 700, color: result.passed ? 'var(--accent,#8b93ff)' : '#e2555a' }}>{result.score}<span style={{ fontSize: 18, color: 'var(--mut,#9aa6bd)' }}>/100</span></div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: result.passed ? 'var(--accent,#8b93ff)' : '#e2555a', marginTop: 4 }}>{result.passed ? L('¡Aprobado!', 'Passed!') : L('No alcanzaste la nota', 'Not enough to pass')}</div>
                  <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>{result.correct}/{result.total} {L('correctas', 'correct')}{result.certIssued ? ' · ' + L('Certificado emitido', 'Certificate issued') : ''}</div>
                </div>
                {result.certIssued && <a href={`/api/training/cert?track=${detail.track.id}&lang=${lang}`} target="_blank" rel="noreferrer" style={{ ...S.btnP, width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' }}>↓ {L('Descargar certificado (PDF)', 'Download certificate (PDF)')}</a>}
                <button style={{ ...S.btn, width: '100%' }} onClick={() => { setDetail(null); setResult(null); }}>{L('Volver a mis rutas', 'Back to my tracks')}</button>
              </div>
            ) : !ex.canTake ? (
              <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 14 }}>{L('Sin intentos disponibles. Contacta a tu supervisor.', 'No attempts left. Contact your supervisor.')}</div>
            ) : (
              <div>
                {!allDone && <div style={{ fontSize: 12.5, color: '#e0a03a', marginBottom: 12 }}>{L('Sugerencia: completa todas las lecciones antes del examen.', 'Tip: finish all lessons before the exam.')}</div>}
                {ex.questions.map((q: any, qi: number) => (
                  <div key={q.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', marginBottom: 8 }}>{qi + 1}. {q.prompt}</div>
                    {(q.options || []).map((op: string, oi: number) => (
                      <label key={oi} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '9px 11px', borderRadius: 9, border: '1px solid ' + (answers[q.id] === oi ? 'var(--accent,#8b93ff)' : 'var(--line,#2a3350)'), background: answers[q.id] === oi ? 'rgba(139,147,255,.08)' : 'transparent', marginBottom: 6, cursor: 'pointer', fontSize: 14 }}>
                        <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                        <span style={{ color: 'var(--tx,#e8ecf5)' }}>{op}</span>
                      </label>
                    ))}
                  </div>
                ))}
                {err && <div style={{ color: '#e2555a', fontSize: 13, marginBottom: 10 }}>{err}</div>}
                <button style={{ ...S.btnP, width: '100%', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submitExam}>{busy ? L('Enviando…', 'Submitting…') : L('Enviar examen', 'Submit exam')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -------- HOME --------
  const st = home?.stats || {};
  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(139,147,255,.14)', color: 'var(--accent,#8b93ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><OnyxIcon name="graduation" size={22} /></div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{home?.brand || 'Onyx Academy'}</div>
          <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>{L('Tu área de estudio y certificación', 'Your study and certification area')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
        <div style={S.stat}><div style={S.statN}>{st.progress || 0}%</div><div style={S.statL}>{L('Progreso general', 'Overall progress')}</div></div>
        <div style={S.stat}><div style={S.statN}>{st.avgScore || 0}<span style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>/100</span></div><div style={S.statL}>{L('Promedio de exámenes', 'Exam average')}</div></div>
        <div style={S.stat}><div style={S.statN}>{st.certs || 0}<span style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>/{st.tracks || 0}</span></div><div style={S.statL}>{L('Certificados', 'Certificates')}</div></div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', margin: '4px 0 10px' }}>{L('Rutas de estudio', 'Study tracks')}</div>
      {(home?.tracks || []).map((t: any) => {
        const badge = t.examStatus === 'passed'
          ? S.badge('rgba(70,190,120,.16)', '#4bbd7c')
          : t.examStatus === 'failed' ? S.badge('rgba(226,85,90,.16)', '#e2555a') : S.badge('var(--card,#1b2338)', 'var(--mut,#9aa6bd)');
        const badgeTxt = t.examStatus === 'passed' ? L('Aprobado', 'Passed') + ' ' + t.bestScore : t.examStatus === 'failed' ? L('Reintentar', 'Retry') + ' ' + t.bestScore : L('Pendiente', 'Pending');
        return (
          <div key={t.id} style={{ ...S.card, marginBottom: 10, opacity: t.locked ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ color: 'var(--accent,#8b93ff)', flexShrink: 0 }}><OnyxIcon name={t.icon || 'book'} emoji="📘" size={22} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>{t.lessons} {L('lecciones', 'lessons')} · {t.done}/{t.lessons} {L('vistas', 'done')}{t.gateLeads ? ' · ' + L('requisito', 'required') : ''}</div>
              </div>
              <span style={badge}>{badgeTxt}</span>
            </div>
            <div style={S.bar}><div style={{ width: t.progress + '%', height: '100%', background: t.examStatus === 'passed' ? '#4bbd7c' : 'var(--accent,#8b93ff)' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {t.locked ? (
                <span style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>🔒 {L('Aprueba primero', 'Pass first')}: {t.prereqTitle}</span>
              ) : (
                <button style={S.btnP} onClick={() => openTrack(t.id)}>{t.progress > 0 || t.examStatus !== 'none' ? L('Continuar', 'Continue') : L('Empezar', 'Start')}</button>
              )}
              {t.cert && !t.cert.expired && <span style={S.badge('rgba(139,147,255,.14)', 'var(--accent,#8b93ff)')}>{L('Certificado', 'Certified')} {t.cert.score}</span>}
              {t.cert && t.cert.expired && <span style={S.badge('rgba(224,160,58,.16)', '#e0a03a')}>{L('Recertifica', 'Recertify')}</span>}
              {t.cert && <a href={`/api/training/cert?track=${t.id}&lang=${lang}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent,#8b93ff)', fontWeight: 600, textDecoration: 'none' }}>↓ {L('Certificado PDF', 'PDF certificate')}</a>}
            </div>
          </div>
        );
      })}
      {(home?.tracks || []).length === 0 && <div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 14, padding: 20, textAlign: 'center' }}>{L('Aún no hay rutas asignadas a tu rol.', 'No tracks assigned to your role yet.')}</div>}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div style={S.wrap}>
      <div style={{ ...S.card, textAlign: 'center', padding: 30 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--mut,#9aa6bd)', marginTop: 8 }}>{body}</div>
      </div>
    </div>
  );
}
