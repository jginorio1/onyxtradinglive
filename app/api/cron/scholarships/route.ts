import { NextResponse } from 'next/server';
import { expireDue, dueReminders } from '@/lib/academyScholarship';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail, fromWithName } from '@/lib/mail';
import { emailTplLive } from '@/lib/emailTemplates';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Cron: vence las becas caducadas (el alumno pierde el acceso) y le avisa por
// correo con la opción de suscribirse. Protegido con CRON_SECRET (?key=...).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    // Correo a un alumno con plantilla bilingüe + marca de la academia.
    const notify = async (s: any, tplId: string, extra: Record<string, string | number> = {}) => {
      try {
        if (!s.student_id) return;
        const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', s.student_id).maybeSingle();
        const email = (prof as any)?.email;
        if (!email) return;
        const { data: m } = await supabaseAdmin.from('mentors').select('academy_name,slug').eq('user_id', s.mentor_id).maybeSingle();
        const academia = (m as any)?.academy_name || 'la academia';
        const enlace = `${APP}/academia/${(m as any)?.slug || ''}`;
        const t = await emailTplLive(tplId, s.lang, { academia, enlace, ...extra });
        await sendEmail(email, t.subject, t.text, { from: fromWithName(academia), brandName: academia });
      } catch {}
    };

    const due = await expireDue();
    for (const s of due) await notify(s, 'sch_expired');

    // Recordatorio a quienes les vence pronto (≤3 días): renovar/suscribirse.
    const soon = await dueReminders(3);
    for (const s of soon) {
      const days = s.ends_at ? Math.max(1, Math.ceil((new Date(s.ends_at).getTime() - Date.now()) / 86400000)) : 0;
      await notify(s, 'sch_reminder', { dias: days });
    }

    return NextResponse.json({ ok: true, expired: due.length, reminded: soon.length });
  } catch (e: any) {
    await logError('cron_scholarships', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
