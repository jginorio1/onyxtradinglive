import { NextResponse } from 'next/server';
import { stripe, planFromPriceId } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

async function setByCustomer(customerId: string, fields: any) {
  await supabaseAdmin.from('profiles').update(fields).eq('stripe_customer_id', customerId);
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
          plan: planFromPriceId(priceId),
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
        });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub: any = event.data.object;
      const priceId = sub.items.data[0]?.price?.id;
      const active = sub.status === 'active' || sub.status === 'trialing';
      await setByCustomer(sub.customer, {
        plan: active ? planFromPriceId(priceId) : 'free',
        subscription_status: sub.status,
        stripe_subscription_id: sub.id,
      });
    }
  } catch (e: any) {
    console.error('webhook handler error', e);
  }

  return NextResponse.json({ received: true });
}
