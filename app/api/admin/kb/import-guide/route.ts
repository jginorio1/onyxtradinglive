import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ARTICLES, type Article, type Lang } from '@/lib/guide';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Aplana un artículo de la Guía a texto plano para la Base IA.
function flatten(a: Article, lang: Lang): string {
  const blocks = (a.body[lang] || []) as any[];
  const parts = blocks.map((b) => b.p || b.h || b.note || b.warn || (b.list || b.steps || []).join(' · ') || '');
  return `${a.summary[lang]}\n${parts.filter(Boolean).join('\n')}`.slice(0, 8000);
}

// Vuelca TODOS los artículos de la Guía a la Base de conocimiento (kb_articles),
// en español e inglés. Idempotente: borra los importados previos (tag guide:*)
// y los vuelve a crear, así siempre reflejan la Guía actual.
export async function POST() {
  try {
    const { ok, user } = await requirePerm('soporte', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    // Limpia importaciones anteriores para no duplicar
    try { await supabaseAdmin.from('kb_articles').delete().ilike('tags', '%guide:%'); } catch {}

    const rows: any[] = [];
    for (const a of ARTICLES) {
      for (const lang of ['es', 'en'] as Lang[]) {
        rows.push({
          title: a.title[lang],
          body: flatten(a, lang),
          tags: `guide:${a.slug}:${lang}, ${a.cat}, ${lang}`,
          published: true,
        });
      }
    }

    if (rows.length) {
      const { error } = await supabaseAdmin.from('kb_articles').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAdmin(user?.email || '', 'kb_import_guide', 'guide', { count: rows.length });
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e: any) {
    await logError('kb_import_guide', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
