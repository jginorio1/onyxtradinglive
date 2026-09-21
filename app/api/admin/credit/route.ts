import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Crédito manual a la cuenta de un usuario (saldo a favor en su suscripción).
// En Stripe el balance del cliente es NEGATIVO cuando tiene crédito, así que
// para DAR crédito enviamos un monto negativo. Se descuenta de su próxima factura.

async function creditOf(cust: string): Promise<number> {
  try {
    const c: any = await stripe.customers.retrieve(cust);
    if (c && !c.deleted && typeof c.balance === 'number' && c.balance < 0) return Math.round((-c.balance) / 100 * 100) / 100;
  } catch { /* sin cliente */ }
  return 0;
}

export async function GET(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id,email').eq('id', id).maybeSingle();
  const cust = (prof as any)?.stripe_customer_id;
  return NextResponse.json({ hasCustomer: !!cust, balance: cust ? await creditOf(cust) : 0, email: (prof as any)?.email || '' });
}

export async function POST(req: Request) {
  try {
    const { isAdmin, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const id = String(b.id || '');
    const amount = Number(b.amount);
    if (!id || !Number.isFinite(amount) || amount === 0) return NextResponse.json({ error: 'Monto inválido.', code: 'bad_amount' }, { status: 400 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id,email').eq('id', id).maybeSingle();
    const cust = (prof as any)?.stripe_customer_id;
    // Sin cliente de Stripe no hay dónde aplicar el crédito (nunca inició un pago).
    if (!cust) return NextResponse.json({ error: 'Este usuario aún no tiene cliente en Stripe (no ha iniciado ningún pago).', code: 'no_stripe_customer' }, { status: 400 });

    const cents = Math.round(amount * 100);   // amount>0 = dar crédito; amount<0 = quitar
    const bt = await stripe.customers.createBalanceTransaction(cust, {
      amount: -cents,
      currency: 'usd',
      description: `Onyx · crédito manual${b.note ? ' — ' + String(b.note).slice(0, 120) : ''}`,
    });
    await logAdmin(user.email, 'user_credit', id, { amount, note: b.note || null, bt: bt.id });
    return NextResponse.json({ ok: true, balance: await creditOf(cust) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
