import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { landingContent, saveLandingContent, type LandingContent } from '@/lib/landingContent';
import { PLAN_ROWS } from '@/lib/plansData';
import { DEFAULT_ECO, DEFAULT_FEATURES, DEFAULT_HOW, DEFAULT_TRUST, DEFAULT_CTA, DEFAULT_PAGES, DEFAULT_NAV, DEFAULT_FOOTER, DEFAULT_LEGAL, DEFAULT_FAQ } from '@/lib/landingDefaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · devuelve el contenido guardado + los valores de código como referencia
// (para que el editor arranque con lo actual y no en blanco).
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const content = await landingContent();
  return NextResponse.json({ content, defaults: { compare: PLAN_ROWS, eco: DEFAULT_ECO, features: DEFAULT_FEATURES, how: DEFAULT_HOW, trust: DEFAULT_TRUST, cta: DEFAULT_CTA, pages: DEFAULT_PAGES, nav: DEFAULT_NAV, footer: DEFAULT_FOOTER, legal: DEFAULT_LEGAL, faq: DEFAULT_FAQ } });
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
  if (b.eco !== undefined) next.eco = b.eco;
  if (b.features !== undefined) next.features = b.features;
  if (b.how !== undefined) next.how = b.how;
  if (b.trust !== undefined) next.trust = b.trust;
  if (b.cta !== undefined) next.cta = b.cta;
  if (b.pages !== undefined) next.pages = b.pages;
  if (b.nav !== undefined) next.nav = b.nav;
  if (b.footer !== undefined) next.footer = b.footer;
  if (b.legal !== undefined) next.legal = b.legal;
  await saveLandingContent(next);
  return NextResponse.json({ ok: true, content: next });
}
