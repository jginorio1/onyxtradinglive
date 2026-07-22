import { NextResponse } from 'next/server';
import { stripe, planFromPriceId } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings, rateFor } from '@/lib/ambassadors';

export const runtime = 'nodejs';

async function setByCustomer(customerId: string, fields: any) {
  await supabaseAdmin.from('profiles').update(fields).eq('stripe_customer_id', customerId);
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
      if (s.subscription && s.customer) {
        const sub: any = await stripe.subscriptions.retrieve(s.subscription);
        const priceId = sub.items.data[0]?.price?.id;
        await setByCustomer(s.customer, {
          plan: await planFromPriceId(priceId),
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
        });
      }
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      await creditCommission(event.data.object as any);
    } else if (event.type === 'charge.refunded') {
      const ch: any = event.data.object;
      await reverseCommission(ch.invoice);
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub: any = event.data.object;
      const priceId = sub.items.data[0]?.price?.id;
      const active = sub.status === 'active' || sub.status === 'trialing';
      await setByCustomer(sub.customer, {
        plan: active ? await planFromPriceId(priceId) : 'free',
        subscription_status: sub.status,
        stripe_subscription_id: sub.id,
      });
    }
  } catch (e: any) {
    console.error('webhook handler error', e);
  }

  return NextResponse.json({ received: true });
}
