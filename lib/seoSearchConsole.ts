import crypto from 'crypto';

// ============================================================
// Cliente de Google Search Console (Search Analytics) con CUENTA DE SERVICIO.
// Firma un JWT con la clave privada, obtiene un token OAuth y consulta la API.
// Así el panel de Admin muestra el ranking real, las keywords top, clics,
// impresiones y páginas — dentro de Onyx, sin salir a Google.
//
// ENV necesarias (una vez):
//   GSC_CLIENT_EMAIL   = correo de la cuenta de servicio (…@…iam.gserviceaccount.com)
//   GSC_PRIVATE_KEY    = la clave privada (con \n reales o escapados)
//   GSC_SITE_URL       = la propiedad en Search Console:
//                        "sc-domain:onyxtradinglive.com" (propiedad de dominio) o
//                        "https://www.onyxtradinglive.com/" (prefijo de URL)
// La cuenta de servicio debe estar añadida como USUARIO de esa propiedad en GSC.
// ============================================================

export function gscConfigured(): boolean {
  return !!(process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY && process.env.GSC_SITE_URL);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getToken(): Promise<string | null> {
  const email = process.env.GSC_CLIENT_EMAIL;
  let key = process.env.GSC_PRIVATE_KEY || '';
  if (!email || !key) return null;
  key = key.replace(/\\n/g, '\n');   // permitir la clave con \n escapados
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  let sig: string;
  try {
    sig = b64url(crypto.createSign('RSA-SHA256').update(unsigned).sign(key));
  } catch { return null; }
  const jwt = `${unsigned}.${sig}`;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.access_token || null;
  } catch { return null; }
}

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type GscResult = {
  ok: boolean; reason?: string;
  totals?: { clicks: number; impressions: number; ctr: number; position: number };
  queries?: GscRow[];
  pages?: GscRow[];
};

// Consulta los últimos N días. Devuelve totales + top consultas + top páginas.
export async function gscOverview(days = 28): Promise<GscResult> {
  if (!gscConfigured()) return { ok: false, reason: 'not_configured' };
  const token = await getToken();
  if (!token) return { ok: false, reason: 'auth' };
  const site = process.env.GSC_SITE_URL as string;
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const base = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;

  async function q(dimensions: string[], rowLimit: number): Promise<GscRow[]> {
    const r = await fetch(base, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions, rowLimit }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.rows || []) as GscRow[];
  }

  try {
    const [totalsRows, queries, pages] = await Promise.all([
      q([], 1),
      q(['query'], 25),
      q(['page'], 25),
    ]);
    const t = totalsRows[0];
    return {
      ok: true,
      totals: t ? { clicks: t.clicks || 0, impressions: t.impressions || 0, ctr: t.ctr || 0, position: t.position || 0 } : { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      queries, pages,
    };
  } catch { return { ok: false, reason: 'error' }; }
}
