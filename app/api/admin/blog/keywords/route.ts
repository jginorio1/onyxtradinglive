import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, blogKeywordsSettings, type BlogKeywords } from '@/lib/settings';
import { listAllPosts } from '@/lib/blog';
import { gscOverview, gscConfigured, oppScore, isStrikingDistance } from '@/lib/seoSearchConsole';
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

  // Cobertura: cuántos artículos PUBLICADOS ya contienen cada keyword (para
  // rotar/reforzar). Solo 'published': los slots programados/borrador (que el
  // autopiloto agenda a futuro con el tema como título y cuerpo vacío) NO cuentan;
  // si no, la cifra se infla con cientos de artículos que aún no existen.
  let posts: any[] = [];
  try { posts = (await listAllPosts()).filter((p: any) => p.status === 'published'); } catch {}
  const cov = (kw: string) => posts.filter((p) => (`${p.title_es || ''} ${p.body_es || ''} ${p.title_en || ''} ${p.body_en || ''}`).toLowerCase().includes(kw.toLowerCase())).length;
  const coverage: Record<string, number> = {};
  for (const k of [...(settings.es || []), ...(settings.en || [])]) coverage[k] = cov(k);

  // Ideas: consultas reales de Google (impresiones + posición). Ordenadas por
  // "distancia de golpe" (mismo scoring que usa el generador), no por impresiones
  // puras. Así lo fácil de ganar —página 2, borde de página 1 y tu marca— sale
  // arriba, en vez de términos cabeza imposibles para un sitio nuevo.
  let ideas: any[] = [];
  let gscRows: { q: string; impressions: number; position: number }[] = [];
  let gsc = gscConfigured();
  if (gsc) {
    try {
      const ov = await gscOverview(90);
      if (ov.ok) {
        // Todas las consultas (para poder cruzar cualquier keyword guardada, no solo las 40 ideas).
        gscRows = (ov.queries || []).map((q: any) => ({
          q: String(q.keys?.[0] || '').toLowerCase(), impressions: Math.round(q.impressions || 0), position: q.position || 0,
        })).filter((r: any) => r.q);
        ideas = (ov.queries || []).map((q: any) => {
          const impressions = Math.round(q.impressions || 0);
          const position = Math.round((q.position || 0) * 10) / 10;
          return {
            query: q.keys?.[0] || '', impressions, clicks: Math.round(q.clicks || 0), position,
            opportunity: isStrikingDistance(impressions, position),
          };
        }).filter((x: any) => x.query);
        ideas.sort((a: any, b: any) => oppScore(b.impressions, b.position, b.query) - oppScore(a.impressions, a.position, a.query));
        ideas = ideas.slice(0, 40);
      }
    } catch (e) { await logError('blog_kw_gsc', e); }
  }

  // Aporte por keyword: cruza cada una con Search Console (impresiones sumadas +
  // mejor posición de las consultas que la contienen) y le pone un semáforo para
  // que el dueño vea de un vistazo cuáles quitar. tier: green (ganable/tu marca),
  // amber (asoma pero lejos), gray (sin tracción todavía), na (GSC sin conectar).
  const statFor = (kw: string) => {
    const k = kw.toLowerCase();
    const matches = gscRows.filter((r) => r.q.includes(k));
    const impressions = matches.reduce((a, r) => a + r.impressions, 0);
    const pos = matches.filter((r) => r.position > 0).map((r) => r.position);
    const position = pos.length ? Math.round(Math.min(...pos) * 10) / 10 : 0;
    return { impressions, position };
  };
  const kwStats: Record<string, { coverage: number; impressions: number; position: number; tier: string }> = {};
  for (const k of [...(settings.es || []), ...(settings.en || [])]) {
    const isBrand = k.toLowerCase().includes('onyx');
    const { impressions, position } = gsc ? statFor(k) : { impressions: 0, position: 0 };
    let tier = 'na';
    if (gsc) {
      if (isBrand) tier = 'green';
      else if (impressions >= 2 && position > 0 && position <= 25) tier = 'green';
      else if (impressions >= 1 && position > 0) tier = 'amber';
      else tier = 'gray';
    }
    kwStats[k] = { coverage: coverage[k] ?? 0, impressions, position, tier };
  }

  return NextResponse.json({ settings, coverage, kwStats, ideas, gsc });
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
    useGsc: b.useGsc == null ? (prev.useGsc ?? true) : !!b.useGsc,
    gscMax: b.gscMax == null ? (prev.gscMax ?? 6) : Math.min(20, Math.max(0, parseInt(b.gscMax, 10) || 0)),
    es: b.es == null ? prev.es : cleanList(b.es),
    en: b.en == null ? prev.en : cleanList(b.en),
  };
  await saveSetting('blog_keywords', value);
  return NextResponse.json({ ok: true, ...value });
}
