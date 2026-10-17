import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { debit, credit } from '@/lib/wallet';
import { pickLang } from '@/lib/i18n';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · pasa parte del SALDO del monedero a CRÉDITO de Stripe. Stripe lo aplica
// solo a la próxima factura (add-ons, plan…) y cobra a la tarjeta solo el resto.
// "Saldo primero, tarjeta el resto", nativo de Stripe. { amountCents | amount }
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const en = pickLang(b.lang) === 'en';
    const cents = Math.round(b.amountCents != null ? Number(b.amountCents) : (Number(b.amount) || 0) * 100);
    if (!(cents >= 100)) return NextResponse.json({ error: en ? 'Minimum $1.' : 'Mínimo $1.', code: 'amount' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    const cust = (prof as any)?.stripe_customer_id;
    if (!cust) return NextResponse.json({ error: en ? 'You have no active subscription yet, so there is no invoice to apply credit to.' : 'Aún no tienes una suscripción activa, así que no hay factura donde aplicar el crédito.', code: 'no_customer' }, { status: 400 });

    // 1) Descuenta del monedero (idempotente). Si no alcanza, avisa.
    const orderId = `wallet_credit_${user.id}_${Date.now()}`;
    const d = await debit({ userId: user.id, amountCents: cents, source: 'stripe_credit', extRef: orderId, note: en ? 'Applied to Stripe credit' : 'Aplicado a crédito de Stripe' });
    if (!d.ok) {
      if (d.reason === 'insufficient') return NextResponse.json({ error: en ? 'Not enough balance.' : 'Saldo insuficiente.', code: 'insufficient', balanceCents: d.balance || 0 }, { status: 400 });
      return NextResponse.json({ error: en ? 'Could not use balance.' : 'No se pudo usar el saldo.' }, { status: 400 });
    }
    // 2) Crea el crédito en Stripe (amount negativo = crédito a favor del cliente).
    try {
      await stripe.customers.createBalanceTransaction(cust, {
        amount: -Math.abs(cents), currency: 'usd',
        description: 'Onyx · crédito desde monedero',
      } as any, { idempotencyKey: orderId } as any);
    } catch (e) {
      // Si Stripe falla, devolvemos el saldo al monedero (no se pierde dinero).
      await credit({ userId: user.id, amountCents: cents, kind: 'refund', method: 'system', source: 'stripe_credit', extRef: 'refund_' + orderId, note: en ? 'Stripe credit failed · refunded' : 'Falló el crédito de Stripe · devuelto' });
      await logError('wallet_apply_credit_stripe', e);
      return NextResponse.json({ error: en ? 'Could not apply credit. Your balance was kept.' : 'No se pudo aplicar el crédito. Tu saldo quedó intacto.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, applied: cents });
  } catch (e: any) {
    await logError('wallet_apply_credit', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
