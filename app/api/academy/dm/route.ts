import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getMentor, isEnrolled, dmThreads, dmWith, dmSend } from '@/lib/academy';
import { isStaff } from '@/lib/academyCollab';
import { pushDm } from '@/lib/academyPush';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function guard(mentorId: string, userId: string) {
  const mrow = await getMentor(userId);
  if (mrow && mrow.user_id === mentorId) return true;
  return isEnrolled(mentorId, userId);
}

// GET · ?m=mentorId → lista de conversaciones; +&with=userId → hilo con esa persona.
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m'); const withId = sp.get('with');
  if (!m || !(await guard(m, user.id))) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (withId) return NextResponse.json(await dmWith(m, user.id, withId));
  return NextResponse.json({ threads: await dmThreads(m, user.id) });
}

// POST · enviar mensaje { m, to, body }.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const m = String(b.m || ''); const to = String(b.to || '');
  if (!m || !to || (!b.body && !b.image_url) || !(await guard(m, user.id))) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (to === user.id) return NextResponse.json({ error: 'self' }, { status: 400 });
  // El destinatario debe ser miembro de la comunidad.
  if (!(await guard(m, to))) return NextResponse.json({ error: 'no_member' }, { status: 400 });
  // Chat PRIVADO: un alumno solo puede escribir al equipo (mentor/colaboradores).
  // El equipo puede escribir a cualquiera. (Alumno↔alumno no está permitido.)
  const senderStaff = await isStaff(m, user.id);
  if (!senderStaff && !(await isStaff(m, to))) return NextResponse.json({ error: 'only_staff' }, { status: 403 });
  const msg = await dmSend(m, user.id, to, String(b.body || ''), b.image_url ? String(b.image_url) : undefined);
  pushDm(m, user.id, to, String(b.body || '') || (b.image_url ? '📷' : ''));
  return NextResponse.json({ ok: true, message: msg });
}
