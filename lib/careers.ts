import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// CARRERAS · plazas disponibles. Página pública configurable desde el panel.
// ============================================================

export type CareersSettings = {
  enabled: boolean;
  title: string; subtitle: string;
  title_en: string; subtitle_en: string;
  apply_mode: 'form' | 'email' | 'link';   // cómo se postula
  apply_email?: string; apply_url?: string;
};

const DEFAULTS: CareersSettings = {
  enabled: true,
  title: 'Únete a Onyx', subtitle: 'Estamos construyendo el futuro del trading. Mira nuestras plazas y postúlate.',
  title_en: 'Join Onyx', subtitle_en: 'We are building the future of trading. See our openings and apply.',
  apply_mode: 'form',
};

export async function careersSettings(): Promise<CareersSettings> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'careers').maybeSingle();
    return { ...DEFAULTS, ...((data?.value as any) || {}) };
  } catch { return DEFAULTS; }
}
export async function saveCareersSettings(patch: Partial<CareersSettings>): Promise<CareersSettings> {
  const prev = await careersSettings();
  const value = { ...prev, ...patch };
  await supabaseAdmin.from('app_settings').upsert({ key: 'careers', value, updated_at: new Date().toISOString() });
  return value;
}

const clean = (s: any, n = 300) => (s == null ? null : String(s).trim().slice(0, n) || null);

// Plazas públicas (solo abiertas), ordenadas.
export async function openPositions(): Promise<any[]> {
  const { data } = await supabaseAdmin.from('job_openings').select('*').eq('status', 'open').order('sort', { ascending: true }).order('created_at', { ascending: false }).limit(100);
  return data || [];
}
// Todas (para el admin).
export async function allPositions(): Promise<any[]> {
  const { data } = await supabaseAdmin.from('job_openings').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false }).limit(300);
  return data || [];
}

export async function savePosition(p: any): Promise<{ ok: boolean; id?: string; error?: string }> {
  const patch: any = {
    title: clean(p.title, 120), department: clean(p.department, 30) || 'other',
    location: clean(p.location, 80) || 'Remoto', type: ['full', 'part', 'contract', 'intern'].includes(p.type) ? p.type : 'full',
    summary: clean(p.summary, 300), description: clean(p.description, 6000),
    salary_range: clean(p.salary_range, 60),
    tags: Array.isArray(p.tags) ? p.tags.map((t: any) => String(t).slice(0, 30)).slice(0, 12) : [],
    status: ['open', 'closed', 'draft'].includes(p.status) ? p.status : 'draft',
    sort: Number(p.sort) || 0,
    // Versión en inglés (bilingüe).
    title_en: clean(p.title_en, 120), summary_en: clean(p.summary_en, 300), description_en: clean(p.description_en, 6000),
    tags_en: Array.isArray(p.tags_en) ? p.tags_en.map((t: any) => String(t).slice(0, 30)).slice(0, 12) : [],
  };
  if (!patch.title) return { ok: false, error: 'falta el título' };
  if (p.id) { await supabaseAdmin.from('job_openings').update(patch).eq('id', p.id); return { ok: true, id: p.id }; }
  const { data, error } = await supabaseAdmin.from('job_openings').insert(patch).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any)?.id };
}
export async function deletePosition(id: string) { await supabaseAdmin.from('job_openings').delete().eq('id', id); return { ok: true }; }

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// Un candidato se postula (público). Anti-duplicado por email+plaza.
export async function submitApplication(b: any): Promise<{ ok: boolean; error?: string; duplicated?: boolean }> {
  const name = clean(b.name, 120), email = clean(b.email, 160)?.toLowerCase();
  if (!name || name.length < 2 || !email || !isEmail(email)) return { ok: false, error: 'datos incompletos' };
  const jobId = b.job_id || null;
  let jobTitle: string | null = null;
  if (jobId) { const { data: j } = await supabaseAdmin.from('job_openings').select('title').eq('id', jobId).maybeSingle(); jobTitle = (j as any)?.title || null; }
  const { data: prev } = await supabaseAdmin.from('job_applications').select('id').eq('email', email).eq('job_id', jobId).maybeSingle();
  if (prev) return { ok: true, duplicated: true };
  await supabaseAdmin.from('job_applications').insert({
    job_id: jobId, job_title: jobTitle, name, email,
    phone: clean(b.phone, 40), country: clean(b.country, 60), message: clean(b.message, 2000),
    resume_url: clean(b.resume_path, 300), status: 'new',
  });
  return { ok: true };
}

export async function listApplications(limit = 300): Promise<any[]> {
  const { data } = await supabaseAdmin.from('job_applications').select('*').order('created_at', { ascending: false }).limit(limit);
  const rows = (data || []) as any[];
  for (const a of rows) {
    a.resume_signed = null;
    if (a.resume_url) { try { const { data: sig } = await supabaseAdmin.storage.from('careers-cv').createSignedUrl(a.resume_url, 3600); a.resume_signed = (sig as any)?.signedUrl || null; } catch {} }
  }
  return rows;
}
