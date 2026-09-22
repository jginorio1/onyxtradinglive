import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getSetting, saveSetting } from '@/lib/settings';

// ============================================================
// Espacios patrocinados (Ads) · Fase 1 (solo web)
//
// - Los SLOTS (ubicaciones) se definen aquí; el PRECIO de cada uno lo pone el
//   dueño (por ubicación + tamaño) y se guarda como override en app_settings.
// - Un anuncio por slot a la vez, elegido por rotación ponderada entre las
//   campañas activas. Si no hay ninguna pagada, se muestra un "house ad" propio
//   (mejora a Pro, etc.) para no desperdiciar el espacio.
// - A los usuarios de PAGO no se les muestran anuncios (gancho de upgrade).
// - En la app NATIVA los anuncios van APAGADOS hasta que Apple/Google aprueben
//   (por CSS .native-app y por el flag nativeEnabled).
// ============================================================

export type AdSlot = {
  key: string; es: string; en: string; size: string;   // ej. '728x90'
  page: 'blog' | 'article' | 'landing' | 'guide';
  unit: 'week' | 'month' | 'cpm';                        // unidad de cobro por defecto
  price: number;                                         // precio por defecto (USD)
};

// Catálogo de ubicaciones (Fase 1, web). Añadir más es trivial.
export const AD_SLOTS: AdSlot[] = [
  { key: 'blog_top',         es: 'Blog · Leaderboard superior', en: 'Blog · Top leaderboard',  size: '970x90',  page: 'blog',    unit: 'week',  price: 60 },
  { key: 'blog_infeed',      es: 'Blog · Tarjeta entre posts',  en: 'Blog · In-feed card',      size: '600x300', page: 'blog',    unit: 'week',  price: 45 },
  { key: 'article_incontent',es: 'Artículo · Dentro del texto', en: 'Article · In-content',     size: '728x90',  page: 'article', unit: 'week',  price: 50 },
  { key: 'article_sidebar',  es: 'Artículo · Lateral (MPU)',    en: 'Article · Sidebar (MPU)',  size: '300x250', page: 'article', unit: 'month', price: 120 },
  { key: 'landing_top',      es: 'Landing · Leaderboard',       en: 'Landing · Leaderboard',    size: '970x90',  page: 'landing', unit: 'week',  price: 90 },
];
export const slotByKey = (k: string) => AD_SLOTS.find((s) => s.key === k) || null;

export type AdsConfig = { enabled: boolean; nativeEnabled: boolean; rates: Record<string, { price: number; unit: AdSlot['unit'] }> };
const DEFAULT_CFG: AdsConfig = { enabled: true, nativeEnabled: false, rates: {} };

export async function getAdsConfig(): Promise<AdsConfig> {
  const c = await getSetting<AdsConfig>('ads', DEFAULT_CFG);
  return { enabled: c.enabled !== false, nativeEnabled: c.nativeEnabled === true, rates: c.rates || {} };
}
export async function saveAdsConfig(c: Partial<AdsConfig>) {
  const prev = await getAdsConfig();
  await saveSetting('ads', { ...prev, ...c });
}

// Tarifario efectivo: catálogo + los precios que el dueño haya sobrescrito.
export async function rateCard() {
  const cfg = await getAdsConfig();
  return AD_SLOTS.map((s) => {
    const o = cfg.rates[s.key];
    return { ...s, price: o?.price ?? s.price, unit: o?.unit ?? s.unit };
  });
}

// ¿El visitante actual paga? (a los de pago NO se les muestran anuncios).
export async function viewerIsPaid(): Promise<boolean> {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const plan = (data as any)?.plan;
    return !!plan && plan !== 'free';
  } catch { return false; }
}

export type ServedAd =
  | { kind: 'paid'; id: string; creative: string; link: string; alt: string; size: string }
  | { kind: 'house'; id: string; size: string }
  | null;

// Elige el anuncio a mostrar en un slot: una campaña pagada activa (rotación
// ponderada) o, si no hay, un house ad. Devuelve null si el slot no existe.
export async function pickAd(slotKey: string, lang: 'es' | 'en'): Promise<ServedAd> {
  const slot = slotByKey(slotKey);
  if (!slot) return null;
  try {
    const nowIso = new Date().toISOString();
    const { data } = await supabaseAdmin.from('ad_campaigns')
      .select('id,creative_url,link_url,alt,weight,lang,starts_at,ends_at')
      .eq('slot_key', slotKey).eq('status', 'active')
      .or(`lang.eq.all,lang.eq.${lang}`)
      .limit(50);
    const live = (data || []).filter((c: any) =>
      (!c.starts_at || c.starts_at <= nowIso) && (!c.ends_at || c.ends_at >= nowIso) && c.creative_url && c.link_url);
    if (live.length) {
      // Rotación ponderada.
      const total = live.reduce((s: number, c: any) => s + Math.max(1, c.weight || 1), 0);
      let r = Math.random() * total;
      for (const c of live) { r -= Math.max(1, c.weight || 1); if (r <= 0) return { kind: 'paid', id: c.id, creative: c.creative_url, link: c.link_url, alt: c.alt || '', size: slot.size }; }
      const c = live[0]; return { kind: 'paid', id: c.id, creative: c.creative_url, link: c.link_url, alt: c.alt || '', size: slot.size };
    }
  } catch {}
  // Sin campaña pagada → house ad (relleno propio).
  return { kind: 'house', id: 'house', size: slot.size };
}

// Registro atómico de impresión/clic (best-effort, nunca lanza).
export async function bumpAd(id: string, kind: 'impression' | 'click') {
  if (!id || id === 'house') return;
  try { await supabaseAdmin.rpc('ad_bump', { p_id: id, p_kind: kind }); } catch {}
}
