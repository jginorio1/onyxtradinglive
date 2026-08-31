import { NextResponse } from 'next/server';
import { stripe, planFromPriceId } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings, rateFor } from '@/lib/ambassadors';
import { enforcePlanLimits, notifyPlanChange, planRank } from '@/lib/planNotify';
import { qualifyOnPaid, reverseMemberRewards } from '@/lib/memberReferral';
import { setGuardianTier, revokeGuardianBySub, type GuardianTier } from '@/lib/guardianAccess';

// ¿Es una suscripción de Onyx Guardian comprada dentro de la academia?
// Esas NO cambian el plan de Onyx: solo activan/revocan el gestor de riesgo.
function guardianMeta(md: any): { userId?: string; tier: GuardianTier } | null {
  if (md?.kind !== 'guardian_academy') return null;
  return { userId: md.userId, tier: (md.tier === 'elite' ? 'elite' : 'pro') as GuardianTier };
}

export const runtime = 'nodejs';

async function setByCustomer(customerId: string, fields: any) {
  await supabaseAdmin.from('profiles').update(fields).eq('stripe_customer_id', customerId);
}

// Cuando el plan efectivo cambia, decidimos si es el corte de un downgrade
// programado (o cualquier bajada) para pausar lo que sobra y avisar al trader.
async function applyPlanTransition(customerId: string, newPlan: string) {
  const { data: prof } = await supabaseAdmin.from('profiles')
    .select('id,plan,pending_plan').eq('stripe_customer_id', customerId).maybeSingle() as any;
  // Pagó con tarjeta: la suscripción real manda. Limpiamos cualquier prueba de
  // cortesía para que no la revierta el cron ni le salga el popup de "expiró".
  const compClear = { comp_plan: null, comp_until: null, comp_warned: false, comp_expired_seen: true };
  if (!prof) { await setByCustomer(customerId, { plan: newPlan, ...compClear }); return; }

  const oldPlan = prof.plan;
  const rank = await planRank();
  const isDown = (rank[newPlan] ?? 0) < (rank[oldPlan] ?? 0);

  // Guardar el plan nuevo y, si era un downgrade programado que ya llegó, limpiar.
  const fields: any = { plan: newPlan, ...compClear };
  if (prof.pending_plan === newPlan) {
    Object.assign(fields, { pending_plan: null, pending_plan_at: null, pending_schedule_id: null, pending_notified_3d: false, pending_keep: null });
  }
  await supabaseAdmin.from('profiles').update(fields).eq('id', prof.id);

  if (isDown && oldPlan !== newPlan) {
    await enforcePlanLimits(prof.id, newPlan);
    const { data: pl } = await supabaseAdmin.from('plans').select('name,name_en').eq('id', newPlan).maybeSingle();
    const nm = { es: (pl as any)?.name || newPlan, en: (pl as any)?.name_en || (pl as any)?.name || newPlan };
    await notifyPlanChange(prof.id,
      { es: `Tu plan cambió a ${nm.es}`, en: `Your plan changed to ${nm.en}` },
      { es: `Tu plan ahora es ${nm.es}. Si alguna función quedó pausada por el nuevo límite, vuelve a estar disponible en cuanto subas de plan.`,
        en: `Your plan is now ${nm.en}. If any feature was paused by the new limit, it becomes available again as soon as you upgrade.` });
  }
}

// Acredita la comisión del embajador cuando el cliente paga una factura.
// Es idempotente: si Stripe reintenta, el invoice_id único evita duplicados.
async function creditCommission(invoice: any) {
  const settings = await ambSettings();
  if (!settings.enabled) return;

  const paid = Number(invoice.amount_paid || 0) / 100;
  if (paid <= 0) return;

  const { data: prof } = await supabaseAdmin
    .from('profiles').select('id,referred_by').eq('stripe_customer_id', invoice.customer).maybeSingle();
  if (!prof) return;

  let ambassadorId = prof.referred_by;

  // Si no vino por enlace pero usó el cupón de un embajador, lo atribuimos igual.
  if (!ambassadorId) {
    const promo = invoice.discount?.promotion_code || invoice.discounts?.[0]?.promotion_code;
    if (promo) {
      try {
        const pc: any = typeof promo === 'string' ? await stripe.promotionCodes.retrieve(promo) : promo;
        const { data: amb } = await supabaseAdmin.from('ambassadors').select('id,user_id,status').eq('code', String(pc.code || '').toLowerCase()).maybeSingle();
        if (amb && amb.status === 'approved' && amb.user_id !== prof.id) {
          ambassadorId = amb.id;
          await supabaseAdmin.from('referrals').insert({ ambassador_id: amb.id, user_id: prof.id, source: 'coupon' });
          await supabaseAdmin.from('profiles').update({ referred_by: amb.id }).eq('id', prof.id);
        }
      } catch { /* sin cupón válido */ }
    }
  }
  if (!ambassadorId) return;

  const { data: amb } = await supabaseAdmin.from('ambassadors').select('id,rate,status').eq('id', ambassadorId).maybeSingle();
  if (!amb || amb.status !== 'approved') return;

  const { rate } = await rateFor(amb, settings);
  if (!rate) return;

  // Tope de meses de comisión por suscriptor (0 = ilimitado). Cada factura pagada
  // genera una fila; si este suscriptor ya alcanzó el tope, dejamos de pagar.
  const capMonths = Number(settings.commission_months) || 0;
  if (capMonths > 0) {
    const { count: prior } = await supabaseAdmin.from('commissions')
      .select('*', { count: 'exact', head: true })
      .eq('ambassador_id', amb.id).eq('user_id', prof.id).neq('status', 'reversed');
    if ((prior || 0) >= capMonths) return;
  }

  const amount = Math.round(paid * (rate / 100) * 100) / 100;
  const availableAt = new Date(Date.now() + (settings.hold_days || 30) * 864e5).toISOString();

  await supabaseAdmin.from('commissions').insert({
    ambassador_id: amb.id,
    user_id: prof.id,
    invoice_id: invoice.id,
    base_amount: paid,
    rate,
    amount,
    currency: (invoice.currency || 'usd').toUpperCase(),
    status: 'pending',
    available_at: availableAt,
  });

  await supabaseAdmin.from('referrals').update({ first_paid_at: new Date().toISOString() })
    .eq('user_id', prof.id).is('first_paid_at', null);
}

// Si se devuelve el dinero, la comisión se anula (solo si aún no se pagó)
async function reverseCommission(invoiceId: string) {
  if (!invoiceId) return;
  await supabaseAdmin.from('commissions').update({ status: 'reversed' })
    .eq('invoice_id', invoiceId).in('status', ['pending', 'available']);
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (e: any) {
    return NextResponse.json({ error: `webhook: ${e.message}` }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s: any = event.data.object;
      const g = guardianMeta(s.metadata);
      if (g && g.userId && s.subscription) {
        // Guardian de academia: activa el nivel, guarda la suscripción, NO toca el plan.
        await setGuardianTier(g.userId, g.tier, s.subscription);
      } else if (s.subscription && s.customer) {
        const sub: any = await stripe.subscriptions.retrieve(s.subscription);
        const priceId = sub.items.data[0]?.price?.id;
        await setByCustomer(s.customer, {
          plan: await planFromPriceId(priceId),
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
          comp_plan: null, comp_until: null, comp_warned: false, comp_expired_seen: true,   // fin de la prueba: pagó
        });
      }
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      await creditCommission(event.data.object as any);       // comisión de embajador (efectivo)
      await qualifyOnPaid(event.data.object as any);           // "Invita y gana" del miembro (crédito)
    } else if (event.type === 'charge.refunded') {
      const ch: any = event.data.object;
      await reverseCommission(ch.invoice);
      await reverseMemberRewards(ch.invoice);
    } else if (event.type === 'invoice.payment_failed') {
      // El cobro falló (tarjeta vencida, sin fondos…). Avisamos "plan en riesgo"
      // pero NO quitamos funciones: Stripe reintenta (dunning) antes de cancelar.
      const inv: any = event.data.object;
      const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('stripe_customer_id', inv.customer).maybeSingle() as any;
      if (prof?.id) {
        await notifyPlanChange(prof.id,
          { es: 'Tu plan está en riesgo: no pudimos cobrar', en: 'Your plan is at risk: payment failed' },
          { es: 'No pudimos procesar tu pago. Actualiza tu tarjeta en Mi cuenta → Suscripción para no perder tu plan. Volveremos a intentarlo automáticamente.',
            en: 'We could not process your payment. Update your card in My account → Subscription to keep your plan. We will retry automatically.' });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub: any = event.data.object;
      const g = guardianMeta(sub.metadata);
      if (g) {
        // Suscripción de Guardian de academia: activa si vigente, revoca si no.
        const alive = sub.status === 'active' || sub.status === 'trialing';
        if (alive && g.userId) await setGuardianTier(g.userId, g.tier, sub.id);
        else await revokeGuardianBySub(sub.id);
        return NextResponse.json({ received: true });   // no tocar el plan
      }
      const priceId = sub.items.data[0]?.price?.id;
      const active = sub.status === 'active' || sub.status === 'trialing';
      const newPlan = active ? await planFromPriceId(priceId) : 'free';
      await setByCustomer(sub.customer, { subscription_status: sub.status, stripe_subscription_id: sub.id });
      await applyPlanTransition(sub.customer, newPlan);
    }
  } catch (e: any) {
    console.error('webhook handler error', e);
  }

  return NextResponse.json({ received: true });
}
