import { NextResponse } from 'next/server';
import { bumpAd } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · registra un clic en un anuncio pagado. Se llama con navigator.sendBeacon.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({} as any));
    if (b?.id) await bumpAd(String(b.id), 'click');
  } catch {}
  return NextResponse.json({ ok: true });
}
