import { headers, cookies } from 'next/headers';

export type Lang = 'es' | 'en';
export const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Idioma en el servidor. Prioridad:
//   1) la cabecera x-onyx-lang que pone el middleware para las URLs /en
//   2) la cookie onyx_lang (navegación normal)
// Así una URL /en/... SIEMPRE renderiza en inglés, aunque la cookie diga otra cosa.
export function serverLang(): Lang {
  const h = headers().get('x-onyx-lang');
  if (h === 'en') return 'en';
  if (h === 'es') return 'es';
  const c = cookies().get('onyx_lang')?.value;
  return c === 'en' ? 'en' : 'es';
}

// canonical + hreflang para una ruta pública. `pathEs` es la ruta sin prefijo
// (por ejemplo '/pricing' o '/'). El español vive sin prefijo; el inglés en /en.
export function localeAlternates(pathEs: string) {
  const enPath = pathEs === '/' ? '/en' : '/en' + pathEs;
  const isEn = headers().get('x-onyx-lang') === 'en';
  return {
    canonical: isEn ? enPath : pathEs,
    languages: { es: pathEs, en: enPath, 'x-default': pathEs } as Record<string, string>,
  };
}
