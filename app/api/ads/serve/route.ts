import { NextResponse } from 'next/server';
import { getAdsConfig, pickAd, viewerIsPaid, bumpAd, visitorHash, dedupeImpression, recordEvent, deviceFromUA } from '@/lib/ads';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · devuelve el anuncio a mostrar en un slot. Oculta a usuarios de pago y si
// los anuncios están apagados. Registra una impresión (una por visitante/campaña/día,
// filtrando bots) y suma al gasto/reporte según el modelo (CPM).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slot = url.searchParams.get('slot') || '';
  const lang = (url.searchParams.get('lang') === 'en' ? 'en' : 'es') as 'es' | 'en';
  // Posición del hueco en la página (0,1,2…). Sirve para que dos huecos seguidos
  // NO muestren el mismo anuncio ni la misma marca (rotación determinista por posición).
  const pos = Math.max(0, parseInt(url.searchParams.get('pos') || '0', 10) || 0);

  // Marca de build: sirve para COMPROBAR qué versión está desplegada. La lógica de
  // exclusividad del pin (un partner fijado NO rota en otros huecos) vive aquí; si en
  // producción los partners fijados siguen saliendo en todos lados, casi seguro el
  // sitio corre un build anterior a esta versión. Visita:
  //   /api/ads/serve?slot=blog_top&debug=1
  // y mira "build" y "pins": si "build" no es "ads-pin-exclusive-v2" o "pins" sale
  // vacío, el fix aún no está desplegado.
  const BUILD = 'ads-pin-exclusive-v3';
  const cfg = await getAdsConfig();
  const noStore = { headers: { 'cache-control': 'no-store' } };

  // Modo diagnóstico: NO registra impresión. Muestra la config normalizada QUE LEE
  // el servidor Y ADEMÁS la fila CRUDA de la BD (rawPins), saltándose toda la
  // normalización. Así sabemos con certeza si el pin llegó al disco:
  //   · rawPins con el pin  → el guardado SÍ persiste; el problema sería normalización/caché.
  //   · rawPins vacío       → el guardado NO está escribiendo el pin (bug en el guardado).
  if (url.searchParams.get('debug')) {
    const uaD = req.headers.get('user-agent') || '';
    const countryD = (req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '').toUpperCase();
    const would = cfg.enabled ? await pickAd(slot, lang, { country: countryD, ua: uaD, pos }) : null;
    let rawPins: any = 'n/a', rawFills: any = 'n/a', rawKeys: any = 'n/a', rowCount = -1;
    try {
      const { data: rows } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'ads');
      rowCount = rows ? rows.length : 0;    // ¿hay filas duplicadas de 'ads'?
      const raw: any = (rows && rows[0] && (rows[0] as any).value) || {};
      rawPins = raw.partnerSlotPin ?? null;
      rawFills = raw.partnerFillSlots ?? null;
      rawKeys = Object.keys(raw);          // qué campos tiene la fila 'ads' en la BD
    } catch (e: any) { rawPins = 'ERR:' + (e?.message || 'x'); }
    return NextResponse.json({
      build: BUILD,
      slot,
      enabled: cfg.enabled,
      pins: cfg.partnerSlotPin || {},        // partner FIJADO por ubicación (normalizado)
      fills: cfg.partnerFillSlots || {},
      partnerFill: cfg.partnerFill,
      rawPins,                                // ← lo que hay REALMENTE en la BD (sin normalizar)
      rawFills,
      rawKeys,
      rowCount,                               // filas 'ads' en la BD (>1 = duplicados = bug)
      wouldServe: would ? { kind: (would as any).kind, id: (would as any).id, name: (would as any).name || null } : null,
    }, noStore);
  }

  if (!cfg.enabled) return NextResponse.json({ hide: true, build: BUILD }, noStore);
  if (await viewerIsPaid()) return NextResponse.json({ hide: true, build: BUILD }, noStore);

  const ua = req.headers.get('user-agent') || '';
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const country = (req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '').toUpperCase();
  const device = deviceFromUA(ua);

  const ad = await pickAd(slot, lang, { country, ua, pos });
  if (!ad) return NextResponse.json({ hide: true, build: BUILD }, noStore);

  if (ad.kind === 'paid') {
    // Antifraude: solo cuenta si es un visitante nuevo hoy para esta campaña.
    const fresh = await dedupeImpression(ad.id, visitorHash(ip, ua), ua);
    if (fresh) { bumpAd(ad.id, 'impression'); recordEvent(ad.id, 'impression', { country, device }); }
  }
  return NextResponse.json({ ad, build: BUILD }, noStore);
}
