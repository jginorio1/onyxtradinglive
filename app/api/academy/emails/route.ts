import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor } from '@/lib/academy';
import { audienceCounts, sendCampaign } from '@/lib/academyEmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function mentorOf(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, mentor: null as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  if (!(plan?.capabilities as any)?.academy) return { user, mentor: null };
  return { user, mentor: await getMentor(user.id) };
}

// GET · campañas del mentor + tamaños de público + toggles de automatización.
export async function GET(req: Request) {
  const { mentor } = await mentorOf(req);
  if (!mentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [{ data: campaigns }, counts] = await Promise.all([
    supabaseAdmin.from('academy_emails').select('*').eq('mentor_id', mentor.user_id).order('created_at', { ascending: false }).limit(50),
    audienceCounts(mentor.user_id),
  ]);
  return NextResponse.json({ campaigns: campaigns || [], counts, email_auto: mentor.email_auto || {}, mailEnabled: !!process.env.RESEND_API_KEY });
}

// POST · crear+enviar ya, programar, borrar, o guardar automatizaciones.
export async function POST(req: Request) {
  const { mentor } = await mentorOf(req);
  if (!mentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const mid = mentor.user_id;
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'automations') {
      const a = { welcome: !!b.welcome, class_reminder: !!b.class_reminder, expiring: !!b.expiring };
      await supabaseAdmin.from('mentors').update({ email_auto: a }).eq('user_id', mid);
      return NextResponse.json({ ok: true, email_auto: a });
    }
    if (b.action === 'delete' && b.id) {
      await supabaseAdmin.from('academy_emails').delete().eq('id', String(b.id)).eq('mentor_id', mid);
      return NextResponse.json({ ok: true });
    }
    // Crear campaña
    const subject = String(b.subject || '').slice(0, 200);
    const body = String(b.body || '').slice(0, 8000);
    const audience = ['all', 'active', 'inactive', 'expiring'].includes(b.audience) ? b.audience : 'all';
    if (!subject || !body) return NextResponse.json({ error: 'faltan_datos' }, { status: 400 });

    if (b.action === 'schedule' && b.scheduled_at) {
      const when = new Date(b.scheduled_at);
      if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return NextResponse.json({ error: 'fecha_invalida' }, { status: 400 });
      const { data } = await supabaseAdmin.from('academy_emails').insert({ mentor_id: mid, subject, body, audience, scheduled_at: when.toISOString(), status: 'scheduled' }).select('id').single();
      return NextResponse.json({ ok: true, scheduled: true, id: (data as any)?.id });
    }
    // Enviar ya
    const { data } = await supabaseAdmin.from('academy_emails').insert({ mentor_id: mid, subject, body, audience, status: 'draft' }).select('id').single();
    const r = await sendCampaign((data as any).id);
    return NextResponse.json({ ok: true, sent: r.sent });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
