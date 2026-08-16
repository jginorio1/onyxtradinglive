// ============================================================
// Guías del dueño: se guardan en app_settings ('guide_custom') como una lista
// de artículos con el mismo formato que los del código. Se fusionan con los del
// código: un artículo del dueño con el mismo slug SOBREESCRIBE al del código, y
// los slugs nuevos se AÑADEN. Así el dueño puede editar guías o crear nuevas sin
// tocar el código ni volver a desplegar.
//
// Este archivo es SOLO de servidor (usa app_settings). No lo importes en el cliente.
// ============================================================
import { getSetting, saveSetting } from '@/lib/settings';
import { ARTICLES, type Article } from '@/lib/guide';

const KEY = 'guide_custom';

export async function getCustomArticles(): Promise<Article[]> {
  const raw = await getSetting<Article[]>(KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export async function saveCustomArticles(list: Article[]): Promise<void> {
  await saveSetting(KEY, list.slice(0, 200));
}

// Todos los artículos visibles: código + del dueño (el dueño gana por slug).
export async function getAllArticles(): Promise<Article[]> {
  let custom: Article[] = [];
  try { custom = await getCustomArticles(); } catch { custom = []; }
  const bySlug = new Map<string, Article>();
  for (const a of ARTICLES) bySlug.set(a.slug, a);
  for (const c of custom) if (c && c.slug) bySlug.set(c.slug, c);
  return Array.from(bySlug.values());
}

export async function getArticleServer(slug: string): Promise<Article | null> {
  try {
    const custom = await getCustomArticles();
    const c = custom.find((a) => a && a.slug === slug);
    if (c) return c;
  } catch { /* si falla, seguimos con el código */ }
  return ARTICLES.find((a) => a.slug === slug) || null;
}
