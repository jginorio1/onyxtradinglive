import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getSetting, saveSetting } from '@/lib/settings';
import crypto from 'crypto';

// ============================================================
// Onyx Ads · motor de monetización (Fases 1–6)
//
//  · Inventario con formatos IAB (F4).
//  · Control de artes: se suben a NUESTRO storage y requieren APROBACIÓN
//    humana antes de salir live; el arte queda congelado (F3).
//  · Geo por país + tier 1/2/3 + exclusiones de compliance (F4).
//  · Modelos flat/CPM/CPC/CPA con pacing y presupuesto (F5).
//  · Antifraude: dedupe por visitante + filtro de bots (F5).
//  · Relleno programático cuando no hay campaña pagada (F6).
//  · A los usuarios de PAGO no se les muestran anuncios (gancho de upgrade).
//  · En la app NATIVA los anuncios van APAGADOS hasta aprobación de tiendas.
// ============================================================

export type PricingModel = 'flat' | 'cpm' | 'cpc' | 'cpa';

export type AdSlot = {
  key: string; es: string; en: string; size: string;   // ej. '728x90' (IAB)
  page: 'blog' | 'article' | 'landing' | 'guide' | 'site' | 'directory' | 'email';
  unit: 'week' | 'month' | 'cpm';                        // unidad por defecto del plano
  price: number;                                         // precio por defecto (USD)
  model?: PricingModel;                                  // modelo sugerido
  fmt?: string;                                          // nombre IAB legible
};

// Catálogo de tamaños estándar IAB (referencia para el anunciante).
export const IAB_SIZES: { size: string; es: string; en: string; maxKB: number }[] = [
  { size: '970x250', es: 'Billboard', en: 'Billboard', maxKB: 200 },
  { size: '970x90',  es: 'Súper leaderboard', en: 'Large leaderboard', maxKB: 150 },
  { size: '728x90',  es: 'Leaderboard', en: 'Leaderboard', maxKB: 150 },
  { size: '300x250', es: 'Rectángulo (MPU)', en: 'Medium rectangle (MPU)', maxKB: 150 },
  { size: '300x600', es: 'Media página', en: 'Half-page', maxKB: 200 },
  { size: '320x50',  es: 'Banner móvil', en: 'Mobile banner', maxKB: 60 },
  { size: '320x100', es: 'Banner móvil grande', en: 'Large mobile banner', maxKB: 80 },
  { size: '600x300', es: 'Tarjeta in-feed', en: 'In-feed card', maxKB: 150 },
];
export const sizeInfo = (size: string) => IAB_SIZES.find((s) => s.size === size) || { size, es: size, en: size, maxKB: 150 };

// Catálogo de ubicaciones. Fase 1: blog/artículo. Fase 4 añade footer site-wide,
// sticky inferior, media página, native in-feed, billboard de landing y directorio.
export const AD_SLOTS: AdSlot[] = [
  // --- Fase 1 ---
  { key: 'blog_top',          es: 'Blog · Leaderboard superior', en: 'Blog · Top leaderboard',  size: '970x90',  page: 'blog',    unit: 'week',  price: 60,  model: 'flat', fmt: 'Súper leaderboard' },
  { key: 'blog_infeed',       es: 'Blog · Tarjeta entre posts',  en: 'Blog · In-feed card',      size: '600x300', page: 'blog',    unit: 'week',  price: 45,  model: 'flat', fmt: 'In-feed' },
  { key: 'article_incontent', es: 'Artículo · Dentro del texto', en: 'Article · In-content',     size: '728x90',  page: 'article', unit: 'week',  price: 50,  model: 'flat', fmt: 'Leaderboard' },
  { key: 'article_sidebar',   es: 'Artículo · Lateral vertical',  en: 'Article · Vertical sidebar', size: '300x600', page: 'article', unit: 'month', price: 150, model: 'flat', fmt: 'Half-page' },
  { key: 'landing_top',       es: 'Landing · Leaderboard',       en: 'Landing · Leaderboard',    size: '970x90',  page: 'landing', unit: 'week',  price: 90,  model: 'flat', fmt: 'Súper leaderboard' },
  // --- Fase 4: inventario nuevo ---
  { key: 'landing_billboard', es: 'Landing · Billboard superior',en: 'Landing · Top billboard',  size: '970x250', page: 'landing', unit: 'week',  price: 140, model: 'cpm',  fmt: 'Billboard' },
  { key: 'footer_site',       es: 'Sitio · Footer global',       en: 'Site · Global footer',     size: '728x90',  page: 'site',    unit: 'week',  price: 70,  model: 'flat', fmt: 'Leaderboard' },
  { key: 'sticky_bottom',     es: 'Sitio · Barra sticky inferior',en: 'Site · Sticky bottom bar', size: '320x50',  page: 'site',    unit: 'week',  price: 110, model: 'cpc',  fmt: 'Sticky móvil' },
  { key: 'article_halfpage',  es: 'Artículo · Media página',     en: 'Article · Half-page',      size: '300x600', page: 'article', unit: 'month', price: 180, model: 'cpm',  fmt: 'Half-page' },
  { key: 'blog_native',       es: 'Blog · Native destacado',     en: 'Blog · Native featured',   size: '600x300', page: 'blog',    unit: 'week',  price: 75,  model: 'flat', fmt: 'Native' },
  { key: 'directory_partner', es: 'Directorio · Partner destacado',en: 'Directory · Featured partner', size: '600x300', page: 'directory', unit: 'month', price: 250, model: 'cpa', fmt: 'Listing' },
];
export const slotByKey = (k: string) => AD_SLOTS.find((s) => s.key === k) || null;

// --- Geo por tier (Tier-1 paga mucho más; compliance por país) --------------
export const GEO_TIERS: Record<string, string[]> = {
  t1: ['US', 'CA', 'GB', 'AU', 'DE', 'CH', 'NZ', 'SG', 'AE', 'NL', 'SE', 'NO'],
  t2: ['ES', 'FR', 'IT', 'PT', 'BR', 'MX', 'PL', 'JP', 'KR', 'ZA', 'IE', 'BE', 'AT'],
  t3: ['IN', 'PH', 'VN', 'ID', 'NG', 'PK', 'EG', 'CO', 'AR', 'PE', 'CL', 'TR', 'MA'],
};
export const tierOf = (country: string): 't1' | 't2' | 't3' | '' => {
  const c = (country || '').toUpperCase();
  if (GEO_TIERS.t1.includes(c)) return 't1';
  if (GEO_TIERS.t2.includes(c)) return 't2';
  if (GEO_TIERS.t3.includes(c)) return 't3';
  return '';
};

export type AdsConfig = {
  enabled: boolean;
  nativeEnabled: boolean;
  rates: Record<string, { price: number; unit: AdSlot['unit'] }>;
  autoApprove: boolean;                 // si true, se salta la revisión (no recomendado)
  programmatic: { enabled: boolean; code: string };  // relleno de red (F6)
  riskDisclaimer: { es: string; en: string };        // aviso financiero
  freqCap: number;                       // impresiones máx por visitante/campaña/día (0 = sin tope)
  partnerFill: boolean;                  // rellenar huecos vacíos con socios del directorio (CPA) en vez del house ad de Pro
  partnerFillSlots: Record<string, boolean>; // override por ubicación: true/false gana sobre partnerFill; sin valor = usa el global
  partnerSlotPin: Record<string, string>;    // partner FIJO por ubicación (id del ad_partners); sin valor = rotar todos
  // --- Reserva de espacios por cupo fijo (v6) ---
  caps: Record<string, number>;          // cupo (máx anunciantes rotando) por slot_key; editable en admin
  defaultCap: number;                    // cupo por defecto para slots sin valor propio
  spaceCommissionPct: number;            // % del VENDEDOR directo sobre el espacio vendido
  spaceOv1Pct: number | null;            // % override Líder N1 para espacios; null = usa el global de Ventas
  spaceOv2Pct: number | null;            // % override Director N2 para espacios; null = usa el global de Ventas
  holdMinutes: number;                   // minutos que una pre-reserva sin pagar bloquea el cupo
  maturationDays: number;                // días que la comisión queda "en espera" antes de estar disponible
  // --- Cotización / propuesta de espacios (editable + validez) ---
  quoteValidityDays: number;             // días que vale la cotización (para la fecha "válida hasta")
  quoteTemplate: { es: QuoteTpl; en: QuoteTpl };  // plantilla por secciones, editable en admin, por idioma
};

// Plantilla de la propuesta de banners: cada campo es texto editable con
// variables tipo {advertiser}, {seller}, {slot}, {price}, {validUntil}, etc.
// includes/whyOnyx son varias líneas (una por viñeta).
export type QuoteTpl = {
  intro: string;         // párrafo de saludo/introducción
  includes: string;      // "qué incluye" (una viñeta por línea)
  whyOnyx: string;       // "por qué Onyx" (una viñeta por línea)
  terms: string;         // términos y condiciones (párrafo)
  validityNote: string;  // nota de validez (usa {validUntil})
  closing: string;       // cierre / firma
};

export const DEFAULT_QUOTE_TPL: { es: QuoteTpl; en: QuoteTpl } = {
  es: {
    intro: 'Hola {advertiser}, gracias por tu interés en anunciarte en Onyx Trading Live. A continuación tienes la propuesta para el espacio {slot} ({size}) en la sección {page}, con todo lo que incluye y el detalle de fechas y precio.',
    includes: 'Banner mostrado en el espacio durante todo el rango de fechas\nEncendido automático el día de inicio y apagado al terminar\nReporte de impresiones y clics\nArte en el tamaño IAB exacto, sujeto a una revisión rápida',
    whyOnyx: 'Audiencia de traders reales y activos (forex y prop firms)\nTarifa plana: sin costo por clic ni sorpresas\nEspacio premium, bien visible en la sección elegida\nAcompañamiento de tu asesor Onyx en todo el proceso',
    terms: 'El pago se realiza por adelantado. Al confirmar y pagar, reservamos el espacio para las fechas exactas y se activa automáticamente el día de inicio; se apaga solo al finalizar. El arte queda sujeto a una revisión rápida de calidad.',
    validityNote: 'Esta propuesta es válida hasta el {validUntil}. Después de esa fecha los precios y la disponibilidad pueden cambiar.',
    closing: 'Quedamos atentos a cualquier duda.\n{seller} · Onyx Trading Live',
  },
  en: {
    intro: 'Hi {advertiser}, thank you for your interest in advertising on Onyx Trading Live. Below is the proposal for the {slot} placement ({size}) in the {page} section, with everything it includes and the dates and price.',
    includes: 'Banner shown across the placement for the full date range\nAutomatic go-live on the start date and auto-pause at the end\nImpression and click reporting\nCreative in the exact IAB size, subject to a quick review',
    whyOnyx: 'Real, active trader audience (forex and prop firms)\nFlat rate: no cost per click, no surprises\nPremium, highly visible spot in the chosen section\nSupport from your Onyx rep throughout the process',
    terms: 'Payment is made in advance. Once you confirm and pay, we reserve the space for the exact dates and it goes live automatically on the start date; it turns off by itself at the end. Creative is subject to a quick quality review.',
    validityNote: 'This proposal is valid until {validUntil}. After that date, pricing and availability may change.',
    closing: 'We are happy to answer any questions.\n{seller} · Onyx Trading Live',
  },
};
const DEFAULT_CFG: AdsConfig = {
  enabled: true, nativeEnabled: false, rates: {}, autoApprove: false,
  programmatic: { enabled: false, code: '' },
  riskDisclaimer: {
    es: 'Los productos de trading apalancado conllevan alto riesgo de pérdida. Este anuncio no es asesoría de inversión.',
    en: 'Leveraged trading products carry a high risk of loss. This ad is not investment advice.',
  },
  freqCap: 3,
  partnerFill: true,
  partnerFillSlots: {},
  partnerSlotPin: {},
  caps: {}, defaultCap: 4, spaceCommissionPct: 15, spaceOv1Pct: 5, spaceOv2Pct: 3, holdMinutes: 45, maturationDays: 21,
  quoteValidityDays: 15, quoteTemplate: DEFAULT_QUOTE_TPL,
};

export async function getAdsConfig(): Promise<AdsConfig> {
  const c = await getSetting<Partial<AdsConfig>>('ads', DEFAULT_CFG);
  return {
    enabled: c.enabled !== false,
    nativeEnabled: c.nativeEnabled === true,
    rates: c.rates || {},
    autoApprove: c.autoApprove === true,
    programmatic: { enabled: c.programmatic?.enabled === true, code: c.programmatic?.code || '' },
    riskDisclaimer: { es: c.riskDisclaimer?.es || DEFAULT_CFG.riskDisclaimer.es, en: c.riskDisclaimer?.en || DEFAULT_CFG.riskDisclaimer.en },
    freqCap: typeof c.freqCap === 'number' ? c.freqCap : DEFAULT_CFG.freqCap,
    partnerFill: c.partnerFill !== false,
    partnerFillSlots: c.partnerFillSlots && typeof c.partnerFillSlots === 'object' ? c.partnerFillSlots : {},
    partnerSlotPin: c.partnerSlotPin && typeof c.partnerSlotPin === 'object' ? c.partnerSlotPin : {},
    caps: c.caps && typeof c.caps === 'object' ? c.caps : {},
    defaultCap: typeof c.defaultCap === 'number' && c.defaultCap > 0 ? c.defaultCap : DEFAULT_CFG.defaultCap,
    spaceCommissionPct: typeof c.spaceCommissionPct === 'number' ? c.spaceCommissionPct : DEFAULT_CFG.spaceCommissionPct,
    // null explícito = "vaciado a propósito" → hereda el override global de Ventas.
    // undefined (nunca configurado) = usa el default individual de banners (5%/3%).
    spaceOv1Pct: c.spaceOv1Pct === null ? null : (typeof c.spaceOv1Pct === 'number' ? c.spaceOv1Pct : DEFAULT_CFG.spaceOv1Pct),
    spaceOv2Pct: c.spaceOv2Pct === null ? null : (typeof c.spaceOv2Pct === 'number' ? c.spaceOv2Pct : DEFAULT_CFG.spaceOv2Pct),
    holdMinutes: typeof c.holdMinutes === 'number' && c.holdMinutes >= 0 ? c.holdMinutes : DEFAULT_CFG.holdMinutes,
    maturationDays: typeof c.maturationDays === 'number' && c.maturationDays >= 0 ? c.maturationDays : DEFAULT_CFG.maturationDays,
    quoteValidityDays: typeof c.quoteValidityDays === 'number' && c.quoteValidityDays > 0 ? c.quoteValidityDays : DEFAULT_CFG.quoteValidityDays,
    quoteTemplate: {
      es: { ...DEFAULT_QUOTE_TPL.es, ...(c.quoteTemplate?.es || {}) },
      en: { ...DEFAULT_QUOTE_TPL.en, ...(c.quoteTemplate?.en || {}) },
    },
  };
}

// Sustituye variables {var} en una plantilla con los datos reales. Se usa en el
// PDF y en el correo; el editor del admin replica la misma sustitución para la
// vista previa en vivo.
export function fillQuoteVars(text: string, vars: Record<string, string>): string {
  return String(text || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
}
export async function saveAdsConfig(c: Partial<AdsConfig>) {
  const prev = await getAdsConfig();
  await saveSetting('ads', { ...prev, ...c });
}

// Tarifario efectivo: catálogo + precios sobrescritos por el dueño.
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
  | { kind: 'paid'; id: string; creative: string; link: string; alt: string; size: string; disclaimer?: string }
  | { kind: 'partner'; id: string; name: string; logo: string; banner: string; blurb: string; link: string; size: string }
  | { kind: 'house'; id: string; size: string }
  | { kind: 'programmatic'; id: 'net'; size: string; code: string }
  | null;

// ¿La campaña apunta al país/tier del visitante? Respeta exclusiones de compliance.
function geoMatch(geo: string, tier: string, exclude: string, country: string): boolean {
  const c = (country || '').toUpperCase();
  const ex = String(exclude || '').split(/[,\s]+/).filter(Boolean).map((x) => x.toUpperCase());
  if (c && ex.includes(c)) return false; // excluido por compliance
  const g = String(geo || 'all').trim().toLowerCase();
  const t = String(tier || '').trim().toLowerCase();
  const hasGeo = g && g !== 'all';
  const hasTier = t && ['t1', 't2', 't3'].includes(t);
  if (!hasGeo && !hasTier) return true;            // sin restricción → todos
  if (!c) return true;                              // sin país → no excluimos
  if (hasGeo && g.split(/[,\s]+/).filter(Boolean).includes(c.toLowerCase())) return true;
  if (hasTier && tierOf(c) === t) return true;
  return false;
}

export const deviceFromUA = (ua: string): 'mobile' | 'desktop' =>
  /Mobi|Android|iPhone|iPad|iPod/i.test(ua || '') ? 'mobile' : 'desktop';
const deviceOf = deviceFromUA;

// Hash de visitante (IP+UA) sin PII, para dedupe antifraude.
export function visitorHash(ip: string, ua: string): string {
  return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 24);
}
const isBot = (ua: string) => /bot|crawler|spider|crawl|slurp|headless|preview|facebookexternalhit/i.test(ua || '');

// Elige el anuncio a mostrar en un slot: campaña pagada APROBADA y activa
// (rotación ponderada, filtrada por idioma, país/tier, dispositivo y pacing),
// o house ad, o relleno programático.
// Marca de un anuncio = dominio de su enlace (o del creativo). Sirve para NO mostrar
// dos anuncios de la MISMA marca pegados aunque sean campañas distintas (p.ej. dos de Axi).
function brandOf(c: any): string {
  const src = String(c?.link_url || c?.creative_url || c?.alt || '');
  try { const h = new URL(src.startsWith('http') ? src : 'https://' + src).hostname.replace(/^www\./, ''); const p = h.split('.'); return (p.length > 2 ? p.slice(-2).join('.') : h) || src; }
  catch { return src.toLowerCase().slice(0, 40); }
}

// Reordena una lista intercalando por marca (round-robin) para que NO haya dos
// elementos de la misma marca seguidos. Respeta el peso: cada campaña aparece 'weight'
// veces antes de intercalar.
function diversify(list: any[]): any[] {
  const byBrand = new Map<string, any[]>();
  for (const c of list) {
    const w = Math.max(1, Math.min(10, Number(c.weight) || 1));
    const b = brandOf(c);
    if (!byBrand.has(b)) byBrand.set(b, []);
    for (let i = 0; i < w; i++) byBrand.get(b)!.push(c);
  }
  const queues = Array.from(byBrand.values());
  const out: any[] = [];
  let any = true;
  while (any) {
    any = false;
    for (const q of queues) { if (q.length) { out.push(q.shift()); any = true; } }
  }
  return out;
}

export async function pickAd(
  slotKey: string,
  lang: 'es' | 'en',
  ctx: { country?: string; ua?: string; pos?: number } = {},
): Promise<ServedAd> {
  const pos = Math.max(0, Number(ctx.pos) || 0);
  const slot = slotByKey(slotKey);
  if (!slot) return null;
  const country = (ctx.country || '').toUpperCase();
  const dev = deviceOf(ctx.ua || '');
  const cfg = await getAdsConfig();
  try {
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const { data } = await supabaseAdmin.from('ad_campaigns')
      .select('id,creative_url,link_url,alt,weight,lang,geo,geo_tier,geo_exclude,device,disclaimer,starts_at,ends_at,pricing_model,budget,spent,daily_cap,spent_today,spent_day')
      .eq('slot_key', slotKey).eq('status', 'active')       // solo APROBADAS (status active)
      .or(`lang.eq.all,lang.eq.${lang}`)
      .limit(60);
    const live = (data || []).filter((c: any) => {
      if (!(c.creative_url && c.link_url)) return false;
      if (c.starts_at && c.starts_at > nowIso) return false;
      if (c.ends_at && c.ends_at < nowIso) return false;
      if (c.device && c.device !== 'all' && c.device !== dev) return false;
      if (!geoMatch(c.geo, c.geo_tier, c.geo_exclude, country)) return false;
      // Pacing: presupuesto total y tope diario (para cpm/cpc/cpa).
      if (c.pricing_model && c.pricing_model !== 'flat') {
        if (Number(c.budget) > 0 && Number(c.spent) >= Number(c.budget)) return false;
        const st = c.spent_day === today ? Number(c.spent_today || 0) : 0;
        if (Number(c.daily_cap) > 0 && st >= Number(c.daily_cap)) return false;
      }
      return true;
    });
    if (live.length) {
      // Rotación DETERMINISTA por posición del hueco (pos) + marca diversificada:
      // huecos seguidos en la misma página caen en posiciones distintas de la lista
      // intercalada por marca → nunca dos anuncios de la misma marca pegados. Rota
      // cada ~10 min para que con el tiempo cambien. (Antes era aleatorio por hueco).
      const order = diversify(live);
      const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
      const chosen = order[(bucket + pos) % order.length] || live[0];
      const disc = chosen.disclaimer ? (lang === 'es' ? cfg.riskDisclaimer.es : cfg.riskDisclaimer.en) : undefined;
      return { kind: 'paid', id: chosen.id, creative: chosen.creative_url, link: chosen.link_url, alt: chosen.alt || '', size: slot.size, disclaimer: disc };
    }
  } catch {}
  // Sin campaña pagada → primero un socio del directorio (CPA), si está activado
  // PARA ESTA UBICACIÓN. El override por hueco (partnerFillSlots) manda sobre el
  // global: así el dueño elige en qué espacios salen partners y en cuáles no.
  const slotFill = cfg.partnerFillSlots ? cfg.partnerFillSlots[slotKey] : undefined;
  const doPartnerFill = (slotFill === true || slotFill === false) ? slotFill : cfg.partnerFill;
  if (doPartnerFill) {
    try {
      const { data: parts } = await supabaseAdmin.from('ad_partners')
        .select('id,name,logo_url,banner_url,blurb_es,blurb_en,geo').eq('status', 'active').limit(50);
      // Orden estable (por id) para que la rotación sea consistente entre huecos.
      const live = (parts || []).filter((p: any) => geoMatch(p.geo, '', '', country))
        .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
      if (live.length) {
        const asPartner = (p: any) => ({ kind: 'partner' as const, id: p.id, name: p.name, logo: p.logo_url || '', banner: p.banner_url || '', blurb: (lang === 'es' ? p.blurb_es : p.blurb_en) || '', link: `/api/ads/partner?id=${p.id}`, size: slot.size });
        // Partner FIJADO para esta ubicación: si el dueño eligió uno concreto y sigue
        // activo (y coincide geo), ese sale siempre en este hueco (sin rotar).
        const pinId = cfg.partnerSlotPin ? cfg.partnerSlotPin[slotKey] : '';
        if (pinId) {
          const pinned = live.find((p: any) => String(p.id) === String(pinId));
          if (pinned) return asPartner(pinned);
          // Si el fijado ya no está activo/geo, cae a rotación (no dejamos el hueco vacío).
        }
        // Rotación por hueco: cada slot arranca en un socio distinto (hash del slot)
        // y todo rota con el tiempo (cada 12 min). Así en una misma página no se
        // repite el mismo banner en huecos seguidos, y con el tiempo van cambiando.
        let h = 0; for (let i = 0; i < slotKey.length; i++) h = (h * 31 + slotKey.charCodeAt(i)) >>> 0;
        const bucket = Math.floor(Date.now() / (12 * 60 * 1000)); // cambia cada 12 min
        // + pos: dos huecos seguidos en la misma página NO muestran el mismo socio.
        const p = live[(h + bucket + pos) % live.length];
        return asPartner(p);
      }
    } catch {}
  }
  // Si no hay socios → relleno programático (si está activo) o house ad de Pro.
  if (cfg.programmatic.enabled && cfg.programmatic.code.trim()) {
    return { kind: 'programmatic', id: 'net', size: slot.size, code: cfg.programmatic.code };
  }
  return { kind: 'house', id: 'house', size: slot.size };
}

// Registro atómico de impresión/clic (best-effort, nunca lanza).
export async function bumpAd(id: string, kind: 'impression' | 'click') {
  if (!id || id === 'house' || id === 'net') return;
  try { await supabaseAdmin.rpc('ad_bump', { p_id: id, p_kind: kind }); } catch {}
}

// ¿Ya contamos una impresión de esta campaña para este visitante hoy? (dedupe).
export async function dedupeImpression(campaignId: string, visitor: string, ua: string): Promise<boolean> {
  if (isBot(ua)) return false;                 // los bots no cuentan
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { error } = await supabaseAdmin.from('ad_impression_log')
      .insert({ campaign_id: campaignId, visitor, day });
    if (error) return false;                    // choque de unique → ya contada hoy
    return true;
  } catch { return false; }
}

// Suma al rollup diario + al gasto de la campaña según su modelo.
export async function recordEvent(
  campaignId: string,
  ev: 'impression' | 'view' | 'click' | 'conversion',
  ctx: { country?: string; device?: string } = {},
) {
  const day = new Date().toISOString().slice(0, 10);
  const country = (ctx.country || '').toUpperCase();
  const device = ctx.device || 'all';
  try {
    const { data: c } = await supabaseAdmin.from('ad_campaigns')
      .select('pricing_model,price,spent,spent_today,spent_day,conversions').eq('id', campaignId).maybeSingle();
    const model = (c as any)?.pricing_model || 'flat';
    let spend = 0;
    if (model === 'cpm' && ev === 'impression') spend = Number((c as any)?.price || 0) / 1000;
    if (model === 'cpc' && ev === 'click') spend = Number((c as any)?.price || 0);
    if (model === 'cpa' && ev === 'conversion') spend = Number((c as any)?.price || 0);
    await supabaseAdmin.rpc('ad_stat_bump', {
      p_campaign: campaignId, p_day: day, p_country: country, p_device: device,
      p_imp: ev === 'impression' ? 1 : 0, p_view: ev === 'view' ? 1 : 0,
      p_click: ev === 'click' ? 1 : 0, p_conv: ev === 'conversion' ? 1 : 0, p_spend: spend,
    });
    if (spend > 0 || ev === 'conversion') {
      const st = (c as any)?.spent_day === day ? Number((c as any)?.spent_today || 0) : 0;
      await supabaseAdmin.from('ad_campaigns').update({
        spent: Number((c as any)?.spent || 0) + spend,
        spent_today: st + spend, spent_day: day,
        conversions: Number((c as any)?.conversions || 0) + (ev === 'conversion' ? 1 : 0),
      }).eq('id', campaignId);
    }
  } catch {}
}

// ===== Autoservicio + disponibilidad (F2) =====

// Precio total = precio del slot × nº de periodos (semanas o meses).
export function priceFor(slot: AdSlot, count: number): number {
  return Math.round((slot.price || 0) * Math.max(1, count));
}

// Disponibilidad de un slot (modelo exclusivo: un anunciante por rango).
export async function slotAvailability(slotKey: string): Promise<{ freeFrom: string | null; bookedUntil: string | null }> {
  try {
    const nowIso = new Date().toISOString();
    const { data } = await supabaseAdmin.from('ad_campaigns')
      .select('ends_at,status,created_at').eq('slot_key', slotKey)
      .in('status', ['active', 'pending', 'draft']).not('ends_at', 'is', null).gte('ends_at', nowIso);
    const ends = (data || []).filter((c: any) => c.status === 'active' || c.status === 'pending' || (Date.now() - new Date(c.created_at).getTime() < 30 * 60000))
      .map((c: any) => c.ends_at).sort();
    const last = ends.length ? ends[ends.length - 1] : null;
    return { bookedUntil: last, freeFrom: last ? new Date(new Date(last).getTime() + 86400000).toISOString() : null };
  } catch { return { freeFrom: null, bookedUntil: null }; }
}

// ¿El rango [start,end] está libre en ese slot?
export async function rangeAvailable(slotKey: string, startIso: string, endIso: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.from('ad_campaigns')
      .select('starts_at,ends_at,status,created_at').eq('slot_key', slotKey).in('status', ['active', 'pending', 'draft']);
    const S = new Date(startIso).getTime(), E = new Date(endIso).getTime();
    for (const c of (data || [])) {
      if (c.status === 'draft' && Date.now() - new Date(c.created_at).getTime() > 30 * 60000) continue;
      const s = c.starts_at ? new Date(c.starts_at).getTime() : 0;
      const e = c.ends_at ? new Date(c.ends_at).getTime() : Number.POSITIVE_INFINITY;
      if (S <= e && E >= s) return false;
    }
    return true;
  } catch { return true; }
}

// ===== Validación de creativo (F3) =====
// Lee dimensiones de PNG/JPG/GIF/WebP desde el buffer, sin dependencias.
export function imageDims(buf: Buffer): { w: number; h: number; type: string } | null {
  try {
    if (buf.length < 24) return null;
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png' };
    // GIF
    if (buf[0] === 0x47 && buf[1] === 0x49) return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), type: 'gif' };
    // WebP (VP8/VP8L/VP8X)
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fmt = buf.toString('ascii', 12, 16);
      if (fmt === 'VP8X') return { w: 1 + ((buf[24] | (buf[25] << 8) | (buf[26] << 16))), h: 1 + ((buf[27] | (buf[28] << 8) | (buf[29] << 16))), type: 'webp' };
      if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, type: 'webp' };
    }
    // JPEG: recorrer marcadores SOFn
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o < buf.length) {
        if (buf[o] !== 0xff) { o++; continue; }
        const m = buf[o + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), type: 'jpg' };
        }
        o += 2 + buf.readUInt16BE(o + 2);
      }
    }
  } catch {}
  return null;
}

// ¿El arte respeta el tamaño exacto del slot (±2%) y el peso máximo IAB?
export function validateCreative(slotKey: string, buf: Buffer): { ok: boolean; error?: string; w?: number; h?: number } {
  const slot = slotByKey(slotKey);
  if (!slot) return { ok: false, error: 'Ubicación inválida.' };
  const [sw, sh] = slot.size.split('x').map((n) => parseInt(n, 10) || 0);
  const info = sizeInfo(slot.size);
  if (buf.length > info.maxKB * 1024) return { ok: false, error: `El arte pesa ${Math.round(buf.length / 1024)}KB; el máximo para ${slot.size} es ${info.maxKB}KB.` };
  const dim = imageDims(buf);
  if (!dim) return { ok: false, error: 'Formato no reconocido. Usa PNG, JPG, GIF o WebP.' };
  const okW = Math.abs(dim.w - sw) <= Math.max(2, sw * 0.02);
  const okH = Math.abs(dim.h - sh) <= Math.max(2, sh * 0.02);
  if (!okW || !okH) return { ok: false, error: `El arte mide ${dim.w}×${dim.h}; debe ser ${slot.size}.`, w: dim.w, h: dim.h };
  return { ok: true, w: dim.w, h: dim.h };
}
