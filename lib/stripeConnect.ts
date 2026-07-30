import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Stripe Connect para las academias. El mentor conecta una cuenta Express;
// los alumnos pagan con "destination charge" y Onyx retiene su comisión
// (application fee) automáticamente en la misma transacción.
// ============================================================

// Comisión de Onyx por venta del mentor (%). Ajustable por env.
export const FEE_PCT = Number(process.env.ONYX_ACADEMY_FEE_PCT || 10);

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';

// Crea (si hace falta) la cuenta Express del mentor y devuelve un enlace de
// onboarding para que complete sus datos con Stripe.
export async function onboardingLink(mentorUserId: string, email?: string) {
  const { data: m } = await supabaseAdmin.from('mentors').select('stripe_account_id').eq('user_id', mentorUserId).maybeSingle();
  let acct = (m as any)?.stripe_account_id as string | undefined;
  if (!acct) {
    const account = await stripe.accounts.create({ type: 'express', email, capabilities: { transfers: { requested: true }, card_payments: { requested: true } }, metadata: { onyx_mentor: mentorUserId } });
    acct = account.id;
    await supabaseAdmin.from('mentors').update({ stripe_account_id: acct }).eq('user_id', mentorUserId);
  }
  const link = await stripe.accountLinks.create({
    account: acct,
    refresh_url: `${appUrl()}/dashboard/academy?connect=refresh`,
    return_url: `${appUrl()}/dashboard/academy?connect=done`,
    type: 'account_onboarding',
  });
  return link.url;
}

// Estado de la cuenta del mentor (si ya puede cobrar).
export async function connectStatus(mentorUserId: string) {
  const { data: m } = await supabaseAdmin.from('mentors').select('stripe_account_id,charges_enabled').eq('user_id', mentorUserId).maybeSingle();
  const acct = (m as any)?.stripe_account_id;
  if (!acct) return { connected: false, chargesEnabled: false };
  try {
    const a = await stripe.accounts.retrieve(acct);
    const enabled = !!a.charges_enabled;
    if (enabled !== (m as any).charges_enabled) await supabaseAdmin.from('mentors').update({ charges_enabled: enabled }).eq('user_id', mentorUserId);
    return { connected: true, chargesEnabled: enabled };
  } catch { return { connected: true, chargesEnabled: !!(m as any).charges_enabled }; }
}

// Sesión de checkout para que un alumno compre un producto del mentor.
// feePctOverride: comisión de Onyx resuelta por mentor (editable en el panel).
export async function checkoutForProduct(product: any, mentorAccount: string, studentId: string, customerEmail?: string, feePctOverride?: number) {
  const pct = feePctOverride != null && Number.isFinite(feePctOverride) ? feePctOverride : FEE_PCT;
  const feePct = pct / 100;
  const base = {
    mode: (product.kind === 'one_time' ? 'payment' : 'subscription') as 'payment' | 'subscription',
    success_url: `${appUrl()}/dashboard/academy?m=${product.mentor_id}&bought=1`,
    cancel_url: `${appUrl()}/dashboard/academy?m=${product.mentor_id}`,
    customer_email: customerEmail,
    metadata: { onyx_mentor: product.mentor_id, onyx_student: studentId, onyx_product: product.id, onyx_kind: product.kind },
  } as any;

  if (product.kind === 'one_time') {
    return stripe.checkout.sessions.create({
      ...base,
      line_items: [{ price_data: { currency: product.currency || 'usd', unit_amount: product.price_cents, product_data: { name: product.name } }, quantity: 1 }],
      payment_intent_data: {
        application_fee_amount: Math.round(product.price_cents * feePct),
        // on_behalf_of hace que el mentor sea el comercio de registro: ABSORBE el
        // fee de Stripe y la comisión de Onyx (application_fee) queda limpia.
        on_behalf_of: mentorAccount,
        transfer_data: { destination: mentorAccount },
        metadata: base.metadata,
      },
    });
  }
  return stripe.checkout.sessions.create({
    ...base,
    line_items: [{ price_data: { currency: product.currency || 'usd', unit_amount: product.price_cents, recurring: { interval: product.interval === 'year' ? 'year' : 'month' }, product_data: { name: product.name } }, quantity: 1 }],
    subscription_data: {
      application_fee_percent: pct,
      on_behalf_of: mentorAccount,
      transfer_data: { destination: mentorAccount },
      metadata: base.metadata,
    },
  });
}

// Checkout de MEMBRESÍA de la comunidad (suscripción). El mentor absorbe el fee de
// Stripe (on_behalf_of) y Onyx retiene su comisión (application_fee_percent).
export async function checkoutForMembership(o: { mentorId: string; mentorAccount: string; priceCents: number; currency: string; interval: string; code: string; studentId: string; customerEmail?: string; feePct: number }) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: `${appUrl()}/dashboard/academy?m=${o.mentorId}&joined=1`,
    cancel_url: `${appUrl()}/academia/${o.code}`,
    customer_email: o.customerEmail,
    metadata: { onyx_mentor: o.mentorId, onyx_student: o.studentId, onyx_kind: 'membership' },
    line_items: [{ price_data: { currency: o.currency || 'usd', unit_amount: o.priceCents, recurring: { interval: o.interval === 'year' ? 'year' : 'month' }, product_data: { name: 'Membership' } }, quantity: 1 }],
    subscription_data: {
      application_fee_percent: o.feePct,
      on_behalf_of: o.mentorAccount,
      transfer_data: { destination: o.mentorAccount },
      metadata: { onyx_mentor: o.mentorId, onyx_student: o.studentId, onyx_kind: 'membership' },
    },
  });
}

// Enlace al panel de Stripe del mentor (Express dashboard) para ver sus cobros.
export async function expressLoginLink(mentorUserId: string) {
  const { data: m } = await supabaseAdmin.from('mentors').select('stripe_account_id').eq('user_id', mentorUserId).maybeSingle();
  const acct = (m as any)?.stripe_account_id;
  if (!acct) return null;
  try { const l = await stripe.accounts.createLoginLink(acct); return l.url; } catch { return null; }
}
