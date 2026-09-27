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
  const BUILD = 'ads-pin-exclusive-v10';
  const cfg = await getAdsConfig();
  const noStore = { headers: { 'cache-control': 'no-store' } };

  // Prueba de ESCRITURA: escribe partnerSlotPin={"__TEST__": ...} directo en la fila
  // 'ads' y la relee CRUDA, mostrando el error del upsert si lo hay. Así sabemos si
  // la BD acepta la escritura o la rechaza en silencio (RLS, tamaño, etc.).
  if (url.searchParams.get('writetest')) {
    const stamp = 'wt' + Date.now();
    const out: any = { build: BUILD, wroteStamp: stamp };
    // (1) ¿EXISTE la fila 'ads' y cuántas hay?
    try {
      const { data: rows, error } = await supabaseAdmin.from('app_settings').select('key,value').eq('key', 'ads');
      out.ads_selectError = error ? (error.message || 'x') : null;
      out.ads_rowCount = rows ? rows.length : 0;
      out.ads_rawValue = rows && rows[0] ? (rows[0] as any).value : 'NO_ROW';
    } catch (e: any) { out.ads_selectError = 'THROW:' + (e?.message || 'x'); }
    // (2) Escribir a la fila 'ads' y releer.
    try {
      const cur: any = out.ads_rawValue && out.ads_rawValue !== 'NO_ROW' ? out.ads_rawValue : {};
      const merged = { ...cur, partnerSlotPin: { ...(cur.partnerSlotPin || {}), __TEST__: stamp } };
      const { error } = await supabaseAdmin.from('app_settings').upsert({ key: 'ads', value: merged, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      out.ads_writeError = error ? (error.message || JSON.stringify(error)) : null;
      const { data: back } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'ads');
      const bv: any = (back && back[0] && (back[0] as any).value) || {};
      out.ads_backKeys = Object.keys(bv);
      out.ads_backTest = bv.partnerSlotPin?.__TEST__ ?? null;   // === stamp si persistió
    } catch (e: any) { out.ads_writeError = 'THROW:' + (e?.message || 'x'); }
    // (3) Escribir a una CLAVE NUEVA de prueba y releer (¿persiste ALGUNA escritura?).
    try {
      const testKey = 'ads_wtest';
      const { error } = await supabaseAdmin.from('app_settings').upsert({ key: testKey, value: { stamp }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      out.newkey_writeError = error ? (error.message || 'x') : null;
      const { data: back } = await supabaseAdmin.from('app_settings').select('value').eq('key', testKey);
      out.newkey_back = back && back[0] ? (back[0] as any).value : 'NO_ROW';
      out.newkey_persisted = (out.newkey_back && out.newkey_back.stamp === stamp);   // true = las escrituras SÍ funcionan
    } catch (e: any) { out.newkey_writeError = 'THROW:' + (e?.message || 'x'); }
    // (4) ¿Hay clave de servicio configurada? (solo longitud, no la clave)
    out.hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    out.serviceKeyLen = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length;
    out.hasUrl = !!process.env.SUPABASE_URL;
    return NextResponse.json(out, noStore);
  }

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
    // Lectura CRUDA de la clave dedicada 'ads_placements' (donde v671 guarda los pines).
    let rawPlacements: any = 'n/a';
    try {
      const { data: rows } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'ads_placements');
      rawPlacements = rows && rows[0] ? (rows[0] as any).value : 'NO_ROW';
    } catch (e: any) { rawPlacements = 'ERR:' + (e?.message || 'x'); }
    // A QUÉ BASE se conecta la app (solo el host, nunca la clave). Compáralo con el
    // Project URL de tu Supabase (Settings → API). Si el "ref" difiere → es OTRA base.
    let dbHost = 'n/a';
    try { dbHost = new URL(process.env.SUPABASE_URL || '').host; } catch {}
    // A QUÉ PROYECTO pertenece la SERVICE KEY. La key es un JWT: su parte central
    // (payload) lleva en claro el "ref" del proyecto y el "role". NO exponemos el
    // secreto (la firma queda opaca). Si keyRef !== el subdominio de dbHost, la app
    // tiene la URL de un proyecto y la CLAVE de OTRO → escrituras/lecturas no cuajan.
    let keyRef = 'n/a', keyRole = 'n/a', keyProjectMatches: any = 'n/a';
    try {
      const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const payload = k.split('.')[1] || '';
      const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      keyRef = json.ref || 'no-ref';
      keyRole = json.role || 'no-role';
      const urlRef = dbHost.split('.')[0];
      keyProjectMatches = (keyRef === urlRef);   // false = URL y KEY de proyectos distintos
    } catch (e: any) { keyRef = 'DECODE_ERR:' + (e?.message || 'x'); }
    // updated_at de la fila 'ads' que LEE la app: si no coincide con el de tu panel
    // de Supabase tras el SQL, o es viejo, confirma caché o base distinta.
    let adsUpdatedAt = 'n/a';
    try {
      const { data: r2 } = await supabaseAdmin.from('app_settings').select('updated_at').eq('key', 'ads');
      adsUpdatedAt = r2 && r2[0] ? String((r2[0] as any).updated_at) : 'NO_ROW';
    } catch {}
    return NextResponse.json({
      build: BUILD,
      dbHost,          // ← host de la base que usa la app (compáralo con tu Supabase)
      keyRef,          // ← proyecto al que pertenece la SERVICE KEY
      keyRole,         // ← debe ser "service_role"
      keyProjectMatches, // ← false = URL y KEY de proyectos DISTINTOS (bug de env)
      adsUpdatedAt,    // ← cuándo se actualizó la fila 'ads' que ve la app
      rawPlacements,   // ← lo que hay en la clave dedicada de pines/fills
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
