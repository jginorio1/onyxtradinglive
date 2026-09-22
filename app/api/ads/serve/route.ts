import { NextResponse } from 'next/server';
import { getAdsConfig, pickAd, viewerIsPaid, bumpAd, visitorHash, dedupeImpression, recordEvent, deviceFromUA } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · devuelve el anuncio a mostrar en un slot. Oculta a usuarios de pago y si
// los anuncios están apagados. Registra una impresión (una por visitante/campaña/día,
// filtrando bots) y suma al gasto/reporte según el modelo (CPM).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slot = url.searchParams.get('slot') || '';
  const lang = (url.searchParams.get('lang') === 'en' ? 'en' : 'es') as 'es' | 'en';

  const cfg = await getAdsConfig();
  const noStore = { headers: { 'cache-control': 'no-store' } };
  if (!cfg.enabled) return NextResponse.json({ hide: true }, noStore);
  if (await viewerIsPaid()) return NextResponse.json({ hide: true }, noStore);

  const ua = req.headers.get('user-agent') || '';
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const country = (req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '').toUpperCase();
  const device = deviceFromUA(ua);

  const ad = await pickAd(slot, lang, { country, ua });
  if (!ad) return NextResponse.json({ hide: true }, noStore);

  if (ad.kind === 'paid') {
    // Antifraude: solo cuenta si es un visitante nuevo hoy para esta campaña.
    const fresh = await dedupeImpression(ad.id, visitorHash(ip, ua), ua);
    if (fresh) { bumpAd(ad.id, 'impression'); recordEvent(ad.id, 'impression', { country, device }); }
  }
  return NextResponse.json({ ad }, noStore);
}
