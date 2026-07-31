import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor, isEnrolled, recentCount } from '@/lib/academy';
import { addWin, listWins, pendingWins, reviewWin, toggleWinLike, deleteWin, setWinVerified } from '@/lib/academyWins';
import { pushWinPending, pushWinApproved } from '@/lib/academyPush';
import { permsFor } from '@/lib/academyCollab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Contexto de permisos: dueño, colaborador con permiso de moderar, o alumno inscrito.
async function ctx(mentorId: string, userId: string) {
  const perms = await permsFor(mentorId, userId);
  const allowed = perms.isMentor || perms.isCollab || (await isEnrolled(mentorId, userId));
  return { perms, allowed };
}

// GET · ?m= muro aprobado (+ mi like). ?m=&pending=1 la cola (mentor o colaborador que modera).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { perms, allowed } = await ctx(m, user.id);
  if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (sp.get('pending')) {
    if (!perms.moderate) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    return NextResponse.json({ pending: await pendingWins(m) });
  }
  return NextResponse.json({ wins: await listWins(m, user.id, sp.get('kind') || undefined) });
}

// POST · alumno sube logro; like; el mentor/colaborador aprueba/rechaza/verifica/borra.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const m = String(b.mentor_id || '');
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { perms, allowed } = await ctx(m, user.id);
  if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const action = String(b.action || 'add');
  if (action === 'add') {
    if (await recentCount('academy_wins', 'student_id', user.id, 120) >= 4) return NextResponse.json({ error: 'too_fast' }, { status: 429 });
    const r = await addWin(m, user.id, b); if (r.ok && !perms.isMentor) pushWinPending(m, user.id); return NextResponse.json(r);
  }
  if (action === 'like') { return NextResponse.json(await toggleWinLike(String(b.win_id), user.id)); }

  // Acciones de moderación: dueño o colaborador con permiso "moderate".
  if (!perms.moderate) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (action === 'review') {
    // Antes de aprobar, sabemos a quién notificar (el autor del logro).
    const decision = b.decision === 'reject' ? 'reject' : 'approve';
    const { data: w } = await supabaseAdmin.from('academy_wins').select('student_id').eq('id', String(b.win_id)).eq('mentor_id', m).maybeSingle();
    const r = await reviewWin(m, String(b.win_id), decision, !!b.verified);
    if (r.ok && decision === 'approve' && (w as any)?.student_id) pushWinApproved(m, (w as any).student_id);
    return NextResponse.json(r);
  }
  if (action === 'verify') return NextResponse.json(await setWinVerified(m, String(b.win_id), !!b.on));
  if (action === 'delete') return NextResponse.json(await deleteWin(m, String(b.win_id)));
  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
