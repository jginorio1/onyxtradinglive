import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureMentor, getMentor, updateMentor, getContent, saveModule, deleteModule, saveLesson, deleteLesson, roster, listPosts, addPost, deletePost, applyTemplate, listEvents, saveEvent, deleteEvent } from '@/lib/academy';

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
  const [content, rost, feed, events] = await Promise.all([getContent(mentor.user_id, false), roster(mentor.user_id), listPosts(mentor.user_id, undefined, true), listEvents(mentor.user_id)]);
  return NextResponse.json({ mentor, content, roster: rost, feed, events });
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
      case 'post': await addPost(mid, user.id, String(b.body || ''), !!b.pinned, b.image_url ? String(b.image_url) : undefined, b.scheduled_at ? String(b.scheduled_at) : undefined); return NextResponse.json({ ok: true });
      case 'post_delete': await deletePost(mid, String(b.id)); return NextResponse.json({ ok: true });
      case 'template': return NextResponse.json({ ok: true, ...(await applyTemplate(mid, !!b.force, b.lang === 'en' ? 'en' : 'es')) });
      case 'event': return NextResponse.json({ ok: true, ...(await saveEvent(mid, b)) });
      case 'event_delete': await deleteEvent(mid, String(b.id)); return NextResponse.json({ ok: true });
      default: return NextResponse.json({ error: 'bad_action' }, { status: 400 });
    }
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
