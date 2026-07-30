import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getMentor, isEnrolled } from '@/lib/academy';
import { addWin, listWins, pendingWins, reviewWin, toggleWinLike, deleteWin, setWinVerified } from '@/lib/academyWins';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function ctx(req: Request, mentorId: string, userId: string) {
  const mrow = await getMentor(userId);
  const isMentor = mrow && mrow.user_id === mentorId;
  const allowed = isMentor || (await isEnrolled(mentorId, userId));
  return { isMentor, allowed };
}

// GET · ?m= muro aprobado (+ mi like). ?m=&pending=1 la cola (solo mentor).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { isMentor, allowed } = await ctx(req, m, user.id);
  if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (sp.get('pending')) {
    if (!isMentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    return NextResponse.json({ pending: await pendingWins(m) });
  }
  return NextResponse.json({ wins: await listWins(m, user.id, sp.get('kind') || undefined) });
}

// POST · alumno sube logro; like; el mentor aprueba/rechaza/verifica/borra.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const m = String(b.mentor_id || '');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { isMentor, allowed } = await ctx(req, m, user.id);
  if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const action = String(b.action || 'add');
  if (action === 'add') { return NextResponse.json(await addWin(m, user.id, b)); }
  if (action === 'like') { return NextResponse.json(await toggleWinLike(String(b.win_id), user.id)); }

  // Acciones del mentor.
  if (!isMentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (action === 'review') return NextResponse.json(await reviewWin(m, String(b.win_id), b.decision === 'reject' ? 'reject' : 'approve', !!b.verified));
  if (action === 'verify') return NextResponse.json(await setWinVerified(m, String(b.win_id), !!b.on));
  if (action === 'delete') return NextResponse.json(await deleteWin(m, String(b.win_id)));
  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
