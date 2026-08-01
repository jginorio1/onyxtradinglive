import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';

// ============================================================
// Secuencia de correos de onboarding, 100% automática. Un cron la corre a
// diario; cada usuario recibe como mucho UN correo por corrida, y nunca dos
// veces el mismo paso (se registra en profiles.onboarding_emails).
// ============================================================

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

type Step = 'welcome' | 'connect' | 'tips';

function content(step: Step, lang: 'es' | 'en', name: string): { subject: string; body: string } {
  const hi = name ? (lang === 'en' ? `Hi ${name},` : `Hola ${name},`) : (lang === 'en' ? 'Hi,' : 'Hola,');
  const sign = lang === 'en' ? '\n\n— Onyx Trading Live team' : '\n\n— Equipo de Onyx Trading Live';
  if (step === 'welcome') {
    return lang === 'en'
      ? { subject: 'Welcome to Onyx Trading Live 🖤', body: `${hi}\n\nWelcome aboard! Onyx turns your MetaTrader account into a clear trading journal with Onyx Guardian watching your risk.\n\nStart here — connect your account in 2 minutes:\n${SITE}/dashboard\n\nNeed help? Just reply to this email or open the chat on our site.${sign}` }
      : { subject: 'Bienvenido a Onyx Trading Live 🖤', body: `${hi}\n\n¡Bienvenido! Onyx convierte tu cuenta de MetaTrader en un diario de trading claro, con Onyx Guardian cuidando tu riesgo.\n\nEmpieza aquí — conecta tu cuenta en 2 minutos:\n${SITE}/dashboard\n\n¿Dudas? Responde a este correo o abre el chat en la web.${sign}` };
  }
  if (step === 'connect') {
    return lang === 'en'
      ? { subject: 'Connect your account to see your numbers', body: `${hi}\n\nWe noticed you haven't connected a MetaTrader account yet. It takes about 2 minutes and unlocks your live stats and Onyx Guardian.\n\nStep‑by‑step guide:\n${SITE}/guia/conectar-cuenta\n\nStuck? Reply here and a person will help.${sign}` }
      : { subject: 'Conecta tu cuenta para ver tus números', body: `${hi}\n\nVimos que aún no has conectado una cuenta de MetaTrader. Toma unos 2 minutos y desbloquea tus estadísticas en vivo y Onyx Guardian.\n\nGuía paso a paso:\n${SITE}/guia/conectar-cuenta\n\n¿Atascado? Responde aquí y te ayuda una persona.${sign}` };
  }
  return lang === 'en'
    ? { subject: 'Get more out of Onyx Guardian', body: `${hi}\n\nQuick tip: Onyx Guardian can enforce your daily loss limit, protect your profits and warn you before high‑impact news — automatically.\n\nSee how it works:\n${SITE}/guia/que-hace-onyx\n\nReply anytime if you have questions.${sign}` }
    : { subject: 'Saca más partido a Onyx Guardian', body: `${hi}\n\nTip rápido: Onyx Guardian puede hacer respetar tu límite de pérdida diaria, proteger tus ganancias y avisarte antes de noticias de alto impacto — automáticamente.\n\nMira cómo funciona:\n${SITE}/guia/que-hace-onyx\n\nResponde cuando quieras si tienes dudas.${sign}` };
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

  let sent = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const u of users || []) {
    if ((u as any).notify_email === false) continue;           // respeta el opt-out
    const email = (u as any).email; if (!email) continue;
    const age = (now - new Date((u as any).created_at || now).getTime()) / day;
    const done = ((u as any).onboarding_emails || {}) as Record<string, string>;
    const lang = (u as any).lang === 'en' ? 'en' : 'es';
    const name = ((u as any).full_name || '').split(' ')[0] || '';

    let step: Step | null = null;
    if (!done.welcome && age <= 3) step = 'welcome';
    else if (!done.connect && age >= 2 && age <= 12 && !hasAcc.has((u as any).id)) step = 'connect';
    else if (!done.tips && age >= 5 && age <= 16) step = 'tips';
    if (!step) continue;

    if (!dryRun) {
      const { subject, body } = content(step, lang, name);
      const ok = await sendEmail(email, subject, body, { kind: 'onboarding', userId: (u as any).id });
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
