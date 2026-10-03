import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fixLink } from '@/lib/emailDestinations';

// ============================================================
// Enlaces de los correos: seguimiento (UTM) y enlace corto de marca.
//   - addUtmToHtml: añade utm_source/medium/campaign a los enlaces http(s)
//     del cuerpo (no toca variables {..}, mailto: ni enlaces ya con UTM).
//   - shortenHtmlLinks: reemplaza cada URL http(s) por una corta de marca
//     onyxtradinglive.com/r/<code> que redirige y cuenta clics (tabla short_links).
// ============================================================

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Añade parámetros UTM a cada href http(s). Seguro: no toca {{var}}, mailto ni relativos.
export function addUtmToHtml(html: string, opts?: { source?: string; medium?: string; campaign?: string }): string {
  const source = encodeURIComponent(opts?.source || 'email');
  const medium = encodeURIComponent(opts?.medium || 'email');
  const campaign = encodeURIComponent(opts?.campaign || 'email');
  return String(html || '').replace(/href=["'](https?:\/\/[^"']+)["']/gi, (m, url) => {
    const u = String(url).trim();
    if (/[?&]utm_/i.test(u)) return m;                 // ya tiene UTM
    if (/\/r\/[a-z0-9]+$/i.test(u) && u.startsWith(SITE)) return m;  // es un enlace corto nuestro
    const sep = u.includes('?') ? '&' : '?';
    return `href="${u}${sep}utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}"`;
  });
}

// Crea enlaces cortos para las URLs http(s) del HTML y los sustituye.
// Idempotente por URL dentro de un mismo envío (un code por URL distinta).
export async function shortenHtmlLinks(html: string, campaign?: string): Promise<string> {
  const s = String(html || '');
  const urls = new Set<string>();
  s.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (_m, u) => { urls.add(String(u)); return _m; });
  if (!urls.size) return s;
  const map: Record<string, string> = {};
  for (const u of urls) {
    if (u.startsWith(SITE + '/r/')) { map[u] = u; continue; }       // ya es corto
    try {
      const code = crypto.randomBytes(5).toString('hex');            // 10 chars
      const { error } = await supabaseAdmin.from('short_links').insert({ code, url: u, campaign: campaign || null });
      if (!error) map[u] = `${SITE}/r/${code}`;
    } catch { /* si falla, se deja la URL original */ }
  }
  return s.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (m, u) => (map[u] ? `href="${map[u]}"` : m));
}

// Candado final: corrige cualquier enlace roto o con dominio equivocado
// (p. ej. onyxtradingvault.com → onyxtradinglive.com, rutas relativas → absolutas,
// placeholders → la web). Deja intactos los enlaces externos legítimos.
export function normalizeButtonLinks(html: string): string {
  return String(html || '').replace(/href=["']([^"']*)["']/gi, (_m, u) => `href="${fixLink(u)}"`);
}

// Procesa el HTML de un correo según las opciones elegidas en el Centro de correos.
// SIEMPRE normaliza los enlaces primero (candado), luego UTM/acortado si se pidieron.
export async function processEmailLinks(html: string, opts?: { utm?: boolean; shorten?: boolean; campaign?: string }): Promise<string> {
  let h = String(html || '');
  if (!h) return h;
  h = normalizeButtonLinks(h);                                  // 0º candado: enlaces seguros
  const campaign = (opts?.campaign || 'email').slice(0, 60);
  if (opts?.utm) h = addUtmToHtml(h, { campaign });             // 1º UTM sobre la URL real
  if (opts?.shorten) h = await shortenHtmlLinks(h, campaign);   // 2º acortar (redirige a la URL con UTM)
  return h;
}
