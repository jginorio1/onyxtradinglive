import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor } from '@/lib/academy';
import { mentorScholarships, createScholarship, revokeScholarship, mentorReport } from '@/lib/academyScholarship';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return { user, caps: (plan?.capabilities as any) || {} };
}

// GET · becas de la academia del mentor + resumen. También los módulos (para elegir alcance).
export async function GET() {
  const { user, caps } = await me();
  if (!user || !caps?.academy) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [scholarships, report, mods, prods] = await Promise.all([
    mentorScholarships(user.id),
    mentorReport(user.id),
    supabaseAdmin.from('academy_modules').select('id,title').eq('mentor_id', user.id).order('position'),
    supabaseAdmin.from('academy_products').select('id,name,grants').eq('mentor_id', user.id).eq('active', true),
  ]);
  // Adjunta el correo de cada becado (para mostrarlo en la lista).
  const sids = Array.from(new Set(scholarships.map((s: any) => s.student_id).filter(Boolean)));
  const emailById: Record<string, string> = {};
  if (sids.length) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id,email').in('id', sids);
    for (const p of (profs || []) as any[]) emailById[p.id] = p.email;
  }
  const enriched = scholarships.map((s: any) => ({ ...s, email: s.student_id ? emailById[s.student_id] || null : null }));
  return NextResponse.json({ scholarships: enriched, report, modules: mods.data || [], products: prods.data || [] });
}

// POST · crear o revocar. { action:'create'|'revoke', ... }
export async function POST(req: Request) {
  const { user, caps } = await me();
  if (!user || !caps?.academy) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const mentor = await getMentor(user.id);
  if (!mentor) return NextResponse.json({ error: 'no_mentor' }, { status: 400 });
  if ((mentor as any).scholarships_enabled === false) return NextResponse.json({ error: 'Las becas están desactivadas para esta academia.' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  try {
    if (b.action === 'revoke' && b.id) { await revokeScholarship(user.id, String(b.id)); return NextResponse.json({ ok: true }); }
    const r = await createScholarship(user.id, user.id, b);
    if (!r.ok) return NextResponse.json({ error: r.error || 'Error' }, { status: 400 });
    return NextResponse.json({ ok: true, row: r.row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
