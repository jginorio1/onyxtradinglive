import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor, isEnrolled } from '@/lib/academy';
import { generateAudit, listAudits } from '@/lib/academyExtras';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ?m=&u= → auditorías de un alumno (el propio alumno o su mentor).
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m'); const u = sp.get('u') || user.id;
  if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const mrow = await getMentor(user.id);
  const isMentor = mrow && mrow.user_id === m;
  if (!isMentor && u !== user.id) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ audits: await listAudits(u, m) });
}

// POST · el mentor genera una auditoría AI de un alumno. { student_id, period, lang }.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const mrow = await getMentor(user.id);
  if (!mrow) return NextResponse.json({ error: 'no_mentor' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const student = String(b.student_id || '');
  if (!student || !(await isEnrolled(mrow.user_id, student))) return NextResponse.json({ error: 'no_alumno' }, { status: 400 });
  // Respeta la privacidad: el alumno debe compartir su track record.
  const { data: prof } = await supabaseAdmin.from('profiles').select('academy_share_stats').eq('id', student).maybeSingle();
  if (!(prof as any)?.academy_share_stats) return NextResponse.json({ error: 'no_consent' }, { status: 400 });
  const r = await generateAudit(mrow.user_id, student, b.period === '90d' ? '90d' : '30d', b.lang === 'en' ? 'en' : 'es');
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...r });
}
