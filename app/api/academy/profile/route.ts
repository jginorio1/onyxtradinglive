import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getMentor, isEnrolled, memberProfile, setShareStats, setStudentDisplayName, setAvatar } from '@/lib/academy';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSettings, moderateText } from '@/lib/academyModeration';

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
  // El alumno cambia su avatar (foto de perfil).
  if (b.avatar_url !== undefined) await setAvatar(user.id, b.avatar_url ? String(b.avatar_url) : null);
  // El alumno cambia su nombre visible en ESTA academia (se modera; el mentor puede sobrescribir).
  if (b.display_name !== undefined && b.mentor_id) {
    const nm = String(b.display_name || '').slice(0, 60);
    if (nm) {
      const dec = await moderateText(await getSettings(String(b.mentor_id)), nm, { kind: 'name' });
      if (dec.action === 'block') return NextResponse.json({ error: 'blocked', message: 'Ese nombre no cumple las normas.' }, { status: 422 });
    }
    await setStudentDisplayName(String(b.mentor_id), user.id, nm);
  }
  if (b.push_prefs !== undefined && b.push_prefs && typeof b.push_prefs === 'object') {
    const keys = ['announcements', 'messages', 'classes', 'wins'];
    const p: any = {}; for (const k of keys) if (b.push_prefs[k] !== undefined) p[k] = !!b.push_prefs[k];
    patch.academy_push_prefs = p;
  }
  if (Object.keys(patch).length) await supabaseAdmin.from('profiles').update(patch).eq('id', user.id);
  return NextResponse.json({ ok: true });
}
