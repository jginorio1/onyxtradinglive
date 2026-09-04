import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe, priceIdForPlan } from '@/lib/stripe';
import { addonSettings } from '@/lib/settings';
import { notifyPlanChange } from '@/lib/planNotify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Cambiar el plan de la suscripción ACTUAL (sin crear otra).
//
//  POST  { plan, annual }
//    · Subir  → inmediato (cobra diferencia prorrateada). Además, si el plan
//               nuevo ya incluye add-ons (p. ej. Black Onyx ilimitado), se
//               quitan esos ítems de add-on para no cobrar doble.
//    · Bajar  → NO cambia nada ahora. Se programa con un Subscription Schedule
//               para el final del periodo. El trader conserva su plan actual
//               (y sus funciones) hasta esa fecha. Se guarda en profiles el
//               cambio pendiente y se avisa por correo/Telegram.
//
//  DELETE (o POST {action:'cancel'})  → cancela el downgrade programado
//               (libera el schedule) y vuelve a la normalidad.
// ============================================================

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// Quita del ítem de suscripción los add-ons que el plan nuevo ya incluye.
function addonPriceIds(a: any): string[] {
  return [a.extra_account_price_id, a.extra_slave_price_id, a.extra_master_price_id].filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const user = await me();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    if (body.action === 'cancel') return cancelScheduled(user.id);

    const { plan, annual } = body;
    if (!plan) return NextResponse.json({ error: 'missing plan', code: 'invalid' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles')
      .select('stripe_subscription_id,plan,email,pending_plan,pending_schedule_id').eq('id', user.id).maybeSingle();
    if (!prof?.stripe_subscription_id) return NextResponse.json({ error: 'No active subscription.', code: 'no_sub' }, { status: 400 });
    if (prof.plan === plan) return NextResponse.json({ error: 'Ya estás en ese plan.', code: 'same' }, { status: 400 });

    const newPrice = await priceIdForPlan(plan, !!annual);
    if (!newPrice) return NextResponse.json({ error: `El plan "${plan}" no tiene Price ID configurado.`, code: 'no_price' }, { status: 400 });

    // ¿sube o baja? (por precio del plan en la tabla)
    const { data: plans } = await supabaseAdmin.from('plans').select('id,price_month,name,name_en,max_accounts,capabilities').order('price_month', { ascending: true });
    const rank = (id: string) => (plans || []).findIndex((p: any) => p.id === id);
    const isUpgrade = rank(plan) > rank(prof.plan);
    const newPlanRow: any = (plans || []).find((p: any) => p.id === plan);
    const planLabel = { es: newPlanRow?.name || plan, en: newPlanRow?.name_en || newPlanRow?.name || plan };

    const sub: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
    const annualNow = sub.items.data[0]?.price?.recurring?.interval === 'year';
    const currentPrice = await priceIdForPlan(prof.plan, annualNow);
    const planItem = sub.items.data.find((i: any) => i.price?.id === currentPrice) || sub.items.data[0];

    // Si había un downgrade programado y ahora se cambia de idea, lo liberamos.
    if (prof.pending_schedule_id) { try { await stripe.subscriptionSchedules.release(prof.pending_schedule_id); } catch { /* ya liberado */ } }

    if (isUpgrade) {
      // ---- SUBIR: inmediato ----
      await stripe.subscriptions.update(prof.stripe_subscription_id, {
        items: [{ id: planItem.id, price: newPrice }],
        proration_behavior: 'always_invoice',
      } as any);

      // Quitar add-ons que el plan nuevo ya incluye (evita cobro doble).
      const addons = await addonSettings();
      const included: string[] = [];
      const caps: any = newPlanRow?.capabilities || {};
      if (Number(newPlanRow?.max_accounts) >= 999) included.push(addons.extra_account_price_id);
      if (caps.copy && Number(caps.copy_slaves) === 0) included.push(addons.extra_slave_price_id);
      if (caps.copy && Number(caps.copy_masters) === 0) included.push(addons.extra_master_price_id);
      const kill = new Set(included.filter(Boolean));
      const del = sub.items.data.filter((i: any) => kill.has(i.price?.id));
      if (del.length) {
        try {
          await stripe.subscriptions.update(prof.stripe_subscription_id, {
            items: del.map((i: any) => ({ id: i.id, deleted: true })),
            proration_behavior: 'always_invoice',
          } as any);
          await supabaseAdmin.from('profiles').update({ extra_accounts: 0, extra_masters: 0 }).eq('id', user.id);
        } catch { /* si falla, el plan igual subió */ }
      }

      await supabaseAdmin.from('profiles').update({
        plan, pending_plan: null, pending_plan_at: null, pending_schedule_id: null, pending_notified_3d: false, pending_keep: null,
      }).eq('id', user.id);

      await notifyPlanChange(user.id,
        { es: `Bienvenido a ${planLabel.es}`, en: `Welcome to ${planLabel.en}` },
        { es: `Tu plan ${planLabel.es} ya está activo. ¡Gracias por confiar en Onyx Trading Live!`, en: `Your ${planLabel.en} plan is now active. Thanks for choosing Onyx Trading Live!` });

      return NextResponse.json({ ok: true, upgrade: true });
    }

    // ---- BAJAR: programar al final del periodo (Subscription Schedule) ----
    const periodEnd: number = sub.current_period_end;
    let schedule: any = await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
    const ph0: any = schedule.phases[0];
    // Fase 1: exactamente lo de ahora, hasta el corte. Fase 2: mismo carrito
    // pero con el precio del plan cambiado al nuevo (más barato). Los add-ons
    // se conservan en ambas fases.
    const phase1Items = ph0.items.map((i: any) => ({ price: i.price, quantity: i.quantity || 1 }));
    const phase2Items = ph0.items.map((i: any) => ({ price: i.price === currentPrice ? newPrice : i.price, quantity: i.quantity || 1 }));

    schedule = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        { items: phase1Items, start_date: ph0.start_date, end_date: periodEnd },
        { items: phase2Items },
      ],
    } as any);

    await supabaseAdmin.from('profiles').update({
      pending_plan: plan,
      pending_plan_at: new Date(periodEnd * 1000).toISOString(),
      pending_schedule_id: schedule.id,
      pending_notified_3d: false,
      pending_keep: null,
    }).eq('id', user.id);

    const fecha = new Date(periodEnd * 1000);
    const fEs = fecha.toLocaleDateString('es-ES');
    const fEn = fecha.toLocaleDateString('en-US');
    await notifyPlanChange(user.id,
      { es: `Tu plan bajará a ${planLabel.es}`, en: `Your plan will change to ${planLabel.en}` },
      { es: `El cambio a ${planLabel.es} se aplicará el ${fEs}. Hasta entonces conservas tu plan actual y todas sus funciones. Puedes cancelar este cambio cuando quieras desde Mi cuenta → Suscripción.`,
        en: `The change to ${planLabel.en} will apply on ${fEn}. Until then you keep your current plan and all its features. You can cancel this change anytime from My account → Subscription.` });

    return NextResponse.json({ ok: true, upgrade: false, scheduledAt: new Date(periodEnd * 1000).toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  return cancelScheduled(user.id);
}

async function cancelScheduled(userId: string) {
  const { data: prof } = await supabaseAdmin.from('profiles').select('pending_schedule_id').eq('id', userId).maybeSingle();
  if ((prof as any)?.pending_schedule_id) {
    try { await stripe.subscriptionSchedules.release((prof as any).pending_schedule_id); } catch { /* ya liberado */ }
  }
  await supabaseAdmin.from('profiles').update({
    pending_plan: null, pending_plan_at: null, pending_schedule_id: null, pending_notified_3d: false, pending_keep: null,
  }).eq('id', userId);
  return NextResponse.json({ ok: true, canceled: true });
}
