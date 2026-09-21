import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';
import { emailTplLive } from '@/lib/emailTemplates';
import { compSettings } from '@/lib/compTrial';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Pruebas de pago (cortesía): una vez al día,
//  1) avisa por email a quien le vence en <= warnDays (una sola vez),
//  2) al vencer, devuelve la cuenta a Free (deja el rastro para el popup).
// Protegido con CRON_SECRET.
// ============================================================
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

const PLAN_LABEL: Record<string, string> = { pro: 'Pro', elite: 'Elite', black: 'Black Onyx' };

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const { warnDays } = await compSettings();
  const now = Date.now();
  let warned = 0, expired = 0;

  let base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

  // 1) AVISO: prueba activa que vence dentro de warnDays y aún no se avisó.
  try {
    const soon = new Date(now + warnDays * 864e5).toISOString();
    const { data: rows } = await supabaseAdmin.from('profiles')
      .select('id,email,comp_plan,comp_until,lang')
      .not('comp_until', 'is', null).eq('comp_warned', false)
      .lte('comp_until', soon).gt('comp_until', new Date(now).toISOString());
    for (const r of (rows || []) as any[]) {
      const daysLeft = Math.max(1, Math.ceil((new Date(r.comp_until).getTime() - now) / 864e5));
      if (r.email) {
        const planName = PLAN_LABEL[r.comp_plan] || r.comp_plan || 'Pro';
        const { subject, text } = await emailTplLive('comp_reminder', r.lang, { plan: planName, dias: daysLeft, enlace: `${base}/pricing` });
        if (subject) { try { await sendEmail(r.email, subject, text); } catch {} }
      }
      await supabaseAdmin.from('profiles').update({ comp_warned: true }).eq('id', r.id);
      warned++;
    }
  } catch {}

  // 2) EXPIRACIÓN: prueba vencida y aún en el plan de cortesía → vuelve a Free.
  //    (Deja comp_plan/comp_until para que el dashboard muestre el popup "expiró".)
  try {
    const { data: rows } = await supabaseAdmin.from('profiles')
      .select('id,plan,comp_plan,stripe_subscription_id')
      .not('comp_until', 'is', null).lte('comp_until', new Date(now).toISOString());
    for (const r of (rows || []) as any[]) {
      if (r.stripe_subscription_id) continue;              // pagó: su suscripción manda
      if (r.plan === r.comp_plan) {                        // sigue en la cortesía → cortar
        await supabaseAdmin.from('profiles').update({ plan: 'free' }).eq('id', r.id);
        expired++;
      }
    }
  } catch {}

  return NextResponse.json({ ok: true, warnDays, warned, expired });
}
