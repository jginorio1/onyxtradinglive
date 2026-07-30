import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getMentor, isEnrolled, memberProfile } from '@/lib/academy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ?m=mentorId&u=userId → perfil de un miembro (nivel, puntos, actividad).
// Si no se pasa u, devuelve el propio perfil.
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
  return NextResponse.json({ profile: await memberProfile(m, u) });
}
