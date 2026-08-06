import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { type Promo, PROMO0 } from '@/lib/promo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PromoStats = { views: number; clicks: number };
const STATS0: PromoStats = { views: 0, clicks: 0 };

// GET · configuración de la barra + métricas (para el panel).
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const promo = { ...PROMO0, ...(await getSetting<Promo>('promo', PROMO0)) };
  const stats = await getSetting<PromoStats>('promo_stats', STATS0);
  return NextResponse.json({ promo, stats });
}

const oneOf = <T extends string>(v: any, allowed: T[], fb: T): T => (allowed.includes(v) ? v : fb);

// PATCH · guardar la barra (owner).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede editar la barra.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const prev = { ...PROMO0, ...(await getSetting<Promo>('promo', PROMO0)) };
  const next: Promo = {
    on: !!b.on,
    emoji: String(b.emoji ?? prev.emoji).slice(0, 8),
    text_es: String(b.text_es ?? prev.text_es).slice(0, 160),
    text_en: String(b.text_en ?? prev.text_en).slice(0, 160),
    link: String(b.link ?? prev.link).slice(0, 300),
    newTab: !!b.newTab,
    cta_es: String(b.cta_es ?? prev.cta_es).slice(0, 40),
    cta_en: String(b.cta_en ?? prev.cta_en).slice(0, 40),
    coupon: String(b.coupon ?? prev.coupon).slice(0, 40),
    bg: String(b.bg ?? prev.bg).slice(0, 20),
    bg2: String(b.bg2 ?? prev.bg2).slice(0, 20),
    gradient: !!b.gradient,
    fg: String(b.fg ?? prev.fg).slice(0, 20),
    position: oneOf(b.position, ['top', 'bottom'], prev.position),
    anim: oneOf(b.anim, ['none', 'slide', 'pulse', 'marquee'], prev.anim),
    countdown: b.countdown == null ? prev.countdown : !!b.countdown,
    countdownFmt: oneOf(b.countdownFmt, ['dhms', 'hms'], prev.countdownFmt),
    startsAt: String(b.startsAt ?? prev.startsAt).slice(0, 40),
    endsAt: String(b.endsAt ?? prev.endsAt).slice(0, 40),
    pages: oneOf(b.pages, ['all', 'landing', 'pricing'], prev.pages),
    audience: oneOf(b.audience, ['all', 'guests', 'free'], prev.audience),
    dismissible: b.dismissible == null ? prev.dismissible : !!b.dismissible,
  };
  await saveSetting('promo', next);
  // Si se pide, reiniciar el contador de métricas (al lanzar una promo nueva).
  if (b.resetStats) await saveSetting('promo_stats', STATS0);
  const stats = await getSetting<PromoStats>('promo_stats', STATS0);
  return NextResponse.json({ ok: true, promo: next, stats });
}
