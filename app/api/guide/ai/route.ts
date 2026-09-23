import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { generateGuide, improveText, altText } from '@/lib/guideAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · Onyx AI para el editor de guías (solo dueño).
//  { mode:'generate', topic, keyword? } -> { article }
//  { mode:'improve',  text, lang }      -> { text }
//  { mode:'alt',      context }         -> { es, en }
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (b.mode === 'improve') {
      const r = await improveText(String(b.text || ''), b.lang === 'en' ? 'en' : 'es');
      return NextResponse.json(r);
    }
    if (b.mode === 'alt') {
      const r = await altText(String(b.context || ''));
      return NextResponse.json(r);
    }
    // por defecto: generar guía completa
    const r = await generateGuide(String(b.topic || '').slice(0, 300), b.keyword ? String(b.keyword).slice(0, 80) : undefined);
    return NextResponse.json(r);
  } catch (e: any) {
    await logError('guide_ai', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
