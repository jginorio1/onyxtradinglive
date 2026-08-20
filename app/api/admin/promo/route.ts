import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { type Promo, type PromoQueue, PROMO0, blankPromo, newId } from '@/lib/promo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Stats = Record<string, { views: number; clicks: number }>;

const oneOf = <T extends string>(v: any, allowed: T[], fb: T): T => (allowed.includes(v) ? v : fb);

// Sanea una barra que llega del cliente (respeta lo previo si falta).
function clean(b: any, prev: Promo): Promo {
  return {
    id: String(b.id || prev.id || newId()),
    on: b.on == null ? prev.on : !!b.on,
    name: String(b.name ?? prev.name).slice(0, 40),
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
    sticky: b.sticky == null ? prev.sticky : !!b.sticky,
    anim: oneOf(b.anim, ['none', 'slide', 'pulse', 'marquee'], prev.anim),
    speed: oneOf(b.speed, ['slow', 'normal', 'fast'], prev.speed),
    countdown: b.countdown == null ? prev.countdown : !!b.countdown,
    countdownFmt: oneOf(b.countdownFmt, ['dhms', 'hms'], prev.countdownFmt),
    startsAt: String(b.startsAt ?? prev.startsAt).slice(0, 40),
    endsAt: String(b.endsAt ?? prev.endsAt).slice(0, 40),
    pages: oneOf(b.pages, ['all', 'landing', 'pricing'], prev.pages),
    audience: oneOf(b.audience, ['all', 'guests', 'free'], prev.audience),
    dismissible: b.dismissible == null ? prev.dismissible : !!b.dismissible,
  };
}

// Lee la cola; si no existe pero hay una barra vieja ('promo'), la migra.
async function loadQueue(): Promise<PromoQueue> {
  const q = await getSetting<PromoQueue | null>('promo_queue', null as any);
  if (q && Array.isArray(q.bars)) return { bars: q.bars.map((b) => ({ ...blankPromo(), ...b })) };
  const old = await getSetting<Promo | null>('promo', null as any);
  if (old && (old.text_es || old.text_en)) return { bars: [{ ...blankPromo(), ...old, id: old.id || 'default', name: old.name || 'Barra' }] };
  return { bars: [] };
}

// GET · la cola de barras + métricas por barra.
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const queue = await loadQueue();
  const stats = await getSetting<Stats>('promo_stats', {} as Stats);
  return NextResponse.json({ bars: queue.bars, stats });
}

// PATCH · guardar la cola completa (owner). { bars: Promo[], resetStatsId? }
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede editar la barra.' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const incoming = Array.isArray(b.bars) ? b.bars : [];
  const bars: Promo[] = incoming.slice(0, 40).map((x: any) => clean(x, blankPromo()));
  await saveSetting('promo_queue', { bars });

  // Reiniciar métricas de una barra concreta si se pide.
  if (b.resetStatsId) {
    const stats = await getSetting<Stats>('promo_stats', {} as Stats);
    delete stats[b.resetStatsId];
    await saveSetting('promo_stats', stats);
  }
  const stats = await getSetting<Stats>('promo_stats', {} as Stats);
  return NextResponse.json({ ok: true, bars, stats });
}
