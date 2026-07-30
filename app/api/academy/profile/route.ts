import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getMentor, isEnrolled, memberProfile, setShareStats } from '@/lib/academy';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ?m=mentorId&u=userId → perfil de un miembro (nivel, puntos, actividad,
// track record verificado si lo comparte). Sin u → el propio perfil.
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m'); const u = sp.get('u') || user.id;
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const mrow = await getMentor(user.id);
  const allowed = (mrow && mrow.user_id === m) || (await isEnrolled(m, user.id));
  if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ profile: await memberProfile(m, u, u === user.id) });
}

// POST · { share: bool } → activar/desactivar compartir mi track record.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const patch: any = {};
  if (b.share !== undefined) await setShareStats(user.id, !!b.share);
  if (b.country !== undefined) patch.country = b.country ? String(b.country).slice(0, 2).toUpperCase() : null;
  if (Object.keys(patch).length) await supabaseAdmin.from('profiles').update(patch).eq('id', user.id);
  return NextResponse.json({ ok: true });
}
