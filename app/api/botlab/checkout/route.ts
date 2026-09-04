import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getProduct, checkoutCard, hasLicense } from '@/lib/botlab';
import { createCryptoPayment, cryptoEnabled } from '@/lib/cryptoPay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · comprar/rentar un robot. { productId, method: 'card' | 'usdt' }
//  · card → devuelve { url } de Stripe Checkout.
//  · usdt → crea el pago en cripto y devuelve la dirección para pagar.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const product = await getProduct(String(b.productId || ''));
  if (!product || product.status !== 'active') return NextResponse.json({ error: 'Robot no disponible' }, { status: 404 });
  if (await hasLicense(user.id, product.id)) return NextResponse.json({ error: 'Ya tienes este robot activo.' }, { status: 400 });

  const method = b.method === 'usdt' ? 'usdt' : 'card';

  if (method === 'usdt') {
    if (!product.accepts_crypto) return NextResponse.json({ error: 'Este robot no acepta cripto.' }, { status: 400 });
    if (!(await cryptoEnabled())) return NextResponse.json({ error: 'Pago en cripto no disponible por ahora.' }, { status: 400 });
    const pay = await createCryptoPayment({ userId: user.id, purpose: 'license', refId: product.id, amountUsd: (product.price_cents || 0) / 100 });
    return NextResponse.json({ crypto: { id: pay.id, address: pay.address, network: pay.network, amountUsd: pay.amount_usd, asset: 'USDT' } });
  }

  if (!product.accepts_card) return NextResponse.json({ error: 'Este robot no acepta tarjeta.' }, { status: 400 });
  try {
    const session = await checkoutCard(product, user.id, user.email || undefined);
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    if (e?.message === 'seller_not_connected') return NextResponse.json({ error: 'El creador aún no conectó su cobro. Prueba con cripto o vuelve más tarde.' }, { status: 400 });
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
