import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { getSetting } from '@/lib/settings';

// ============================================================
// Onyx Bot Lab · marketplace de robots + servicios + payouts.
//
// Reusa el mismo Supabase y el mismo Stripe. Los CREADORES cobran con Stripe
// Connect (destination charge, Onyx retiene su comisión). Los robots OFICIALES
// de Onyx (seller_id null) cobran directo a la cuenta de la plataforma.
// El pago en USDT vive en lib/cryptoPay.ts.
// ============================================================

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
const clampPct = (n: any) => Math.max(0, Math.min(50, Number(n) || 0));

export type BotLabSettings = {
  fee_pct: number;            // comisión de Onyx sobre ventas de creadores (%)
  usdt_address: string;       // wallet para cobrar en USDT (modo manual)
  usdt_network: string;       // trc20 | erc20 | bep20
  service_automate_from: number; // precio "desde" del servicio a medida (USD)
  service_install_price: number; // instalación asistida por sesión (USD)
  service_elite_from: number;    // programa elite (USD)
};
const DEF: BotLabSettings = {
  fee_pct: 20, usdt_address: '', usdt_network: 'trc20',
  service_automate_from: 1500, service_install_price: 99, service_elite_from: 6000,
};
export async function botLabSettings(): Promise<BotLabSettings> {
  const s = await getSetting<Partial<BotLabSettings>>('bot_lab', {});
  return { ...DEF, ...(s || {}) };
}
export async function botLabFee(): Promise<number> {
  const s = await botLabSettings();
  return clampPct(s.fee_pct);
}

// ---- nombre público de un vendedor ----
async function sellerNames(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (!clean.length) return out;
  const { data } = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', clean);
  for (const p of (data || []) as any[]) out[p.id] = p.full_name || (p.email || '').split('@')[0] || 'Trader';
  return out;
}

// ============================================================
// Marketplace (lectura pública)
// ============================================================
export async function listMarketplace(opts: { category?: string; platform?: string; q?: string; limit?: number } = {}) {
  let query = supabaseAdmin.from('bot_products').select('*').eq('status', 'active').order('position').order('created_at', { ascending: false });
  if (opts.category) query = query.eq('category', opts.category);
  if (opts.platform && opts.platform !== 'any') query = query.eq('platform', opts.platform);
  const { data } = await query.limit(Math.min(opts.limit || 60, 100));
  let rows = (data || []) as any[];
  if (opts.q) { const s = opts.q.toLowerCase(); rows = rows.filter((r) => (r.name + ' ' + (r.tagline || '')).toLowerCase().includes(s)); }
  const names = await sellerNames(rows.map((r) => r.seller_id));
  return rows.map((r) => ({ ...r, seller_name: r.is_official ? 'Onyx oficial' : (names[r.seller_id] || 'Trader') }));
}
export async function getProduct(id: string) {
  const { data } = await supabaseAdmin.from('bot_products').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const names = await sellerNames([(data as any).seller_id]);
  return { ...(data as any), seller_name: (data as any).is_official ? 'Onyx oficial' : (names[(data as any).seller_id] || 'Trader') };
}

// ============================================================
// Panel del creador (publicar / editar)
// ============================================================
export async function myProducts(sellerId: string) {
  const { data } = await supabaseAdmin.from('bot_products').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false });
  return (data || []) as any[];
}
export async function saveProduct(sellerId: string, b: any, isAdmin = false) {
  const row: any = {
    name: String(b.name || 'Mi robot').slice(0, 80),
    tagline: b.tagline ? String(b.tagline).slice(0, 140) : null,
    description: b.description ? String(b.description).slice(0, 2000) : null,
    kind: b.kind === 'one_time' ? 'one_time' : 'subscription',
    interval: b.interval === 'year' ? 'year' : 'month',
    price_cents: Math.max(0, Math.round(Number(b.price_cents) || 0)),
    currency: (b.currency || 'usd').toLowerCase().slice(0, 3),
    platform: ['mt4', 'mt5', 'ctrader', 'any'].includes(b.platform) ? b.platform : 'any',
    pair: b.pair ? String(b.pair).slice(0, 20) : null,
    category: b.category ? String(b.category).slice(0, 24) : null,
    cover_url: b.cover_url ? String(b.cover_url).slice(0, 400) : null,
    bot_id: b.bot_id || null,
    accepts_card: b.accepts_card !== false,
    accepts_crypto: b.accepts_crypto !== false,
  };
  // Un creador manda a revisión (pending). El admin puede fijar estado/oficial/verificado.
  if (isAdmin) {
    if (b.status) row.status = b.status;
    if (b.is_official != null) row.is_official = !!b.is_official;
    if (b.verified != null) row.verified = !!b.verified;
    if (b.position != null) row.position = Number(b.position) || 0;
  } else {
    row.status = 'pending';
  }
  if (b.id) {
    let up = supabaseAdmin.from('bot_products').update(row).eq('id', b.id);
    if (!isAdmin) up = up.eq('seller_id', sellerId);   // un creador solo edita lo suyo
    await up;
    return { id: b.id };
  }
  const insert: any = { ...row, seller_id: isAdmin && b.is_official ? null : sellerId, is_official: isAdmin ? !!b.is_official : false };
  const { data } = await supabaseAdmin.from('bot_products').insert(insert).select('id').single();
  return data as any;
}
export async function deleteProduct(sellerId: string, id: string, isAdmin = false) {
  let d = supabaseAdmin.from('bot_products').delete().eq('id', id);
  if (!isAdmin) d = d.eq('seller_id', sellerId);
  await d;
}

// ============================================================
// Admin del marketplace
// ============================================================
export async function adminListProducts(status?: string) {
  let q = supabaseAdmin.from('bot_products').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data } = await q.limit(200);
  const rows = (data || []) as any[];
  const names = await sellerNames(rows.map((r) => r.seller_id));
  return rows.map((r) => ({ ...r, seller_name: r.is_official ? 'Onyx oficial' : (names[r.seller_id] || 'Trader') }));
}
export async function setProductStatus(id: string, patch: { status?: string; verified?: boolean; is_official?: boolean; position?: number }) {
  const up: any = {};
  if (patch.status) up.status = patch.status;
  if (patch.verified != null) up.verified = !!patch.verified;
  if (patch.is_official != null) up.is_official = !!patch.is_official;
  if (patch.position != null) up.position = Number(patch.position) || 0;
  await supabaseAdmin.from('bot_products').update(up).eq('id', id);
}

// ============================================================
// Licencias (lo que compra el trader)
// ============================================================
export async function myLicenses(buyerId: string) {
  const { data } = await supabaseAdmin.from('bot_purchases').select('*').eq('buyer_id', buyerId).order('created_at', { ascending: false });
  const rows = (data || []) as any[];
  const pids = Array.from(new Set(rows.map((r) => r.product_id)));
  const prodMap: Record<string, any> = {};
  if (pids.length) { const { data: pr } = await supabaseAdmin.from('bot_products').select('id,name,platform,cover_url').in('id', pids); (pr || []).forEach((p: any) => { prodMap[p.id] = p; }); }
  return rows.map((r) => ({ ...r, product: prodMap[r.product_id] || null }));
}
export async function hasLicense(buyerId: string, productId: string) {
  const { data } = await supabaseAdmin.from('bot_purchases').select('status').eq('buyer_id', buyerId).eq('product_id', productId).maybeSingle();
  return !!data && (data as any).status === 'active';
}

// Registra/renueva una licencia (idempotente por comprador+producto) y anota comisión.
export async function grantLicense(o: { productId: string; buyerId: string; sellerId?: string | null; kind: string; method: string; grossCents: number; currency?: string; ref?: string; sessionId?: string; subId?: string; cryptoId?: string; periodEnd?: number }) {
  await supabaseAdmin.from('bot_purchases').upsert({
    product_id: o.productId, buyer_id: o.buyerId, seller_id: o.sellerId || null,
    kind: o.kind, status: 'active', method: o.method, price_cents: o.grossCents, currency: (o.currency || 'usd').toLowerCase().slice(0, 3),
    stripe_session_id: o.sessionId || null, stripe_subscription_id: o.subId || null, crypto_payment_id: o.cryptoId || null,
    current_period_end: o.periodEnd ? new Date(o.periodEnd * 1000).toISOString() : null,
  }, { onConflict: 'buyer_id,product_id' });
  await supabaseAdmin.from('bot_products').update({ sales: (await productSales(o.productId)) }).eq('id', o.productId).select('id');
  if (o.sellerId && o.ref) await recordBotCommission({ sellerId: o.sellerId, buyerId: o.buyerId, productId: o.productId, grossCents: o.grossCents, currency: o.currency, kind: o.kind, method: o.method, ref: o.ref });
}
async function productSales(productId: string) {
  const { count } = await supabaseAdmin.from('bot_purchases').select('*', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'active');
  return count || 0;
}
export async function recordBotCommission(o: { sellerId: string; buyerId?: string; productId?: string; grossCents: number; currency?: string; kind: string; method: string; ref: string; feePct?: number }) {
  if (!o.ref) return;
  const pct = o.feePct != null ? o.feePct : await botLabFee();
  const fee = Math.round((o.grossCents || 0) * (pct / 100));
  await supabaseAdmin.from('bot_commissions').upsert({
    seller_id: o.sellerId, buyer_id: o.buyerId || null, product_id: o.productId || null,
    gross_cents: o.grossCents || 0, fee_cents: fee, currency: (o.currency || 'usd').toLowerCase().slice(0, 3),
    kind: o.kind, method: o.method, status: 'earned', ref: o.ref,
  }, { onConflict: 'seller_id,ref', ignoreDuplicates: true });
}
export async function reverseBotCommissionByRef(ref?: string | null) {
  if (!ref) return;
  await supabaseAdmin.from('bot_commissions').update({ status: 'reversed', reversed_at: new Date().toISOString() }).eq('ref', ref).eq('status', 'earned');
}
export async function setPurchaseStatus(subId: string, status: string, periodEnd?: number) {
  const patch: any = { status };
  if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();
  await supabaseAdmin.from('bot_purchases').update(patch).eq('stripe_subscription_id', subId);
}

// ============================================================
// Stripe Connect del creador (marketplace) — cuenta propia en profiles
// ============================================================
export async function sellerOnboardingLink(userId: string, email?: string) {
  const { data: p } = await supabaseAdmin.from('profiles').select('bot_stripe_account_id').eq('id', userId).maybeSingle();
  let acct = (p as any)?.bot_stripe_account_id as string | undefined;
  if (!acct) {
    const account = await stripe.accounts.create({ type: 'express', email, capabilities: { transfers: { requested: true }, card_payments: { requested: true } }, metadata: { onyx_bot_seller: userId } });
    acct = account.id;
    await supabaseAdmin.from('profiles').update({ bot_stripe_account_id: acct, bot_seller: true }).eq('id', userId);
  }
  const link = await stripe.accountLinks.create({
    account: acct,
    refresh_url: `${appUrl()}/dashboard/bot-lab?tab=vender&connect=refresh`,
    return_url: `${appUrl()}/dashboard/bot-lab?tab=vender&connect=done`,
    type: 'account_onboarding',
  });
  return link.url;
}
export async function sellerConnectStatus(userId: string) {
  const { data: p } = await supabaseAdmin.from('profiles').select('bot_stripe_account_id,bot_charges_enabled').eq('id', userId).maybeSingle();
  const acct = (p as any)?.bot_stripe_account_id;
  if (!acct) return { connected: false, chargesEnabled: false };
  try {
    const a = await stripe.accounts.retrieve(acct);
    const enabled = !!a.charges_enabled;
    if (enabled !== (p as any).bot_charges_enabled) await supabaseAdmin.from('profiles').update({ bot_charges_enabled: enabled }).eq('id', userId);
    return { connected: true, chargesEnabled: enabled };
  } catch { return { connected: true, chargesEnabled: !!(p as any).bot_charges_enabled }; }
}

// Checkout con TARJETA. Producto de creador → destination charge con comisión.
// Producto oficial de Onyx → cobro directo a la plataforma.
export async function checkoutCard(product: any, buyerId: string, email?: string) {
  const base: any = {
    mode: (product.kind === 'one_time' ? 'payment' : 'subscription') as 'payment' | 'subscription',
    success_url: `${appUrl()}/dashboard/bot-lab?bought={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/dashboard/bot-lab?tab=market`,
    customer_email: email,
    allow_promotion_codes: true,
    metadata: { onyx_kind: 'botlab', onyx_product: product.id, onyx_buyer: buyerId, onyx_seller: product.seller_id || '' },
  };
  const price: any = { currency: product.currency || 'usd', unit_amount: product.price_cents, product_data: { name: product.name } };
  // Producto oficial de Onyx (sin creador): cobro simple a la plataforma.
  if (!product.seller_id) {
    if (product.kind === 'one_time') return stripe.checkout.sessions.create({ ...base, line_items: [{ price_data: price, quantity: 1 }], payment_intent_data: { metadata: base.metadata } });
    return stripe.checkout.sessions.create({ ...base, line_items: [{ price_data: { ...price, recurring: { interval: product.interval === 'year' ? 'year' : 'month' } }, quantity: 1 }], subscription_data: { metadata: base.metadata } });
  }
  // Producto de creador: hace falta su cuenta conectada.
  const { data: sp } = await supabaseAdmin.from('profiles').select('bot_stripe_account_id').eq('id', product.seller_id).maybeSingle();
  const acct = (sp as any)?.bot_stripe_account_id;
  if (!acct) throw new Error('seller_not_connected');
  const pct = await botLabFee();
  if (product.kind === 'one_time') {
    return stripe.checkout.sessions.create({
      ...base, line_items: [{ price_data: price, quantity: 1 }],
      payment_intent_data: { application_fee_amount: Math.round(product.price_cents * (pct / 100)), on_behalf_of: acct, transfer_data: { destination: acct }, metadata: base.metadata },
    });
  }
  return stripe.checkout.sessions.create({
    ...base, line_items: [{ price_data: { ...price, recurring: { interval: product.interval === 'year' ? 'year' : 'month' } }, quantity: 1 }],
    subscription_data: { application_fee_percent: pct, on_behalf_of: acct, transfer_data: { destination: acct }, metadata: base.metadata },
  });
}

// Confirma una sesión de checkout (llamada al volver de Stripe) y otorga la licencia.
export async function confirmSession(sessionId: string, buyerId: string) {
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  if (s.payment_status !== 'paid' && s.status !== 'complete') return { ok: false };
  const productId = (s.metadata as any)?.onyx_product;
  if (!productId) return { ok: false };
  const prod = await getProduct(productId);
  if (!prod) return { ok: false };
  await grantLicense({
    productId, buyerId, sellerId: prod.seller_id, kind: prod.kind, method: 'card',
    grossCents: prod.price_cents, currency: prod.currency,
    ref: (s.payment_intent as string) || s.id, sessionId: s.id, subId: (s.subscription as string) || undefined,
  });
  return { ok: true, product: prod };
}

// ============================================================
// Ganancias / payouts del creador
// ============================================================
export async function sellerEarnings(sellerId: string) {
  const { data } = await supabaseAdmin.from('bot_commissions').select('gross_cents,fee_cents').eq('seller_id', sellerId).neq('status', 'reversed');
  const gross = (data || []).reduce((s: number, r: any) => s + (r.gross_cents || 0), 0);
  const fee = (data || []).reduce((s: number, r: any) => s + (r.fee_cents || 0), 0);
  const { data: paid } = await supabaseAdmin.from('bot_payouts').select('amount_cents').eq('seller_id', sellerId).eq('status', 'paid');
  const paidC = (paid || []).reduce((s: number, r: any) => s + (r.amount_cents || 0), 0);
  const net = gross - fee;
  return { grossCents: gross, feeCents: fee, netCents: net, paidCents: paidC, availableCents: Math.max(0, net - paidC), sales: (data || []).length };
}
export async function listPayouts(sellerId?: string) {
  let q = supabaseAdmin.from('bot_payouts').select('*').order('created_at', { ascending: false });
  if (sellerId) q = q.eq('seller_id', sellerId);
  const { data } = await q.limit(200);
  return (data || []) as any[];
}
export async function createPayout(o: { sellerId: string; amountCents: number; method: string; destination?: string; note?: string }) {
  const { data } = await supabaseAdmin.from('bot_payouts').insert({ seller_id: o.sellerId, amount_cents: Math.round(o.amountCents), method: o.method, destination: o.destination || null, note: o.note || null }).select('id').single();
  return data as any;
}
export async function markPayoutPaid(id: string) {
  await supabaseAdmin.from('bot_payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
}

// ============================================================
// Solicitudes de servicio (leads DFY / instalación / elite)
// ============================================================
export async function createServiceRequest(o: { userId?: string | null; email?: string; name?: string; service: string; platform?: string; budget?: string; message?: string; lang?: string }) {
  const service = ['automate', 'install', 'elite'].includes(o.service) ? o.service : 'automate';
  const { data } = await supabaseAdmin.from('bot_service_requests').insert({
    user_id: o.userId || null, email: o.email || null, name: o.name || null, service,
    platform: o.platform || null, budget: o.budget || null,
    message: o.message ? String(o.message).slice(0, 2000) : null, lang: o.lang || 'es',
  }).select('id').single();
  return data as any;
}
export async function listServiceRequests(status?: string) {
  let q = supabaseAdmin.from('bot_service_requests').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data } = await q.limit(200);
  return (data || []) as any[];
}
export async function setServiceStatus(id: string, status: string) {
  await supabaseAdmin.from('bot_service_requests').update({ status }).eq('id', id);
}

// Contadores para el panel admin.
export async function botLabAdminStats() {
  const [{ count: pend }, { count: leads }, { data: comm }] = await Promise.all([
    supabaseAdmin.from('bot_products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('bot_service_requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabaseAdmin.from('bot_commissions').select('fee_cents').neq('status', 'reversed'),
  ]);
  const feeTotal = (comm || []).reduce((s: number, r: any) => s + (r.fee_cents || 0), 0);
  return { pendingProducts: pend || 0, newLeads: leads || 0, commissionCents: feeTotal };
}
