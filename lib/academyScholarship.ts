import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Academy · Programa de becas (Fase 1).
// Una beca concede acceso COMPLETO a un alcance (toda la academia, un nivel o
// unos módulos) por un tiempo. Se otorga de forma directa (a un alumno) o por
// un código canjeable (para sorteos/campañas). Al vencer, un cron la marca
// 'expired' y el alumno pierde el acceso (se le ofrece suscribirse).
// La cobertura parcial (%) se guarda pero se aplicará como descuento en el
// checkout en una fase posterior; en la Fase 1 solo la 'full' da acceso.
// ============================================================

const TB = 'academy_scholarships';
const APPS = 'academy_scholarship_apps';

export type Scholarship = {
  id: string; mentor_id: string; student_id: string | null;
  kind: 'direct' | 'code'; code: string | null;
  coverage: 'full' | 'partial'; percent: number | null;
  scope: 'all' | 'modules'; modules: string[]; product_id: string | null;
  reason: string; seats: number; used: number;
  starts_at: string; ends_at: string | null; status: 'active' | 'expired' | 'revoked';
  created_at: string;
};

const nowIso = () => new Date().toISOString();
const isLive = (s: any) => s.status === 'active' && (!s.ends_at || new Date(s.ends_at).getTime() > Date.now());

// Grants directos y vigentes de un alumno en una academia (cobertura completa).
export async function activeGrants(studentId: string, mentorId: string): Promise<Scholarship[]> {
  const { data } = await supabaseAdmin.from(TB).select('*')
    .eq('mentor_id', mentorId).eq('student_id', studentId).eq('kind', 'direct').eq('status', 'active');
  return ((data || []) as any[]).filter(isLive) as Scholarship[];
}

// Módulos a los que el alumno tiene acceso POR BECA (solo cobertura completa).
export async function scholarshipModules(studentId: string, mentorId: string): Promise<{ all: boolean; ids: Set<string> }> {
  const grants = (await activeGrants(studentId, mentorId)).filter((g) => g.coverage === 'full');
  const ids = new Set<string>();
  let all = false;
  for (const g of grants) {
    if (g.scope === 'all') { all = true; break; }
    (Array.isArray(g.modules) ? g.modules : []).forEach((m) => ids.add(m));
  }
  return { all, ids };
}

// ¿Tiene alguna beca completa vigente en esta academia? (para insignia del alumno)
export async function activeScholarship(studentId: string, mentorId: string): Promise<Scholarship | null> {
  const g = (await activeGrants(studentId, mentorId)).filter((x) => x.coverage === 'full');
  return g[0] || null;
}

// --- Mentor ---
export async function mentorScholarships(mentorId: string): Promise<Scholarship[]> {
  const { data } = await supabaseAdmin.from(TB).select('*').eq('mentor_id', mentorId).order('created_at', { ascending: false }).limit(300);
  return (data || []) as any[];
}

function genCode(): string {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'BECA-';
  for (let i = 0; i < 6; i++) out += s[Math.floor(Math.random() * s.length)];
  return out;
}

async function idByEmail(email: string): Promise<string | null> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('email', e).maybeSingle();
  return (data as any)?.id || null;
}

async function ensureEnrolled(mentorId: string, studentId: string) {
  await supabaseAdmin.from('academy_enrollments').upsert({ mentor_id: mentorId, student_id: studentId, status: 'active' }, { onConflict: 'mentor_id,student_id' });
}

// Crea una beca (directa o código). Devuelve la fila creada o un error legible.
export async function createScholarship(mentorId: string, createdBy: string, b: any): Promise<{ ok: boolean; error?: string; row?: any }> {
  const kind = b.kind === 'code' ? 'code' : 'direct';
  const coverage = b.coverage === 'partial' ? 'partial' : 'full';
  const scope = b.scope === 'modules' ? 'modules' : 'all';
  const days = Number(b.days) || 0;                       // duración en días (0 = de por vida si lifetime)
  const lifetime = !!b.lifetime;
  const ends_at = lifetime ? null : (b.ends_at ? new Date(b.ends_at).toISOString() : (days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null));
  const modules = scope === 'modules' && Array.isArray(b.modules) ? b.modules.map(String).slice(0, 200) : [];
  const percent = coverage === 'partial' ? Math.max(1, Math.min(100, Math.round(Number(b.percent) || 50))) : null;
  const reason = ['low_income', 'raffle', 'merit', 'other'].includes(b.reason) ? b.reason : 'other';
  const product_id = b.product_id ? String(b.product_id) : null;

  const lang = b.lang === 'en' ? 'en' : 'es';
  const row: any = { mentor_id: mentorId, created_by: createdBy, kind, coverage, percent, scope, modules, product_id, reason, ends_at, status: 'active', lang };

  if (kind === 'direct') {
    const studentId = b.student_id || (b.email ? await idByEmail(b.email) : null);
    if (!studentId) return { ok: false, error: 'No encontramos a ese alumno por su correo. Debe tener cuenta en Onyx.' };
    row.student_id = studentId; row.seats = 1; row.used = 1;
    const { data, error } = await supabaseAdmin.from(TB).insert(row).select('*').single();
    if (error) return { ok: false, error: error.message };
    await ensureEnrolled(mentorId, studentId);
    return { ok: true, row: data };
  }
  // Código canjeable
  row.code = String(b.code || genCode()).trim().toUpperCase().slice(0, 40);
  row.seats = Math.max(1, Math.min(10000, Math.round(Number(b.seats) || 1)));
  row.used = 0; row.student_id = null;
  const { data, error } = await supabaseAdmin.from(TB).insert(row).select('*').single();
  if (error) return { ok: false, error: error.message.includes('duplicate') ? 'Ya existe un código con ese texto.' : error.message };
  return { ok: true, row: data };
}

export async function revokeScholarship(mentorId: string, id: string) {
  await supabaseAdmin.from(TB).update({ status: 'revoked' }).eq('id', id).eq('mentor_id', mentorId);
}

// Alumno canjea un código de beca. Crea un grant directo para él.
export async function redeemCode(studentId: string, code: string, lang: string = 'es'): Promise<{ ok: boolean; error?: string; mentorId?: string }> {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { ok: false, error: 'Escribe un código.' };
  const { data } = await supabaseAdmin.from(TB).select('*').eq('code', c).eq('kind', 'code').eq('status', 'active').maybeSingle();
  const sch: any = data;
  if (!sch || !isLive(sch)) return { ok: false, error: 'Código no válido o vencido.' };
  if (sch.used >= sch.seats) return { ok: false, error: 'Este código ya agotó sus plazas.' };
  if (sch.coverage !== 'full') return { ok: false, error: 'Este código es un descuento; se aplica al pagar (próximamente).' };

  // ¿Ya lo canjeó este alumno?
  const { data: prev } = await supabaseAdmin.from(TB).select('id').eq('source_code', sch.id).eq('student_id', studentId).maybeSingle();
  if (prev) return { ok: false, error: 'Ya canjeaste este código.' };

  const grant: any = {
    mentor_id: sch.mentor_id, student_id: studentId, kind: 'direct', coverage: 'full',
    scope: sch.scope, modules: sch.modules, product_id: sch.product_id, reason: sch.reason,
    seats: 1, used: 1, ends_at: sch.ends_at, status: 'active', source_code: sch.id, created_by: studentId,
    lang: lang === 'en' ? 'en' : 'es',
  };
  const { error } = await supabaseAdmin.from(TB).insert(grant);
  if (error) return { ok: false, error: error.message };
  await supabaseAdmin.from(TB).update({ used: sch.used + 1 }).eq('id', sch.id);
  await ensureEnrolled(sch.mentor_id, studentId);
  return { ok: true, mentorId: sch.mentor_id };
}

// Cron: vence las becas cuya fecha ya pasó. Devuelve las vencidas (para avisar).
export async function expireDue(): Promise<Scholarship[]> {
  const { data } = await supabaseAdmin.from(TB).select('*')
    .eq('status', 'active').eq('kind', 'direct').not('ends_at', 'is', null).lte('ends_at', nowIso()).limit(500);
  const due = (data || []) as any[];
  if (due.length) await supabaseAdmin.from(TB).update({ status: 'expired' }).in('id', due.map((d) => d.id));
  return due as Scholarship[];
}

// Reporte para el mentor: activas, vencidas y valor regalado (según nivel de ref).
export async function mentorReport(mentorId: string) {
  const list = await mentorScholarships(mentorId);
  const active = list.filter((s) => s.status === 'active' && (!s.ends_at || new Date(s.ends_at).getTime() > Date.now()));
  const productIds = Array.from(new Set(active.map((s) => s.product_id).filter(Boolean))) as string[];
  const priceById: Record<string, number> = {};
  if (productIds.length) {
    const { data } = await supabaseAdmin.from('academy_products').select('id,price_cents').in('id', productIds);
    for (const p of (data || []) as any[]) priceById[p.id] = p.price_cents || 0;
  }
  let givenCents = 0;
  for (const s of active) if (s.coverage === 'full' && s.product_id) givenCents += priceById[s.product_id] || 0;
  return {
    activeCount: active.filter((s) => s.kind === 'direct').length,
    codeCount: active.filter((s) => s.kind === 'code').length,
    expiredCount: list.filter((s) => s.status === 'expired').length,
    givenCents,
  };
}

// ============================================================
// Fase 2 · Solicitudes de beca (el alumno pide, el mentor aprueba).
// ============================================================

// Un alumno solicita una beca a una academia.
export async function applyScholarship(studentId: string, mentorId: string, message: string, reason: string, lang: string = 'es'): Promise<{ ok: boolean; error?: string }> {
  const { data: prev } = await supabaseAdmin.from(APPS).select('id').eq('mentor_id', mentorId).eq('student_id', studentId).eq('status', 'pending').maybeSingle();
  if (prev) return { ok: false, error: 'Ya tienes una solicitud pendiente en esta academia.' };
  const r = ['low_income', 'merit', 'other'].includes(reason) ? reason : 'low_income';
  const { error } = await supabaseAdmin.from(APPS).insert({ mentor_id: mentorId, student_id: studentId, message: String(message || '').slice(0, 1000), reason: r, status: 'pending', lang: lang === 'en' ? 'en' : 'es' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Solicitudes de una academia (por defecto, las pendientes).
export async function listApps(mentorId: string, status = 'pending') {
  const { data } = await supabaseAdmin.from(APPS).select('*').eq('mentor_id', mentorId).eq('status', status).order('created_at', { ascending: false }).limit(200);
  return (data || []) as any[];
}

// El mentor aprueba (crea la beca) o rechaza una solicitud.
export async function decideApp(mentorId: string, appId: string, decision: 'approve' | 'deny', opts: any = {}): Promise<{ ok: boolean; error?: string; approved?: boolean; studentId?: string; lang?: string }> {
  const { data: app } = await supabaseAdmin.from(APPS).select('*').eq('id', appId).eq('mentor_id', mentorId).maybeSingle();
  if (!app) return { ok: false, error: 'Solicitud no encontrada.' };
  if ((app as any).status !== 'pending') return { ok: false, error: 'La solicitud ya estaba resuelta.' };
  const a: any = app;
  if (decision === 'approve') {
    const r = await createScholarship(mentorId, mentorId, {
      kind: 'direct', student_id: a.student_id, coverage: 'full',
      scope: opts.scope === 'modules' ? 'modules' : 'all', modules: opts.modules || [],
      days: Number(opts.days) || 90, reason: a.reason, lang: a.lang || 'es',
    });
    if (!r.ok) return { ok: false, error: r.error };
    await supabaseAdmin.from(APPS).update({ status: 'approved', grant_id: r.row?.id || null, decided_by: mentorId, decided_at: nowIso(), mentor_note: opts.note || null }).eq('id', appId);
    return { ok: true, approved: true, studentId: a.student_id, lang: a.lang || 'es' };
  }
  await supabaseAdmin.from(APPS).update({ status: 'denied', decided_by: mentorId, decided_at: nowIso(), mentor_note: opts.note || null }).eq('id', appId);
  return { ok: true, approved: false, studentId: a.student_id, lang: a.lang || 'es' };
}

// Cron: becas que vencen dentro de `days` días y aún no avisaron. Marca enviado.
export async function dueReminders(days = 3): Promise<Scholarship[]> {
  const soon = new Date(Date.now() + days * 86400000).toISOString();
  const { data } = await supabaseAdmin.from(TB).select('*')
    .eq('status', 'active').eq('kind', 'direct').eq('reminder_sent', false)
    .not('ends_at', 'is', null).lte('ends_at', soon).gt('ends_at', nowIso()).limit(500);
  const list = (data || []) as any[];
  if (list.length) await supabaseAdmin.from(TB).update({ reminder_sent: true }).in('id', list.map((d) => d.id));
  return list as Scholarship[];
}

// Vista global de Onyx (solo lectura): todas las becas + resumen por academia.
export async function allScholarships(limit = 500) {
  const { data } = await supabaseAdmin.from(TB).select('*').order('created_at', { ascending: false }).limit(limit);
  return (data || []) as any[];
}
