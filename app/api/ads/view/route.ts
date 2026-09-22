import { NextResponse } from 'next/server';
import { recordEvent, deviceFromUA } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · registra una "vista" viewable (IAB 50%/1s) de un anuncio pagado.
// Se llama con navigator.sendBeacon desde AdSlot.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({} as any));
    if (b?.id) {
      const ua = req.headers.get('user-agent') || '';
      const country = (req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '').toUpperCase();
      await recordEvent(String(b.id), 'view', { country, device: deviceFromUA(ua) });
    }
  } catch {}
  return NextResponse.json({ ok: true });
}
