import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { payrollSettings, staffById, buildPayrun, paymentsForPeriod, thisPeriod, listStaff, periodForCycle, normCycle } from '@/lib/payroll';

// ============================================================
// Pagos de NÓMINA. Reutiliza el nodo Stripe Connect compartido (ventas /
// embajadores / mentores). El sueldo sale del saldo de la plataforma.
// Candados: Connect verificado, on_hold por empleado, freno global.
// ============================================================

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';

// Enlace de Stripe Connect para que el empleado conecte su cobro.
export async function staffOnboardingLink(staffId: string, userId: string, email?: string): Promise<string> {
  const { sharedStripeAccountId } = await import('@/lib/payoutProfile');
  const acct = await sharedStripeAccountId(userId, email);
  await supabaseAdmin.from('staff').update({ stripe_account_id: acct }).eq('id', staffId);
  const link = await stripe.accountLinks.create({
    account: acct,
    refresh_url: `${appUrl()}/staff?connect=refresh`,
    return_url: `${appUrl()}/staff?connect=done`,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function staffConnectStatus(staffId: string): Promise<{ connected: boolean; payoutsEnabled: boolean }> {
  const { data: s } = await supabaseAdmin.from('staff').select('stripe_account_id,payouts_enabled').eq('id', staffId).maybeSingle();
  const acct = (s as any)?.stripe_account_id;
  if (!acct) return { connected: false, payoutsEnabled: false };
  try {
    const a = await stripe.accounts.retrieve(acct);
    const enabled = !!a.payouts_enabled;
    if (enabled !== (s as any).payouts_enabled) await supabaseAdmin.from('staff').update({ payouts_enabled: enabled }).eq('id', staffId);
    return { connected: true, payoutsEnabled: enabled };
  } catch { return { connected: true, payoutsEnabled: !!(s as any).payouts_enabled }; }
}

// Paga un pago concreto de nómina por Stripe Connect.
export async function payStaffStripe(paymentId: string): Promise<{ ok: boolean; amount?: number; ref?: string; error?: string }> {
  const { data: pay } = await supabaseAdmin.from('staff_payments').select('*').eq('id', paymentId).maybeSingle();
  if (!pay) return { ok: false, error: 'payment_not_found' };
  if ((pay as any).status === 'paid') return { ok: false, error: 'already_paid' };
  const staff = await staffById((pay as any).staff_id);
  if (!staff) return { ok: false, error: 'staff_not_found' };
  if (staff.on_hold) return { ok: false, error: 'on_hold' };
  if (!staff.stripe_account_id || !staff.payouts_enabled) return { ok: false, error: 'connect_not_ready' };
  const amount = Number((pay as any).amount) || 0;
  if (amount <= 0) return { ok: false, error: 'no_amount' };

  let transfer;
  try {
    transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), currency: (staff.currency || 'usd').toLowerCase(),
      destination: staff.stripe_account_id, metadata: { onyx_staff: staff.id, period: (pay as any).period },
    });
  } catch (e: any) { return { ok: false, error: e?.message || 'stripe_transfer_failed' }; }

  await supabaseAdmin.from('staff_payments').update({ status: 'paid', method: 'stripe', ref: transfer.id, paid_at: new Date().toISOString() }).eq('id', paymentId);
  return { ok: true, amount, ref: transfer.id };
}

// Cron: arma la nómina del periodo (si no está) y paga por Stripe a quienes se
// pueda, respetando los frenos. Solo actúa si auto_pay está activo y no hay
// freno global. Devuelve un resumen.
export async function autoPayPayrollDue(): Promise<{ built: number; paid: number; skipped: number }> {
  const s = await payrollSettings();
  if (!s.enabled || !s.auto_pay || s.review_before_pay) return { built: 0, paid: 0, skipped: 0 };
  // Cadencia-consciente: corre a diario. Arma el periodo ACTUAL de cada empleado
  // según su frecuencia (idempotente: solo crea cuando empieza un periodo nuevo).
  const { created } = await buildPayrun();
  const day = new Date().getDate();
  const monthlyPayDay = s.pay_day || 1;
  const staff = (await listStaff()).filter((x) => x.status === 'active' && Number(x.salary) > 0);
  let paid = 0, skipped = 0;
  for (const st of staff) {
    const cyc = normCycle(st.pay_cycle);
    // Mensual: solo se paga en el día de pago configurado. Sub-mensual (semanal/
    // bisemanal/quincenal): se paga en cuanto el periodo arranca (su día ancla).
    if (cyc === 'monthly' && day !== monthlyPayDay) continue;
    const period = periodForCycle(cyc, new Date());
    const { data: pay } = await supabaseAdmin.from('staff_payments')
      .select('id,status').eq('staff_id', st.id).eq('period', period).maybeSingle();
    if (!pay || (pay as any).status === 'paid' || (pay as any).status === 'skipped') continue;
    if (st.on_hold || st.payout_method !== 'stripe' || !st.payouts_enabled) { skipped++; continue; }
    const r = await payStaffStripe((pay as any).id);
    if (r.ok) paid++; else skipped++;
  }
  return { built: created, paid, skipped };
}
