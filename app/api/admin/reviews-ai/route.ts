import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { draftReview, draftReviewBatch } from '@/lib/reviewAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST → genera reseñas de ejemplo con la IA (editables).
//   { batch: true }      → 5 a la vez (4×5★ + 1×4★, ES/EN aleatorio) → { reviews: [...] }
//   { lang: 'es'|'en' }  → 1 sola en ese idioma                       → { review: {...} }
export async function POST(req: Request) {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('modulos', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // `used`: nombres que ya existen en el landing → el generador los evita para no repetir.
    const used: string[] = Array.isArray(body?.used) ? body.used.map((n: any) => String(n || '')).filter(Boolean) : [];
    if (body?.batch) {
      const reviews = await draftReviewBatch(used);
      if (!reviews.length) return NextResponse.json({ error: 'no_ai', hint: 'Falta ANTHROPIC_API_KEY o la IA no respondió.' }, { status: 502 });
      return NextResponse.json({ ok: true, reviews });
    }
    const l = body?.lang === 'en' ? 'en' : 'es';
    const review = await draftReview(l, undefined, undefined, undefined, new Set(used.map((n) => n.toLowerCase())));
    if (!review) return NextResponse.json({ error: 'no_ai', hint: 'Falta ANTHROPIC_API_KEY o la IA no respondió.' }, { status: 502 });
    return NextResponse.json({ ok: true, review });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
