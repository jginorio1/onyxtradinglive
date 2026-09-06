import { getSetting, saveSetting } from '@/lib/settings';
import { unstable_cache, revalidateTag } from 'next/cache';

// ============================================================
// SEO: overrides de meta por página (título + descripción, ES/EN) que el owner
// edita desde Admin → SEO. Si un campo está vacío, la página usa su texto por
// defecto del código. Guardado en app_settings key 'seo_meta'.
// ============================================================

export type SeoPage = 'home' | 'pricing' | 'guia' | 'blog' | 'embajadores' | 'contacto';
export type SeoMeta = Record<string, { title_es?: string; title_en?: string; desc_es?: string; desc_en?: string }>;

async function _getSeoMeta(): Promise<SeoMeta> {
  try { return (await getSetting<SeoMeta>('seo_meta', {})) || {}; } catch { return {}; }
}
// Cacheado en el servidor: se lee en el metadata de CADA página. Se refresca
// cada 2 min y al guardar en Admin → SEO invalidamos para verlo al momento.
export const getSeoMeta = unstable_cache(_getSeoMeta, ['seo_meta_v1'], { revalidate: 120, tags: ['seo_meta'] });

export async function saveSeoMeta(m: SeoMeta): Promise<void> {
  await saveSetting('seo_meta', m || {});
  try { revalidateTag('seo_meta'); } catch {}
}

// Devuelve {title, description} para una página, usando el override si existe,
// o los textos por defecto que se pasan. lang decide idioma.
export function seoFor(meta: SeoMeta, page: SeoPage, es: boolean, defTitle: string, defDesc: string) {
  const o = meta?.[page] || {};
  const title = (es ? o.title_es : o.title_en)?.trim() || defTitle;
  const description = (es ? o.desc_es : o.desc_en)?.trim() || defDesc;
  return { title, description };
}
