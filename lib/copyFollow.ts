import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Copy F2/F3 · el seguidor copia a un trader calificado y paga por ello.
//  · F3 (cobro): suscripción con Stripe Connect (destination charge). Onyx
//    retiene su comisión (application_fee) y el resto va al trader.
//  · F2 (ejecución): al activarse la suscripción se crea un copy_links que ata
//    la cuenta del proveedor (master) con la del seguidor (slave). El motor de
//    copia existente (copy_links → copy_commands → EA slave) hace el resto.
// ============================================================

// Comisión de Onyx por copia (%). Ajustable por env.
export const COPY_FEE_PCT = Number(process.env.ONYX_COPY_FEE_PCT || 30);
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Connect: onboarding del TRADER calificado para poder cobrar sus copias.
export async function copyOnboardingLink(userId: string, email?: string) {
  const { data: p } = await supabaseAdmin.from('profiles').select('copy_stripe_account_id').eq('id', userId).maybeSingle();
  let acct = (p as any)?.copy_stripe_account_id as string | undefined;
  if (!acct) {
    const account = await stripe.accounts.create({ type: 'express', email, capabilities: { transfers: { requested: true }, card_payments: { requested: true } }, metadata: { onyx_copy_provider: userId } });
    acct = account.id;
    await supabaseAdmin.from('profiles').update({ copy_stripe_account_id: acct }).eq('id', userId);
  }
  const link = await stripe.accountLinks.create({
    account: acct,
    refresh_url: `${appUrl()}/dashboard/onyx-copy?connect=refresh`,
    return_url: `${appUrl()}/dashboard/onyx-copy?connect=done`,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function copyConnectStatus(userId: string) {
  const { data: p } = await supabaseAdmin.from('profiles').select('copy_stripe_account_id,copy_charges_enabled').eq('id', userId).maybeSingle();
  const acct = (p as any)?.copy_stripe_account_id;
  if (!acct) return { connected: false, chargesEnabled: false };
  try {
    const a = await stripe.accounts.retrieve(acct);
    const enabled = !!a.charges_enabled;
    if (enabled !== (p as any).copy_charges_enabled) await supabaseAdmin.from('profiles').update({ copy_charges_enabled: enabled }).eq('id', userId);
    return { connected: true, chargesEnabled: enabled, acct };
  } catch { return { connected: true, chargesEnabled: !!(p as any).copy_charges_enabled, acct }; }
}

// Checkout de suscripción para copiar a un proveedor (destination charge).
export async function checkoutForFollow(o: { followId: string; providerId: string; followerId: string; providerAccount: string; priceCents: number; currency?: string; customerEmail?: string }) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: `${appUrl()}/dashboard/onyx-copy?followed=1`,
    cancel_url: `${appUrl()}/dashboard/onyx-copy?canceled=1`,
    customer_email: o.customerEmail,
    metadata: { onyx_kind: 'copyfollow', onyx_follow: o.followId, onyx_provider: o.providerId, onyx_follower: o.followerId },
    line_items: [{ price_data: { currency: o.currency || 'usd', unit_amount: o.priceCents, recurring: { interval: 'month' }, product_data: { name: 'Onyx Copy' } }, quantity: 1 }],
    subscription_data: {
      application_fee_percent: COPY_FEE_PCT,
      on_behalf_of: o.providerAccount,
      transfer_data: { destination: o.providerAccount },
      metadata: { onyx_kind: 'copyfollow', onyx_follow: o.followId, onyx_provider: o.providerId, onyx_follower: o.followerId },
    },
  });
}

// Mapea el modo de lote del marketplace al del motor de copia (copy_links.mode).
function linkFieldsFromFollow(f: any) {
  const mode = f.lot_mode === 'fixed' ? 'fixed' : f.lot_mode === 'risk' ? 'risk' : 'balance';
  const multiplier = (f.lot_mode === 'multiplier' || f.lot_mode === 'fixed') ? Math.max(0.01, Number(f.lot_value) || 1) : 1;
  const risk_pct = f.lot_mode === 'risk' ? Math.max(0.1, Number(f.lot_value) || 1) : 1;
  return { mode, multiplier, risk_pct };
}

// Crea (o reactiva) el copy_links que hace la copia real, con los controles del seguidor.
async function ensureLink(follow: any): Promise<string | null> {
  const { data: prov } = await supabaseAdmin.from('strategy_providers').select('account_id').eq('id', follow.provider_id).maybeSingle();
  const masterAccount = (prov as any)?.account_id;
  if (!masterAccount) return null;
  const lf = linkFieldsFromFollow(follow);
  const row: any = {
    owner_id: follow.follower_id,
    master_account_id: masterAccount,
    slave_account_id: follow.follower_account_id,
    mode: lf.mode, multiplier: lf.multiplier, risk_pct: lf.risk_pct,
    max_lot: Math.max(0.01, Number(follow.max_lot) || 5),
    reverse: !!follow.reverse,
    max_drawdown_pct: Number(follow.max_drawdown_pct) || 0,
    require_sl: !!follow.require_sl,
    enabled: true,
  };
  const { data: saved } = await supabaseAdmin.from('copy_links').upsert(row, { onConflict: 'master_account_id,slave_account_id' }).select('id').maybeSingle();
  return (saved as any)?.id || null;
}

// Desactiva la copia (sin borrar el enlace) para poder reactivar si vuelve a pagar.
async function disableLink(follow: any) {
  if (follow.link_id) { await supabaseAdmin.from('copy_links').update({ enabled: false }).eq('id', follow.link_id); return; }
  const { data: prov } = await supabaseAdmin.from('strategy_providers').select('account_id').eq('id', follow.provider_id).maybeSingle();
  if ((prov as any)?.account_id) {
    await supabaseAdmin.from('copy_links').update({ enabled: false })
      .eq('master_account_id', (prov as any).account_id).eq('slave_account_id', follow.follower_account_id);
  }
}

// Recuenta seguidores activos de un proveedor.
async function refreshFollowerCount(providerId: string) {
  const { count } = await supabaseAdmin.from('copy_follows').select('id', { count: 'exact', head: true }).eq('provider_id', providerId).eq('status', 'active');
  await supabaseAdmin.from('strategy_providers').update({ followers: count || 0 }).eq('id', providerId);
}

// Webhook: activar una suscripción de copia (checkout completado). Crea el enlace
// y guarda la marca de agua (F4): el % de comisión por rendimiento del proveedor,
// el cliente de Stripe (para cobrarla) y desde cuándo se mide la ganancia nueva.
export async function activateFollow(o: { followId: string; subId?: string; customerId?: string }) {
  const { data: f } = await supabaseAdmin.from('copy_follows').select('*').eq('id', o.followId).maybeSingle();
  if (!f) return;
  const linkId = await ensureLink(f);
  const { data: prov } = await supabaseAdmin.from('strategy_providers').select('perf_fee_pct').eq('id', (f as any).provider_id).maybeSingle();
  const patch: any = { status: 'active', link_id: linkId, stripe_sub_id: o.subId || (f as any).stripe_sub_id, perf_fee_pct: Number((prov as any)?.perf_fee_pct) || 0, updated_at: new Date().toISOString() };
  if (o.customerId) patch.stripe_customer_id = o.customerId;
  if (!(f as any).perf_started_at) patch.perf_started_at = new Date().toISOString();
  await supabaseAdmin.from('copy_follows').update(patch).eq('id', o.followId);
  await refreshFollowerCount((f as any).provider_id);
}

// Webhook: cambio de estado de la suscripción (activa / past_due / cancelada).
export async function syncFollowStatusBySub(subId: string, stripeStatus: string) {
  const { data: f } = await supabaseAdmin.from('copy_follows').select('*').eq('stripe_sub_id', subId).maybeSingle();
  if (!f) return;
  const status = (stripeStatus === 'active' || stripeStatus === 'trialing') ? 'active' : (stripeStatus === 'past_due' ? 'past_due' : 'canceled');
  if (status === 'active') await ensureLink(f); else await disableLink(f);
  await supabaseAdmin.from('copy_follows').update({ status, updated_at: new Date().toISOString() }).eq('id', (f as any).id);
  await refreshFollowerCount((f as any).provider_id);
}

// Webhook: suscripción borrada → parar la copia.
export async function cancelFollowBySub(subId: string) {
  const { data: f } = await supabaseAdmin.from('copy_follows').select('*').eq('stripe_sub_id', subId).maybeSingle();
  if (!f) return;
  await disableLink(f);
  await supabaseAdmin.from('copy_follows').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', (f as any).id);
  await refreshFollowerCount((f as any).provider_id);
}

// Webhook: registra la comisión de una factura pagada (idempotente por invoice_id).
export async function recordFollowCommission(o: { subId: string; grossCents: number; currency: string; invoiceId: string }) {
  const { data: f } = await supabaseAdmin.from('copy_follows').select('id,provider_id').eq('stripe_sub_id', o.subId).maybeSingle();
  if (!f) return;   // no es una suscripción de copia
  const fee = Math.round(o.grossCents * (COPY_FEE_PCT / 100));
  await supabaseAdmin.from('copy_follow_commissions').upsert({
    provider_id: (f as any).provider_id, follow_id: (f as any).id,
    gross_cents: o.grossCents, fee_cents: fee, net_cents: o.grossCents - fee,
    currency: o.currency, invoice_id: o.invoiceId,
  }, { onConflict: 'invoice_id' });
}

// Cancelación desde la app (el seguidor deja de copiar).
export async function cancelFollowById(followId: string, followerId: string) {
  const { data: f } = await supabaseAdmin.from('copy_follows').select('*').eq('id', followId).eq('follower_id', followerId).maybeSingle();
  if (!f) return { ok: false };
  if ((f as any).stripe_sub_id) { try { await stripe.subscriptions.cancel((f as any).stripe_sub_id); } catch {} }
  await disableLink(f);
  await supabaseAdmin.from('copy_follows').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', followId);
  await refreshFollowerCount((f as any).provider_id);
  return { ok: true };
}
