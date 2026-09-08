// Helpers de plataforma. Una sola fuente para (a) traducir el código que reporta
// una cuenta a su nombre bonito (mt5 -> "MetaTrader 5") y (b) armar la frase de
// "plataformas soportadas". Así, al añadir una plataforma en el catálogo del admin,
// no hay que perseguir textos "MT4/MT5" por toda la app.
import { CATALOG_DEFAULTS, type CatalogItem } from '@/lib/catalogDefaults';

const BASE: Record<string, { es: string; en: string }> = {};
for (const it of CATALOG_DEFAULTS.platform) BASE[it.code] = { es: it.es, en: it.en };
BASE['ambas'] = { es: 'Varias', en: 'Several' };
BASE['both'] = { es: 'Varias', en: 'Several' };

// Nombre bonito de una plataforma a partir de su código.
export function platformLabel(code: string | null | undefined, lang: 'es' | 'en' = 'es'): string {
  const c = String(code || '').toLowerCase().trim();
  if (!c) return '';
  const m = BASE[c];
  if (m) return lang === 'en' ? m.en : m.es;
  return String(code).toUpperCase(); // desconocida: al menos no la ocultamos
}

// Frase "MetaTrader 5, MetaTrader 4, cTrader…" a partir de la lista del catálogo.
// Pasa aquí los items de useCatalog('platform'); si no, usa los por defecto.
export function platformsPhrase(items: CatalogItem[] | null | undefined, lang: 'es' | 'en' = 'es', max = 3): string {
  const list = (items && items.length ? items : CATALOG_DEFAULTS.platform).slice(0, max);
  const names = list.map((c) => (lang === 'en' ? (c.en || c.es) : c.es));
  return names.join(', ') + '…';
}
