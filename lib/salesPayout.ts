import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { salesSettings, balances } from '@/lib/sales';

// ============================================================
// Pagos a la RED DE VENTAS. Reutiliza el nodo Stripe Connect compartido
// (mismo que embajadores/mentores). El dinero de las comisiones vive en el
// saldo de la plataforma (las suscripciones se cobran a Onyx), así que la
// transferencia a la cuenta conectada del vendedor tiene fondos.
// Candados: retención (available_at) + mínimo + Connect verificado + on_hold
// por rep + freno global review_before_pay.
// ============================================================

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';

// Enlace de onboarding de Stripe para que el vendedor conecte su cobro.
export async function salesOnboardingLink(repId: string, userId: string, email?: string): Promise<string> {
  const { sharedStripeAccountId } = await import('@/lib/payoutProfile');
  const acct = await sharedStripeAccountId(userId, email);
  await supabaseAdmin.from('sales_reps').update({ stripe_account_id: acct }).eq('id', repId);
  const link = await stripe.accountLinks.create({
    account: acct,
    refresh_url: `${appUrl()}/account?connect=refresh#retiros`,
    return_url: `${appUrl()}/account?connect=done#retiros`,
    type: 'account_onboarding',
  });
  return link.url;
}

// ¿La cuenta Connect del vendedor ya puede recibir pagos?
export async function salesConnectStatus(repId: string): Promise<{ connected: boolean; payoutsEnabled: boolean }> {
  const { data: r } = await supabaseAdmin.from('sales_reps').select('stripe_account_id,payouts_enabled').eq('id', repId).maybeSingle();
  const acct = (r as any)?.stripe_account_id;
  if (!acct) return { connected: false, payoutsEnabled: false };
  try {
    const a = await stripe.accounts.retrieve(acct);
    const enabled = !!a.payouts_enabled;
    if (enabled !== (r as any).payouts_enabled) await supabaseAdmin.from('sales_reps').update({ payouts_enabled: enabled }).eq('id', repId);
    return { connected: true, payoutsEnabled: enabled };
  } catch { return { connected: true, payoutsEnabled: !!(r as any).payouts_enabled }; }
}

// Paga a un vendedor su saldo disponible por Stripe Connect. Marca las comisiones
// maduradas como pagadas y crea el registro del pago.
export async function paySalesRep(repId: string): Promise<{ ok: boolean; amount?: number; transfer_id?: string; error?: string }> {
  const { data: rep } = await supabaseAdmin.from('sales_reps').select('id,status,stripe_account_id,payouts_enabled').eq('id', repId).maybeSingle();
  if (!rep) return { ok: false, error: 'rep_not_found' };
  const bal = await balances(repId);
  if (bal.available <= 0) return { ok: false, error: 'no_balance' };
  if (!(rep as any).stripe_account_id || !(rep as any).payouts_enabled) return { ok: false, error: 'connect_not_ready' };

  const cents = Math.round(bal.available * 100);
  let transfer;
  try {
    transfer = await stripe.transfers.create({
      amount: cents, currency: 'usd', destination: (rep as any).stripe_account_id,
      metadata: { onyx_sales_rep: repId },
    });
  } catch (e: any) { return { ok: false, error: e?.message || 'stripe_transfer_failed' }; }

  const now = new Date().toISOString();
  const { data: payout } = await supabaseAdmin.from('sales_payouts')
    .insert({ rep_id: repId, amount: bal.available, method: 'stripe', ref: transfer.id, status: 'paid', paid_at: now })
    .select('id').maybeSingle();
  // Marca como pagadas las comisiones maduras (disponibles) de este rep.
  await supabaseAdmin.from('sales_commissions')
    .update({ status: 'paid', paid_at: now, payout_id: (payout as any)?.id || null })
    .eq('rep_id', repId).in('status', ['pending', 'available']).lte('available_at', now).neq('status', 'reversed');
  return { ok: true, amount: bal.available, transfer_id: transfer.id };
}

// Marca un pago manual (cripto/transferencia fuera del sistema) con referencia.
export async function markSalesPaidManual(repId: string, method = 'manual', ref?: string): Promise<{ ok: boolean; amount?: number }> {
  const bal = await balances(repId);
  if (bal.available <= 0) return { ok: false };
  const now = new Date().toISOString();
  const { data: payout } = await supabaseAdmin.from('sales_payouts')
    .insert({ rep_id: repId, amount: bal.available, method, ref: ref || null, status: 'paid', paid_at: now })
    .select('id').maybeSingle();
  await supabaseAdmin.from('sales_commissions')
    .update({ status: 'paid', paid_at: now, payout_id: (payout as any)?.id || null })
    .eq('rep_id', repId).in('status', ['pending', 'available']).lte('available_at', now).neq('status', 'reversed');
  return { ok: true, amount: bal.available };
}

// Cron: paga automáticamente a todos los que ya maduraron y superan el mínimo,
// respetando los frenos. Devuelve un resumen.
export async function autoPaySalesDue(): Promise<{ checked: number; paid: number; skipped: number }> {
  const s = await salesSettings();
  if (!s.enabled || s.auto_payout === false || s.review_before_pay === true) return { checked: 0, paid: 0, skipped: 0 };
  const min = Number(s.min_payout) || 50;
  const { data: reps } = await supabaseAdmin.from('sales_reps').select('id,on_hold,status,payouts_enabled').eq('status', 'active');
  let paid = 0, skipped = 0; const list = reps || [];
  for (const r of list as any[]) {
    if (r.on_hold) { skipped++; continue; }
    if (!r.payouts_enabled) { skipped++; continue; }
    const bal = await balances(r.id);
    if (bal.available < min) { skipped++; continue; }
    const res = await paySalesRep(r.id);
    if (res.ok) paid++; else skipped++;
  }
  return { checked: list.length, paid, skipped };
}
