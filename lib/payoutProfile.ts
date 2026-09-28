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

// Reúne TODAS las cuentas Stripe Express distintas que el usuario tenga en
// cualquier programa (perfil, embajador, mentor). Puede haber más de una si en
// algún momento se creó un duplicado.
export async function allCandidateAccounts(userId: string): Promise<string[]> {
  const set = new Set<string>();
  try {
    const { data: p } = await supabaseAdmin.from('profiles')
      .select('payout_stripe_account_id,bot_stripe_account_id,copy_stripe_account_id').eq('id', userId).maybeSingle();
    for (const k of ['payout_stripe_account_id', 'bot_stripe_account_id', 'copy_stripe_account_id']) { const v = (p as any)?.[k]; if (v) set.add(v); }
  } catch {}
  try { const { data } = await supabaseAdmin.from('ambassadors').select('stripe_account_id').eq('user_id', userId).not('stripe_account_id', 'is', null); for (const r of (data || []) as any[]) if (r.stripe_account_id) set.add(r.stripe_account_id); } catch {}
  try { const { data } = await supabaseAdmin.from('mentors').select('stripe_account_id').eq('user_id', userId).not('stripe_account_id', 'is', null); for (const r of (data || []) as any[]) if (r.stripe_account_id) set.add(r.stripe_account_id); } catch {}
  return Array.from(set);
}

// Compat: una sola cuenta existente (la primera candidata), sin consultar Stripe.
export async function findExistingAccount(userId: string): Promise<string | null> {
  const list = await allCandidateAccounts(userId);
  return list[0] || null;
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

// Estado del nodo: ¿ya puede cobrar? RECONCILIA entre todas las cuentas Stripe
// que tengas: si en algún momento se creó un duplicado vacío y quedó como
// canónica, aquí se detecta la cuenta que Stripe reporta como verificada
// (payouts/charges habilitados) y se canoniza esa. Así "Ingresos" refleja la
// cuenta buena aunque el perfil apuntara a la equivocada.
export async function payoutNodeStatus(userId: string): Promise<{ connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; acct: string | null; adopted?: boolean }> {
  const { data: p } = await supabaseAdmin.from('profiles').select('payout_stripe_account_id').eq('id', userId).maybeSingle();
  const canonical = (p as any)?.payout_stripe_account_id || null;
  const candidates = await allCandidateAccounts(userId);
  if (!candidates.length) return { connected: false, chargesEnabled: false, payoutsEnabled: false, acct: null };

  // Revisa cada candidata en Stripe y elige la mejor: primero una con payouts
  // habilitados, luego con charges, luego cualquiera que exista.
  let best: { acct: string; charges: boolean; payouts: boolean } | null = null;
  for (const acct of candidates) {
    try {
      const a = await stripe.accounts.retrieve(acct);
      const charges = !!a.charges_enabled, payouts = !!a.payouts_enabled;
      const score = (payouts ? 2 : 0) + (charges ? 1 : 0);
      const bestScore = best ? (best.payouts ? 2 : 0) + (best.charges ? 1 : 0) : -1;
      if (!best || score > bestScore) best = { acct, charges, payouts };
    } catch { /* cuenta inexistente/borrada: la ignoramos */ }
  }
  if (!best) return { connected: false, chargesEnabled: false, payoutsEnabled: false, acct: null };

  const adopted = best.acct !== canonical;
  if (adopted) { try { await propagateAccount(userId, best.acct); } catch {} }
  // Sincroniza banderas de cada programa para que sus retiros se habiliten solos.
  try { await supabaseAdmin.from('profiles').update({ payout_charges_enabled: best.charges, bot_charges_enabled: best.charges, copy_charges_enabled: best.charges }).eq('id', userId); } catch {}
  try { await supabaseAdmin.from('ambassadors').update({ payouts_enabled: best.payouts }).eq('user_id', userId); } catch {}
  return { connected: true, chargesEnabled: best.charges, payoutsEnabled: best.payouts, acct: best.acct, adopted };
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
