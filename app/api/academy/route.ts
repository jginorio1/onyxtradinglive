import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor, myAcademies, getContent, progressSet, markLesson, isEnrolled, listPosts, addPost, addComment } from '@/lib/academy';
import { listProducts, accessibleModules, studentPurchases } from '@/lib/academyPay';

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

// GET · vista del alumno. ?m=mentorId abre esa academia (contenido + progreso + comunidad).
export async function GET(req: Request) {
  const { user, caps } = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const m = new URL(req.url).searchParams.get('m');
  const [mine, mentorRow] = await Promise.all([myAcademies(user.id), getMentor(user.id)]);
  const out: any = { canMentor: !!caps?.academy, isMentor: !!mentorRow, mentorCode: mentorRow?.code || null, academies: mine };
  if (m && (await isEnrolled(m, user.id))) {
    const [mentor, content, progress, feed, products, access, purchases] = await Promise.all([
      supabaseAdmin.from('mentors').select('academy_name,tagline,about').eq('user_id', m).maybeSingle(),
      getContent(m, true), progressSet(user.id, m), listPosts(m), listProducts(m, true), accessibleModules(user.id, m), studentPurchases(user.id, m),
    ]);
    // Marca cada módulo como bloqueado si el alumno no tiene acceso por su compra.
    const lockedContent = (content as any[]).map((mod: any) => {
      const unlocked = access.all || access.ids.has(mod.id);
      return { ...mod, locked: !unlocked, lessons: mod.lessons.map((l: any) => (unlocked || l.is_free) ? l : { id: l.id, title: l.title, is_free: false, locked: true }) };
    });
    out.active = { mentor_id: m, ...(mentor.data as any), content: lockedContent, progress, feed, products, purchases, hasAccess: access.all || access.ids.size > 0, hasAccessAll: access.all };
  }
  return NextResponse.json(out);
}

// POST · progreso de lección, o publicar en comunidad / comentar.
export async function POST(req: Request) {
  const { user } = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'lesson' && b.lesson_id) { await markLesson(user.id, String(b.lesson_id), !!b.done); return NextResponse.json({ ok: true }); }
    if (b.action === 'post' && b.mentor_id && b.body) {
      const mentorRow = await getMentor(user.id);
      const allowed = (mentorRow && mentorRow.user_id === b.mentor_id) || (await isEnrolled(String(b.mentor_id), user.id));
      if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
      await addPost(String(b.mentor_id), user.id, String(b.body));
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'comment' && b.post_id && b.mentor_id && b.body) {
      const mentorRow = await getMentor(user.id);
      const allowed = (mentorRow && mentorRow.user_id === b.mentor_id) || (await isEnrolled(String(b.mentor_id), user.id));
      if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
      await addComment(String(b.post_id), user.id, String(b.body));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
