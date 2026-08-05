import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Pagos a EMBAJADORES.
//   · Stripe Connect (Express, solo "transfers"): el embajador conecta su cuenta
//     y el pago sale AUTOMÁTICO con stripe.transfers.create desde el saldo de la
//     plataforma. Stripe se encarga del payout a su banco/tarjeta.
//   · Cripto (USDT/USDC) o manual: no automatizado; se marca pagado con una
//     referencia (hash/txid) para trazabilidad.
// El dinero de las comisiones vive en el saldo de la plataforma (las suscripciones
// de sus referidos se cobran a Onyx, no por destination charge), así que la
// transferencia a la cuenta conectada tiene fondos.
// ============================================================

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';

// Crea (si hace falta) la cuenta Express del embajador y devuelve un enlace de
// onboarding de Stripe para que complete sus datos de cobro.
export async function ambOnboardingLink(ambassadorId: string, userId: string, email?: string): Promise<string> {
  const { data: a } = await supabaseAdmin.from('ambassadors').select('stripe_account_id').eq('id', ambassadorId).maybeSingle();
  let acct = (a as any)?.stripe_account_id as string | undefined;
  if (!acct) {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } },   // solo recibe pagos
      metadata: { onyx_ambassador: ambassadorId, onyx_user: userId },
    });
    acct = account.id;
    await supabaseAdmin.from('ambassadors').update({ stripe_account_id: acct }).eq('id', ambassadorId);
  }
  const link = await stripe.accountLinks.create({
    account: acct,
    refresh_url: `${appUrl()}/account?tab=ambassador&connect=refresh`,
    return_url: `${appUrl()}/account?tab=ambassador&connect=done`,
    type: 'account_onboarding',
  });
  return link.url;
}

// Estado de la cuenta Connect del embajador (si ya puede recibir pagos).
export async function ambConnectStatus(ambassadorId: string): Promise<{ connected: boolean; payoutsEnabled: boolean }> {
  const { data: a } = await supabaseAdmin.from('ambassadors').select('stripe_account_id,payouts_enabled').eq('id', ambassadorId).maybeSingle();
  const acct = (a as any)?.stripe_account_id;
  if (!acct) return { connected: false, payoutsEnabled: false };
  try {
    const acc = await stripe.accounts.retrieve(acct);
    const enabled = !!acc.payouts_enabled;
    if (enabled !== (a as any).payouts_enabled) await supabaseAdmin.from('ambassadors').update({ payouts_enabled: enabled }).eq('id', ambassadorId);
    return { connected: true, payoutsEnabled: enabled };
  } catch { return { connected: true, payoutsEnabled: !!(a as any).payouts_enabled }; }
}

// Enlace al panel Express del embajador (ver sus cobros/datos bancarios).
export async function ambExpressLoginLink(ambassadorId: string): Promise<string | null> {
  const { data: a } = await supabaseAdmin.from('ambassadors').select('stripe_account_id').eq('id', ambassadorId).maybeSingle();
  const acct = (a as any)?.stripe_account_id;
  if (!acct) return null;
  try { const l = await stripe.accounts.createLoginLink(acct); return l.url; } catch { return null; }
}

type PayResult =
  | { ok: true; auto: boolean; transfer_id?: string }
  | { ok: false; error: string };

// Ejecuta un payout. Para Stripe hace la transferencia REAL. Para cripto/manual
// devuelve 'manual_method' para que el admin lo marque con una referencia.
export async function runPayout(payoutId: string): Promise<PayResult> {
  const { data: pay } = await supabaseAdmin.from('ambassador_payouts').select('*').eq('id', payoutId).maybeSingle();
  if (!pay) return { ok: false, error: 'payout_not_found' };
  if (pay.status === 'paid') return { ok: false, error: 'already_paid' };

  const { data: amb } = await supabaseAdmin.from('ambassadors')
    .select('id,user_id,payout_method,stripe_account_id,payouts_enabled').eq('id', pay.ambassador_id).maybeSingle();
  if (!amb) return { ok: false, error: 'ambassador_not_found' };

  // "Crédito en mi plan": aplica el monto como saldo a favor en la propia
  // suscripción del embajador (Stripe customer balance). Negativo = crédito.
  if ((amb as any).payout_method === 'credit') {
    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', (amb as any).user_id).maybeSingle();
    const cust = (prof as any)?.stripe_customer_id;
    if (!cust) return { ok: false, error: 'no_stripe_customer' };
    const cents = Math.round(Number(pay.amount) * 100);
    if (cents <= 0) return { ok: false, error: 'zero_amount' };
    try {
      const bt = await stripe.customers.createBalanceTransaction(cust, {
        amount: -cents,   // negativo = crédito a favor del cliente
        currency: String(pay.currency || 'usd').toLowerCase(),
        description: `Onyx · comisión de embajador aplicada como crédito (payout ${payoutId})`,
      });
      await supabaseAdmin.from('ambassador_payouts')
        .update({ status: 'paid', paid_at: new Date().toISOString(), method: 'credit', tx_ref: bt.id }).eq('id', payoutId);
      await supabaseAdmin.from('commissions').update({ status: 'paid' }).eq('payout_id', payoutId);
      return { ok: true, auto: true, transfer_id: bt.id };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'stripe_credit_failed' };
    }
  }

  if ((amb as any).payout_method === 'stripe') {
    if (!(amb as any).stripe_account_id || !(amb as any).payouts_enabled) return { ok: false, error: 'connect_not_ready' };
    const cents = Math.round(Number(pay.amount) * 100);
    if (cents <= 0) return { ok: false, error: 'zero_amount' };
    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: cents,
        currency: String(pay.currency || 'usd').toLowerCase(),
        destination: (amb as any).stripe_account_id,
        metadata: { onyx_payout: payoutId, onyx_ambassador: (amb as any).id },
      });
    } catch (e: any) {
      return { ok: false, error: e?.message || 'stripe_transfer_failed' };
    }
    await supabaseAdmin.from('ambassador_payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString(), method: 'stripe', transfer_id: transfer.id }).eq('id', payoutId);
    await supabaseAdmin.from('commissions').update({ status: 'paid' }).eq('payout_id', payoutId);
    return { ok: true, auto: true, transfer_id: transfer.id };
  }

  // usdt / manual → lo marca el admin con referencia (markPaidManual)
  return { ok: false, error: 'manual_method' };
}

// Marca un payout como pagado a mano (cripto/otro), guardando la referencia.
export async function markPaidManual(payoutId: string, method: string, txRef?: string): Promise<PayResult> {
  const { data: pay } = await supabaseAdmin.from('ambassador_payouts').select('id,status').eq('id', payoutId).maybeSingle();
  if (!pay) return { ok: false, error: 'payout_not_found' };
  if (pay.status === 'paid') return { ok: false, error: 'already_paid' };
  await supabaseAdmin.from('ambassador_payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), method: method || 'manual', tx_ref: (txRef || '').slice(0, 120) || null }).eq('id', payoutId);
  await supabaseAdmin.from('commissions').update({ status: 'paid' }).eq('payout_id', payoutId);
  return { ok: true, auto: false };
}
