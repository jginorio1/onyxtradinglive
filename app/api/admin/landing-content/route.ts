import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { landingContent, saveLandingContent, type LandingContent } from '@/lib/landingContent';
import { PLAN_ROWS } from '@/lib/plansData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · devuelve el contenido guardado + los valores de código como referencia
// (para que el editor arranque con lo actual y no en blanco).
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const content = await landingContent();
  return NextResponse.json({ content, defaults: { compare: PLAN_ROWS } });
}

export async function PATCH(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const _p = await requirePerm('planes', 'manage'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as LandingContent;
  const cur = await landingContent();
  const next: LandingContent = { ...cur };
  if (b.hero !== undefined) next.hero = b.hero;
  if (b.faq !== undefined) next.faq = b.faq;
  if (b.compare !== undefined) next.compare = b.compare;
  await saveLandingContent(next);
  return NextResponse.json({ ok: true, content: next });
}
