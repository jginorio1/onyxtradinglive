import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor, isEnrolled } from '@/lib/academy';
import { pickLang } from '@/lib/i18n';
import { listAudits } from '@/lib/academyExtras';
import { auditRoster, generateAuditReport, saveStudentNote, setPlanVerified, setAuditConsent, canAudit, studentTrades } from '@/lib/academyAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · el mentor pide el roster de auditoría (?roster=1&m=), los trades de un
// alumno (?trades=1&m=&u=), o el historial de auditorías de un alumno (?m=&u=).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m'); const u = sp.get('u') || user.id;
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const mrow = await getMentor(user.id);
  const isMentor = mrow && mrow.user_id === m;

  // Roster completo (solo el mentor de esa academia).
  if (sp.get('roster')) {
    if (!isMentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    return NextResponse.json(await auditRoster(m));
  }
  // Trades del alumno (mentor con permiso: add-on + consentimiento).
  if (sp.get('trades')) {
    if (!isMentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const perm = await canAudit(m, u);
    if (!perm.ok) return NextResponse.json({ error: perm.consent ? 'no_addon' : 'no_consent' }, { status: 400 });
    return NextResponse.json({ trades: await studentTrades(u, sp.get('period') === '90d' ? 90 : 30) });
  }
  // Historial de auditorías (el propio alumno, o su mentor).
  if (!isMentor && u !== user.id) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ audits: await listAudits(u, m) });
}

// POST · acciones del mentor (generar reporte, nota, verificar) y del alumno
// (dar/quitar consentimiento).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || 'audit');

  // --- Acción del ALUMNO: consentir/revocar compartir con un mentor ---
  if (action === 'consent') {
    const mentorId = String(b.mentor_id || '');
    if (!mentorId || !(await isEnrolled(mentorId, user.id))) return NextResponse.json({ error: 'no_alumno' }, { status: 400 });
    const on = !!b.on;
    await setAuditConsent(mentorId, user.id, on);
    return NextResponse.json({ ok: true, consent: on });
  }

  // --- El resto son acciones del MENTOR ---
  const mrow = await getMentor(user.id);
  if (!mrow) return NextResponse.json({ error: 'no_mentor' }, { status: 403 });
  const student = String(b.student_id || '');
  if (!student || !(await isEnrolled(mrow.user_id, student))) return NextResponse.json({ error: 'no_alumno' }, { status: 400 });

  // Nota privada del mentor.
  if (action === 'note') {
    await saveStudentNote(mrow.user_id, student, String(b.notes || ''));
    return NextResponse.json({ ok: true });
  }
  // Marcar/quitar "plan verificado por su mentor".
  if (action === 'verify') {
    const on = await setPlanVerified(mrow.user_id, student, !!b.on);
    return NextResponse.json({ ok: true, verified: on });
  }

  // Generar auditoría AI. Requiere add-on activo + consentimiento del alumno.
  const perm = await canAudit(mrow.user_id, student);
  if (!perm.ok) return NextResponse.json({ error: perm.consent ? 'no_addon' : 'no_consent' }, { status: 400 });
  const r = await generateAuditReport(mrow.user_id, student, b.period === '90d' ? '90d' : '30d', pickLang(b.lang));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...r });
}
