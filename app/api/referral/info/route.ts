import { NextResponse } from 'next/server';
import { memberReferralSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;      // nunca cachear en el servidor
export const runtime = 'nodejs';

// Cabeceras agresivas para que NI Vercel/CDN NI el navegador guarden la respuesta:
// así, al cambiar los créditos en admin, la página /invita se actualiza al instante.
const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

// GET público · montos del programa "Invita y gana" para la landing (sin sesión).
export async function GET() {
  try {
    const s = await memberReferralSettings();
    return NextResponse.json({
      enabled: s.enabled,
      referrerCredit: s.referrer_credit,
      friendCredit: s.friend_credit,
      holdDays: s.hold_days,
      bridge: s.bridge_threshold,
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ enabled: true, referrerCredit: 10, friendCredit: 10, holdDays: 21, bridge: 5 }, { headers: NO_STORE });
  }
}
