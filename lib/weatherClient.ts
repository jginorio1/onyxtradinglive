// Cliente de clima (navegador). Usa Open-Meteo (gratis, sin API key, con CORS).
// Ubicación: primero geolocalización del navegador; si la niega, geocodifica el
// país del perfil. Resultado cacheado en memoria (una sola llamada por sesión).
//
// - Unidad de temperatura según el país (EE. UU., Puerto Rico, etc. → Fahrenheit;
//   el resto → Celsius).
// - is_day de Open-Meteo → de noche mostramos luna en vez de sol.

export type WxCond = 'clear' | 'clouds' | 'rain' | 'snow' | 'storm' | 'fog';
export type WxUnit = 'C' | 'F';
export type Weather = { temp: number; unit: WxUnit; code: number; cond: WxCond; city?: string; isDay: boolean };

// Caché con CADUCIDAD (antes era para siempre → el clima se congelaba toda la
// sesión). Guardamos la marca de tiempo y el país; si pasa el TTL o se pide
// forzado (refresco automático), se vuelve a pedir de verdad.
const TTL_MS = 10 * 60 * 1000; // 10 min
let cache: { at: number; country?: string; manual?: string; p: Promise<Weather | null> } | null = null;

// Ciudad manual (la elige el usuario tocando el clima). Tiene PRIORIDAD sobre la
// IP, que dentro de la app suele resolver a la ciudad del proveedor (p. ej. la
// capital) y no la del trader. Se guarda en localStorage.
const CITY_KEY = 'onyx_wx_city';
export function getManualCity(): string {
  try { return localStorage.getItem(CITY_KEY) || ''; } catch { return ''; }
}
export function setManualCity(name: string) {
  try {
    const v = (name || '').trim();
    if (v) localStorage.setItem(CITY_KEY, v); else localStorage.removeItem(CITY_KEY);
  } catch {}
  cache = null; // invalida la caché para que el próximo getWeather use la ciudad nueva
}

export function getWeather(country?: string, force = false): Promise<Weather | null> {
  const now = Date.now();
  const manual = getManualCity();
  if (!force && cache && cache.country === country && cache.manual === manual && now - cache.at < TTL_MS) return cache.p;
  const p = load(country, manual);
  cache = { at: now, country, manual, p };
  // Si falla (null), invalidamos para poder reintentar antes del TTL.
  p.then((w) => { if (!w && cache && cache.p === p) cache = null; }).catch(() => { if (cache && cache.p === p) cache = null; });
  return p;
}

// Países que usan Fahrenheit en el día a día.
// Códigos exactos (para no confundir 'us' dentro de "Mauritius", etc.).
const F_CODES = new Set(['us', 'usa', 'pr', 'bs', 'bz', 'ky', 'pw', 'fm', 'mh', 'lr']);
// Nombres completos (comparación por "incluye", ya son largos y seguros).
const F_NAMES = ['united states', 'estados unidos', 'puerto rico', 'bahamas', 'belize', 'cayman', 'palau', 'micronesia', 'marshall', 'liberia'];
function unitFor(country?: string): WxUnit {
  const c = (country || '').trim().toLowerCase();
  if (!c) return 'C';
  if (c.length <= 3) return F_CODES.has(c) ? 'F' : 'C';
  return F_NAMES.some((k) => c.includes(k)) ? 'F' : 'C';
}

function codeToCond(c: number): WxCond {
  if (c === 0 || c === 1) return 'clear';
  if (c === 2 || c === 3) return 'clouds';
  if (c === 45 || c === 48) return 'fog';
  if ([71, 73, 75, 77, 85, 86].includes(c)) return 'snow';
  if ([95, 96, 99].includes(c)) return 'storm';
  if (c >= 51 && c <= 82) return 'rain';   // llovizna, lluvia, chubascos
  return 'clouds';
}

async function load(country?: string, manual?: string): Promise<Weather | null> {
  try {
    let lat: number | undefined, lon: number | undefined, city: string | undefined;
    const unit = unitFor(country);

    // 0) Ciudad manual elegida por el usuario: tiene PRIORIDAD sobre todo lo demás.
    if (manual && manual.trim()) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(manual.trim())}&count=1&language=es`).then((r) => r.json()).catch(() => null);
      const r0 = g?.results?.[0];
      if (r0) { lat = r0.latitude; lon = r0.longitude; city = r0.name; }
    }

    // 1) Ubicación del navegador (con tope de 4s; si la niega, seguimos).
    const geo = lat != null ? null : await new Promise<GeolocationPosition | null>((res) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return res(null);
      let done = false;
      const ok = (p: GeolocationPosition) => { if (!done) { done = true; res(p); } };
      const no = () => { if (!done) { done = true; res(null); } };
      navigator.geolocation.getCurrentPosition(ok, no, { timeout: 4000, maximumAge: 6 * 3600 * 1000 });
      setTimeout(no, 4200);
    });
    if (geo) { lat = geo.coords.latitude; lon = geo.coords.longitude; }

    // 1.5) Respaldo por IP (NO pide permiso → funciona dentro de la app, donde el
    // WebView suele bloquear la geolocalización del navegador). Servicio gratis con
    // CORS. Si falla, seguimos al país del perfil.
    if (lat == null) {
      try {
        const ip = await fetch('https://ipapi.co/json/').then((r) => r.ok ? r.json() : null).catch(() => null);
        if (ip && typeof ip.latitude === 'number' && typeof ip.longitude === 'number') {
          lat = ip.latitude; lon = ip.longitude; city = ip.city || ip.region || undefined;
        }
      } catch {}
    }

    // 2) Respaldo final: geocodifica el país del perfil.
    if (lat == null && country) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(country)}&count=1`).then((r) => r.json()).catch(() => null);
      const r0 = g?.results?.[0];
      if (r0) { lat = r0.latitude; lon = r0.longitude; city = r0.name; }
    }
    if (lat == null || lon == null) return null;

    // Si la ciudad aún no se conoce (p. ej. vino de la geolocalización GPS, que no
    // trae nombre), la resolvemos con reverse-geocoding gratuito (sin API key, CORS).
    if (!city) {
      try {
        const rg = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${(country || '').toLowerCase().includes('estados') || (country || '').toLowerCase() === 'us' ? 'en' : 'es'}`).then((r) => r.json()).catch(() => null);
        city = rg?.city || rg?.locality || rg?.principalSubdivision || undefined;
      } catch {}
    }

    const tu = unit === 'F' ? '&temperature_unit=fahrenheit' : '';
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day${tu}`).then((r) => r.json()).catch(() => null);
    const cur = w?.current;
    if (!cur || cur.temperature_2m == null) return null;
    return { temp: Math.round(cur.temperature_2m), unit, code: cur.weather_code, cond: codeToCond(cur.weather_code), city, isDay: cur.is_day !== 0 };
  } catch { return null; }
}
