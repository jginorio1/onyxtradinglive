import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor, isEnrolled } from '@/lib/academy';
import { assistantAnswer } from '@/lib/academyAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · el alumno pregunta y el asistente responde con la guía del mentor.
// { mentor_id, question }.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const m = String(b.mentor_id || '');
  const question = String(b.question || '').trim();
  if (!m || !question) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  // Debe ser el mentor o un alumno inscrito.
  const mine = await getMentor(user.id);
  const allowed = (mine && mine.user_id === m) || (await isEnrolled(m, user.id));
  if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const { data: mrow } = await supabaseAdmin.from('mentors').select('assistant_kb,assistant_on,academy_name,ai_emojis').eq('user_id', m).maybeSingle();
  if (!mrow || !(mrow as any).assistant_on || !((mrow as any).assistant_kb || '').trim()) {
    return NextResponse.json({ error: 'assistant_off' }, { status: 400 });
  }
  const lang = /onyx_lang=en/.test(req.headers.get('cookie') || '') ? 'en' : 'es';
  const text = await assistantAnswer(question, (mrow as any).assistant_kb, (mrow as any).academy_name || 'Onyx Academy', lang, (mrow as any).ai_emojis !== false);
  if (!text) return NextResponse.json({ error: 'ai_error' }, { status: 400 });
  return NextResponse.json({ ok: true, text });
}
