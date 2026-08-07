import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor } from '@/lib/academy';
import { mentorScholarships, createScholarship, revokeScholarship, mentorReport, listApps, decideApp } from '@/lib/academyScholarship';
import { sendEmail } from '@/lib/mail';

const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

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
  const [scholarships, report, mods, prods, apps] = await Promise.all([
    mentorScholarships(user.id),
    mentorReport(user.id),
    supabaseAdmin.from('academy_modules').select('id,title').eq('mentor_id', user.id).order('position'),
    supabaseAdmin.from('academy_products').select('id,name,grants').eq('mentor_id', user.id).eq('active', true),
    listApps(user.id, 'pending'),
  ]);
  // Adjunta el correo de becados y solicitantes (para mostrarlo en la lista).
  const sids = Array.from(new Set([...scholarships.map((s: any) => s.student_id), ...apps.map((a: any) => a.student_id)].filter(Boolean)));
  const emailById: Record<string, string> = {};
  if (sids.length) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id,email').in('id', sids);
    for (const p of (profs || []) as any[]) emailById[p.id] = p.email;
  }
  const enriched = scholarships.map((s: any) => ({ ...s, email: s.student_id ? emailById[s.student_id] || null : null }));
  const appsE = apps.map((a: any) => ({ ...a, email: emailById[a.student_id] || null }));
  return NextResponse.json({ scholarships: enriched, report, modules: mods.data || [], products: prods.data || [], apps: appsE });
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

    // Resolver una solicitud (aprobar crea la beca; rechazar la cierra).
    if ((b.action === 'approve' || b.action === 'deny') && b.id) {
      const r = await decideApp(user.id, String(b.id), b.action === 'approve' ? 'approve' : 'deny', b);
      if (!r.ok) return NextResponse.json({ error: r.error || 'Error' }, { status: 400 });
      // Aviso al alumno (best-effort).
      try {
        if (r.studentId) {
          const { data: sp } = await supabaseAdmin.from('profiles').select('email').eq('id', r.studentId).maybeSingle();
          const { data: mm } = await supabaseAdmin.from('mentors').select('academy_name,slug').eq('user_id', user.id).maybeSingle();
          const name = (mm as any)?.academy_name || 'la academia';
          const link = `${APP}/academia/${(mm as any)?.slug || ''}`;
          if ((sp as any)?.email) await sendEmail((sp as any).email,
            r.approved ? `¡Tu beca en ${name} fue aprobada! 🎓` : `Tu solicitud de beca en ${name}`,
            r.approved
              ? `¡Buenas noticias! Tu beca fue aprobada. Ya puedes entrar y aprender:\n${link}`
              : `Gracias por tu interés. Esta vez tu solicitud no fue aprobada. Puedes seguir aprendiendo con una suscripción:\n${link}`);
        }
      } catch {}
      return NextResponse.json({ ok: true, approved: r.approved });
    }

    const r = await createScholarship(user.id, user.id, b);
    if (!r.ok) return NextResponse.json({ error: r.error || 'Error' }, { status: 400 });
    return NextResponse.json({ ok: true, row: r.row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
