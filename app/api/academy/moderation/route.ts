import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { isEnrolled, setStudentBanned } from '@/lib/academy';
import { permsFor } from '@/lib/academyCollab';
import {
  getSettings, saveSettings, pendingContent, reportsOpen, reviewContent, resolveReports,
  warnStudent, muteStudent, unmuteStudent, logInfraction, infractions, addReport,
} from '@/lib/academyModeration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ?m=mentorId → panel de moderación (solo dueño o colaborador que modera):
//   { settings, pending, reports }. ?m=&student=uid → historial de sanciones de un alumno.
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const perms = await permsFor(m, user.id);
  if (!perms.moderate) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const student = sp.get('student');
  if (student) return NextResponse.json({ infractions: await infractions(m, student) });
  const [settings, pending, reports] = await Promise.all([getSettings(m), pendingContent(m), reportsOpen(m)]);
  return NextResponse.json({ settings, pending, reports, isOwner: perms.isMentor });
}

// POST · reportar (cualquier miembro) o acciones de moderación (dueño/colaborador).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const m = String(b.mentor_id || b.m || '');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const action = String(b.action || '');
  const perms = await permsFor(m, user.id);

  // --- Reportar: cualquier miembro inscrito (o el equipo). ---
  if (action === 'report') {
    const member = perms.isMentor || perms.isCollab || (await isEnrolled(m, user.id));
    if (!member) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    if (!b.target_type || !b.target_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    return NextResponse.json(await addReport(m, user.id, String(b.target_type), String(b.target_id), b.reason ? String(b.reason) : undefined));
  }

  // --- El resto son acciones de moderación: dueño o colaborador con permiso "moderate". ---
  if (!perms.moderate) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  // Guardar ajustes: solo el dueño de la academia.
  if (action === 'settings') {
    if (!perms.isMentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    return NextResponse.json({ ok: true, settings: await saveSettings(m, b.settings || {}) });
  }
  if (action === 'review') {
    const type = b.type === 'comment' ? 'comment' : 'post';
    const decision = ['approve', 'hide', 'delete'].includes(b.decision) ? b.decision : 'approve';
    return NextResponse.json(await reviewContent(m, type as any, String(b.id), decision));
  }
  if (action === 'dismiss_report') {
    return NextResponse.json(await resolveReports(m, String(b.target_type || 'post'), String(b.target_id), 'dismissed'));
  }
  if (action === 'warn') {
    if (!b.student_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    return NextResponse.json(await warnStudent(m, String(b.student_id), user.id, b.reason ? String(b.reason) : undefined));
  }
  if (action === 'mute') {
    if (!b.student_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    return NextResponse.json(await muteStudent(m, String(b.student_id), Number(b.hours) || 24, user.id, b.reason ? String(b.reason) : undefined));
  }
  if (action === 'unmute') {
    if (!b.student_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    return NextResponse.json(await unmuteStudent(m, String(b.student_id), user.id));
  }
  if (action === 'ban') {
    if (!b.student_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    await setStudentBanned(m, String(b.student_id), true);
    await logInfraction(m, String(b.student_id), 'ban', user.id, b.reason ? String(b.reason) : undefined);
    // Cierra reportes de perfil de ese alumno.
    await resolveReports(m, 'profile', String(b.student_id), 'resolved');
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
