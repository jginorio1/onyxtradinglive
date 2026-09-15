import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// ONYX TRAINING — Academia INTERNA (empleados + vendedores).
// Área de estudio con rutas, lecciones, exámenes, rendimiento y certificados.
// Aislada por completo de las academias de los mentores (academy_*). Todo se
// sirve desde el backend con el service role; el acceso se controla por persona.
// ============================================================

export type Lang = 'es' | 'en';

export type TrainingSettings = {
  enabled: boolean;
  brand_name: string;
  pass_score: number;        // nota mínima por defecto (una ruta puede sobreescribir)
  max_attempts: number;      // intentos por defecto (0 = ilimitado)
  remind_pending: boolean;   // recordar cursos pendientes
  remind_cert_days: number;  // avisar X días antes de que caduque un certificado
  auto_enroll_sales: boolean;
  auto_enroll_staff: boolean;
  gating_enabled: boolean;   // bloquear leads a quien no aprobó las rutas requisito
  // --- anti-trampa ---
  require_lessons: boolean;  // exige completar todas las lecciones antes del examen
  attempt_cooldown_min: number; // minutos de espera entre intentos (0 = sin espera)
  shuffle_options: boolean;  // baraja el orden de las opciones en cada intento
  hide_answers_on_fail: boolean; // no revela las respuestas correctas si repruebas
  email_cert: boolean;       // envía el certificado por correo al aprobar
  require_attestation: boolean; // exige la casilla "respondí yo mismo" al enviar
  min_read_sec: number;      // segundos mínimos en una lección antes de marcarla
  onboarding_block: boolean; // muestra aviso de onboarding obligatorio hasta certificar
  // --- certificado ---
  signer_name: string;       // nombre de quien firma el certificado
  signer_role: string;       // cargo del firmante (p. ej. "Dirección de Formación")
};

const DEFAULTS: TrainingSettings = {
  enabled: true,
  brand_name: 'Onyx Academy · Formación interna',
  pass_score: 80,
  max_attempts: 3,
  remind_pending: true,
  remind_cert_days: 15,
  auto_enroll_sales: true,
  auto_enroll_staff: true,
  gating_enabled: false,
  require_lessons: true,
  attempt_cooldown_min: 5,
  shuffle_options: true,
  hide_answers_on_fail: true,
  email_cert: true,
  require_attestation: true,
  min_read_sec: 15,
  onboarding_block: false,
  signer_name: 'Onyx Trading Live',
  signer_role: 'Dirección de Formación',
};

export async function trainingSettings(): Promise<TrainingSettings> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'training').maybeSingle();
    return { ...DEFAULTS, ...((data?.value as any) || {}) };
  } catch { return DEFAULTS; }
}

export async function saveTrainingSettings(patch: Partial<TrainingSettings>): Promise<TrainingSettings> {
  const prev = await trainingSettings();
  const next = { ...prev, ...patch };
  await supabaseAdmin.from('app_settings').upsert({ key: 'training', value: next as any }, { onConflict: 'key' });
  return next;
}

const T = (r: any, base: string, lang: Lang) => (lang === 'en' ? (r[base + '_en'] || r[base + '_es']) : (r[base + '_es'] || r[base + '_en'])) || '';

// -------- ACCESO --------
export async function accessFor(userId: string): Promise<any | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin.from('training_access').select('*').eq('user_id', userId).maybeSingle();
  return data || null;
}
export async function hasTrainingAccess(userId: string): Promise<boolean> {
  const a = await accessFor(userId);
  return !!(a && a.active);
}

// -------- HOME DEL ALUMNO --------
// Rutas que aplican a su rol (o todas si la ruta no fija roles), con progreso,
// estado de examen, intentos restantes, certificado y bloqueo por prerrequisito.
export async function learnerHome(userId: string, lang: Lang = 'es') {
  const s = await trainingSettings();
  const acc = await accessFor(userId);
  const role = acc?.role || 'staff';

  const { data: tracksRaw } = await supabaseAdmin.from('training_tracks').select('*').eq('active', true).order('sort', { ascending: true });
  const tracks = (tracksRaw || []).filter((t: any) => !t.required_for?.length || t.required_for.includes(role));

  const [{ data: prog }, { data: attempts }, { data: certs }, { data: lessonRows }] = await Promise.all([
    supabaseAdmin.from('training_progress').select('lesson_id').eq('user_id', userId),
    supabaseAdmin.from('training_attempts').select('track_id,score,passed').eq('user_id', userId),
    supabaseAdmin.from('training_certificates').select('track_id,score,issued_at,expires_at').eq('user_id', userId),
    supabaseAdmin.from('training_lessons').select('id,track_id'),
  ]);
  const doneSet = new Set((prog || []).map((p: any) => p.lesson_id));
  const lessonsByTrack: Record<string, string[]> = {};
  for (const l of (lessonRows || []) as any[]) (lessonsByTrack[l.track_id] ||= []).push(l.id);
  const attByTrack: Record<string, any[]> = {};
  for (const a of (attempts || []) as any[]) (attByTrack[a.track_id] ||= []).push(a);
  const certByTrack: Record<string, any> = {};
  for (const c of (certs || []) as any[]) certByTrack[c.track_id] = c;

  const passedTrackIds = new Set((attempts || []).filter((a: any) => a.passed).map((a: any) => a.track_id));

  const out = tracks.map((t: any) => {
    const lids = lessonsByTrack[t.id] || [];
    const done = lids.filter((id) => doneSet.has(id)).length;
    const att = attByTrack[t.id] || [];
    const best = att.reduce((m, a) => Math.max(m, a.score || 0), 0);
    const passed = att.some((a) => a.passed);
    const attemptsUsed = att.length;
    const attemptsLeft = t.max_attempts > 0 ? Math.max(0, t.max_attempts - attemptsUsed) : -1; // -1 = ilimitado
    const cert = certByTrack[t.id] || null;
    const certExpired = cert?.expires_at ? new Date(cert.expires_at).getTime() < Date.now() : false;
    const locked = !!t.prereq_track_id && !passedTrackIds.has(t.prereq_track_id);
    const prereq = t.prereq_track_id ? tracks.find((x: any) => x.id === t.prereq_track_id) : null;
    return {
      id: t.id, slug: t.slug, icon: t.icon,
      title: T(t, 'title', lang), summary: T(t, 'summary', lang),
      lessons: lids.length, done,
      progress: lids.length ? Math.round((done / lids.length) * 100) : 0,
      examStatus: passed ? 'passed' : (attemptsUsed ? 'failed' : 'none'),
      bestScore: best, passScore: t.pass_score, attemptsLeft,
      cert: cert ? { score: cert.score, issued_at: cert.issued_at, expires_at: cert.expires_at, expired: certExpired } : null,
      locked, prereqTitle: prereq ? T(prereq, 'title', lang) : null,
      gateLeads: !!t.gate_leads,
      required: !!(t.required_for?.length && t.required_for.includes(role)),
    };
  });

  const totLessons = out.reduce((n, t) => n + t.lessons, 0);
  const totDone = out.reduce((n, t) => n + t.done, 0);
  const examScores = out.filter((t) => t.examStatus !== 'none').map((t) => t.bestScore);
  const stats = {
    progress: totLessons ? Math.round((totDone / totLessons) * 100) : 0,
    avgScore: examScores.length ? Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length) : 0,
    certs: out.filter((t) => t.cert && !t.cert.expired).length,
    tracks: out.length,
    active: !!acc?.active,
  };
  return { brand: s.brand_name, role, stats, tracks: out };
}

// -------- DETALLE DE RUTA (para estudiar + examen) --------
// Devuelve lecciones con estado y un examen SIN las respuestas correctas.
export async function trackDetail(userId: string, trackId: string, lang: Lang = 'es') {
  const s = await trainingSettings();
  const { data: t } = await supabaseAdmin.from('training_tracks').select('*').eq('id', trackId).maybeSingle();
  if (!t) return null;
  const [{ data: lessons }, { data: qs }, { data: prog }, { data: att }] = await Promise.all([
    supabaseAdmin.from('training_lessons').select('*').eq('track_id', trackId).order('sort', { ascending: true }),
    supabaseAdmin.from('training_questions').select('*').eq('track_id', trackId).order('sort', { ascending: true }),
    supabaseAdmin.from('training_progress').select('lesson_id').eq('user_id', userId),
    supabaseAdmin.from('training_attempts').select('passed,created_at').eq('user_id', userId).eq('track_id', trackId).order('created_at', { ascending: false }),
  ]);
  const doneSet = new Set((prog || []).map((p: any) => p.lesson_id));
  const attemptsUsed = (att || []).length;
  const passed = (att || []).some((a: any) => a.passed);
  const attemptsLeft = (t as any).max_attempts > 0 ? Math.max(0, (t as any).max_attempts - attemptsUsed) : -1;
  const lessonsList = (lessons || []) as any[];
  const lessonsDone = lessonsList.length > 0 && lessonsList.every((l: any) => doneSet.has(l.id));

  // Cooldown entre intentos (anti fuerza-bruta).
  let cooldownLeft = 0;
  if (!passed && s.attempt_cooldown_min > 0 && (att || [])[0]) {
    const last = new Date((att as any)[0].created_at).getTime();
    const mins = (Date.now() - last) / 60000;
    cooldownLeft = Math.max(0, Math.ceil(s.attempt_cooldown_min - mins));
  }
  const lessonsBlock = s.require_lessons && !passed && !lessonsDone;

  // Banco al azar: si exam_count > 0, tomamos ese nº de preguntas mezcladas.
  const shuf = (arr: any[]) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let bank = shuf(qs || []);
  if ((t as any).exam_count > 0) bank = bank.slice(0, (t as any).exam_count);

  return {
    track: { id: t.id, slug: (t as any).slug, title: T(t, 'title', lang), summary: T(t, 'summary', lang), passScore: (t as any).pass_score },
    minReadSec: s.min_read_sec || 0,
    lessons: lessonsList.map((l: any) => ({ id: l.id, title: T(l, 'title', lang), body: T(l, 'body', lang), video: l.video_url || null, doc: l.doc_url || null, docName: l.doc_name || null, done: doneSet.has(l.id) })),
    exam: {
      passScore: (t as any).pass_score, attemptsLeft, passed,
      lessonsDone, requireLessons: s.require_lessons, cooldownLeft, attestRequired: s.require_attestation,
      canTake: passed || (attemptsLeft !== 0 && cooldownLeft === 0 && !lessonsBlock),
      questions: bank.map((q: any) => {
        // Cada opción lleva su índice original; barajamos el orden para que no se
        // memorice "la respuesta es la B". El cliente devuelve el índice original.
        const src = (lang === 'en' ? q.options_en : q.options_es) || [];
        let opts = src.map((text: string, i: number) => ({ i, text }));
        if (s.shuffle_options) opts = shuf(opts);
        return { id: q.id, prompt: T(q, 'prompt', lang), options: opts };
      }),
    },
  };
}

export async function markLesson(userId: string, lessonId: string, done = true): Promise<void> {
  if (done) await supabaseAdmin.from('training_progress').upsert({ user_id: userId, lesson_id: lessonId, done: true, done_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
  else await supabaseAdmin.from('training_progress').delete().eq('user_id', userId).eq('lesson_id', lessonId);
}

// -------- CALIFICAR EXAMEN --------
// answers: { [questionId]: choiceIndex }. Califica solo las preguntas enviadas.
export async function submitExam(userId: string, trackId: string, answers: Record<string, number>, lang: Lang = 'es', meta: { attested?: boolean; ip?: string; ua?: string } = {}): Promise<{ ok: boolean; error?: string; score?: number; passed?: boolean; correct?: number; total?: number; results?: any[]; certIssued?: boolean; hidden?: boolean }> {
  const s = await trainingSettings();
  const en = lang === 'en';
  if (s.require_attestation && !meta.attested) return { ok: false, error: en ? 'Confirm you answered it yourself.' : 'Confirma que respondiste tú mismo.' };
  const { data: t } = await supabaseAdmin.from('training_tracks').select('*').eq('id', trackId).maybeSingle();
  if (!t) return { ok: false, error: 'ruta no encontrada' };

  const { data: att } = await supabaseAdmin.from('training_attempts').select('passed,created_at').eq('user_id', userId).eq('track_id', trackId).order('created_at', { ascending: false });
  const alreadyPassed = (att || []).some((a: any) => a.passed);
  const attemptsUsed = (att || []).length;
  if (!alreadyPassed && (t as any).max_attempts > 0 && attemptsUsed >= (t as any).max_attempts) {
    return { ok: false, error: en ? 'No attempts left. Contact your supervisor.' : 'Sin intentos disponibles. Contacta a tu supervisor.' };
  }
  // Anti-trampa: espera entre intentos.
  if (!alreadyPassed && s.attempt_cooldown_min > 0 && (att || [])[0]) {
    const mins = (Date.now() - new Date((att as any)[0].created_at).getTime()) / 60000;
    if (mins < s.attempt_cooldown_min) return { ok: false, error: en ? `Wait ${Math.ceil(s.attempt_cooldown_min - mins)} min before retrying.` : `Espera ${Math.ceil(s.attempt_cooldown_min - mins)} min antes de reintentar.` };
  }
  // Anti-trampa: exige completar las lecciones antes del examen.
  if (!alreadyPassed && s.require_lessons) {
    const [{ data: lrows }, { data: prow }] = await Promise.all([
      supabaseAdmin.from('training_lessons').select('id').eq('track_id', trackId),
      supabaseAdmin.from('training_progress').select('lesson_id').eq('user_id', userId),
    ]);
    const done = new Set((prow || []).map((p: any) => p.lesson_id));
    const all = (lrows || []) as any[];
    if (all.length && !all.every((l: any) => done.has(l.id))) return { ok: false, error: en ? 'Finish all lessons before the exam.' : 'Completa todas las lecciones antes del examen.' };
  }

  const ids = Object.keys(answers || {});
  if (!ids.length) return { ok: false, error: 'Responde el examen primero.' };
  const { data: qs } = await supabaseAdmin.from('training_questions').select('id,correct,explain_es,explain_en').in('id', ids);
  const byId: Record<string, any> = {};
  for (const q of (qs || []) as any[]) byId[q.id] = q;

  let correct = 0; const total = ids.length;
  const results = ids.map((id) => {
    const q = byId[id];
    const chosen = Number(answers[id]);
    const ok = q ? chosen === q.correct : false;
    if (ok) correct++;
    return { id, correct: ok, right: q?.correct ?? null, explain: q ? (lang === 'en' ? (q.explain_en || q.explain_es) : (q.explain_es || q.explain_en)) : '' };
  });
  const score = total ? Math.round((correct / total) * 100) : 0;
  const passed = score >= (t as any).pass_score;

  await supabaseAdmin.from('training_attempts').insert({ user_id: userId, track_id: trackId, score, passed, total, correct, attested: !!meta.attested, ip: meta.ip || null, user_agent: (meta.ua || '').slice(0, 300) || null });

  let certIssued = false;
  if (passed) {
    const months = (t as any).cert_months || 0;
    const expires = months > 0 ? new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toISOString() : null;
    const code = 'OT-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await supabaseAdmin.from('training_certificates').upsert(
      { user_id: userId, track_id: trackId, score, code, issued_at: new Date().toISOString(), expires_at: expires },
      { onConflict: 'user_id,track_id' });
    certIssued = true;
    // Aviso in-app (no bloquea si falla).
    try {
      const { notify } = await import('@/lib/notify');
      await notify(userId, { kind: 'training', title: en ? 'Course passed' : 'Curso aprobado', body: `${T(t, 'title', lang)} · ${score}/100`, url: '/entrenamiento' });
    } catch {}
    // Correo con enlace de descarga del certificado.
    if (s.email_cert) {
      try {
        const { data: p } = await supabaseAdmin.from('profiles').select('email,name,lang').eq('id', userId).maybeSingle();
        const em = (p as any)?.email;
        if (em) {
          const eu = ((p as any)?.lang === 'en') ? 'en' : lang;
          const enE = eu === 'en';
          const app = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';
          const url = `${app}/api/training/cert?track=${trackId}&lang=${eu}`;
          const title = T(t, 'title', eu);
          const { sendEmail } = await import('@/lib/mail');
          const subject = enE ? `Certificate: ${title}` : `Certificado: ${title}`;
          const body = enE
            ? `Congratulations ${(p as any)?.name || ''}! You passed "${title}" with ${score}/100.\n\nDownload your certificate (sign in first):\n${url}`
            : `¡Felicidades ${(p as any)?.name || ''}! Aprobaste "${title}" con ${score}/100.\n\nDescarga tu certificado (inicia sesión primero):\n${url}`;
          await sendEmail(em, subject, body, { kind: 'training_cert', userId });
        }
      } catch {}
    }
  }
  // Anti-trampa: si reprueba y está activado, NO revelamos las respuestas correctas
  // (solo la nota), para que no coseche el examen y lo repita.
  if (!passed && s.hide_answers_on_fail) return { ok: true, score, passed, correct, total, hidden: true };
  return { ok: true, score, passed, correct, total, results, certIssued };
}

// -------- GATING POR COMPETENCIA --------
// ¿La persona aprobó todas las rutas marcadas como requisito (gate_leads) que
// aplican a su rol? Si el gating está apagado, siempre true.
export async function competencyOk(userId: string): Promise<boolean> {
  const s = await trainingSettings();
  if (!s.gating_enabled) return true;
  const acc = await accessFor(userId);
  const role = acc?.role || 'vendedor';
  const { data: gates } = await supabaseAdmin.from('training_tracks').select('id,required_for').eq('active', true).eq('gate_leads', true);
  const need = (gates || []).filter((t: any) => !t.required_for?.length || t.required_for.includes(role));
  if (!need.length) return true;
  const { data: att } = await supabaseAdmin.from('training_attempts').select('track_id,passed').eq('user_id', userId).eq('passed', true);
  const passed = new Set((att || []).map((a: any) => a.track_id));
  // Además, respetar caducidad del certificado.
  const { data: certs } = await supabaseAdmin.from('training_certificates').select('track_id,expires_at').eq('user_id', userId);
  const valid = new Set((certs || []).filter((c: any) => !c.expires_at || new Date(c.expires_at).getTime() > Date.now()).map((c: any) => c.track_id));
  return need.every((t: any) => passed.has(t.id) && (valid.has(t.id) || true)); // el cert refuerza; el aprobado basta
}

// -------- DATOS DEL CERTIFICADO (para el PDF) --------
export async function certData(userId: string, trackId: string, lang: Lang = 'es'): Promise<{ brand: string; personName: string; trackTitle: string; score: number; code: string; issuedAt: string; expiresAt: string | null; signerName: string; signerRole: string; verifyUrl: string } | null> {
  const { data: cert } = await supabaseAdmin.from('training_certificates').select('*').eq('user_id', userId).eq('track_id', trackId).maybeSingle();
  if (!cert) return null;
  const s = await trainingSettings();
  const { data: t } = await supabaseAdmin.from('training_tracks').select('title_es,title_en').eq('id', trackId).maybeSingle();
  const { data: p } = await supabaseAdmin.from('profiles').select('name,email').eq('id', userId).maybeSingle();
  const app = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
  const code = (cert as any).code || '';
  // El emisor es la marca; el nombre del alumno cae al email antes que a "Onyx".
  const person = (p as any)?.name || (p as any)?.email || '';
  return {
    brand: s.brand_name,
    personName: person,
    trackTitle: t ? T(t, 'title', lang) : '',
    score: (cert as any).score || 0,
    code,
    issuedAt: (cert as any).issued_at,
    expiresAt: (cert as any).expires_at || null,
    signerName: s.signer_name || s.brand_name || 'Onyx Trading Live',
    signerRole: s.signer_role || 'Dirección de Formación',
    verifyUrl: `${app}/verificar-certificado?folio=${encodeURIComponent(code)}`,
  };
}

// Verificación pública de un folio de certificado (sin exponer datos sensibles).
export async function verifyCertificate(code: string): Promise<{ valid: boolean; personName?: string; trackTitle?: string; score?: number; issuedAt?: string; expiresAt?: string | null; expired?: boolean; brand?: string } | null> {
  const folio = String(code || '').trim();
  if (!folio) return { valid: false };
  const { data: cert } = await supabaseAdmin.from('training_certificates').select('*').eq('code', folio).maybeSingle();
  if (!cert) return { valid: false };
  const s = await trainingSettings();
  const [{ data: t }, { data: p }] = await Promise.all([
    supabaseAdmin.from('training_tracks').select('title_es,title_en').eq('id', (cert as any).track_id).maybeSingle(),
    supabaseAdmin.from('profiles').select('name,email').eq('id', (cert as any).user_id).maybeSingle(),
  ]);
  const exp = (cert as any).expires_at || null;
  const expired = !!exp && new Date(exp).getTime() < Date.now();
  return {
    valid: true,
    brand: s.brand_name,
    personName: (p as any)?.name || (p as any)?.email || '—',
    trackTitle: t ? (t.title_es || t.title_en || '') : '',
    score: (cert as any).score || 0,
    issuedAt: (cert as any).issued_at,
    expiresAt: exp,
    expired,
  };
}

// -------- ONBOARDING OBLIGATORIO --------
// ¿Completó las rutas obligatorias de su rol? Devuelve las pendientes para el
// aviso. Sirve para mostrar un banner que empuje a terminar la formación.
export async function onboardingStatus(userId: string, lang: Lang = 'es'): Promise<{ enabled: boolean; complete: boolean; pending: { id: string; title: string }[] }> {
  const s = await trainingSettings();
  const acc = await accessFor(userId);
  if (!acc || !acc.active) return { enabled: false, complete: true, pending: [] };
  const role = acc.role || 'staff';
  const { data: tracks } = await supabaseAdmin.from('training_tracks').select('id,title_es,title_en,required_for').eq('active', true);
  const req = (tracks || []).filter((t: any) => t.required_for?.length && t.required_for.includes(role));
  if (!req.length) return { enabled: s.onboarding_block, complete: true, pending: [] };
  const { data: att } = await supabaseAdmin.from('training_attempts').select('track_id,passed').eq('user_id', userId).eq('passed', true);
  const passed = new Set((att || []).map((a: any) => a.track_id));
  const pending = req.filter((t: any) => !passed.has(t.id)).map((t: any) => ({ id: t.id, title: T(t, 'title', lang) }));
  return { enabled: s.onboarding_block, complete: pending.length === 0, pending };
}

// ============================================================
// ADMIN
// ============================================================
export async function listTracksAdmin() {
  const { data: tracks } = await supabaseAdmin.from('training_tracks').select('*').order('sort', { ascending: true });
  const { data: lc } = await supabaseAdmin.from('training_lessons').select('track_id');
  const { data: qc } = await supabaseAdmin.from('training_questions').select('track_id');
  const lCount: Record<string, number> = {}, qCount: Record<string, number> = {};
  for (const r of (lc || []) as any[]) lCount[r.track_id] = (lCount[r.track_id] || 0) + 1;
  for (const r of (qc || []) as any[]) qCount[r.track_id] = (qCount[r.track_id] || 0) + 1;
  return (tracks || []).map((t: any) => ({ ...t, lessons: lCount[t.id] || 0, questions: qCount[t.id] || 0 }));
}

export async function trackFull(trackId: string) {
  const { data: t } = await supabaseAdmin.from('training_tracks').select('*').eq('id', trackId).maybeSingle();
  if (!t) return null;
  const { data: lessons } = await supabaseAdmin.from('training_lessons').select('*').eq('track_id', trackId).order('sort', { ascending: true });
  const { data: questions } = await supabaseAdmin.from('training_questions').select('*').eq('track_id', trackId).order('sort', { ascending: true });
  return { track: t, lessons: lessons || [], questions: questions || [] };
}

export async function saveTrack(t: any): Promise<{ ok: boolean; id?: string }> {
  const row: any = {
    slug: String(t.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60) || ('ruta-' + Date.now()),
    title_es: String(t.title_es || '').slice(0, 160), title_en: String(t.title_en || '').slice(0, 160),
    summary_es: String(t.summary_es || '').slice(0, 600), summary_en: String(t.summary_en || '').slice(0, 600),
    icon: String(t.icon || 'school').slice(0, 40),
    sort: Number(t.sort) || 0,
    required_for: Array.isArray(t.required_for) ? t.required_for.filter((x: any) => typeof x === 'string').slice(0, 8) : [],
    pass_score: Math.min(100, Math.max(0, Number(t.pass_score) || 80)),
    max_attempts: Math.max(0, Number(t.max_attempts) || 0),
    exam_count: Math.max(0, Number(t.exam_count) || 0),
    cert_months: Math.max(0, Number(t.cert_months) || 0),
    prereq_track_id: t.prereq_track_id || null,
    gate_leads: !!t.gate_leads,
    active: t.active !== false,
  };
  if (t.id) { await supabaseAdmin.from('training_tracks').update(row).eq('id', t.id); return { ok: true, id: t.id }; }
  const { data } = await supabaseAdmin.from('training_tracks').insert(row).select('id').maybeSingle();
  return { ok: true, id: (data as any)?.id };
}
export async function delTrack(id: string): Promise<void> { await supabaseAdmin.from('training_tracks').delete().eq('id', id); }

export async function saveLesson(l: any): Promise<{ ok: boolean; id?: string }> {
  if (!l.track_id && !l.id) return { ok: false };
  const row: any = {
    track_id: l.track_id, title_es: String(l.title_es || '').slice(0, 200), title_en: String(l.title_en || '').slice(0, 200),
    body_es: String(l.body_es || '').slice(0, 20000), body_en: String(l.body_en || '').slice(0, 20000),
    video_url: l.video_url ? String(l.video_url).slice(0, 800) : null,
    doc_url: l.doc_url ? String(l.doc_url).slice(0, 800) : null,
    doc_name: l.doc_name ? String(l.doc_name).slice(0, 160) : null,
    sort: Number(l.sort) || 0,
  };
  if (l.id) { delete row.track_id; await supabaseAdmin.from('training_lessons').update(row).eq('id', l.id); return { ok: true, id: l.id }; }
  const { data } = await supabaseAdmin.from('training_lessons').insert(row).select('id').maybeSingle();
  return { ok: true, id: (data as any)?.id };
}
export async function delLesson(id: string): Promise<void> { await supabaseAdmin.from('training_lessons').delete().eq('id', id); }

export async function saveQuestion(q: any): Promise<{ ok: boolean; id?: string }> {
  if (!q.track_id && !q.id) return { ok: false };
  const clean = (arr: any) => (Array.isArray(arr) ? arr.map((x: any) => String(x || '').slice(0, 300)).slice(0, 8) : []);
  const row: any = {
    track_id: q.track_id, prompt_es: String(q.prompt_es || '').slice(0, 600), prompt_en: String(q.prompt_en || '').slice(0, 600),
    options_es: clean(q.options_es), options_en: clean(q.options_en),
    correct: Math.max(0, Number(q.correct) || 0), explain_es: String(q.explain_es || '').slice(0, 600), explain_en: String(q.explain_en || '').slice(0, 600),
    sort: Number(q.sort) || 0,
  };
  if (q.id) { delete row.track_id; await supabaseAdmin.from('training_questions').update(row).eq('id', q.id); return { ok: true, id: q.id }; }
  const { data } = await supabaseAdmin.from('training_questions').insert(row).select('id').maybeSingle();
  return { ok: true, id: (data as any)?.id };
}
export async function delQuestion(id: string): Promise<void> { await supabaseAdmin.from('training_questions').delete().eq('id', id); }

// Reordena lecciones o preguntas: guarda el nuevo 'sort' según el orden de ids.
export async function reorderItems(kind: 'lessons' | 'questions', ids: string[]): Promise<{ ok: boolean }> {
  const table = kind === 'lessons' ? 'training_lessons' : 'training_questions';
  const arr = Array.isArray(ids) ? ids : [];
  for (let i = 0; i < arr.length; i++) await supabaseAdmin.from(table).update({ sort: i }).eq('id', arr[i]);
  return { ok: true };
}

// -------- BIBLIOTECA DE MATERIALES (reutilizable entre lecciones) --------
export async function listMaterials(): Promise<any[]> {
  const { data } = await supabaseAdmin.from('training_assets').select('*').order('created_at', { ascending: false }).limit(300);
  return data || [];
}
export async function saveMaterial(m: { kind?: string; title?: string; url: string; size?: number }): Promise<{ ok: boolean; id?: string }> {
  if (!m.url) return { ok: false };
  const kind = m.kind === 'video' ? 'video' : 'doc';
  const { data } = await supabaseAdmin.from('training_assets').insert({ kind, title: String(m.title || '').slice(0, 200), url: String(m.url).slice(0, 800), size: m.size || null }).select('id').maybeSingle();
  return { ok: true, id: (data as any)?.id };
}
export async function delMaterial(id: string): Promise<void> { await supabaseAdmin.from('training_assets').delete().eq('id', id); }

// -------- ROSTER + RENDIMIENTO --------
// Lista de personas con acceso + progreso, promedio de examen y certificados.
export async function roster() {
  const { data: acc } = await supabaseAdmin.from('training_access').select('*').order('created_at', { ascending: true });
  const list = (acc || []) as any[];
  if (!list.length) return [];
  const ids = list.map((a) => a.user_id);
  const [{ data: profs }, { data: tracks }, { data: lessons }, { data: prog }, { data: att }, { data: certs }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,name,email').in('id', ids),
    supabaseAdmin.from('training_tracks').select('id,required_for,active'),
    supabaseAdmin.from('training_lessons').select('id,track_id'),
    supabaseAdmin.from('training_progress').select('user_id,lesson_id').in('user_id', ids),
    supabaseAdmin.from('training_attempts').select('user_id,track_id,score,passed').in('user_id', ids),
    supabaseAdmin.from('training_certificates').select('user_id,track_id,expires_at').in('user_id', ids),
  ]);
  const profById: Record<string, any> = {}; for (const p of (profs || []) as any[]) profById[p.id] = p;
  const activeTracks = (tracks || []).filter((t: any) => t.active);
  const lessonsByTrack: Record<string, string[]> = {};
  for (const l of (lessons || []) as any[]) (lessonsByTrack[l.track_id] ||= []).push(l.id);
  const progByUser: Record<string, Set<string>> = {};
  for (const p of (prog || []) as any[]) (progByUser[p.user_id] ||= new Set()).add(p.lesson_id);
  const attByUser: Record<string, any[]> = {};
  for (const a of (att || []) as any[]) (attByUser[a.user_id] ||= []).push(a);
  const certByUser: Record<string, any[]> = {};
  for (const c of (certs || []) as any[]) (certByUser[c.user_id] ||= []).push(c);

  return list.map((a) => {
    const p = profById[a.user_id] || {};
    const myTracks = activeTracks.filter((t: any) => !t.required_for?.length || t.required_for.includes(a.role));
    const myLessonIds = myTracks.flatMap((t: any) => lessonsByTrack[t.id] || []);
    const doneSet = progByUser[a.user_id] || new Set();
    const done = myLessonIds.filter((id) => doneSet.has(id)).length;
    const myAtt = attByUser[a.user_id] || [];
    const bestByTrack: Record<string, number> = {};
    for (const at of myAtt) bestByTrack[at.track_id] = Math.max(bestByTrack[at.track_id] || 0, at.score || 0);
    const scores = Object.values(bestByTrack);
    const validCerts = (certByUser[a.user_id] || []).filter((c: any) => !c.expires_at || new Date(c.expires_at).getTime() > Date.now());
    return {
      user_id: a.user_id, name: p.name || null, email: p.email || null, role: a.role, active: a.active, source: a.source,
      progress: myLessonIds.length ? Math.round((done / myLessonIds.length) * 100) : 0,
      avgScore: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : 0,
      certs: validCerts.length, tracksTotal: myTracks.length,
      passed: Object.keys(bestByTrack).length,
    };
  });
}

// -------- REPORTE DE CUMPLIMIENTO (auditoría) --------
// Por persona × ruta obligatoria: estado ok | expired | pending. compliant si
// todas sus rutas obligatorias están en ok. Sirve para el panel y el CSV.
export async function complianceReport(scopeUserIds?: string[] | null): Promise<{ tracks: { id: string; title: string }[]; people: any[]; summary: { total: number; compliant: number; overdue: number; pending: number } }> {
  let accQ = supabaseAdmin.from('training_access').select('*').order('created_at', { ascending: true });
  if (scopeUserIds) accQ = accQ.in('user_id', scopeUserIds.length ? scopeUserIds : ['00000000-0000-0000-0000-000000000000']);
  const [{ data: acc }, { data: tracksRaw }] = await Promise.all([
    accQ,
    supabaseAdmin.from('training_tracks').select('id,title_es,title_en,required_for,active').eq('active', true).order('sort', { ascending: true }),
  ]);
  const people0 = (acc || []) as any[];
  const tracks = (tracksRaw || []) as any[];
  const tracksOut = tracks.map((t) => ({ id: t.id, title: t.title_es || t.title_en || t.id }));
  if (!people0.length) return { tracks: tracksOut, people: [], summary: { total: 0, compliant: 0, overdue: 0, pending: 0 } };

  const ids = people0.map((p) => p.user_id);
  const [{ data: profs }, { data: att }, { data: certs }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,name,email').in('id', ids),
    supabaseAdmin.from('training_attempts').select('user_id,track_id,score,passed').in('user_id', ids),
    supabaseAdmin.from('training_certificates').select('user_id,track_id,score,expires_at').in('user_id', ids),
  ]);
  const profById: Record<string, any> = {}; for (const p of (profs || []) as any[]) profById[p.id] = p;
  const bestPass: Record<string, Record<string, boolean>> = {};
  const bestScore: Record<string, Record<string, number>> = {};
  for (const a of (att || []) as any[]) {
    (bestPass[a.user_id] ||= {})[a.track_id] = (bestPass[a.user_id]?.[a.track_id]) || a.passed;
    (bestScore[a.user_id] ||= {})[a.track_id] = Math.max(bestScore[a.user_id]?.[a.track_id] || 0, a.score || 0);
  }
  const certByUT: Record<string, any> = {};
  for (const c of (certs || []) as any[]) certByUT[c.user_id + '|' + c.track_id] = c;

  let compliant = 0, overdue = 0, pending = 0;
  const people = people0.map((p) => {
    const prof = profById[p.user_id] || {};
    const mine = tracks.filter((t) => !t.required_for?.length || t.required_for.includes(p.role));
    const items: Record<string, any> = {};
    let allOk = mine.length > 0, hasExpired = false, hasPending = false;
    for (const t of mine) {
      const passed = !!bestPass[p.user_id]?.[t.id];
      const cert = certByUT[p.user_id + '|' + t.id];
      const expired = cert?.expires_at ? new Date(cert.expires_at).getTime() < Date.now() : false;
      let status: 'ok' | 'expired' | 'pending' = 'pending';
      if (passed && !expired) status = 'ok';
      else if (passed && expired) status = 'expired';
      if (status !== 'ok') allOk = false;
      if (status === 'expired') hasExpired = true;
      if (status === 'pending') hasPending = true;
      items[t.id] = { status, score: bestScore[p.user_id]?.[t.id] || 0, expires: cert?.expires_at || null };
    }
    if (mine.length && allOk) compliant++;
    else if (hasExpired) overdue++;
    else if (hasPending) pending++;
    return { user_id: p.user_id, name: prof.name || null, email: prof.email || null, role: p.role, active: p.active, compliant: mine.length > 0 && allOk, items, required: mine.length };
  });

  return { tracks: tracksOut, people, summary: { total: people.length, compliant, overdue, pending } };
}

export async function setAccess(userId: string, patch: { active?: boolean; role?: string; source?: string }, adminId?: string): Promise<{ ok: boolean }> {
  if (!userId) return { ok: false };
  const cur = await accessFor(userId);
  const role = patch.role || cur?.role || 'staff';
  const active = patch.active !== undefined ? patch.active : (cur?.active ?? true);
  if (cur) await supabaseAdmin.from('training_access').update({ active, role }).eq('user_id', userId);
  else await supabaseAdmin.from('training_access').insert({ user_id: userId, role, active, source: patch.source || 'manual', assigned_by: adminId || null });
  return { ok: true };
}

// Reinicia los intentos de una persona en una ruta (para reabrir un examen
// bloqueado). Opcionalmente revoca su certificado de esa ruta.
export async function resetAttempts(userId: string, trackId: string, revokeCert = false): Promise<{ ok: boolean }> {
  if (!userId || !trackId) return { ok: false };
  await supabaseAdmin.from('training_attempts').delete().eq('user_id', userId).eq('track_id', trackId);
  if (revokeCert) await supabaseAdmin.from('training_certificates').delete().eq('user_id', userId).eq('track_id', trackId);
  return { ok: true };
}

// Alta por correo (busca el perfil por email).
export async function enrollByEmail(email: string, role: string, adminId?: string): Promise<{ ok: boolean; error?: string }> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return { ok: false, error: 'correo vacío' };
  const { data: p } = await supabaseAdmin.from('profiles').select('id').ilike('email', e).maybeSingle();
  if (!p) return { ok: false, error: 'No existe una cuenta con ese correo.' };
  await setAccess((p as any).id, { active: true, role, source: 'manual' }, adminId);
  return { ok: true };
}

// Sincroniza altas automáticas desde ventas (sales_reps) y equipo (staff).
export async function autoEnrollSync(): Promise<{ added: number }> {
  const s = await trainingSettings();
  let added = 0;
  const { data: existing } = await supabaseAdmin.from('training_access').select('user_id');
  const have = new Set((existing || []).map((r: any) => r.user_id));

  if (s.auto_enroll_sales) {
    const { data: reps } = await supabaseAdmin.from('sales_reps').select('user_id,status').eq('status', 'active');
    for (const r of (reps || []) as any[]) {
      if (!r.user_id || have.has(r.user_id)) continue;
      await supabaseAdmin.from('training_access').insert({ user_id: r.user_id, role: 'vendedor', active: true, source: 'sales' });
      have.add(r.user_id); added++;
    }
  }
  if (s.auto_enroll_staff) {
    const { data: st } = await supabaseAdmin.from('staff').select('user_id,status,department').eq('status', 'active');
    for (const r of (st || []) as any[]) {
      if (!r.user_id || have.has(r.user_id)) continue;
      const role = ['ops', 'support'].includes(r.department) ? 'support' : 'staff';
      await supabaseAdmin.from('training_access').insert({ user_id: r.user_id, role, active: true, source: 'staff' });
      have.add(r.user_id); added++;
    }
  }
  return { added };
}

// -------- RECORDATORIOS (cron) --------
// (1) Cursos pendientes: a quien tiene acceso activo y no ha completado sus
//     rutas obligatorias. (2) Certificados por vencer dentro de N días.
// Idempotente por día: no repite el mismo aviso el mismo día (usa notify kind).
export async function runTrainingReminders(): Promise<{ pending: number; expiring: number }> {
  const s = await trainingSettings();
  if (!s.enabled) return { pending: 0, expiring: 0 };
  let pending = 0, expiring = 0;
  const { notify } = await import('@/lib/notify').catch(() => ({ notify: async () => {} } as any));

  if (s.remind_pending) {
    const r = await roster();
    for (const p of r) {
      if (!p.active) continue;
      if (p.tracksTotal > 0 && (p.progress < 100 || p.passed < p.tracksTotal)) {
        try { await notify(p.user_id, { kind: 'training', title: 'Formación pendiente', body: `Tienes cursos por completar (${p.progress}%).`, url: '/entrenamiento' }); pending++; } catch {}
      }
    }
  }

  if (s.remind_cert_days > 0) {
    const nowIso = new Date().toISOString();
    // (a) Certificados por vencer (dentro de N días): aviso nivel 1.
    const soon = new Date(Date.now() + s.remind_cert_days * 24 * 3600 * 1000).toISOString();
    const { data: certs } = await supabaseAdmin.from('training_certificates').select('id,user_id,track_id,expires_at,remind_level').not('expires_at', 'is', null).lte('expires_at', soon).gt('expires_at', nowIso);
    for (const c of (certs || []) as any[]) {
      if ((c.remind_level || 0) >= 1) continue; // ya avisado
      const days = Math.max(0, Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000));
      try {
        await notify(c.user_id, { kind: 'training', title: 'Certificado por vencer', body: `Vence en ${days} día(s). Vuelve a certificarte para no perder acceso a leads.`, url: '/entrenamiento' });
        await supabaseAdmin.from('training_certificates').update({ remind_level: 1 }).eq('id', c.id);
        expiring++;
      } catch {}
    }
    // (b) Certificados YA vencidos: aviso escalado nivel 2 (suspensión de leads si el gating está activo).
    const { data: expired } = await supabaseAdmin.from('training_certificates').select('id,user_id,remind_level').not('expires_at', 'is', null).lt('expires_at', nowIso);
    for (const c of (expired || []) as any[]) {
      if ((c.remind_level || 0) >= 2) continue;
      try {
        await notify(c.user_id, { kind: 'training', title: 'Certificado vencido', body: s.gating_enabled ? 'Tu certificado venció: no recibirás leads hasta recertificarte.' : 'Tu certificado venció. Recertifícate cuanto antes.', url: '/entrenamiento' });
        await supabaseAdmin.from('training_certificates').update({ remind_level: 2 }).eq('id', c.id);
        expiring++;
      } catch {}
    }
  }
  return { pending, expiring };
}
