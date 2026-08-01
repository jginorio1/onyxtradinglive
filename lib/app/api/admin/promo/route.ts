import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { type Promo, PROMO0 } from '@/lib/promo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · configuración de la barra (para el panel).
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ promo: await getSetting<Promo>('promo', PROMO0) });
}

// PATCH · guardar la barra (owner).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede editar la barra.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const prev = await getSetting<Promo>('promo', PROMO0);
  const next: Promo = {
    on: !!b.on,
    text_es: String(b.text_es ?? prev.text_es).slice(0, 160),
    text_en: String(b.text_en ?? prev.text_en).slice(0, 160),
    link: String(b.link ?? prev.link).slice(0, 300),
    cta_es: String(b.cta_es ?? prev.cta_es).slice(0, 40),
    cta_en: String(b.cta_en ?? prev.cta_en).slice(0, 40),
    bg: String(b.bg ?? prev.bg).slice(0, 20),
    fg: String(b.fg ?? prev.fg).slice(0, 20),
    endsAt: String(b.endsAt ?? prev.endsAt).slice(0, 40),
  };
  await saveSetting('promo', next);
  return NextResponse.json({ ok: true, promo: next });
}
