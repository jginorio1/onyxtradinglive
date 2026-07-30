import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { grantPurchase, setPurchaseStatus, feeForMentor } from '@/lib/academyPay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Webhook DEDICADO a la academia (Stripe Connect). Usa su PROPIO secreto
// ACADEMY_WEBHOOK_SECRET (no toca el STRIPE_WEBHOOK_SECRET del checkout normal).
// Suscribir en Stripe a: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, account.updated.
export async function POST(req: Request) {
  const secret = process.env.ACADEMY_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature') || '';
  const raw = await req.text();
  let event: any;
  try {
    event = secret ? stripe.webhooks.constructEvent(raw, sig, secret) : JSON.parse(raw);
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const md = s.metadata || {};
      if (md.onyx_mentor && md.onyx_student && md.onyx_product) {
        const feePct = await feeForMentor(md.onyx_mentor);
        await grantPurchase({
          mentorId: md.onyx_mentor, studentId: md.onyx_student, productId: md.onyx_product,
          kind: md.onyx_kind === 'one_time' ? 'one_time' : 'subscription',
          grossCents: Number(s.amount_total || 0), currency: s.currency || 'usd',
          subId: s.subscription || undefined, sessionId: s.id, feePct,
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      await setPurchaseStatus(event.data.object.id, 'canceled');
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : (sub.status === 'past_due' ? 'past_due' : 'canceled');
      await setPurchaseStatus(sub.id, status, sub.current_period_end);
    } else if (event.type === 'account.updated') {
      const acct = event.data.object;
      await supabaseAdmin.from('mentors').update({ charges_enabled: !!acct.charges_enabled }).eq('stripe_account_id', acct.id);
    }
  } catch (e: any) {
    return NextResponse.json({ received: true, warn: e?.message }, { status: 200 });
  }
  return NextResponse.json({ received: true });
}
