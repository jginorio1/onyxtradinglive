// ============================================================
// Lead source: de dónde viene cada cliente/ticket.
// Captura UTM (utm_source/medium/campaign) + referrer + página de entrada, y
// deriva una FUENTE normalizada (web, facebook, instagram, google, whatsapp,
// email, youtube, tiktok, ads, referral, direct). Funciona en el navegador y es
// "first-touch": guarda la primera atribución en localStorage para no perderla.
// ============================================================

export type Attribution = {
  source: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing?: string;
};

const HOST_SOURCE: Array<[RegExp, string]> = [
  [/facebook\.|fb\.|fbclid/i, 'facebook'],
  [/instagram\.|igsh/i, 'instagram'],
  [/(^|\.)google\.|gclid/i, 'google'],
  [/(^|\.)bing\./i, 'bing'],
  [/youtube\.|youtu\.be/i, 'youtube'],
  [/tiktok\./i, 'tiktok'],
  [/(wa\.me|whatsapp)/i, 'whatsapp'],
  [/t\.me|telegram/i, 'telegram'],
  [/(x\.com|twitter\.)/i, 'twitter'],
  [/linkedin\./i, 'linkedin'],
  [/reddit\./i, 'reddit'],
];

// Normaliza a una fuente a partir de utm_source + referrer. El UTM manda; si no
// hay, se deduce del dominio de origen; si viene de nuestro propio sitio o no hay
// referrer, es 'web' (navegación directa dentro del sitio) o 'direct'.
export function deriveSource(opts: { utmSource?: string; utmMedium?: string; referrer?: string; selfHost?: string }): string {
  const u = (opts.utmSource || '').toLowerCase().trim();
  if (u) {
    for (const [re, name] of HOST_SOURCE) if (re.test(u)) return name;
    if (/(cpc|ppc|ads?|paid)/i.test(opts.utmMedium || '') || /ads?$/i.test(u)) return 'ads';
    if (/email|newsletter|mail/i.test(u + ' ' + (opts.utmMedium || ''))) return 'email';
    if (/referr?al|partner|afili/i.test(opts.utmMedium || '')) return 'referral';
    return u.slice(0, 24);   // una fuente explícita que no mapeamos: úsala tal cual
  }
  const ref = (opts.referrer || '').toLowerCase();
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).host.toLowerCase();
    if (opts.selfHost && host.includes(opts.selfHost.toLowerCase())) return 'web';
    for (const [re, name] of HOST_SOURCE) if (re.test(host)) return name;
    return 'web';   // llegó de otra web que no reconocemos
  } catch { return 'direct'; }
}

const LS_KEY = 'onyx_attr';

// Lee la URL + referrer actuales y arma la atribución. Guarda la PRIMERA vez
// (first-touch) para que, aunque el cliente navegue, sepamos de dónde entró.
export function captureAttribution(): Attribution {
  try {
    const sp = new URLSearchParams(window.location.search);
    const utm_source = sp.get('utm_source') || undefined;
    const utm_medium = sp.get('utm_medium') || undefined;
    const utm_campaign = sp.get('utm_campaign') || undefined;
    const ref = document.referrer || '';
    const selfHost = (window.location.host || '').replace(/^www\./, '').split('.').slice(-2, -1)[0] || window.location.host;
    const landing = (window.location.pathname || '/').slice(0, 120);
    const fresh: Attribution = {
      source: deriveSource({ utmSource: utm_source, utmMedium: utm_medium, referrer: ref, selfHost }),
      utm_source, utm_medium, utm_campaign, landing,
    };
    const prev = readStored();
    // Si ya hay una atribución guardada con fuente real (no direct/web), la conservamos.
    if (prev && prev.source && !['direct', 'web'].includes(prev.source)) return prev;
    // Si la nueva es informativa (trae UTM o fuente real), la guardamos.
    if (fresh.utm_source || !['direct', 'web'].includes(fresh.source) || !prev) {
      try { window.localStorage.setItem(LS_KEY, JSON.stringify(fresh)); } catch {}
      return fresh;
    }
    return prev;
  } catch { return { source: 'direct' }; }
}

function readStored(): Attribution | null {
  try { const raw = window.localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// Para enviar con el lead/ticket. Captura si hace falta.
export function readAttribution(): Attribution {
  return readStored() || captureAttribution();
}
