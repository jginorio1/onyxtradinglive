import { NextResponse } from 'next/server';
import { getSetting, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PromoStats = { views: number; clicks: number };
const STATS0: PromoStats = { views: 0, clicks: 0 };

// POST · registra una vista o un clic de la barra de descuentos. Público y
// tolerante: si algo falla, nunca rompe el landing. { ev: 'view' | 'click' }
export async function POST(req: Request) {
  try {
    const { ev } = await req.json().catch(() => ({} as any));
    if (ev !== 'view' && ev !== 'click') return NextResponse.json({ ok: false });
    const s = await getSetting<PromoStats>('promo_stats', STATS0);
    const next = { views: Number(s.views || 0), clicks: Number(s.clicks || 0) };
    if (ev === 'view') next.views++; else next.clicks++;
    await saveSetting('promo_stats', next);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}
