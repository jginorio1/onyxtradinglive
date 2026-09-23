import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { hasTrainingAccess, learnerHome, trackDetail, markLesson, submitExam, trainingSettings } from '@/lib/training';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const asLang = (v: any): 'es' | 'en' => (String(v) === 'en' ? 'en' : 'es');

// GET · home del alumno (o detalle de una ruta con ?track=ID).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const s = await trainingSettings();
  if (!s.enabled) return NextResponse.json({ access: false, enabled: false });
  const ok = await hasTrainingAccess(user.id);
  if (!ok) return NextResponse.json({ access: false, enabled: true });

  const url = new URL(req.url);
  const lang = asLang(url.searchParams.get('lang'));
  const trackId = url.searchParams.get('track');
  if (trackId) {
    const detail = await trackDetail(user.id, trackId, lang);
    if (!detail) return NextResponse.json({ error: 'ruta no encontrada' }, { status: 404 });
    return NextResponse.json({ access: true, detail });
  }
  const home = await learnerHome(user.id, lang);
  return NextResponse.json({ access: true, ...home });
}

// POST · marcar lección / enviar examen.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!(await hasTrainingAccess(user.id))) return NextResponse.json({ error: 'sin acceso' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const lang = asLang(body.lang);
  const action = String(body.action || '');

  if (action === 'mark_lesson') {
    if (!body.lesson_id) return NextResponse.json({ error: 'falta lección' }, { status: 400 });
    await markLesson(user.id, String(body.lesson_id), body.done !== false);
    return NextResponse.json({ ok: true });
  }
  if (action === 'submit_exam') {
    if (!body.track_id) return NextResponse.json({ error: 'falta ruta' }, { status: 400 });
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
    const ua = req.headers.get('user-agent') || '';
    const res = await submitExam(user.id, String(body.track_id), (body.answers || {}) as Record<string, number>, lang, { attested: !!body.attested, ip, ua });
    return NextResponse.json(res);
  }
  return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
}
