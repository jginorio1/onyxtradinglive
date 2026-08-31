import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { getSeoMeta, saveSeoMeta, type SeoMeta } from '@/lib/seo';
import { gscConfigured, gscOverview } from '@/lib/seoSearchConsole';
import { keywordIdeas } from '@/lib/seoAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · datos del panel SEO: overrides de meta + estado de las integraciones +
// (si Search Console está configurado) el resumen de rendimiento en Google.
export async function GET(req: Request) {
  const p = await requirePerm('ajustes', 'view');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const meta = await getSeoMeta();
    const env = {
      gsc: gscConfigured(),
      ga: !!process.env.NEXT_PUBLIC_GA_ID,
      googleVerify: !!process.env.GOOGLE_SITE_VERIFICATION,
      bingVerify: !!process.env.BING_SITE_VERIFICATION,
      site: (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, ''),
    };
    const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get('days')) || 28));
    let search: any = { ok: false, reason: env.gsc ? 'pending' : 'not_configured' };
    if (env.gsc) { try { search = await gscOverview(days); } catch (e) { search = { ok: false, reason: 'error' }; } }
    return NextResponse.json({ meta, env, search, days });
  } catch (e: any) {
    await logError('seo_get', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · guardar overrides de meta, o pedir ideas de keywords a la IA.
export async function POST(req: Request) {
  const p = await requirePerm('ajustes', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));

    if (b.action === 'keywords') {
      const topic = String(b.topic || '').trim();
      if (!topic) return NextResponse.json({ error: 'Escribe un tema.' }, { status: 400 });
      const r = await keywordIdeas(topic, b.lang === 'en' ? 'en' : 'es');
      if (!r.ok) {
        const msg = r.reason === 'no_key' ? 'La IA no está configurada: falta ANTHROPIC_API_KEY.' : 'La IA no pudo generar ideas. Inténtalo otra vez.';
        return NextResponse.json({ error: msg, reason: r.reason }, { status: 400 });
      }
      return NextResponse.json({ ok: true, ideas: r.ideas });
    }

    // Guardar meta (title/desc por página, ES/EN). Sanea longitudes.
    const clean = (s: any, n: number) => String(s || '').trim().slice(0, n);
    const incoming = (b.meta || {}) as SeoMeta;
    const out: SeoMeta = {};
    for (const page of Object.keys(incoming)) {
      const o = incoming[page] || {};
      out[page] = {
        title_es: clean(o.title_es, 70), title_en: clean(o.title_en, 70),
        desc_es: clean(o.desc_es, 170), desc_en: clean(o.desc_en, 170),
      };
    }
    await saveSeoMeta(out);
    await logAdmin(p.user?.email || '', 'seo_meta_save', 'seo', { pages: Object.keys(out).length });
    return NextResponse.json({ ok: true, meta: out });
  } catch (e: any) {
    await logError('seo_post', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
