import { getSetting, saveSetting } from '@/lib/settings';

// ============================================================
// SEO: overrides de meta por página (título + descripción, ES/EN) que el owner
// edita desde Admin → SEO. Si un campo está vacío, la página usa su texto por
// defecto del código. Guardado en app_settings key 'seo_meta'.
// ============================================================

export type SeoPage = 'home' | 'pricing' | 'guia' | 'blog' | 'embajadores';
export type SeoMeta = Record<string, { title_es?: string; title_en?: string; desc_es?: string; desc_en?: string }>;

export async function getSeoMeta(): Promise<SeoMeta> {
  try { return (await getSetting<SeoMeta>('seo_meta', {})) || {}; } catch { return {}; }
}
export async function saveSeoMeta(m: SeoMeta): Promise<void> {
  await saveSetting('seo_meta', m || {});
}

// Devuelve {title, description} para una página, usando el override si existe,
// o los textos por defecto que se pasan. lang decide idioma.
export function seoFor(meta: SeoMeta, page: SeoPage, es: boolean, defTitle: string, defDesc: string) {
  const o = meta?.[page] || {};
  const title = (es ? o.title_es : o.title_en)?.trim() || defTitle;
  const description = (es ? o.desc_es : o.desc_en)?.trim() || defDesc;
  return { title, description };
}
