import { NextResponse } from 'next/server';
import { listMarketplace, getProduct, botLabSettings, cardEnabled } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const runtime = 'nodejs';

// Nunca cachear en CDN/proxy: los ajustes globales (tope de referido, métodos de
// pago…) tienen que reflejarse al instante cuando el admin los cambia.
const NOCACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' };

// GET público · marketplace. ?id= devuelve un robot; con filtros devuelve la lista.
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const id = sp.get('id');
    if (id) { const p = await getProduct(id); return NextResponse.json({ product: p }, { headers: NOCACHE }); }
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
    const pay = { card: cardEnabled(s), crypto: true, monthly: s.robots_monthly === true, affiliate_max: Math.max(0, Math.min(90, Math.round(Number((s as any).affiliate_max ?? 80)))) };
    return NextResponse.json({ products, pay }, { headers: NOCACHE });
  } catch (e: any) {
    return NextResponse.json({ products: [], error: e?.message || 'error' }, { status: 500, headers: NOCACHE });
  }
}
