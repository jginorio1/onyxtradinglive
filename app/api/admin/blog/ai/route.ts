import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { suggestTitles, generateArticle } from '@/lib/blogAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · Onyx AI para el blog.
//   { mode: 'titles',   topic, lang }  -> { titles: [...] }
//   { mode: 'generate', title }        -> { article: { title_es, body_es, ... , tags } }
export async function POST(req: Request) {
  try {
    const { ok } = await requirePerm('modulos', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const b = await req.json().catch(() => ({} as any));
    const mode = String(b.mode || '');

    if (mode === 'titles') {
      const topic = String(b.topic || '').slice(0, 300);
      if (!topic) return NextResponse.json({ error: 'falta tema' }, { status: 400 });
      const r = await suggestTitles(topic, b.lang === 'en' ? 'en' : 'es');
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason }, { status: 502 });
      return NextResponse.json({ titles: r.titles });
    }

    if (mode === 'generate') {
      const title = String(b.title || '').slice(0, 200);
      if (!title) return NextResponse.json({ error: 'falta título' }, { status: 400 });
      const r = await generateArticle(title);
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ai', code: r.reason }, { status: 502 });
      return NextResponse.json({ article: r.article });
    }

    return NextResponse.json({ error: 'modo inválido' }, { status: 400 });
  } catch (e: any) {
    await logError('blog_ai', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
