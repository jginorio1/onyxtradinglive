import { NextResponse } from 'next/server';
import { memberReferralSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    });
  } catch {
    return NextResponse.json({ enabled: true, referrerCredit: 10, friendCredit: 10, holdDays: 21, bridge: 5 });
  }
}
