import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { botLabSettings, getProduct, grantLicense, usdtAddressFor, usdtNetworksAvailable } from '@/lib/botlab';
import { coinbaseEnabled, createCharge } from '@/lib/coinbase';

// ============================================================
// Pago en USDT (cripto). Dos modos:
//   1) MANUAL (por defecto): mostramos la wallet de Onyx, el cliente envía USDT
//      y pega el hash (txid). Un admin confirma → se otorga la licencia/servicio.
//      No necesita ningún servicio externo ni claves. Seguro y simple.
//   2) AUTOMÁTICO (opcional): si hay NOWPAYMENTS_API_KEY, se puede enganchar un
//      procesador que confirme el pago por webhook. (Preparado, no obligatorio.)
// ============================================================

export async function cryptoEnabled(): Promise<boolean> {
  const s = await botLabSettings();
  return coinbaseEnabled() || usdtNetworksAvailable(s).length > 0 || !!s.usdt_address;
}
// Redes USDT disponibles para que el cliente elija en el checkout.
export async function cryptoNetworks(): Promise<('erc20' | 'trc20')[]> {
  const s = await botLabSettings();
  const nets = usdtNetworksAvailable(s);
  return nets.length ? nets : (s.usdt_address ? [(s.usdt_network === 'erc20' ? 'erc20' : 'trc20')] : []);
}

// Crea una intención de pago en USDT. Si hay Coinbase Commerce, genera un charge
// y devuelve su hosted_url (checkout automático, confirmación on-chain por webhook).
// Si no, cae al modo manual: muestra la wallet y el cliente reporta el hash.
export async function createCryptoPayment(o: { userId?: string | null; purpose: 'license' | 'service'; refId: string; amountUsd: number; name?: string; network?: string }) {
  const s = await botLabSettings();
  // Red elegida por el cliente (erc20 | trc20). Si no se pasa, la primera disponible.
  const avail = usdtNetworksAvailable(s);
  let network = (o.network === 'erc20' || o.network === 'trc20') ? o.network : (avail[0] || s.usdt_network || 'trc20');
  const address = usdtAddressFor(s, network) || s.usdt_address || null;
  const base = Math.max(0, Number(o.amountUsd) || 0);
  // MONTO ÚNICO (base + sufijo de sub-centavos) para identificar el pago on-chain
  // sin procesador. Único entre los pagos pendientes de LA MISMA red.
  let matchAmount: number | null = null;
  for (let i = 0; i < 20; i++) {
    const cand = Math.round((base + Math.floor(1 + Math.random() * 98) / 10000) * 10000) / 10000; // base + 0.0001..0.0098
    const { data: dup } = await supabaseAdmin.from('crypto_payments').select('id').eq('status', 'pending').eq('network', network).eq('match_amount', cand).limit(1).maybeSingle();
    if (!dup) { matchAmount = cand; break; }
  }
  if (matchAmount == null) matchAmount = Math.round((base + (Date.now() % 9800 + 1) / 10000) * 10000) / 10000;
  const { data } = await supabaseAdmin.from('crypto_payments').insert({
    user_id: o.userId || null, purpose: o.purpose, ref_id: o.refId,
    amount_usd: base, match_amount: matchAmount, asset: 'USDT',
    network, address,
    status: 'pending', provider: coinbaseEnabled() ? 'coinbase' : 'manual',
  }).select('*').single();
  const row = data as any;
  if (row && coinbaseEnabled()) {
    try {
      const charge = await createCharge({
        name: o.name || (o.purpose === 'license' ? 'Onyx Bot Lab · Robot' : 'Onyx Bot Lab · Servicio'),
        description: o.purpose === 'license' ? 'Licencia de robot' : 'Servicio a medida',
        amountUsd: o.amountUsd,
        metadata: { payment_id: row.id, purpose: o.purpose, ref_id: o.refId, user_id: o.userId || '' },
        redirectPath: '/dashboard/bot-lab?paid=1',
      });
      if (charge) {
        await supabaseAdmin.from('crypto_payments').update({ provider_id: charge.id, hosted_url: charge.hostedUrl }).eq('id', row.id);
        row.provider_id = charge.id; row.hosted_url = charge.hostedUrl;
      }
    } catch { /* si Coinbase falla, queda como pendiente manual */ }
  }
  return row;
}

// Confirma por id de charge de Coinbase (lo llama el webhook). Idempotente.
export async function confirmByProviderId(chargeId: string) {
  const { data } = await supabaseAdmin.from('crypto_payments').select('id,status').eq('provider_id', chargeId).maybeSingle();
  if (!data || (data as any).status === 'confirmed') return { ok: false };
  return confirmCryptoPayment((data as any).id);
}

// El cliente reporta el hash de su transacción (queda pendiente de confirmar).
export async function submitTxid(paymentId: string, userId: string | null, txid: string) {
  let q = supabaseAdmin.from('crypto_payments').update({ txid: String(txid).slice(0, 120) }).eq('id', paymentId).eq('status', 'pending');
  if (userId) q = q.eq('user_id', userId);
  await q;
}

// Pagos en cripto para el panel admin (por defecto, los que faltan confirmar).
export async function listCryptoPayments(status = 'pending') {
  let q = supabaseAdmin.from('crypto_payments').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data } = await q.limit(200);
  const rows = (data || []) as any[];
  // Adjunta nombre del comprador y del producto/servicio para que el admin decida.
  const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const nameOf: Record<string, string> = {};
  if (uids.length) { const { data: pr } = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', uids); (pr || []).forEach((p: any) => { nameOf[p.id] = p.full_name || p.email || ''; }); }
  return rows.map((r) => ({ ...r, buyer: nameOf[r.user_id] || (r.user_id ? '—' : 'anónimo') }));
}

// Un admin CONFIRMA el pago → otorga la licencia (o marca el servicio en curso).
export async function confirmCryptoPayment(paymentId: string) {
  const { data: p } = await supabaseAdmin.from('crypto_payments').select('*').eq('id', paymentId).maybeSingle();
  if (!p || (p as any).status !== 'pending') return { ok: false };
  const pay = p as any;
  await supabaseAdmin.from('crypto_payments').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', paymentId);
  if (pay.purpose === 'license' && pay.user_id) {
    const prod = await getProduct(pay.ref_id);
    if (prod) {
      // USDT no es recurrente: una suscripción mensual pagada en cripto vale 30 días.
      const periodEnd = prod.kind === 'subscription'
        ? Math.floor(Date.now() / 1000) + 30 * 24 * 3600
        : undefined;
      await grantLicense({
        productId: prod.id, buyerId: pay.user_id, sellerId: prod.seller_id, kind: prod.kind, method: 'usdt',
        grossCents: prod.price_cents, currency: prod.currency, ref: 'crypto_' + paymentId, cryptoId: paymentId, periodEnd,
      });
    }
  }
  if (pay.purpose === 'service') {
    await supabaseAdmin.from('bot_service_requests').update({ status: 'in_progress' }).eq('id', pay.ref_id);
  }
  return { ok: true };
}

export async function rejectCryptoPayment(paymentId: string) {
  await supabaseAdmin.from('crypto_payments').update({ status: 'rejected' }).eq('id', paymentId);
}
