import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { emailTplWith } from '@/lib/emailTemplates';
import { getSetting } from '@/lib/settings';

// ============================================================
// Secuencia de correos de onboarding, 100% automática. Un cron la corre a
// diario; cada usuario recibe como mucho UN correo por corrida, y nunca dos
// veces el mismo paso (se registra en profiles.onboarding_emails).
// ============================================================

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

type Step = 'welcome' | 'connect' | 'tips';

// Cada paso → plantilla editable en el Centro de correos + su enlace.
const STEP_TPL: Record<Step, { id: string; path: string }> = {
  welcome: { id: 'onboard_welcome', path: '/dashboard' },
  connect: { id: 'onboard_connect', path: '/guia/conectar-cuenta' },
  tips: { id: 'onboard_guardian', path: '/guia/que-hace-onyx' },
};

function content(overrides: any, step: Step, lang: 'es' | 'en', name: string, sigs?: any[]): { subject: string; body: string; html: string } {
  const m = STEP_TPL[step];
  const r = emailTplWith(overrides, m.id, lang, { nombre: name, enlace: SITE + m.path }, sigs);
  return { subject: r.subject, body: r.text, html: r.html };
}

export async function runOnboardingEmails(dryRun = false) {
  const now = Date.now();
  const day = 86400000;
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id,email,full_name,lang,created_at,onboarding_emails,notify_email')
    .not('email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  // Quién ya tiene al menos una cuenta MT conectada
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('user_id');
  const hasAcc = new Set((accs || []).map((a: any) => a.user_id));

  // Overrides del Centro de correos (editados por el dueño), una sola vez por corrida.
  const overrides = await getSetting<any>('email_tpl_overrides', {});
  const sigs = await getSetting<any>('email_signatures', []);

  let sent = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const u of users || []) {
    if ((u as any).notify_email === false) continue;           // respeta el opt-out
    const email = (u as any).email; if (!email) continue;
    const age = (now - new Date((u as any).created_at || now).getTime()) / day;
    const done = ((u as any).onboarding_emails || {}) as Record<string, string>;
    const lang = (u as any).lang === 'es' ? 'es' : 'en';
    const name = ((u as any).full_name || '').split(' ')[0] || '';

    let step: Step | null = null;
    if (!done.welcome && age <= 3) step = 'welcome';
    else if (!done.connect && age >= 2 && age <= 12 && !hasAcc.has((u as any).id)) step = 'connect';
    else if (!done.tips && age >= 5 && age <= 16) step = 'tips';
    if (!step) continue;

    if (!dryRun) {
      const { subject, body, html } = content(overrides, step, lang, name, Array.isArray(sigs) ? sigs : []);
      const ok = await sendEmail(email, subject, body, { kind: 'onboarding', userId: (u as any).id, htmlBody: html || undefined });
      if (ok) {
        done[step] = today;
        await supabaseAdmin.from('profiles').update({ onboarding_emails: done }).eq('id', (u as any).id);
      }
    }
    sent++;
    if (sent >= 150) break;   // tope por corrida, para no exceder el tiempo del cron
  }
  return { sent };
}
