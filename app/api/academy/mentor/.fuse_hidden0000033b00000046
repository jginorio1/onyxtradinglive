import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureMentor, getMentor, updateMentor, getContent, saveModule, deleteModule, saveLesson, deleteLesson, roster, listPosts, addPost, deletePost, applyTemplate, listEvents, saveEvent, deleteEvent, setStudentDisplayName, setStudentBanned, removeStudent } from '@/lib/academy';
import { listCollaborators, addCollaborator, removeCollaborator } from '@/lib/academyCollab';
import { pushAnnouncement } from '@/lib/academyPush';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return { user, caps: (plan?.capabilities as any) || {} };
}

// GET · panel del mentor: crea su academia si no existe, y devuelve todo.
export async function GET() {
  const { user, caps } = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!caps?.academy) return NextResponse.json({ error: 'no_academy', code: 'no_academy' }, { status: 403 });
  const mentor = await ensureMentor(user.id);
  const [content, rost, feed, events, collaborators, prodCount] = await Promise.all([getContent(mentor.user_id, false), roster(mentor.user_id), listPosts(mentor.user_id, undefined, true), listEvents(mentor.user_id), listCollaborators(mentor.user_id),
    supabaseAdmin.from('academy_products').select('id', { count: 'exact', head: true }).eq('mentor_id', mentor.user_id).eq('active', true)]);
  // Estado de onboarding (5-6 pasos) para la lista de configuración del mentor.
  const onboarding = {
    dismissed: !!(mentor as any).onboarding_dismissed,
    logo: !!(mentor as any).logo_url,
    cover: !!(mentor as any).cover_url,
    content: (content || []).length > 0,
    monetize: ((prodCount.count || 0) > 0) || ((mentor as any).membership_price_cents || 0) > 0,
    charges: !!(mentor as any).charges_enabled,
    liveClass: (events || []).length > 0,
    branding: !!((mentor as any).brand_info || Object.keys((mentor as any).socials || {}).length),
  };
  return NextResponse.json({ mentor, content, roster: rost, feed, events, collaborators, onboarding });
}

// POST · gestión del contenido y la comunidad (solo el mentor).
export async function POST(req: Request) {
  const { user, caps } = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!caps?.academy) return NextResponse.json({ error: 'no_academy' }, { status: 403 });
  const mentor = await getMentor(user.id);
  if (!mentor) return NextResponse.json({ error: 'no_mentor' }, { status: 400 });
  const mid = mentor.user_id;
  const b = await req.json().catch(() => ({}));
  try {
    switch (b.action) {
      case 'settings': await updateMentor(mid, b); return NextResponse.json({ ok: true });
      case 'module': return NextResponse.json({ ok: true, ...(await saveModule(mid, b)) });
      case 'module_delete': await deleteModule(mid, String(b.id)); return NextResponse.json({ ok: true });
      case 'lesson': return NextResponse.json({ ok: true, ...(await saveLesson(mid, b)) });
      case 'lesson_delete': await deleteLesson(mid, String(b.id)); return NextResponse.json({ ok: true });
      case 'post': {
        const isAnn = !!b.announcement;
        await addPost(mid, user.id, String(b.body || ''), !!b.pinned || isAnn, b.image_url ? String(b.image_url) : undefined, b.scheduled_at ? String(b.scheduled_at) : undefined, { kind: b.kind, win_kind: b.win_kind, announcement: isAnn });
        // Anuncio (o fijado) no programado → push a los alumnos.
        if ((b.pinned || isAnn) && !b.scheduled_at) pushAnnouncement(mid, String(b.body || ''));
        return NextResponse.json({ ok: true });
      }
      case 'post_delete': await deletePost(mid, String(b.id)); return NextResponse.json({ ok: true });
      case 'template': return NextResponse.json({ ok: true, ...(await applyTemplate(mid, !!b.force, b.lang === 'en' ? 'en' : 'es')) });
      case 'event': return NextResponse.json({ ok: true, ...(await saveEvent(mid, b)) });
      case 'event_delete': await deleteEvent(mid, String(b.id)); return NextResponse.json({ ok: true });
      case 'student_name': await setStudentDisplayName(mid, String(b.student_id), String(b.name || '')); return NextResponse.json({ ok: true });
      case 'student_ban': return NextResponse.json(await setStudentBanned(mid, String(b.student_id), !!b.banned));
      case 'student_remove': return NextResponse.json(await removeStudent(mid, String(b.student_id)));
      case 'collab_add': return NextResponse.json(await addCollaborator(mid, String(b.user_id), String(b.role || 'Colaborador'), b.perms || {}));
      case 'collab_remove': await removeCollaborator(mid, String(b.user_id)); return NextResponse.json({ ok: true });
      case 'onboarding_dismiss': await supabaseAdmin.from('mentors').update({ onboarding_dismissed: !!b.on }).eq('user_id', mid); return NextResponse.json({ ok: true });
      default: return NextResponse.json({ error: 'bad_action' }, { status: 400 });
    }
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
