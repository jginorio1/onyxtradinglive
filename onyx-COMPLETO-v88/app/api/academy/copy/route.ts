import { NextResponse } from 'next/server';
import { copyMentorSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET público · datos del Copy del mentor para el landing y donde se promocione.
// Solo expone lo necesario (on/off + % de Onyx + precio mínimo). Al cambiar el %
// en el panel, todo lo que lea este endpoint se actualiza solo.
export async function GET() {
  const c = await copyMentorSettings();
  return NextResponse.json({
    enabled: !!c.enabled,
    onyxFeePct: c.onyx_fee_pct,
    minPriceCents: c.min_price_cents,
    currency: c.currency || 'usd',
  });
}
