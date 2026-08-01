import { headers, cookies } from 'next/headers';
import type { Lang } from './navText';
import { LANGS } from './navText';

export type { Lang };
export const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

function asLang(v: string | undefined | null): Lang | null {
  return v && (LANGS as string[]).includes(v) ? (v as Lang) : null;
}

// Idioma en el servidor. Prioridad:
//   1) la cabecera x-onyx-lang que pone el middleware para las URLs con prefijo (/en, /zh…)
//   2) la cookie onyx_lang (navegación normal)
// Así una URL /zh/... SIEMPRE renderiza en chino, aunque la cookie diga otra cosa.
export function serverLang(): Lang {
  return asLang(headers().get('x-onyx-lang')) || asLang(cookies().get('onyx_lang')?.value) || 'es';
}

// canonical + hreflang para una ruta pública. `pathEs` es la ruta sin prefijo
// (por ejemplo '/pricing' o '/'). El español vive sin prefijo; los demás en /xx.
export function localeAlternates(pathEs: string) {
  const cur = asLang(headers().get('x-onyx-lang')) || 'es';
  const pathFor = (l: Lang) => (l === 'es' ? pathEs : (pathEs === '/' ? `/${l}` : `/${l}${pathEs}`));
  const languages: Record<string, string> = { 'x-default': pathEs };
  for (const l of LANGS) languages[l] = pathFor(l);
  return { canonical: pathFor(cur), languages };
}
