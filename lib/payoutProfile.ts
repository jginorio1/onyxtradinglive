import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidTron, isValidEvm, checkWallet } from '@/lib/walletChecksum';

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

// Busca una cuenta Stripe Express que el usuario YA haya conectado en cualquier
// programa (perfil, embajador o mentor). Así el nodo no crea un duplicado vacío
// cuando ya conectaste antes por Embajador/Academia. Solo lectura.
export async function findExistingAccount(userId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from('profiles')
    .select('payout_stripe_account_id,bot_stripe_account_id,copy_stripe_account_id').eq('id', userId).maybeSingle();
  let acct = (p as any)?.payout_stripe_account_id || (p as any)?.bot_stripe_account_id || (p as any)?.copy_stripe_account_id;
  if (!acct) { try { const { data: a } = await supabaseAdmin.from('ambassadors').select('stripe_account_id').eq('user_id', userId).not('stripe_account_id', 'is', null).maybeSingle(); acct = (a as any)?.stripe_account_id || acct; } catch {} }
  if (!acct) { try { const { data: m } = await supabaseAdmin.from('mentors').select('stripe_account_id').eq('user_id', userId).not('stripe_account_id', 'is', null).maybeSingle(); acct = (m as any)?.stripe_account_id || acct; } catch {} }
  return acct || null;
}

// Devuelve (creando si hace falta, UNA vez) la cuenta Stripe Express compartida.
// Si el usuario ya conectó por algún programa, reutiliza esa misma cuenta.
export async function sharedStripeAccountId(userId: string, email?: string): Promise<string> {
  let acct = await findExistingAccount(userId);
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
export async function payoutNodeStatus(userId: string): Promise<{ connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; acct: string | null; adopted?: boolean }> {
  const { data: p } = await supabaseAdmin.from('profiles').select('payout_stripe_account_id').eq('id', userId).maybeSingle();
  let acct = (p as any)?.payout_stripe_account_id || null;
  let adopted = false;
  // Si el nodo aún no tiene cuenta canónica pero ya conectaste por otro programa
  // (embajador/mentor/bot/copy), ADÓPTALA y propágala en vez de mostrar "sin conectar".
  if (!acct) {
    const found = await findExistingAccount(userId);
    if (found) { acct = found; adopted = true; try { await propagateAccount(userId, found); } catch {} }
  }
  if (!acct) return { connected: false, chargesEnabled: false, payoutsEnabled: false, acct: null };
  try {
    const a = await stripe.accounts.retrieve(acct);
    const chargesEnabled = !!a.charges_enabled;
    const payoutsEnabled = !!a.payouts_enabled;
    // Sincroniza banderas de cada programa para que sus retiros se habiliten solos.
    try { await supabaseAdmin.from('profiles').update({ payout_charges_enabled: chargesEnabled, bot_charges_enabled: chargesEnabled, copy_charges_enabled: chargesEnabled }).eq('id', userId); } catch {}
    try { await supabaseAdmin.from('ambassadors').update({ payouts_enabled: payoutsEnabled }).eq('user_id', userId); } catch {}
    return { connected: true, chargesEnabled, payoutsEnabled, acct, adopted };
  } catch { return { connected: true, chargesEnabled: false, payoutsEnabled: false, acct, adopted }; }
}

// Enlace al panel Express (ver cobros/datos bancarios) de la cuenta compartida.
export async function payoutExpressLoginLink(userId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from('profiles').select('payout_stripe_account_id').eq('id', userId).maybeSingle();
  const acct = (p as any)?.payout_stripe_account_id;
  if (!acct) return null;
  try { const l = await stripe.accounts.createLoginLink(acct); return l.url; } catch { return null; }
}

// Validación de dirección por red, AHORA con verificación de checksum
// (Base58Check en TRON, EIP-55 en Ethereum): no solo comprueba el formato sino
// que el dígito de control matemático cuadre, atrapando errores de tecleo.
export function isTronAddress(a: string): boolean { return isValidTron(a); }
export function isEvmAddress(a: string): boolean { return isValidEvm(a); }
export function validateWallet(network: string, addr: string): { ok: boolean; error?: string } {
  const a = (addr || '').trim();
  if (!a) return { ok: true };   // vacío = no configurada (permitido)
  const r = checkWallet(network, a);
  if (r.ok) return { ok: true };
  if (network === 'trc20') return { ok: false, error: r.reason === 'checksum' ? 'La dirección TRON (TRC20) no es válida: el dígito de control no cuadra (revísala).' : 'La dirección TRON (TRC20) debe empezar con "T" y tener 34 caracteres.' };
  if (network === 'erc20') return { ok: false, error: r.reason === 'checksum' ? 'La dirección Ethereum (ERC20) no es válida: el checksum de mayúsculas no cuadra (revísala).' : 'La dirección Ethereum (ERC20) debe empezar con "0x" y tener 42 caracteres.' };
  return { ok: false, error: 'Red no válida.' };
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
  // Valida el formato de cada dirección antes de guardar (una mal escrita = pérdida).
  if (o.trc20 != null) { const v = validateWallet('trc20', o.trc20); if (!v.ok) throw new Error(v.error); }
  if (o.erc20 != null) { const v = validateWallet('erc20', o.erc20); if (!v.ok) throw new Error(v.error); }
  const patch: any = {};
  if (o.trc20 != null) patch.payout_usdt_trc20 = String(o.trc20).trim().slice(0, 80) || null;
  if (o.erc20 != null) patch.payout_usdt_erc20 = String(o.erc20).trim().slice(0, 80) || null;
  if (o.network) patch.payout_usdt_network = o.network === 'erc20' ? 'erc20' : 'trc20';
  if (Object.keys(patch).length) await supabaseAdmin.from('profiles').update(patch).eq('id', userId);
  return savedWallets(userId);
}
