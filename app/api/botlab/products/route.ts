import { NextResponse } from 'next/server';
import { listMarketplace, getProduct, botLabSettings, cardEnabled } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET público · marketplace. ?id= devuelve un robot; con filtros devuelve la lista.
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const id = sp.get('id');
    if (id) { const p = await getProduct(id); return NextResponse.json({ product: p }); }
    const [products, s] = await Promise.all([
      listMarketplace({
        category: sp.get('category') || undefined,
        platform: sp.get('platform') || undefined,
        q: sp.get('q') || undefined,
        limit: Number(sp.get('limit')) || 60,
      }),
      botLabSettings(),
    ]);
    // Métodos de pago globales: la UI muestra USDT y, solo si está encendida, tarjeta.
    const pay = { card: cardEnabled(s), crypto: true, monthly: s.robots_monthly === true };
    return NextResponse.json({ products, pay });
  } catch (e: any) {
    return NextResponse.json({ products: [], error: e?.message || 'error' }, { status: 500 });
  }
}
