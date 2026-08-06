// Configuración de la barra de descuentos del landing (compartida entre la
// API que la edita, el layout que la muestra y el componente PromoBar).
export type Promo = {
  on: boolean;
  emoji: string;                 // icono/emoji al inicio ('' = ninguno)
  text_es: string; text_en: string;
  link: string; newTab: boolean; // abrir el enlace en pestaña nueva
  cta_es: string; cta_en: string;
  coupon: string;                // código de cupón copiable ('' = sin cupón)
  bg: string; bg2: string; gradient: boolean; fg: string; // fondo sólido o degradado
  position: 'top' | 'bottom';    // arriba o abajo del sitio
  anim: 'none' | 'slide' | 'pulse' | 'marquee';
  countdown: boolean;            // mostrar el contador si hay fecha de fin
  countdownFmt: 'dhms' | 'hms';  // "2d 3h 4m" o "03:04:05"
  startsAt: string;              // ISO o '' — no aparece antes de esta fecha
  endsAt: string;                // ISO o '' — desaparece sola al pasar
  pages: 'all' | 'landing' | 'pricing';   // dónde se muestra
  audience: 'all' | 'guests' | 'free';    // a quién
  dismissible: boolean;          // el visitante puede cerrarla (se recuerda)
};

export const PROMO0: Promo = {
  on: false, emoji: '',
  text_es: '', text_en: '',
  link: '', newTab: false,
  cta_es: '', cta_en: '',
  coupon: '',
  bg: '#7c8cff', bg2: '#9a6bff', gradient: false, fg: '#0a0d14',
  position: 'top', anim: 'slide',
  countdown: true, countdownFmt: 'dhms',
  startsAt: '', endsAt: '',
  pages: 'all', audience: 'all', dismissible: true,
};
