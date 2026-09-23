import crypto from 'crypto';

// ============================================================
// Coinbase Commerce (pago en USDT/cripto). Crea un "charge" con precio fijo en
// USD; Coinbase muestra su checkout, el cliente paga en USDT y Coinbase confirma
// on-chain por webhook. Si no hay API key, el llamador cae al modo manual.
//
// Env: COINBASE_COMMERCE_API_KEY, COINBASE_COMMERCE_WEBHOOK_SECRET
// ============================================================

const API = 'https://api.commerce.coinbase.com';
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export function coinbaseEnabled(): boolean {
  return !!process.env.COINBASE_COMMERCE_API_KEY;
}

// Crea un cobro. `metadata` viaja de vuelta en el webhook (para saber qué activar).
export async function createCharge(o: { name: string; description: string; amountUsd: number; metadata: Record<string, string>; redirectPath?: string }) {
  const key = process.env.COINBASE_COMMERCE_API_KEY;
  if (!key) return null;
  const r = await fetch(`${API}/charges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CC-Api-Key': key, 'X-CC-Version': '2018-03-22' },
    body: JSON.stringify({
      name: o.name.slice(0, 100),
      description: o.description.slice(0, 200),
      pricing_type: 'fixed_price',
      local_price: { amount: Number(o.amountUsd || 0).toFixed(2), currency: 'USD' },
      metadata: o.metadata,
      redirect_url: `${appUrl()}${o.redirectPath || '/dashboard/bot-lab'}`,
      cancel_url: `${appUrl()}/bot-lab`,
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const d = j?.data;
  if (!d) return null;
  return { id: d.id as string, code: d.code as string, hostedUrl: d.hosted_url as string };
}

// Verifica la firma del webhook (HMAC-SHA256 del cuerpo crudo con el secreto).
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  try {
    const h = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    // comparación en tiempo constante
    const a = Buffer.from(h); const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
