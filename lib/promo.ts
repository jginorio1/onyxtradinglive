// Configuración de las barras de descuento del landing. Ahora es una COLA:
// muchas barras programadas por fecha; el sitio muestra sola la que toca hoy.
// Compartido entre la API, el layout y el componente PromoBar.

export type Promo = {
  id: string;
  on: boolean;
  name: string;                  // nombre interno (ej. "Halloween", "Verano")
  emoji: string;                 // icono/emoji al inicio ('' = ninguno)
  text_es: string; text_en: string;
  link: string; newTab: boolean; // abrir el enlace en pestaña nueva
  cta_es: string; cta_en: string;
  coupon: string;                // código de cupón copiable ('' = sin cupón)
  bg: string; bg2: string; gradient: boolean; fg: string; // fondo sólido o degradado
  position: 'top' | 'bottom';
  anim: 'none' | 'slide' | 'pulse' | 'marquee';
  speed: 'slow' | 'normal' | 'fast';   // velocidad de la animación
  countdown: boolean;
  countdownFmt: 'dhms' | 'hms';
  startsAt: string;              // ISO o '' — no aparece antes de esta fecha
  endsAt: string;                // ISO o '' — desaparece sola al pasar
  pages: 'all' | 'landing' | 'pricing';
  audience: 'all' | 'guests' | 'free';
  dismissible: boolean;
};

// Estructura guardada: la cola de barras + métricas por id.
export type PromoQueue = { bars: Promo[] };

let _seq = 0;
export const newId = () => 'bar_' + Date.now().toString(36) + '_' + (_seq++).toString(36);

// Base para una barra nueva (sin fechas = "por defecto", siempre elegible).
export function blankPromo(): Promo {
  return {
    id: newId(), on: true, name: '', emoji: '',
    text_es: '', text_en: '',
    link: '', newTab: false,
    cta_es: '', cta_en: '',
    coupon: '',
    bg: '#7c8cff', bg2: '#9a6bff', gradient: false, fg: '#0a0d14',
    position: 'top', anim: 'slide', speed: 'normal',
    countdown: true, countdownFmt: 'dhms',
    startsAt: '', endsAt: '',
    pages: 'all', audience: 'all', dismissible: true,
  };
}

// Compat: config vieja (una sola barra). Se migra a cola de una entrada.
export const PROMO0: Promo = { ...blankPromo(), id: 'default', on: false };

// Duraciones de animación (segundos por ciclo) según la velocidad.
export const ANIM_SECONDS: Record<Promo['speed'], number> = { slow: 34, normal: 22, fast: 12 };
export const PULSE_SECONDS: Record<Promo['speed'], number> = { slow: 3.4, normal: 2.4, fast: 1.4 };

// Biblioteca de temas por temporada. Cada uno rellena colores/emoji/texto.
export type Theme = { key: string; name: string; season: string; patch: Partial<Promo> };
export const THEMES: Theme[] = [
  { key: 'halloween1', name: 'Halloween 1', season: 'Halloween', patch: { emoji: '🎃', gradient: true, bg: '#2a1a3d', bg2: '#e8801f', fg: '#ffffff', anim: 'slide', text_es: '−30% de sustos en tu plan', text_en: '−30% spooky deal on your plan', cta_es: 'Aprovechar', cta_en: 'Grab it', coupon: 'SPOOKY30' } },
  { key: 'halloween2', name: 'Halloween 2', season: 'Halloween', patch: { emoji: '👻', gradient: true, bg: '#1a1a1a', bg2: '#8b2fd6', fg: '#ffffff', anim: 'slide', text_es: 'Oferta de brujas: Pro −30%', text_en: 'Witching hour: Pro −30%', cta_es: 'Ver oferta', cta_en: 'See offer', coupon: 'BOO30' } },
  { key: 'navidad1', name: 'Navidad 1', season: 'Navidad', patch: { emoji: '🎄', gradient: true, bg: '#b3131c', bg2: '#0f7a34', fg: '#ffffff', anim: 'slide', text_es: '−35% de Navidad en Onyx', text_en: '−35% Christmas deal on Onyx', cta_es: 'Aprovechar', cta_en: 'Grab it', coupon: 'XMAS35' } },
  { key: 'navidad2', name: 'Navidad 2', season: 'Navidad', patch: { emoji: '🎁', gradient: true, bg: '#0f3d2e', bg2: '#d4af37', fg: '#ffffff', anim: 'slide', text_es: 'Regálate Onyx: −35%', text_en: 'Gift yourself Onyx: −35%', cta_es: 'Ver planes', cta_en: 'See plans', coupon: 'GIFT35' } },
  { key: 'verano', name: 'Verano', season: 'Verano', patch: { emoji: '☀️', gradient: true, bg: '#0aa5c4', bg2: '#ffd24a', fg: '#08313b', anim: 'slide', text_es: '−25% oferta de verano', text_en: '−25% summer sale', cta_es: 'Aprovechar', cta_en: 'Grab it', coupon: 'VERANO25' } },
  { key: 'sanvalentin', name: 'San Valentín', season: 'San Valentín', patch: { emoji: '💘', gradient: true, bg: '#d6336c', bg2: '#ff8fab', fg: '#ffffff', anim: 'pulse', text_es: 'San Valentín: −20% en Onyx', text_en: "Valentine's: −20% on Onyx", cta_es: 'Ver oferta', cta_en: 'See offer', coupon: 'LOVE20' } },
  { key: 'blackfriday', name: 'Black Friday', season: 'Black Friday', patch: { emoji: '🛍️', gradient: true, bg: '#111111', bg2: '#6b5cff', fg: '#ffffff', anim: 'slide', text_es: 'Black Friday: −40% hoy', text_en: 'Black Friday: −40% today', cta_es: 'Aprovechar', cta_en: 'Grab it', coupon: 'BF40', countdownFmt: 'hms' } },
  { key: 'ano_nuevo', name: 'Año Nuevo', season: 'Año Nuevo', patch: { emoji: '🎉', gradient: true, bg: '#1d3fae', bg2: '#c0c9ff', fg: '#ffffff', anim: 'slide', text_es: 'Empieza el año con Onyx: −25%', text_en: 'Start the year with Onyx: −25%', cta_es: 'Ver planes', cta_en: 'See plans', coupon: 'NY25' } },
];

// Elige la barra a mostrar para "ahora" y el contexto dado. Devuelve null si
// ninguna aplica. Reglas: on + dentro de la ventana de fechas + página + público.
// Si varias aplican, gana la primera de la lista (orden = prioridad).
export function pickActiveBar(
  bars: Promo[], now: number,
  ctx: { lang: 'es' | string; isLanding: boolean; isPricing: boolean; loggedIn: boolean; plan: string },
): Promo | null {
  for (const b of bars) {
    if (!b || !b.on) continue;
    const text = ctx.lang === 'es' ? b.text_es : b.text_en;
    if (!text) continue;
    if (b.startsAt && new Date(b.startsAt).getTime() > now) continue;
    if (b.endsAt && new Date(b.endsAt).getTime() <= now) continue;
    const pageOk = b.pages === 'all' || (b.pages === 'landing' && ctx.isLanding) || (b.pages === 'pricing' && ctx.isPricing);
    if (!pageOk) continue;
    const audOk = b.audience === 'all' || (b.audience === 'guests' && !ctx.loggedIn) || (b.audience === 'free' && (!ctx.loggedIn || ctx.plan === 'free'));
    if (!audOk) continue;
    return b;
  }
  return null;
}
