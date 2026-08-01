// Configuración de la barra de descuentos del landing (compartida entre la
// API que la edita y el layout que la muestra).
export type Promo = {
  on: boolean;
  text_es: string; text_en: string;
  link: string; cta_es: string; cta_en: string;
  bg: string; fg: string;
  endsAt: string; // ISO o '' (sin contador)
};

export const PROMO0: Promo = { on: false, text_es: '', text_en: '', link: '', cta_es: '', cta_en: '', bg: '#7c8cff', fg: '#0a0d14', endsAt: '' };
