import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Normaliza el importe de una suscripción a mensual (para el MRR).
function monthly(amount: number, interval: string, count = 1): number {
  const per = amount * count;
  if (interval === 'year') return per / 12;
  if (interval === 'week') return (per * 52) / 12;
  if (interval === 'day') return (per * 365) / 12;
  return per; // month
}

// GET · métricas de ingresos leídas en vivo de Stripe.
export async function GET() {
  const { ok } = await requirePerm('planes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ configured: false });
  }

  const now = Math.floor(Date.now() / 1000);
  const since30 = now - 30 * 86400;
  let currency = 'usd';

  try {
    // Suscripciones activas → MRR
    let mrrCents = 0, activeSubs = 0, newSubs30 = 0;
    for await (const s of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
      activeSubs++;
      if ((s.created || 0) >= since30) newSubs30++;
      for (const it of s.items.data) {
        const p: any = it.price;
        if (p?.unit_amount && p?.recurring?.interval) {
          mrrCents += monthly(p.unit_amount, p.recurring.interval, it.quantity || 1);
          currency = p.currency || currency;
        }
      }
    }

    // Canceladas en los últimos 30 días
    let canceled30 = 0;
    for await (const s of stripe.subscriptions.list({ status: 'canceled', limit: 100 })) {
      if ((s.canceled_at || 0) >= since30) canceled30++; else if ((s.canceled_at || 0) < since30) break;
    }

    // Cobros y fallos de los últimos 30 días
    let collected30 = 0, paidCount = 0, failed30 = 0;
    const recent: { at: number; amount: number; email: string; ok: boolean }[] = [];
    for await (const c of stripe.charges.list({ limit: 100, created: { gte: since30 } })) {
      if (c.paid && c.status === 'succeeded') { collected30 += c.amount; paidCount++; }
      if (c.status === 'failed') failed30++;
      if (recent.length < 8) recent.push({ at: c.created, amount: c.amount, email: c.billing_details?.email || c.receipt_email || '', ok: c.status === 'succeeded' });
      currency = c.currency || currency;
    }

    return NextResponse.json({
      configured: true, currency,
      mrr: Math.round(mrrCents) / 100,
      arr: Math.round(mrrCents * 12) / 100,
      activeSubs, newSubs30, canceled30,
      collected30: collected30 / 100, paidCount, failed30,
      recent: recent.map((r) => ({ ...r, amount: r.amount / 100 })),
    });
  } catch (e: any) {
    return NextResponse.json({ configured: true, error: e?.message || 'Error al leer Stripe' }, { status: 200 });
  }
}
