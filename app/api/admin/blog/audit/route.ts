import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { runAudit } from '@/lib/blogAudit';
import { listAllPosts, savePost } from '@/lib/blog';
import { enhanceArticle, suggestTitles, lastAiError, type RelatedPost } from '@/lib/blogAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// GET · escanea TODOS los artículos y devuelve el informe de auditoría.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try { return NextResponse.json(await runAudit()); }
  catch (e: any) { await logError('blog_audit', e); return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 }); }
}

// POST · arreglos con IA (híbrido: el auditor marca, aquí se corrige, tú apruebas por artículo).
//   fix_seo   → enhanceArticle: teje enlaces internos + FAQ + banner (sube SEO on-page).
//   refresh   → re-mejora y marca como actualizado (señal de frescura).
//   suggest_angle → propone 5 títulos/ángulos NUEVOS para diferenciar de su gemelo.
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const action = String(b.action || '');
    const id = String(b.id || '');
    const all = await listAllPosts();
    const p: any = all.find((x: any) => x.id === id);
    if (!p && action !== 'suggest_angle') return NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });
    const related: RelatedPost[] = all.filter((x: any) => x.id !== id && x.status === 'published')
      .slice(0, 12).map((x: any) => ({ slug: x.slug, title_es: x.title_es, title_en: x.title_en, tags: x.tags }));

    if (action === 'fix_seo' || action === 'refresh') {
      const r = await enhanceArticle(p.title_es || p.title_en || '', p.body_es || '', p.body_en || '', related);
      if (!r.ok) return NextResponse.json({ ok: false, error: lastAiError() || r.reason || 'ai' }, { status: 200 });
      const patch: any = { ...p, body_es: r.body_es ?? p.body_es, body_en: r.body_en ?? p.body_en, updated_at: new Date().toISOString() };
      await savePost(patch);
      return NextResponse.json({ ok: true, applied: action });
    }
    if (action === 'suggest_angle') {
      const kw = String(b.kw || '');
      const r = await suggestTitles(kw || (p?.title_es || p?.title_en || ''), 'es', kw);
      if (!r.ok) return NextResponse.json({ ok: false, error: lastAiError() || r.reason || 'ai' }, { status: 200 });
      return NextResponse.json({ ok: true, titles: r.titles || [] });
    }
    return NextResponse.json({ ok: false, error: 'acción inválida' }, { status: 400 });
  } catch (e: any) {
    await logError('blog_audit_fix', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
