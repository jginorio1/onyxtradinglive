import { NextResponse } from 'next/server';
import { expireDue, dueReminders } from '@/lib/academyScholarship';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
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
    const due = await expireDue();
    // Aviso best-effort a cada alumno (nombre de academia + enlace a suscribirse).
    for (const s of due) {
      try {
        if (!s.student_id) continue;
        const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', s.student_id).maybeSingle();
        const email = (prof as any)?.email;
        if (!email) continue;
        const { data: m } = await supabaseAdmin.from('mentors').select('academy_name,slug').eq('user_id', s.mentor_id).maybeSingle();
        const name = (m as any)?.academy_name || 'la academia';
        const link = `${APP}/academia/${(m as any)?.slug || ''}`;
        await sendEmail(email, `Tu beca en ${name} ha finalizado`,
          `Hola,\n\nTu beca en ${name} ha llegado a su fin, por lo que el acceso se ha cerrado.\n\nSi quieres seguir aprendiendo, puedes continuar con una suscripción aquí:\n${link}\n\n¡Gracias por formar parte!`);
      } catch {}
    }
    // Recordatorio a quienes les vence pronto (≤3 días): renovar/suscribirse.
    const soon = await dueReminders(3);
    for (const s of soon) {
      try {
        if (!s.student_id) continue;
        const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', s.student_id).maybeSingle();
        const email = (prof as any)?.email;
        if (!email) continue;
        const { data: m } = await supabaseAdmin.from('mentors').select('academy_name,slug').eq('user_id', s.mentor_id).maybeSingle();
        const name = (m as any)?.academy_name || 'la academia';
        const link = `${APP}/academia/${(m as any)?.slug || ''}`;
        const days = s.ends_at ? Math.max(1, Math.ceil((new Date(s.ends_at).getTime() - Date.now()) / 86400000)) : 0;
        await sendEmail(email, `Tu beca en ${name} vence pronto`,
          `Hola,\n\nTu beca en ${name} vence en unos ${days} día(s). Cuando termine, el acceso se cerrará.\n\nSi quieres seguir sin interrupción, puedes continuar con una suscripción aquí:\n${link}\n\n¡Sigue aprendiendo!`);
      } catch {}
    }

    return NextResponse.json({ ok: true, expired: due.length, reminded: soon.length });
  } catch (e: any) {
    await logError('cron_scholarships', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
