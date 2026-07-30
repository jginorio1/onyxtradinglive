import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { academyCopilot, type CopilotKind } from '@/lib/academyAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KINDS: CopilotKind[] = ['tagline', 'about', 'pitch', 'course_desc', 'lesson_desc', 'post'];

// POST · copiloto del mentor. { kind, input, lang } → { ok, text }.
// Solo mentores (capacidad academy).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  if (!(plan?.capabilities as any)?.academy) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const kind = String(b.kind || '') as CopilotKind;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
  const lang = b.lang === 'en' ? 'en' : 'es';
  // Lee ajustes de marca del mentor: emojis, info de marca, y su enlace de academia.
  const { data: mrow } = await supabaseAdmin.from('mentors').select('ai_emojis,brand_info,code').eq('user_id', user.id).maybeSingle();
  const site = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
  const opts = {
    emojis: (mrow as any)?.ai_emojis !== false,
    brand: (mrow as any)?.brand_info || '',
    link: (mrow as any)?.code ? `${site}/academia/${(mrow as any).code}` : '',
  };
  const r = await academyCopilot(kind, String(b.input || '').slice(0, 2000), lang, opts);
  if (!r.ok) return NextResponse.json({ error: r.reason || 'error' }, { status: r.reason === 'no_key' ? 400 : 500 });
  return NextResponse.json({ ok: true, text: r.text });
}
