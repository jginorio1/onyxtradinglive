import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Academy · Moderación de la comunidad.
// Motor por capas para el TEXTO (posts, comentarios, DMs, nombres):
//   1) lista de palabras (base ES/EN + lista propia del mentor), con de-leet
//   2) señales de spam (links, MAYÚSCULAS, repetición, teléfonos/wallets)
//   3) moderación con IA (entiende contexto, evita falsos positivos)
// El mentor decide el nivel; por defecto una academia nueva nace en "normal".
// Devuelve una decisión: allow (publica) | review (a la cola) | block (no entra).
// (La moderación de IMÁGENES por contenido ya vive en lib/academyAI.moderateImage.)
// ============================================================

export type ModLevel = 'off' | 'relaxed' | 'normal' | 'strict';
export type ModAction = 'allow' | 'review' | 'block';
export interface ModSettings {
  level: ModLevel;        // cuán estricto
  ai: boolean;            // usar IA como capa principal
  words: string[];        // palabras/frases propias del mentor (se suman a la base)
  allow: string[];        // palabras que el mentor marca como permitidas (evita falsos positivos)
  new_member_review: number; // primeros N posts de un recién llegado pasan por revisión (0 = off)
  link_policy: 'allow' | 'review' | 'members'; // links: permitir / a revisión / solo miembros con antigüedad
  report_threshold: number;  // nº de reportes que auto-oculta un contenido (0 = off)
}

// Default que se usa al crear la academia: la seguridad "normal" típica de estos grupos.
export const DEFAULT_SETTINGS: ModSettings = {
  level: 'normal', ai: true, words: [], allow: [],
  new_member_review: 0, link_policy: 'review', report_threshold: 3,
};

export function mergeSettings(raw: any): ModSettings {
  const r = (raw && typeof raw === 'object') ? raw : {};
  const lvl = ['off', 'relaxed', 'normal', 'strict'].includes(r.level) ? r.level : DEFAULT_SETTINGS.level;
  const lp = ['allow', 'review', 'members'].includes(r.link_policy) ? r.link_policy : DEFAULT_SETTINGS.link_policy;
  return {
    level: lvl,
    ai: r.ai === undefined ? DEFAULT_SETTINGS.ai : !!r.ai,
    words: Array.isArray(r.words) ? r.words.map((w: any) => String(w).toLowerCase().trim()).filter(Boolean).slice(0, 400) : [],
    allow: Array.isArray(r.allow) ? r.allow.map((w: any) => String(w).toLowerCase().trim()).filter(Boolean).slice(0, 400) : [],
    new_member_review: Math.max(0, Math.min(20, Math.round(Number(r.new_member_review) || 0))),
    link_policy: lp,
    report_threshold: Math.max(0, Math.min(50, Math.round(Number(r.report_threshold ?? DEFAULT_SETTINGS.report_threshold)))),
  };
}

export async function getSettings(mentorId: string): Promise<ModSettings> {
  const { data } = await supabaseAdmin.from('mentors').select('moderation').eq('user_id', mentorId).maybeSingle();
  return mergeSettings((data as any)?.moderation);
}
export async function saveSettings(mentorId: string, patch: any): Promise<ModSettings> {
  const cur = await getSettings(mentorId);
  const next = mergeSettings({ ...cur, ...patch });
  await supabaseAdmin.from('mentors').update({ moderation: next }).eq('user_id', mentorId);
  return next;
}

// ---- Normalización: minúsculas, sin acentos, "de-leet" (l33t → texto), colapsa repeticiones ----
export function normalize(s: string): string {
  let t = (s || '').toLowerCase();
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');       // quita acentos
  t = t.replace(/[0@$!|]/g, (c) => ({ '0': 'o', '@': 'a', '$': 's', '!': 'i', '|': 'i' } as any)[c] || c);
  t = t.replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
  t = t.replace(/(.)\1{2,}/g, '$1$1');                          // "holaaaa" → "holaa"
  t = t.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();  // solo letras/espacios
  return t;
}

// ---- Listas base. GRAVE = se bloquea; LEVE = va a revisión (según el nivel). ----
// Es un filtro de seguridad para una comunidad de pago; cubre lo sexual explícito,
// insultos fuertes y expresiones de odio/amenaza más comunes en ES y EN.
const SEVERE = [
  // sexual explícito (es)
  'porno', 'pornografia', 'coger', 'follar', 'follame', 'mamada', 'mamadas', 'verga', 'pene', 'vagina', 'concha tuya', 'chupamela', 'chupame', 'culiar', 'cojer',
  // sexual explícito (en)
  'porn', 'pornhub', 'blowjob', 'handjob', 'cumshot', 'nudes', 'dick pic', 'send nudes', 'pussy', 'cunt', 'whore',
  // odio / amenaza (genéricos)
  'te voy a matar', 'kill yourself', 'kys', 'matate', 'go die', 'nazi', 'faggot', 'retard',
];
const MILD = [
  // insultos comunes (es)
  'idiota', 'imbecil', 'estupido', 'estupida', 'pendejo', 'pendeja', 'gilipollas', 'cabron', 'cabrona', 'mierda', 'puta', 'puto', 'maricon', 'zorra', 'baboso', 'tarado', 'inutil', 'basura',
  // insultos comunes (en)
  'idiot', 'stupid', 'moron', 'dumbass', 'asshole', 'bastard', 'bitch', 'shit', 'crap', 'scam artist', 'loser',
];

function hits(text: string, list: string[]): string | null {
  const padded = ' ' + text + ' ';
  for (const w of list) {
    const nw = normalize(w);
    if (!nw) continue;
    // frase (con espacio) → substring; palabra suelta → límite de palabra
    if (nw.includes(' ')) { if (padded.includes(' ' + nw + ' ') || text.includes(nw)) return w; }
    else if (padded.includes(' ' + nw + ' ')) return w;
  }
  return null;
}

// ---- Señales de spam ----
export interface SpamInfo { spam: boolean; strong: boolean; links: number; reason?: string }
export function spamSignals(rawBody: string): SpamInfo {
  const body = String(rawBody || '');
  const links = (body.match(/https?:\/\/|www\.|t\.me\/|wa\.me\/|\b[a-z0-9-]+\.(com|net|io|xyz|co|link|vip|bet)\b/gi) || []).length;
  const letters = body.replace(/[^a-zA-Z]/g, '');
  const caps = letters ? (body.replace(/[^A-Z]/g, '').length / letters.length) : 0;
  const shouty = letters.length >= 12 && caps > 0.7;
  const repeatedWord = /\b(\w{2,})\b(?:\W+\1\b){3,}/i.test(body);          // misma palabra 4+ veces
  const wallet = /\b(0x[a-fA-F0-9]{20,}|bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/.test(body);
  const phones = (body.match(/(\+?\d[\d\s().-]{7,}\d)/g) || []).length;
  const strong = links >= 3 || wallet || (links >= 1 && /(free|gratis|garantiz|signal|señal|vip|whatsapp|telegram|invest|profit|x\d{2,})/i.test(body) && phones + links >= 2);
  const spam = strong || shouty || repeatedWord || links >= 2 || phones >= 2;
  let reason: string | undefined;
  if (strong) reason = 'spam_promo'; else if (links >= 2) reason = 'spam_links'; else if (shouty) reason = 'shouting'; else if (repeatedWord) reason = 'repetition'; else if (phones >= 2) reason = 'contact_dump';
  return { spam, strong, links, reason };
}

// ---- IA de moderación (contexto). Fail-open: si no hay clave o falla, no bloquea. ----
export async function aiModerate(text: string): Promise<{ flag: 'none' | 'low' | 'high'; category: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { flag: 'none', category: 'none' };
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 20,
        system: 'You moderate messages in a paid trading community (Spanish/English). Classify the USER message. Reply ONLY as "LEVEL CATEGORY". LEVEL is HIGH (explicit sexual content, sexual harassment, hate speech, slurs, credible threats/violence, self-harm encouragement, or blatant scam/spam), LOW (mild insults, rudeness, borderline), or NONE (normal talk, trading, wins, questions, memes, mild slang). CATEGORY is one of: sexual, harassment, hate, violence, selfharm, spam, insult, none. Trading talk like "I killed it today", "this setup is fire", losses/risk are NONE. Do not explain.',
        messages: [{ role: 'user', content: String(text || '').slice(0, 1500) }],
      }),
    });
    if (!r.ok) return { flag: 'none', category: 'none' };
    const d = await r.json();
    const out = (d?.content || []).map((c: any) => c.text || '').join(' ').trim().toUpperCase();
    const flag = out.startsWith('HIGH') ? 'high' : out.startsWith('LOW') ? 'low' : 'none';
    const category = (out.split(/\s+/)[1] || 'none').toLowerCase();
    return { flag, category };
  } catch { return { flag: 'none', category: 'none' }; }
}

export interface ModDecision { action: ModAction; reason: string; category: string }

// Decide qué hacer con un texto según el nivel del mentor.
// kind: 'post' | 'comment' | 'dm' | 'name'. Para DM y nombre no existe "review"
// (no hay cola pública): dudoso se trata como bloqueo suave.
export async function moderateText(
  settings: ModSettings, rawText: string,
  opts: { kind: 'post' | 'comment' | 'dm' | 'name'; isNewMember?: boolean } = { kind: 'post' },
): Promise<ModDecision> {
  const text = String(rawText || '');
  const norm = normalize(text);
  if (settings.level === 'off') {
    // Aun apagado, cortamos lo más grave para proteger a la comunidad.
    if (hits(norm, SEVERE) || hits(norm, settings.words)) {
      const allowHit = hits(norm, settings.allow);
      if (!allowHit) return { action: opts.kind === 'name' || opts.kind === 'dm' ? 'block' : 'block', reason: 'severe', category: 'sexual' };
    }
    return { action: 'allow', reason: 'off', category: 'none' };
  }

  const allowMatch = hits(norm, settings.allow); // el mentor permitió explícitamente algo
  const sevWord = allowMatch ? null : (hits(norm, SEVERE) || hits(norm, settings.words));
  const mildWord = allowMatch ? null : hits(norm, MILD);
  const spam = spamSignals(text);
  const strict = settings.level === 'strict';
  const relaxed = settings.level === 'relaxed';

  // Nombres de perfil: nunca "revisión" (bloquea o permite). Más estricto por defecto.
  const noReview = opts.kind === 'name' || opts.kind === 'dm';

  // 1) Palabra GRAVE o lista propia del mentor → bloqueo directo (en cualquier nivel).
  if (sevWord) return { action: 'block', reason: 'word:' + sevWord, category: 'sexual' };

  // 2) IA (capa de contexto) si está activada.
  let ai: { flag: 'none' | 'low' | 'high'; category: string } = { flag: 'none', category: 'none' };
  if (settings.ai && text.trim().length >= 2 && opts.kind !== 'name') ai = await aiModerate(text);
  if (ai.flag === 'high') return { action: 'block', reason: 'ai:' + ai.category, category: ai.category };

  // 3) Spam fuerte (promo con links/wallet) → bloqueo; spam leve → revisión (o bloqueo si no hay cola).
  if (spam.strong && opts.kind !== 'name') return { action: noReview ? 'block' : 'review', reason: spam.reason || 'spam', category: 'spam' };

  // 4) Links según política.
  if (spam.links > 0 && opts.kind !== 'name') {
    if (settings.link_policy === 'members' && (opts.isNewMember || strict)) return { action: noReview ? 'block' : 'review', reason: 'link_new_member', category: 'spam' };
    if (settings.link_policy === 'review' && !relaxed) return { action: noReview ? 'allow' : 'review', reason: 'link', category: 'spam' };
  }

  // 5) Insulto leve o IA "low" o señales de spam suaves.
  const mildFlag = mildWord || ai.flag === 'low' || spam.spam;
  if (mildFlag) {
    if (relaxed) return { action: 'allow', reason: 'mild_relaxed', category: mildWord ? 'insult' : (ai.category || 'spam') };
    if (strict) return { action: noReview ? 'block' : 'review', reason: 'strict:' + (mildWord ? 'insult' : (spam.reason || ai.category)), category: mildWord ? 'insult' : (ai.category || 'spam') };
    // normal: insulto/spam suave → revisión; nombre/dm dudoso → bloqueo suave.
    return { action: noReview ? 'block' : 'review', reason: mildWord ? ('word:' + mildWord) : (spam.reason || 'ai_low'), category: mildWord ? 'insult' : (ai.category || 'spam') };
  }

  // 6) Nuevo miembro con revisión activada → primeros posts a la cola.
  if (opts.isNewMember && settings.new_member_review > 0 && (opts.kind === 'post' || opts.kind === 'comment')) {
    return { action: 'review', reason: 'new_member', category: 'none' };
  }

  return { action: 'allow', reason: 'clean', category: 'none' };
}

// ============================================================
// Silencio (mute), sanciones e historial.
// ============================================================
export async function isMuted(mentorId: string, studentId: string): Promise<{ muted: boolean; until?: string }> {
  const { data } = await supabaseAdmin.from('academy_enrollments').select('muted_until').eq('mentor_id', mentorId).eq('student_id', studentId).maybeSingle();
  const until = (data as any)?.muted_until;
  if (until && new Date(until).getTime() > Date.now()) return { muted: true, until };
  return { muted: false };
}
export async function muteStudent(mentorId: string, studentId: string, hours: number, actorId: string, reason?: string) {
  const until = new Date(Date.now() + Math.max(1, Math.min(24 * 30, hours)) * 3600 * 1000).toISOString();
  await supabaseAdmin.from('academy_enrollments').update({ muted_until: until }).eq('mentor_id', mentorId).eq('student_id', studentId);
  await logInfraction(mentorId, studentId, 'mute', actorId, reason, until);
  return { ok: true, until };
}
export async function unmuteStudent(mentorId: string, studentId: string, actorId: string) {
  await supabaseAdmin.from('academy_enrollments').update({ muted_until: null }).eq('mentor_id', mentorId).eq('student_id', studentId);
  await logInfraction(mentorId, studentId, 'unmute', actorId);
  return { ok: true };
}
export async function warnStudent(mentorId: string, studentId: string, actorId: string, reason?: string) {
  await logInfraction(mentorId, studentId, 'warn', actorId, reason);
  return { ok: true };
}
export async function logInfraction(mentorId: string, studentId: string, kind: string, actorId?: string, reason?: string, until?: string) {
  await supabaseAdmin.from('academy_infractions').insert({ mentor_id: mentorId, student_id: studentId, actor_id: actorId || null, kind, reason: reason ? String(reason).slice(0, 300) : null, until: until || null });
}
export async function infractions(mentorId: string, studentId: string) {
  const { data } = await supabaseAdmin.from('academy_infractions').select('*').eq('mentor_id', mentorId).eq('student_id', studentId).order('created_at', { ascending: false }).limit(30);
  return (data || []) as any[];
}
export async function infractionCount(mentorId: string, studentId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('academy_infractions').select('id', { count: 'exact', head: true }).eq('mentor_id', mentorId).eq('student_id', studentId).in('kind', ['warn', 'mute', 'ban', 'block']);
  return count || 0;
}

// ============================================================
// Reportes de la comunidad.
// ============================================================
export async function addReport(mentorId: string, reporterId: string, targetType: string, targetId: string, reason?: string) {
  const t = ['post', 'comment', 'dm', 'profile', 'win'].includes(targetType) ? targetType : 'post';
  await supabaseAdmin.from('academy_reports').upsert(
    { mentor_id: mentorId, reporter_id: reporterId, target_type: t, target_id: String(targetId).slice(0, 80), reason: reason ? String(reason).slice(0, 300) : null, status: 'open' },
    { onConflict: 'mentor_id,reporter_id,target_type,target_id' },
  );
  // Auto-ocultar si supera el umbral de reportes.
  const settings = await getSettings(mentorId);
  if (settings.report_threshold > 0 && (t === 'post' || t === 'comment')) {
    const { count } = await supabaseAdmin.from('academy_reports').select('id', { count: 'exact', head: true }).eq('mentor_id', mentorId).eq('target_type', t).eq('target_id', targetId).eq('status', 'open');
    if ((count || 0) >= settings.report_threshold) {
      await supabaseAdmin.from(t === 'post' ? 'academy_posts' : 'academy_comments').update({ status: 'hidden', flag_reason: 'reports' }).eq('id', targetId);
    }
  }
  return { ok: true };
}
export async function reportsOpen(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_reports').select('*').eq('mentor_id', mentorId).eq('status', 'open').order('created_at', { ascending: false }).limit(80);
  const rows = (data || []) as any[];
  // Agrupa por objeto reportado (varios reportes del mismo → una fila con conteo).
  const byTarget: Record<string, any> = {};
  for (const r of rows) { const k = r.target_type + ':' + r.target_id; (byTarget[k] ||= { ...r, count: 0, reasons: [] as string[] }); byTarget[k].count++; if (r.reason) byTarget[k].reasons.push(r.reason); }
  return Object.values(byTarget);
}
export async function resolveReports(mentorId: string, targetType: string, targetId: string, action: 'resolved' | 'dismissed') {
  await supabaseAdmin.from('academy_reports').update({ status: action }).eq('mentor_id', mentorId).eq('target_type', targetType).eq('target_id', targetId).eq('status', 'open');
  return { ok: true };
}
export async function reportsCount(mentorId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('academy_reports').select('target_type,target_id').eq('mentor_id', mentorId).eq('status', 'open').limit(200);
  const uniq = new Set((data || []).map((r: any) => r.target_type + ':' + r.target_id));
  return uniq.size;
}

// ============================================================
// Cola de revisión: posts y comentarios en 'pending' (marcados por el filtro o
// por ser de un nuevo miembro), con el autor resuelto.
// ============================================================
export async function pendingContent(mentorId: string) {
  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabaseAdmin.from('academy_posts').select('id,author_id,body,image_url,flag_reason,created_at,kind').eq('mentor_id', mentorId).eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('academy_comments').select('id,post_id,author_id,body,image_url,flag_reason,created_at').eq('status', 'pending').limit(200),
  ]);
  const cs = (comments || []) as any[];
  // Filtrar comentarios a posts de ESTA academia.
  let mineComments: any[] = [];
  if (cs.length) {
    const pids = Array.from(new Set(cs.map((c) => c.post_id)));
    const { data: parents } = await supabaseAdmin.from('academy_posts').select('id').eq('mentor_id', mentorId).in('id', pids);
    const ok = new Set((parents || []).map((p: any) => p.id));
    mineComments = cs.filter((c) => ok.has(c.post_id));
  }
  const ps = (posts || []) as any[];
  const ids = Array.from(new Set([...ps.map((p) => p.author_id), ...mineComments.map((c) => c.author_id)]));
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids) : { data: [] } as any;
  const nameOf: Record<string, string> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p.full_name || (p.email || '').split('@')[0] || 'Trader'; });
  return {
    posts: ps.map((p) => ({ ...p, type: 'post', author_name: nameOf[p.author_id] || 'Trader' })),
    comments: mineComments.map((c) => ({ ...c, type: 'comment', author_name: nameOf[c.author_id] || 'Trader' })),
  };
}
export async function pendingContentCount(mentorId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('academy_posts').select('id', { count: 'exact', head: true }).eq('mentor_id', mentorId).eq('status', 'pending');
  return count || 0;
}

// Acciones de moderación sobre un contenido concreto.
export async function reviewContent(mentorId: string, type: 'post' | 'comment', id: string, action: 'approve' | 'hide' | 'delete') {
  const table = type === 'post' ? 'academy_posts' : 'academy_comments';
  if (type === 'post') {
    // Verifica pertenencia por mentor_id.
    if (action === 'delete') { await supabaseAdmin.from(table).delete().eq('id', id).eq('mentor_id', mentorId); }
    else { await supabaseAdmin.from(table).update({ status: action === 'approve' ? 'visible' : 'hidden' }).eq('id', id).eq('mentor_id', mentorId); }
  } else {
    // Comentario: pertenece a un post de esta academia.
    const { data: c } = await supabaseAdmin.from('academy_comments').select('post_id').eq('id', id).maybeSingle();
    if (!c) return { ok: false };
    const { data: p } = await supabaseAdmin.from('academy_posts').select('id').eq('id', (c as any).post_id).eq('mentor_id', mentorId).maybeSingle();
    if (!p) return { ok: false };
    if (action === 'delete') await supabaseAdmin.from('academy_comments').delete().eq('id', id);
    else await supabaseAdmin.from('academy_comments').update({ status: action === 'approve' ? 'visible' : 'hidden' }).eq('id', id);
  }
  // Al resolver, cierra los reportes asociados.
  await resolveReports(mentorId, type, id, action === 'delete' || action === 'hide' ? 'resolved' : 'dismissed');
  return { ok: true };
}
