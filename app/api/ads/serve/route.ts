import { NextResponse } from 'next/server';
import { getAdsConfig, pickAd, viewerIsPaid, bumpAd } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · devuelve el anuncio a mostrar en un slot. Oculta a usuarios de pago y si
// los anuncios están apagados. Registra una impresión cuando entrega un anuncio pagado.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slot = url.searchParams.get('slot') || '';
  const lang = (url.searchParams.get('lang') === 'en' ? 'en' : 'es') as 'es' | 'en';

  const cfg = await getAdsConfig();
  if (!cfg.enabled) return NextResponse.json({ hide: true }, { headers: { 'cache-control': 'no-store' } });
  if (await viewerIsPaid()) return NextResponse.json({ hide: true }, { headers: { 'cache-control': 'no-store' } });

  const country = (req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '').toUpperCase();
  const ad = await pickAd(slot, lang, country);
  if (!ad) return NextResponse.json({ hide: true }, { headers: { 'cache-control': 'no-store' } });
  if (ad.kind === 'paid') bumpAd(ad.id, 'impression');
  return NextResponse.json({ ad }, { headers: { 'cache-control': 'no-store' } });
}
