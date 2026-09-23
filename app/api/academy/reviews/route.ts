import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getMentor, isEnrolled } from '@/lib/academy';
import { addReview, myReview, pendingReviews, decideReview } from '@/lib/academyReviews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ?m= → mi reseña (alumno) o la cola de pendientes (mentor con ?pending=1).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const mrow = await getMentor(user.id);
  const isMentor = mrow && mrow.user_id === m;
  if (sp.get('pending')) {
    if (!isMentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    return NextResponse.json({ pending: await pendingReviews(m) });
  }
  if (!isMentor && !(await isEnrolled(m, user.id))) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ mine: await myReview(m, user.id) });
}

// POST · alumno deja reseña; mentor aprueba/rechaza.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const m = String(b.mentor_id || '');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const mrow = await getMentor(user.id);
  const isMentor = mrow && mrow.user_id === m;
  if (b.action === 'decide') {
    if (!isMentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    return NextResponse.json(await decideReview(m, String(b.id), !!b.approve));
  }
  // Dejar/actualizar reseña (alumno inscrito).
  if (!(await isEnrolled(m, user.id))) return NextResponse.json({ error: 'no_alumno' }, { status: 400 });
  return NextResponse.json(await addReview(m, user.id, b.rating, String(b.body || '')));
}
