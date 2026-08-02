import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Contenido editable del landing (Landing Builder). Se guarda en app_settings
// key 'landing_content'. Las páginas lo leen POR ENCIMA del texto en código:
// si un campo está vacío, se usa el del código (fallback) → nada se rompe.
//
// FASE 1: hero del landing, FAQ por página y tabla de comparación de planes.

export type FaqRow = [string, string, string, string];   // q_es, a_es, q_en, a_en
export type CompareRow = { es: string; en: string; v: (boolean | string)[]; head?: boolean };

export type LandingContent = {
  hero?: { h1a_es?: string; h1b_es?: string; sub_es?: string; h1a_en?: string; h1b_en?: string; sub_en?: string };
  faq?: Record<string, FaqRow[]>;   // 'landing' | 'embajadores' | 'invita' | 'mentores'
  compare?: CompareRow[];           // reemplaza la tabla de comparación entera
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
