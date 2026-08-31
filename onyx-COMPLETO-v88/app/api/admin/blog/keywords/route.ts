import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, blogKeywordsSettings, type BlogKeywords } from '@/lib/settings';
import { listAllPosts } from '@/lib/blog';
import { gscOverview, gscConfigured } from '@/lib/seoSearchConsole';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const oneOf = <T extends string>(v: any, a: T[], fb: T): T => (a.includes(v) ? v : fb);
const cleanList = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : []);

// GET · ajustes de keywords + cobertura en artículos + ideas desde Search Console.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const settings = await blogKeywordsSettings();

  // Cobertura: cuántos artículos ya contienen cada keyword (para rotar/reforzar).
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  const cov = (kw: string) => posts.filter((p) => (`${p.title_es || ''} ${p.body_es || ''} ${p.title_en || ''} ${p.body_en || ''}`).toLowerCase().includes(kw.toLowerCase())).length;
  const coverage: Record<string, number> = {};
  for (const k of [...(settings.es || []), ...(settings.en || [])]) coverage[k] = cov(k);

  // Ideas: consultas reales de Google (impresiones + posición). Marca oportunidad
  // = muchas impresiones pero posición floja (8-40) → fácil de mejorar.
  let ideas: any[] = [];
  let gsc = gscConfigured();
  if (gsc) {
    try {
      const ov = await gscOverview(90);
      if (ov.ok) {
        ideas = (ov.queries || []).slice(0, 40).map((q: any) => ({
          query: q.keys?.[0] || '', impressions: Math.round(q.impressions || 0), clicks: Math.round(q.clicks || 0),
          position: Math.round((q.position || 0) * 10) / 10,
          opportunity: (q.impressions || 0) >= 20 && (q.position || 0) >= 8 && (q.position || 0) <= 40,
        })).filter((x: any) => x.query);
        ideas.sort((a: any, b: any) => (b.opportunity ? 1 : 0) - (a.opportunity ? 1 : 0) || b.impressions - a.impressions);
      }
    } catch (e) { await logError('blog_kw_gsc', e); }
  }

  return NextResponse.json({ settings, coverage, ideas, gsc });
}

// PATCH · guardar ajustes de keywords (owner/gestor de módulos).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const prev = await getSetting<BlogKeywords>('blog_keywords', await blogKeywordsSettings());
  const b = await req.json().catch(() => ({} as any));
  const value: BlogKeywords = {
    enabled: b.enabled == null ? prev.enabled : !!b.enabled,
    intensity: oneOf(b.intensity, ['soft', 'normal', 'strong'], prev.intensity),
    variants: b.variants == null ? prev.variants : !!b.variants,
    internalLinks: b.internalLinks == null ? prev.internalLinks : !!b.internalLinks,
    es: b.es == null ? prev.es : cleanList(b.es),
    en: b.en == null ? prev.en : cleanList(b.en),
  };
  await saveSetting('blog_keywords', value);
  return NextResponse.json({ ok: true, ...value });
}
