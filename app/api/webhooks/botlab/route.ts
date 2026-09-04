import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getProduct, grantLicense, setPurchaseStatus, reverseBotCommissionByRef } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Webhook de Stripe para el marketplace (OPCIONAL). Usa su propio secreto
// BOTLAB_WEBHOOK_SECRET (no toca el del checkout normal). Si no se configura,
// la compra igual se otorga al volver el usuario (confirmSession). Este webhook
// añade robustez: renovaciones, cancelaciones y reembolsos.
// ============================================================
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const secret = process.env.BOTLAB_WEBHOOK_SECRET;
  let event: any;
  try { event = secret ? stripe.webhooks.constructEvent(raw, sig, secret) : JSON.parse(raw); }
  catch { return NextResponse.json({ error: 'firma inválida' }, { status: 400 }); }

  try {
    const o: any = event.data?.object || {};
    const meta = o.metadata || {};
    if (event.type === 'checkout.session.completed' && meta.onyx_kind === 'botlab') {
      const prod = await getProduct(meta.onyx_product);
      if (prod && meta.onyx_buyer) {
        await grantLicense({
          productId: prod.id, buyerId: meta.onyx_buyer, sellerId: prod.seller_id, kind: prod.kind, method: 'card',
          grossCents: prod.price_cents, currency: prod.currency,
          ref: (o.payment_intent as string) || o.id, sessionId: o.id, subId: (o.subscription as string) || undefined,
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      await setPurchaseStatus(o.id, 'canceled');
    } else if (event.type === 'invoice.payment_failed') {
      if (o.subscription) await setPurchaseStatus(o.subscription, 'past_due');
    } else if (event.type === 'charge.refunded') {
      await reverseBotCommissionByRef(o.payment_intent);
    }
  } catch { /* no reventar el webhook: Stripe reintenta si devolvemos error */ }
  return NextResponse.json({ received: true });
}
