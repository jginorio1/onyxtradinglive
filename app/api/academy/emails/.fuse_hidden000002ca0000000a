import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor } from '@/lib/academy';
import { audienceCounts, sendCampaign, mergeAutomations } from '@/lib/academyEmail';

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
  const lang = /onyx_lang=en/.test(req.headers.get('cookie') || '') ? 'en' : 'es';
  return NextResponse.json({ campaigns: campaigns || [], counts, email_auto: mentor.email_auto || {}, automations: mergeAutomations(mentor.email_templates, mentor.email_auto, lang), mailEnabled: !!process.env.RESEND_API_KEY });
}

// POST · crear+enviar ya, programar, borrar, o guardar automatizaciones.
export async function POST(req: Request) {
  const { mentor } = await mentorOf(req);
  if (!mentor) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const mid = mentor.user_id;
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'automations') {
      // Guarda plantillas editables completas (asunto, cuerpo, tiempos, on/off).
      const src = b.automations && typeof b.automations === 'object' ? b.automations : {};
      const clean = (o: any) => ({
        enabled: !!o?.enabled,
        subject: String(o?.subject || '').slice(0, 200),
        body: String(o?.body || '').slice(0, 8000),
        ...(o?.lead_min !== undefined ? { lead_min: Math.max(5, Math.min(1440, Number(o.lead_min) || 60)) } : {}),
        ...(o?.days_before !== undefined ? { days_before: Math.max(1, Math.min(30, Number(o.days_before) || 3)) } : {}),
      });
      const tpl = { welcome: clean(src.welcome), class_reminder: clean(src.class_reminder), expiring: clean(src.expiring) };
      // Mantén el toggle viejo sincronizado por compatibilidad.
      const a = { welcome: tpl.welcome.enabled, class_reminder: tpl.class_reminder.enabled, expiring: tpl.expiring.enabled };
      await supabaseAdmin.from('mentors').update({ email_templates: tpl, email_auto: a }).eq('user_id', mid);
      return NextResponse.json({ ok: true, automations: mergeAutomations(tpl) });
    }
    if (b.action === 'delete' && b.id) {
      await supabaseAdmin.from('academy_emails').delete().eq('id', String(b.id)).eq('mentor_id', mid);
      return NextResponse.json({ ok: true });
    }
    // Editar una campaña que sigue PROGRAMADA (aún no enviada).
    if (b.action === 'edit' && b.id) {
      const { data: c } = await supabaseAdmin.from('academy_emails').select('status').eq('id', String(b.id)).eq('mentor_id', mid).maybeSingle();
      if (!c || (c as any).status !== 'scheduled') return NextResponse.json({ error: 'no_editable' }, { status: 400 });
      const patch: any = {};
      if (b.subject !== undefined) patch.subject = String(b.subject).slice(0, 200);
      if (b.body !== undefined) patch.body = String(b.body).slice(0, 8000);
      if (b.audience !== undefined && ['all', 'active', 'inactive', 'expiring'].includes(b.audience)) patch.audience = b.audience;
      if (b.scheduled_at !== undefined) { const w = new Date(b.scheduled_at); if (isNaN(w.getTime()) || w.getTime() <= Date.now()) return NextResponse.json({ error: 'fecha_invalida' }, { status: 400 }); patch.scheduled_at = w.toISOString(); }
      await supabaseAdmin.from('academy_emails').update(patch).eq('id', String(b.id)).eq('mentor_id', mid);
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
