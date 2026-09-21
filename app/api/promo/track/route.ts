import { NextResponse } from 'next/server';
import { getSetting, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Stats = Record<string, { views: number; clicks: number }>;

// POST · registra una vista o un clic de una barra concreta. Público y tolerante.
// { id: string, ev: 'view' | 'click' }
export async function POST(req: Request) {
  try {
    const { id, ev } = await req.json().catch(() => ({} as any));
    if (!id || (ev !== 'view' && ev !== 'click')) return NextResponse.json({ ok: false });
    const s = await getSetting<Stats>('promo_stats', {} as Stats);
    const cur = s[id] || { views: 0, clicks: 0 };
    if (ev === 'view') cur.views = Number(cur.views || 0) + 1; else cur.clicks = Number(cur.clicks || 0) + 1;
    s[id] = cur;
    await saveSetting('promo_stats', s);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}
