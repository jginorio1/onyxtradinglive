import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { careersSettings, saveCareersSettings, allPositions, savePosition, deletePosition, listApplications } from '@/lib/careers';
import { companyContext, saveCompanyContext } from '@/lib/companyContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // leer un CV con IA puede tardar; evita cortes tempranos

// GET · plazas + postulaciones + ajustes.
export async function GET() {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const settings = await careersSettings();
  const positions = await allPositions();
  const applications = await listApplications(300);
  const company = await companyContext();
  const link = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '') + '/carreras';
  return NextResponse.json({ settings, positions, applications, link, company });
}

// POST · gestión.
export async function POST(req: Request) {
  const { ok, user } = await requirePerm('equipo', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo quien gestiona el equipo puede editar Carreras.' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');
  try {
    if (action === 'save_settings') { const s = await saveCareersSettings(b.settings || {}); return NextResponse.json({ ok: true, settings: s }); }
    // Guardar el Contexto Onyx (perfil de empresa compartido con la IA).
    if (action === 'save_company') { const r = await saveCompanyContext(b.company || ''); return NextResponse.json({ ok: true, company: r.text }); }
    if (action === 'save_position') { const r = await savePosition(b.position || {}); await logAdmin(user?.email || '', 'careers_save', r.id || '', {}); return NextResponse.json(r); }
    if (action === 'set_status' && b.id) { await supabaseAdmin.from('job_openings').update({ status: ['open', 'closed', 'draft'].includes(b.status) ? b.status : 'draft' }).eq('id', b.id); return NextResponse.json({ ok: true }); }
    if (action === 'delete_position' && b.id) { await deletePosition(b.id); return NextResponse.json({ ok: true }); }
    if (action === 'set_app_status' && b.app_id) { await supabaseAdmin.from('job_applications').update({ status: ['new', 'review', 'interview', 'hired', 'rejected'].includes(b.status) ? b.status : 'new' }).eq('id', b.app_id); return NextResponse.json({ ok: true }); }
    // Traducir con IA al idioma destino ('en' o 'es').
    if (action === 'translate') {
      const { translateJob } = await import('@/lib/careersAI');
      const r = await translateJob(b.src || {}, b.to === 'es' ? 'es' : 'en');
      if (!r) return NextResponse.json({ ok: false, error: 'IA no disponible (falta ANTHROPIC_API_KEY)' }, { status: 400 });
      return NextResponse.json({ ok: true, translated: r });
    }
    // Generar un borrador de la plaza con IA a partir del título/contexto.
    if (action === 'draft') {
      const { draftJob } = await import('@/lib/careersAI');
      const r = await draftJob(b.ctx || {}, b.lang === 'en' ? 'en' : 'es', await companyContext());
      if (!r) return NextResponse.json({ ok: false, error: 'IA no disponible (falta ANTHROPIC_API_KEY)' }, { status: 400 });
      return NextResponse.json({ ok: true, draft: r });
    }
    // Sugerir SOLO las etiquetas/skills del puesto.
    if (action === 'suggest_skills') {
      const { suggestSkills } = await import('@/lib/careersAI');
      const r = await suggestSkills(b.ctx || {}, b.lang === 'en' ? 'en' : 'es', await companyContext());
      if (!r) return NextResponse.json({ ok: false, error: 'IA no disponible (falta ANTHROPIC_API_KEY)' }, { status: 400 });
      return NextResponse.json({ ok: true, tags: r });
    }
    // Auditar la plaza con IA (puntaje + sugerencias).
    if (action === 'audit') {
      const { auditJob } = await import('@/lib/careersAI');
      const r = await auditJob(b.job || {}, b.lang === 'en' ? 'en' : 'es', await companyContext());
      return NextResponse.json({ ok: true, audit: r });
    }
    // Aplicar las sugerencias de la auditoría a la plaza (reescribe con IA).
    if (action === 'apply_audit') {
      const { applyAudit } = await import('@/lib/careersAI');
      const r = await applyAudit(b.job || {}, Array.isArray(b.items) ? b.items : [], b.lang === 'en' ? 'en' : 'es', await companyContext());
      if (!r) return NextResponse.json({ ok: false, error: 'IA no disponible (falta ANTHROPIC_API_KEY)' }, { status: 400 });
      return NextResponse.json({ ok: true, applied: r });
    }
    // Analizar el CV de una postulación contra su vacante (IA lee el archivo).
    if (action === 'match_cv' && b.app_id) {
      const { data: app } = await supabaseAdmin.from('job_applications').select('id, job_id, resume_url').eq('id', b.app_id).maybeSingle();
      if (!app || !(app as any).resume_url) return NextResponse.json({ ok: false, error: 'La postulación no tiene CV adjunto.' }, { status: 400 });
      // Descargar el CV del bucket privado.
      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('careers-cv').download((app as any).resume_url);
      if (dlErr || !blob) return NextResponse.json({ ok: false, error: 'No se pudo leer el CV.' }, { status: 400 });
      const buf = Buffer.from(await blob.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'El CV es muy grande para analizar (máx 8 MB).' }, { status: 400 });
      const mediaType = (blob as any).type || (/\.pdf$/i.test((app as any).resume_url) ? 'application/pdf' : 'image/png');
      // Traer la vacante ligada.
      let job: any = {};
      if ((app as any).job_id) { const { data: j } = await supabaseAdmin.from('job_openings').select('title, description, tags').eq('id', (app as any).job_id).maybeSingle(); job = j || {}; }
      const { matchCv } = await import('@/lib/careersAI');
      const r = await matchCv(job, { base64: buf.toString('base64'), mediaType }, b.lang === 'en' ? 'en' : 'es');
      if (!r) return NextResponse.json({ ok: false, error: 'IA no disponible o no pudo leer el CV.' }, { status: 400 });
      const summary = [r.summary, r.strengths?.length ? '✓ ' + r.strengths.join(' · ') : '', r.gaps?.length ? '△ ' + r.gaps.join(' · ') : ''].filter(Boolean).join('\n');
      await supabaseAdmin.from('job_applications').update({ match_score: r.score, match_summary: summary, match_at: new Date().toISOString() }).eq('id', b.app_id);
      return NextResponse.json({ ok: true, match: { score: r.score, summary } });
    }
    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
