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

let cache: Promise<Weather | null> | null = null;

export function getWeather(country?: string): Promise<Weather | null> {
  if (!cache) cache = load(country);
  return cache;
}

// Países que usan Fahrenheit en el día a día.
const FAHRENHEIT = [
  'united states', 'usa', 'us', 'estados unidos', 'eeuu', 'ee.uu', 'america',
  'puerto rico', 'pr', 'bahamas', 'belize', 'cayman', 'palau',
  'micronesia', 'marshall', 'liberia',
];
function unitFor(country?: string): WxUnit {
  const c = (country || '').trim().toLowerCase();
  if (!c) return 'C';
  return FAHRENHEIT.some((k) => c === k || c.includes(k)) ? 'F' : 'C';
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

async function load(country?: string): Promise<Weather | null> {
  try {
    let lat: number | undefined, lon: number | undefined, city: string | undefined;
    const unit = unitFor(country);

    // 1) Ubicación del navegador (con tope de 4s; si la niega, seguimos).
    const geo = await new Promise<GeolocationPosition | null>((res) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return res(null);
      let done = false;
      const ok = (p: GeolocationPosition) => { if (!done) { done = true; res(p); } };
      const no = () => { if (!done) { done = true; res(null); } };
      navigator.geolocation.getCurrentPosition(ok, no, { timeout: 4000, maximumAge: 6 * 3600 * 1000 });
      setTimeout(no, 4200);
    });
    if (geo) { lat = geo.coords.latitude; lon = geo.coords.longitude; }

    // 2) Respaldo: geocodifica el país del perfil.
    if (lat == null && country) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(country)}&count=1`).then((r) => r.json()).catch(() => null);
      const r0 = g?.results?.[0];
      if (r0) { lat = r0.latitude; lon = r0.longitude; city = r0.name; }
    }
    if (lat == null || lon == null) return null;

    const tu = unit === 'F' ? '&temperature_unit=fahrenheit' : '';
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day${tu}`).then((r) => r.json()).catch(() => null);
    const cur = w?.current;
    if (!cur || cur.temperature_2m == null) return null;
    return { temp: Math.round(cur.temperature_2m), unit, code: cur.weather_code, cond: codeToCond(cur.weather_code), city, isDay: cur.is_day !== 0 };
  } catch { return null; }
}
