import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Contenido editable del landing (Landing Builder). Se guarda en app_settings
// key 'landing_content'. Las páginas lo leen POR ENCIMA del texto en código:
// si un campo está vacío, se usa el del código (fallback) → nada se rompe.
//
// FASE 1: hero del landing, FAQ por página y tabla de comparación de planes.

export type FaqRow = [string, string, string, string];   // q_es, a_es, q_en, a_en
export type CompareRow = { es: string; en: string; v: (boolean | string)[]; head?: boolean };
// Tarjeta con icono (emoji) + título + descripción, bilingüe. Sirve para eco y features.
export type CardRow = { i?: string; t_es: string; t_en: string; d_es: string; d_en: string };

export type LandingContent = {
  hero?: { h1a_es?: string; h1b_es?: string; sub_es?: string; h1a_en?: string; h1b_en?: string; sub_en?: string };
  faq?: Record<string, FaqRow[]>;   // 'landing' | 'embajadores' | 'invita' | 'mentores'
  compare?: CompareRow[];           // reemplaza la tabla de comparación entera
  // FASE 2:
  eco?: { badge_es?: string; badge_en?: string; t_es?: string; t_en?: string; s_es?: string; s_en?: string; cards?: CardRow[] };
  features?: { t_es?: string; t_en?: string; cards?: CardRow[] };
  how?: { t_es?: string; t_en?: string; steps?: CardRow[] };   // steps sin icono (van numerados)
  trust?: { es?: string[]; en?: string[] };                    // 3 insignias de confianza
  cta?: { t_es?: string; t_en?: string; btn_es?: string; btn_en?: string };
  // FASE 3 · textos por página (embajadores, invita, mentores, academias, analiza).
  // clave de campo → { es, en }. Vacío = usa el texto del código.
  pages?: Record<string, Record<string, { es?: string; en?: string }>>;
  // FASE 4 · navegación, footer y legales.
  nav?: Record<string, { es?: string; en?: string }>;          // etiquetas del menú del landing
  footer?: { tagline_es?: string; tagline_en?: string; links?: { es: string; en: string; href: string }[] };
  legal?: { terms_es?: string; terms_en?: string; privacy_es?: string; privacy_en?: string };
};

export async function landingContent(): Promise<LandingContent> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_content').maybeSingle();
    return (data?.value as LandingContent) || {};
  } catch { return {}; }
}

export async function saveLandingContent(v: LandingContent) {
  await supabaseAdmin.from('app_settings').upsert({ key: 'landing_content', value: v, updated_at: new Date().toISOString() });
}
