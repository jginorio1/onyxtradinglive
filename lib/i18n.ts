// ============================================================
// Motor de idiomas (memoria de traducción).
//
// Todo el código usa L('texto en español', 'text in english'). Para los idiomas
// nuevos (zh/ja/pt/vi) NO hace falta tocar cada sitio: aquí buscamos la
// traducción usando el TEXTO EN ESPAÑOL como clave. Si falta, cae al INGLÉS
// (nunca mostramos español a un usuario de otro idioma).
//
// Los diccionarios (lib/i18n/*.ts) los va llenando Onyx AI por superficie.
// ============================================================
import type { Lang } from './navText';
import { LANGS } from './navText';
import zh from './i18n/zh';
import ja from './i18n/ja';
import pt from './i18n/pt';
import vi from './i18n/vi';

const MEM: Partial<Record<Lang, Record<string, string>>> = { zh, ja, pt, vi };

export function translate(lang: Lang, es: string, en: string): string {
  if (lang === 'en') return en;
  if (lang === 'es' || !lang) return es;
  const m = MEM[lang] || MEM.en;
  return (m && m[es]) || en; // idiomas nuevos: traducción o inglés de respaldo
}

// Fábrica del ayudante L para un idioma. Reemplaza a los `const L = (a,b)=>…`.
export function mkL(lang: Lang) {
  return (es: string, en: string) => translate(lang, es, en);
}

// ---- Ayudantes para IA y servidor (Telegram, email, reportes) ----
// Nombre del idioma EN INGLÉS, para instruir al modelo.
export const LANG_NAME: Record<Lang, string> = {
  es: 'Spanish',
  en: 'English',
  zh: 'Simplified Chinese (简体中文)',
  ja: 'Japanese (日本語)',
  pt: 'Brazilian Portuguese (Português do Brasil)',
  vi: 'Vietnamese (Tiếng Việt)',
};

// Directiva que se ADJUNTA al system prompt para que la IA responda en el
// idioma del usuario. Para es/en el prompt ya viene en ese idioma → sin extra.
export function aiLangDirective(lang: Lang): string {
  if (lang === 'es' || lang === 'en' || !lang) return '';
  return `\n\nIMPORTANT: Write your ENTIRE response in ${LANG_NAME[lang]}. Use natural, native phrasing — never translate word-for-word, and never mix in other languages.`;
}

// ¿Este idioma usa el prompt/base EN INGLÉS? (todo lo que no sea español).
// Sirve para reemplazar `lang === 'en'` por `enBase(lang)` en las libs de IA:
// el español conserva su prompt; el resto usa el inglés como base + directiva.
export function enBase(lang: Lang): boolean {
  return lang !== 'es';
}

// Normaliza cualquier valor a un idioma soportado, o null. Sirve en las rutas
// para pasar el idioma REAL del usuario (no recortado a es/en) a la IA/servidor.
export function asLang(v: any): Lang | null {
  return (typeof v === 'string' && (LANGS as string[]).includes(v)) ? (v as Lang) : null;
}
export function pickLang(v: any): Lang { return asLang(v) || 'es'; }

// Extrae el idioma de una cadena de cookies (onyx_lang=xx).
export function langFromCookie(cookie: string | null | undefined): Lang {
  const m = /onyx_lang=([a-z]{2})/.exec(cookie || '');
  return asLang(m && m[1]) || 'es';
}
