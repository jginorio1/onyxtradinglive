// Geolocalización aproximada por IP desde las cabeceras que Vercel ya añade en
// cada petición (gratis, sin pedirle nada al cliente). Si no estamos en Vercel o
// no vienen las cabeceras, devuelve vacío. País = código ISO de 2 letras (MX, CO…).
export function reqGeo(req: Request): { country: string; city: string } {
  try {
    const h = req.headers;
    const country = (h.get('x-vercel-ip-country') || '').trim().toUpperCase().slice(0, 2);
    let city = (h.get('x-vercel-ip-city') || '').trim();
    try { city = decodeURIComponent(city); } catch {}
    return { country: /^[A-Z]{2}$/.test(country) ? country : '', city: city.slice(0, 80) };
  } catch { return { country: '', city: '' }; }
}

// Emoji de bandera a partir del código ISO de país (MX → 🇲🇽). '' si no hay código.
export function flagEmoji(cc: string): string {
  const c = String(cc || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
