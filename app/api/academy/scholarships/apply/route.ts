import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { applyScholarship } from '@/lib/academyScholarship';
import { sendEmail } from '@/lib/mail';
import { emailTplLive } from '@/lib/emailTemplates';
import { serverLang } from '@/lib/locale';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// POST · un alumno solicita una beca a una academia. { code | mentorId, message, reason }
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));

  // Resolver la academia por código o por id directo.
  let mentorId = b.mentorId ? String(b.mentorId) : '';
  if (!mentorId && b.code) {
    const { data: m } = await supabaseAdmin.from('mentors').select('user_id,active').eq('code', String(b.code).trim()).maybeSingle();
    if (!m || !(m as any).active) return NextResponse.json({ error: 'No encontramos esa academia.' }, { status: 400 });
    mentorId = (m as any).user_id;
  }
  if (!mentorId) return NextResponse.json({ error: 'Indica el código de la academia.' }, { status: 400 });
  if (mentorId === user.id) return NextResponse.json({ error: 'No puedes pedirte una beca a ti mismo.' }, { status: 400 });

  const lang = serverLang();
  const r = await applyScholarship(user.id, mentorId, String(b.message || ''), String(b.reason || 'low_income'), lang);
  if (!r.ok) return NextResponse.json({ error: r.error || 'Error' }, { status: 400 });

  // Aviso al mentor (best-effort), desde la plataforma.
  try {
    const { data: mp } = await supabaseAdmin.from('profiles').select('email').eq('id', mentorId).maybeSingle();
    const { data: m } = await supabaseAdmin.from('mentors').select('academy_name').eq('user_id', mentorId).maybeSingle();
    const academia = (m as any)?.academy_name || 'tu academia';
    if ((mp as any)?.email) {
      const t = await emailTplLive('sch_apply_mentor', 'es', { academia, enlace: `${APP}/dashboard/academy` });
      await sendEmail((mp as any).email, t.subject, t.text);
    }
  } catch {}
  return NextResponse.json({ ok: true });
}
