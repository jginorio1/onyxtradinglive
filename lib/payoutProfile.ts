import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// NODO DE COBRO ÚNICO · una sola conexión de Stripe y una sola wallet USDT que
// TODOS los programas reutilizan (Bot Lab, embajador, Onyx Copy, academia).
//
// La cuenta Stripe Express canónica vive en profiles.payout_stripe_account_id.
// Al conectar, se copia también al campo de cada programa (bot_stripe_account_id,
// copy_stripe_account_id, ambassadors.stripe_account_id…) para que su lógica de
// transferencias siga funcionando sin cambios — apuntando todos a la MISMA cuenta.
// ============================================================

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';

// Devuelve (creando si hace falta, UNA vez) la cuenta Stripe Express compartida.
// Si el usuario ya conectó por algún programa, reutiliza esa misma cuenta.
export async function sharedStripeAccountId(userId: string, email?: string): Promise<string> {
  const { data: p } = await supabaseAdmin.from('profiles')
    .select('payout_stripe_account_id,bot_stripe_account_id,copy_stripe_account_id').eq('id', userId).maybeSingle();
  let acct = (p as any)?.payout_stripe_account_id || (p as any)?.bot_stripe_account_id || (p as any)?.copy_stripe_account_id;
  if (!acct) {
    const account = await stripe.accounts.create({
      type: 'express', email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      metadata: { onyx_payout: userId },
    });
    acct = account.id;
  }
  // Canoniza y propaga a todos los programas (misma cuenta en todos lados).
  await propagateAccount(userId, acct);
  return acct;
}

// Copia la cuenta canónica a los campos de cada programa (idempotente).
export async function propagateAccount(userId: string, acct: string) {
  try { await supabaseAdmin.from('profiles').update({ payout_stripe_account_id: acct, bot_stripe_account_id: acct, copy_stripe_account_id: acct, bot_seller: true }).eq('id', userId); } catch {}
  try { await supabaseAdmin.from('ambassadors').update({ stripe_account_id: acct }).eq('user_id', userId).is('stripe_account_id', null); } catch {}
  try { await supabaseAdmin.from('mentors').update({ stripe_account_id: acct }).eq('user_id', userId).is('stripe_account_id', null); } catch {}
}

// Enlace de onboarding de Stripe para la cuenta compartida (página de nodo de cobro).
export async function payoutOnboardingLink(userId: string, email?: string, returnPath = '/dashboard/payout-settings'): Promise<string> {
  const acct = await sharedStripeAccountId(userId, email);
  const link = await stripe.accountLinks.create({
    account: acct,
    refresh_url: `${appUrl()}${returnPath}?connect=refresh`,
    return_url: `${appUrl()}${returnPath}?connect=done`,
    type: 'account_onboarding',
  });
  return link.url;
}

// Estado del nodo: ¿ya puede cobrar? Refresca payouts/charges en profiles y programas.
export async function payoutNodeStatus(userId: string): Promise<{ connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; acct: string | null }> {
  const { data: p } = await supabaseAdmin.from('profiles').select('payout_stripe_account_id').eq('id', userId).maybeSingle();
  const acct = (p as any)?.payout_stripe_account_id || null;
  if (!acct) return { connected: false, chargesEnabled: false, payoutsEnabled: false, acct: null };
  try {
    const a = await stripe.accounts.retrieve(acct);
    const chargesEnabled = !!a.charges_enabled;
    const payoutsEnabled = !!a.payouts_enabled;
    // Sincroniza banderas de cada programa para que sus retiros se habiliten solos.
    try { await supabaseAdmin.from('profiles').update({ payout_charges_enabled: chargesEnabled, bot_charges_enabled: chargesEnabled, copy_charges_enabled: chargesEnabled }).eq('id', userId); } catch {}
    try { await supabaseAdmin.from('ambassadors').update({ payouts_enabled: payoutsEnabled }).eq('user_id', userId); } catch {}
    return { connected: true, chargesEnabled, payoutsEnabled, acct };
  } catch { return { connected: true, chargesEnabled: false, payoutsEnabled: false, acct }; }
}

// Enlace al panel Express (ver cobros/datos bancarios) de la cuenta compartida.
export async function payoutExpressLoginLink(userId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from('profiles').select('payout_stripe_account_id').eq('id', userId).maybeSingle();
  const acct = (p as any)?.payout_stripe_account_id;
  if (!acct) return null;
  try { const l = await stripe.accounts.createLoginLink(acct); return l.url; } catch { return null; }
}

// Wallets USDT guardadas (nodo único). Se reutilizan en todos los retiros USDT.
export async function savedWallets(userId: string): Promise<{ trc20: string; erc20: string; network: string }> {
  const { data } = await supabaseAdmin.from('profiles').select('payout_usdt_trc20,payout_usdt_erc20,payout_usdt_network').eq('id', userId).maybeSingle();
  return {
    trc20: (data as any)?.payout_usdt_trc20 || '',
    erc20: (data as any)?.payout_usdt_erc20 || '',
    network: (data as any)?.payout_usdt_network || 'trc20',
  };
}
export async function saveWallets(userId: string, o: { trc20?: string; erc20?: string; network?: string }) {
  const patch: any = {};
  if (o.trc20 != null) patch.payout_usdt_trc20 = String(o.trc20).trim().slice(0, 80) || null;
  if (o.erc20 != null) patch.payout_usdt_erc20 = String(o.erc20).trim().slice(0, 80) || null;
  if (o.network) patch.payout_usdt_network = o.network === 'erc20' ? 'erc20' : 'trc20';
  if (Object.keys(patch).length) await supabaseAdmin.from('profiles').update(patch).eq('id', userId);
  return savedWallets(userId);
}
