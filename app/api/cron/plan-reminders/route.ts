import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyPlanChange } from '@/lib/planNotify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Recordatorio: 3 días antes de que un downgrade programado se aplique,
// avisamos al trader qué perderá. Lo llama Vercel Cron (una vez al día).
// Protegido con CRON_SECRET igual que los demás cron.
// ============================================================
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const now = Date.now();
  const in3d = new Date(now + 3 * 864e5).toISOString();

  // Cambios que aplican dentro de los próximos 3 días y aún no se avisaron.
  const { data: rows } = await supabaseAdmin.from('profiles')
    .select('id,pending_plan,pending_plan_at')
    .not('pending_plan', 'is', null)
    .lte('pending_plan_at', in3d)
    .or('pending_notified_3d.is.null,pending_notified_3d.eq.false');

  let sent = 0;
  for (const p of (rows || []) as any[]) {
    if (!p.pending_plan_at || new Date(p.pending_plan_at).getTime() < now) continue;   // ya pasó → lo maneja el corte
    const { data: pl } = await supabaseAdmin.from('plans').select('name,name_en,capabilities,max_accounts').eq('id', p.pending_plan).maybeSingle();
    const caps: any = (pl as any)?.capabilities || {};
    const nm = { es: (pl as any)?.name || p.pending_plan, en: (pl as any)?.name_en || (pl as any)?.name || p.pending_plan };
    const fecha = new Date(p.pending_plan_at);

    // ¿Qué pierde? (copy y/o cuentas por encima del nuevo límite)
    const lose: { es: string; en: string }[] = [];
    if (!caps.copy) lose.push({ es: 'copy trading', en: 'copy trading' });
    const base = Number((pl as any)?.max_accounts ?? 1);
    if (base < 999) {
      const { count } = await supabaseAdmin.from('trading_accounts').select('id', { count: 'exact', head: true }).eq('user_id', p.id);
      if ((count || 0) > base) lose.push({ es: `${(count || 0) - base} cuenta(s) MT (se pausarán)`, en: `${(count || 0) - base} MT account(s) (will be paused)` });
    }
    const loseEs = lose.length ? ` Perderás: ${lose.map((l) => l.es).join(', ')}.` : '';
    const loseEn = lose.length ? ` You will lose: ${lose.map((l) => l.en).join(', ')}.` : '';

    await notifyPlanChange(p.id,
      { es: `En 3 días tu plan cambia a ${nm.es}`, en: `In 3 days your plan changes to ${nm.en}` },
      { es: `El ${fecha.toLocaleDateString('es-ES')} tu plan bajará a ${nm.es}.${loseEs} Si quieres conservarlo, puedes cancelar el cambio en Mi cuenta → Suscripción.`,
        en: `On ${fecha.toLocaleDateString('en-US')} your plan will change to ${nm.en}.${loseEn} To keep it, cancel the change in My account → Subscription.` });

    await supabaseAdmin.from('profiles').update({ pending_notified_3d: true }).eq('id', p.id);
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
