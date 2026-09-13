import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { botLabSettings, usdtAddressFor } from '@/lib/botlab';
import { confirmCryptoPayment } from '@/lib/cryptoPay';

// ============================================================
// Verificador ON-CHAIN de USDT, SIN procesador, en DOS redes:
//   · Ethereum (ERC20)  → Etherscan  (wallet 0x…)   ETHERSCAN_API_KEY
//   · TRON (TRC20)      → Tronscan   (wallet T…)     (sin key obligatoria)
// Lee las transferencias entrantes de USDT a TU wallet y casa el MONTO EXACTO
// (match_amount) de cada factura pendiente en ESA red → confirma sola.
// Cada red usa su propia dirección: enviar por la red equivocada NO se confirma.
// ============================================================

const USDT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // contrato USDT Ethereum, 6 decimales
const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';         // contrato USDT TRON, 6 decimales
const D6 = 1e6;

async function pendingFor(network: 'erc20' | 'trc20') {
  const { data } = await supabaseAdmin
    .from('crypto_payments').select('id,match_amount,matched_hash')
    .eq('status', 'pending').eq('network', network).not('match_amount', 'is', null).limit(200);
  return (data || []) as any[];
}

async function matchAndConfirm(pending: any[], incoming: { to: string; value: number; hash: string }[], wallet: string) {
  const used = new Set(pending.map((p) => p.matched_hash).filter(Boolean));
  let confirmed = 0;
  for (const p of pending) {
    const target = Number(p.match_amount);
    if (!target) continue;
    const hit = incoming.find((t) => t.to.toLowerCase() === wallet.toLowerCase() && !used.has(t.hash) && Math.abs(t.value - target) < 0.00005);
    if (hit) {
      await supabaseAdmin.from('crypto_payments').update({ matched_hash: hit.hash, txid: hit.hash }).eq('id', p.id);
      used.add(hit.hash);
      const res = await confirmCryptoPayment(p.id); // otorga/renueva licencia + activa el bot
      if (res?.ok) confirmed += 1;
    }
  }
  return confirmed;
}

// --- Ethereum (ERC20) vía Etherscan ---
export async function watchUsdtErc20(): Promise<{ scanned: number; confirmed: number; skipped?: string }> {
  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  const s = await botLabSettings();
  const wallet = usdtAddressFor(s, 'erc20').toLowerCase();
  if (!apiKey) return { scanned: 0, confirmed: 0, skipped: 'no_etherscan_key' };
  if (!wallet.startsWith('0x')) return { scanned: 0, confirmed: 0, skipped: 'no_erc20_wallet' };
  const pending = await pendingFor('erc20');
  if (!pending.length) return { scanned: 0, confirmed: 0 };
  const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${USDT_ERC20}&address=${wallet}&page=1&offset=100&sort=desc&apikey=${apiKey}`;
  let incoming: { to: string; value: number; hash: string }[] = [];
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    if (Array.isArray(j?.result)) incoming = j.result.map((t: any) => ({ to: String(t.to || ''), value: Number(t.value) / D6, hash: String(t.hash || '') }));
  } catch { return { scanned: 0, confirmed: 0, skipped: 'fetch_error' }; }
  const confirmed = await matchAndConfirm(pending, incoming, wallet);
  return { scanned: incoming.length, confirmed };
}

// --- TRON (TRC20) vía Tronscan ---
export async function watchUsdtTrc20(): Promise<{ scanned: number; confirmed: number; skipped?: string }> {
  const s = await botLabSettings();
  const wallet = usdtAddressFor(s, 'trc20');
  if (!wallet.startsWith('T')) return { scanned: 0, confirmed: 0, skipped: 'no_trc20_wallet' };
  const pending = await pendingFor('trc20');
  if (!pending.length) return { scanned: 0, confirmed: 0 };
  const key = process.env.TRONSCAN_API_KEY || '';
  const url = `https://apilist.tronscanapi.com/api/token_trc20/transfers?limit=50&start=0&direction=1&relatedAddress=${wallet}&contract_address=${USDT_TRC20}`;
  let incoming: { to: string; value: number; hash: string }[] = [];
  try {
    const r = await fetch(url, { cache: 'no-store', headers: key ? { 'TRON-PRO-API-KEY': key } : undefined });
    const j = await r.json();
    const arr = Array.isArray(j?.token_transfers) ? j.token_transfers : (Array.isArray(j?.data) ? j.data : []);
    incoming = arr.map((t: any) => ({
      to: String(t.to_address || t.toAddress || ''),
      value: Number(t.quant ?? t.amount ?? 0) / D6,
      hash: String(t.transaction_id || t.hash || ''),
    }));
  } catch { return { scanned: 0, confirmed: 0, skipped: 'fetch_error' }; }
  const confirmed = await matchAndConfirm(pending, incoming, wallet);
  return { scanned: incoming.length, confirmed };
}

// Ambas redes en una pasada.
export async function watchUsdtAll() {
  const erc = await watchUsdtErc20().catch(() => ({ scanned: 0, confirmed: 0, skipped: 'error' }));
  const trc = await watchUsdtTrc20().catch(() => ({ scanned: 0, confirmed: 0, skipped: 'error' }));
  return { erc20: erc, trc20: trc, confirmed: (erc.confirmed || 0) + (trc.confirmed || 0) };
}
