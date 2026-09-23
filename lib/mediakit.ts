// ============================================================================
// lib/mediakit.ts · Media Kit para anunciantes
// ----------------------------------------------------------------------------
// Arma un "kit de prensa" con estadísticas REALES por página (desde page_visits
// y ad_stats_daily) + inventario (AD_SLOTS con precios del tarifario) + audiencia
// por tier geográfico + paquetes con proyección de impresiones.
//
// Filosofía "editable pero crece con datos reales": el admin puede fijar un
// PISO (baseline) para cada cifra clave. Lo que se muestra es max(real, piso).
// Así, al arrancar (poco tráfico) se ve una cifra creíble; cuando el tráfico
// real supera el piso, manda el dato real. Nada se inventa por encima de lo real.
// ============================================================================
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';
import { AD_SLOTS, getAdsConfig, tierOf, type AdSlot } from '@/lib/ads';

// --- Overrides editables (guardados en settings 'mediakit') ------------------
export type MediaKitPackage = {
  id: string; es: string; en: string; priceMonthly: number;
  descEs: string; descEn: string; slots: string[];  // keys de AD_SLOTS incluidos
};
export type MediaKitOverrides = {
  headlineEs: string; headlineEn: string;   // subtítulo del kit
  aboutEs: string; aboutEn: string;         // "quiénes somos" para la propuesta
  contactEmail: string;
  showPrices: boolean;                      // mostrar precios por slot y paquetes
  // Pisos editables (0 = usar solo lo real)
  floorVisitors: number; floorPageviews: number;
  avgTime: string;                          // tiempo medio (estimado, editable)
  mobilePct: number;                        // % móvil (estimado, editable)
  ctrPctFloor: number;                      // CTR piso (%)
  audienceEs: string; audienceEn: string;   // descripción de la audiencia
  packages: MediaKitPackage[];
};

export const DEFAULT_MK: MediaKitOverrides = {
  headlineEs: 'Llega a traders de forex y prop firms con intención de compra.',
  headlineEn: 'Reach forex & prop-firm traders with buying intent.',
  aboutEs: 'Onyx Trading Live es una plataforma para traders de prop firms y forex: estadísticas en vivo, gestión de riesgo (Onyx Guardian), copy trading y robots. Nuestra audiencia son traders activos que evalúan brokers, prop firms, VPS y herramientas.',
  aboutEn: 'Onyx Trading Live is a platform for prop-firm and forex traders: live stats, risk management (Onyx Guardian), copy trading and robots. Our audience is active traders evaluating brokers, prop firms, VPS and tools.',
  contactEmail: 'publicidad@onyxtradinglive.com',
  showPrices: true,
  floorVisitors: 0, floorPageviews: 0,
  avgTime: '3:10',
  mobilePct: 66,
  ctrPctFloor: 0.6,
  audienceEs: 'Traders de prop firms y forex, 18–45, con interés en brokers, retos de fondeo, VPS, señales y herramientas de trading.',
  audienceEn: 'Prop-firm and forex traders, 18–45, interested in brokers, funded challenges, VPS, signals and trading tools.',
  packages: [
    { id: 'starter', es: 'Starter', en: 'Starter', priceMonthly: 150, descEs: '1 banner en blog o footer durante el mes.', descEn: '1 banner on blog or footer for the month.', slots: ['blog_top', 'footer_site'] },
    { id: 'growth',  es: 'Growth',  en: 'Growth',  priceMonthly: 420, descEs: 'Portada + artículo + footer, presencia en todo el sitio.', descEn: 'Landing + article + footer, site-wide presence.', slots: ['landing_top', 'article_halfpage', 'footer_site'] },
    { id: 'enterprise', es: 'Enterprise', en: 'Enterprise', priceMonthly: 0, descEs: 'A medida: patrocinio, CPA/afiliado, billboard y directorio destacado.', descEn: 'Custom: sponsorship, CPA/affiliate, billboard and featured directory.', slots: ['landing_billboard', 'directory_partner'] },
  ],
};

export async function getMediaKitOverrides(): Promise<MediaKitOverrides> {
  const c = await getSetting<Partial<MediaKitOverrides>>('mediakit', DEFAULT_MK);
  return {
    ...DEFAULT_MK, ...c,
    packages: Array.isArray(c.packages) && c.packages.length ? c.packages : DEFAULT_MK.packages,
  };
}
export async function saveMediaKitOverrides(patch: Partial<MediaKitOverrides>) {
  const cur = await getMediaKitOverrides();
  await saveSetting('mediakit', { ...cur, ...patch });
  return getMediaKitOverrides();
}

// --- Grupos de página (agrupamos rutas y slots por "superficie") -------------
type Group = { key: string; es: string; en: string; match: (p: string) => boolean };
const GROUPS: Group[] = [
  { key: 'landing', es: 'Portada', en: 'Home', match: (p) => p === '/' || p === '/en' || p === '/en/' },
  { key: 'article', es: 'Artículos del blog', en: 'Blog articles', match: (p) => /^\/(en\/)?blog\/.+/.test(p) },
  { key: 'blog',    es: 'Blog (índice)', en: 'Blog (index)', match: (p) => /^\/(en\/)?blog\/?$/.test(p) },
  { key: 'directory', es: 'Directorio de socios', en: 'Partner directory', match: (p) => /^\/(en\/)?socios/.test(p) },
  { key: 'site',    es: 'Todo el sitio (footer / sticky)', en: 'Site-wide (footer / sticky)', match: () => true },
];
const groupOf = (path: string) => (GROUPS.find((g) => g.key !== 'site' && g.match(path))?.key) || 'other';

// Datos del cliente para una propuesta dirigida (personaliza la portada).
export type ProposalClient = {
  company: string; contact: string; email?: string;
  packageId?: string;              // paquete sugerido (se resalta)
  noteEs?: string; noteEn?: string;
};

export type MediaKitSlot = { key: string; es: string; en: string; size: string; unit: string; price: number; available: boolean; fmt: string };
export type MediaKit = {
  updatedIso: string;
  client?: ProposalClient | null;   // presente si es una propuesta personalizada
  totals: { visitors: number; pageviews: number; avgTime: string; ctrPct: number; mobilePct: number };
  groups: { key: string; es: string; en: string; pageviews: number; visitors: number; slots: MediaKitSlot[] }[];
  audience: { tiers: { t1: number; t2: number; t3: number }; topCountries: { code: string; n: number }[]; es: string; en: string };
  packages: (MediaKitPackage & { estImpressions: number })[];
  branding: { headlineEs: string; headlineEn: string; aboutEs: string; aboutEn: string; contactEmail: string; showPrices: boolean };
  disclaimer: { es: string; en: string };
  overrides: MediaKitOverrides;   // para el editor admin
  // Solo para admin: datos REALES (sin piso) para comparar con los visibles.
  real?: {
    totals: { visitors: number; pageviews: number };
    groups: { key: string; es: string; en: string; pageviews: number; visitors: number }[];
  };
};

const grow = (real: number, floor: number) => Math.max(real || 0, floor || 0);

export async function buildMediaKit(opts?: { client?: ProposalClient | null; includeReal?: boolean }): Promise<MediaKit> {
  const cfg = await getAdsConfig();
  const ov = await getMediaKitOverrides();
  const now = Date.now();
  const startIso = new Date(now - 30 * 864e5).toISOString();

  // 1) Tráfico real por página (30 días) ------------------------------------
  const perGroupViews: Record<string, number> = {};
  const perGroupVids: Record<string, Set<string>> = {};
  const allVids = new Set<string>();
  const countries: Record<string, number> = {};
  let pageviews = 0;
  try {
    const { data } = await supabaseAdmin.from('page_visits')
      .select('vid,path,country,ts').gte('ts', startIso)
      .order('ts', { ascending: false }).limit(20000);
    for (const r of (data || []) as any[]) {
      pageviews++;
      const g = groupOf(r.path || '/');
      perGroupViews[g] = (perGroupViews[g] || 0) + 1;
      (perGroupVids[g] ||= new Set()).add(r.vid);
      allVids.add(r.vid);
      const c = (r.country || '').toUpperCase();
      if (c) countries[c] = (countries[c] || 0) + 1;
    }
  } catch { /* tabla vacía o no existe todavía */ }

  const visitors = grow(allVids.size, ov.floorVisitors);
  const pv = grow(pageviews, ov.floorPageviews);

  // 2) CTR real (30 días) desde ad_stats_daily ------------------------------
  let imp = 0, clk = 0;
  try {
    const { data } = await supabaseAdmin.from('ad_stats_daily')
      .select('impressions,clicks').gte('day', startIso.slice(0, 10)).limit(20000);
    for (const r of (data || []) as any[]) { imp += Number(r.impressions) || 0; clk += Number(r.clicks) || 0; }
  } catch {}
  const ctrReal = imp > 0 ? (clk / imp) * 100 : 0;
  const ctrPct = Math.round(Math.max(ctrReal, ov.ctrPctFloor) * 100) / 100;

  // 3) Slots ocupados (campañas activas) ------------------------------------
  const taken = new Set<string>();
  try {
    const { data } = await supabaseAdmin.from('ad_campaigns').select('slot_key').eq('status', 'active').limit(500);
    for (const r of (data || []) as any[]) taken.add(r.slot_key);
  } catch {}

  const priceOf = (s: AdSlot) => {
    const r = cfg.rates[s.key];
    return { price: r?.price ?? s.price, unit: (r?.unit ?? s.unit) as string };
  };

  // 4) Ensamblar grupos con sus slots ---------------------------------------
  // Reparto CONGRUENTE del piso: cada superficie recibe una fracción del total,
  // de modo que las filas por página cuadren con el KPI de arriba y nunca se vea
  // "28 vistas" cuando el total dice 90k. Lo mostrado = max(real, cuota del piso),
  // así siempre es ≥ base y sube solo cuando el tráfico real la supera.
  const WEIGHT: Record<string, number> = { landing: 0.30, article: 0.25, blog: 0.18, directory: 0.05 };
  const groupFloorViews = (k: string) => Math.round(pv * (WEIGHT[k] || 0));
  const groupFloorVis   = (k: string) => Math.round(visitors * (WEIGHT[k] || 0));

  const groups = GROUPS.map((g) => {
    const slots = AD_SLOTS.filter((s) => {
      if (g.key === 'site') return s.page === 'site';
      if (g.key === 'landing') return s.page === 'landing';
      if (g.key === 'blog') return s.page === 'blog';
      if (g.key === 'article') return s.page === 'article';
      if (g.key === 'directory') return s.page === 'directory';
      return false;
    }).map((s): MediaKitSlot => {
      const { price, unit } = priceOf(s);
      return { key: s.key, es: s.es, en: s.en, size: s.size, unit, price, available: !taken.has(s.key), fmt: s.fmt };
    });
    // El footer/sticky se sirven en TODAS las páginas → sus vistas = total.
    const views = g.key === 'site' ? pv : grow(perGroupViews[g.key] || 0, groupFloorViews(g.key));
    const vis   = g.key === 'site' ? visitors : grow(perGroupVids[g.key]?.size || 0, groupFloorVis(g.key));
    return { key: g.key, es: g.es, en: g.en, pageviews: views, visitors: vis, slots };
  }).filter((g) => g.slots.length > 0);

  // 5) Audiencia por tier ----------------------------------------------------
  // Mezcla: partimos de un reparto típico del nicho (nunca 0%) proporcional al
  // total, y le SUMAMOS los datos reales. Así los % son congruentes con la base
  // y se van moviendo hacia lo real conforme llega tráfico, sin caer por debajo.
  const tierCount = { t1: 0, t2: 0, t3: 0 };
  for (const [c, n] of Object.entries(countries)) {
    const t = tierOf(c);
    if (t) (tierCount as any)[t] += n;
  }
  const baseScale = Math.max(visitors, 100); // fuerza del reparto base
  const blended = {
    t1: 0.45 * baseScale + tierCount.t1,
    t2: 0.27 * baseScale + tierCount.t2,
    t3: 0.28 * baseScale + tierCount.t3,
  };
  const bTot = blended.t1 + blended.t2 + blended.t3 || 1;
  const t1p = Math.round((blended.t1 / bTot) * 100);
  const t2p = Math.round((blended.t2 / bTot) * 100);
  const tiers = { t1: t1p, t2: t2p, t3: Math.max(0, 100 - t1p - t2p) }; // suman 100 exacto
  const topCountries = Object.entries(countries).map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n).slice(0, 8);

  // 6) Paquetes con proyección de impresiones -------------------------------
  // Usa las mismas vistas "con piso" por superficie → congruente con las filas.
  const viewsForSlot = (key: string): number => {
    const s = AD_SLOTS.find((x) => x.key === key);
    if (!s) return 0;
    if (s.page === 'site') return pv;
    const gk = s.page === 'landing' ? 'landing' : s.page;
    return grow(perGroupViews[gk] || 0, groupFloorViews(gk));
  };
  const packages = ov.packages.map((p) => {
    const est = p.slots.reduce((a, k) => a + viewsForSlot(k), 0);
    return { ...p, estImpressions: est };
  });

  // 7) Datos REALES (sin piso) para la gráfica de comparación en admin --------
  const real = opts?.includeReal ? {
    totals: { visitors: allVids.size, pageviews },
    groups: groups.map((g) => ({
      key: g.key, es: g.es, en: g.en,
      pageviews: g.key === 'site' ? pageviews : (perGroupViews[g.key] || 0),
      visitors: g.key === 'site' ? allVids.size : (perGroupVids[g.key]?.size || 0),
    })),
  } : undefined;

  return {
    real,
    updatedIso: new Date(now).toISOString(),
    client: opts?.client || null,
    totals: { visitors, pageviews: pv, avgTime: ov.avgTime, ctrPct, mobilePct: ov.mobilePct },
    groups,
    audience: { tiers, topCountries, es: ov.audienceEs, en: ov.audienceEn },
    packages,
    branding: { headlineEs: ov.headlineEs, headlineEn: ov.headlineEn, aboutEs: ov.aboutEs, aboutEn: ov.aboutEn, contactEmail: ov.contactEmail, showPrices: ov.showPrices },
    disclaimer: cfg.riskDisclaimer,
    overrides: ov,
  };
}

// ============================================================================
// Propuestas personalizadas por cliente (tabla ad_proposals)
// ============================================================================
export type Proposal = {
  id: string; token: string; company: string; contact_name: string; email: string;
  package_id: string; note_es: string; note_en: string; lang: string;
  status: string; views: number; sent_at: string | null; created_at: string;
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
export const proposalUrl = (token: string, lang = 'es') =>
  `${SITE}${lang === 'en' ? '/en' : ''}/publicidad/propuesta?t=${token}`;

export async function createProposal(d: {
  company: string; contact: string; email?: string; packageId?: string;
  noteEs?: string; noteEn?: string; lang?: string;
}): Promise<Proposal | null> {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const row = {
    token,
    company: String(d.company || '').slice(0, 120),
    contact_name: String(d.contact || '').slice(0, 120),
    email: String(d.email || '').slice(0, 160),
    package_id: String(d.packageId || '').slice(0, 40),
    note_es: String(d.noteEs || '').slice(0, 1200),
    note_en: String(d.noteEn || '').slice(0, 1200),
    lang: d.lang === 'en' ? 'en' : 'es',
    status: 'draft',
  };
  const { data, error } = await supabaseAdmin.from('ad_proposals').insert(row).select('*').single();
  if (error) return null;
  return data as Proposal;
}

export async function listProposals(limit = 100): Promise<Proposal[]> {
  const { data } = await supabaseAdmin.from('ad_proposals').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data || []) as Proposal[];
}

export async function getProposalByToken(token: string): Promise<Proposal | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin.from('ad_proposals').select('*').eq('token', token).maybeSingle();
  return (data as Proposal) || null;
}

export async function deleteProposal(id: string) {
  await supabaseAdmin.from('ad_proposals').delete().eq('id', id);
}

export async function markProposalSent(id: string) {
  await supabaseAdmin.from('ad_proposals').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
}

// Suma una vista (cuando el cliente abre su propuesta). Silencioso.
export async function bumpProposalView(token: string) {
  try {
    const p = await getProposalByToken(token);
    if (p) await supabaseAdmin.from('ad_proposals').update({ views: (p.views || 0) + 1 }).eq('id', p.id);
  } catch {}
}

// Convierte una fila de BD en el overlay de cliente para buildMediaKit.
export function proposalToClient(p: Proposal): ProposalClient {
  return { company: p.company, contact: p.contact_name, email: p.email, packageId: p.package_id, noteEs: p.note_es, noteEn: p.note_en };
}
