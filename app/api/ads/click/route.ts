import { NextResponse } from 'next/server';
import { bumpAd, recordEvent, deviceFromUA } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · registra un clic en un anuncio pagado (se llama con navigator.sendBeacon).
// Suma al contador y al reporte diario + gasto CPC según el modelo de la campaña.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({} as any));
    if (b?.id) {
      await bumpAd(String(b.id), 'click');
      const ua = req.headers.get('user-agent') || '';
      const country = (req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '').toUpperCase();
      await recordEvent(String(b.id), 'click', { country, device: deviceFromUA(ua) });
    }
  } catch {}
  return NextResponse.json({ ok: true });
}
