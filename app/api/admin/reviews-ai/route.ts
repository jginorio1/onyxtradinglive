import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { draftReview } from '@/lib/reviewAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { lang: 'es' | 'en' } → genera 1 reseña de ejemplo con la IA (editable).
export async function POST(req: Request) {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('modulos', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const { lang } = await req.json().catch(() => ({ lang: 'es' }));
    const l = lang === 'en' ? 'en' : 'es';
    const review = await draftReview(l);
    if (!review) return NextResponse.json({ error: 'no_ai', hint: 'Falta ANTHROPIC_API_KEY o la IA no respondió.' }, { status: 502 });
    return NextResponse.json({ ok: true, review });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
