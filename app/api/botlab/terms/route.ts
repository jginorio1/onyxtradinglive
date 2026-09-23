import { NextResponse } from 'next/server';
import { botLabSettings, clampPct } from '@/lib/botlab';
import { academyFeeSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: términos de dinero REALES (editables en admin) que las guías y el chat
// pintan como una sola fuente, para que nunca digan un % o mínimo desincronizado:
//   · Bot Lab: reparto vendedor/Onyx y mínimo de retiro.
//   · Academia: comisión por defecto de Onyx.
// Sin datos sensibles; solo los números que ya se muestran al público.
export async function GET() {
  try {
    const s = await botLabSettings();
    const onyxPct = clampPct(s.fee_pct);              // % que retiene Onyx en Bot Lab
    const sellerPct = Math.max(0, 100 - onyxPct);     // % que se queda el creador
    const payoutMin = Math.max(0, Math.round((Number(s.payout_min_cents) || 1000) / 100)); // $ mínimo de retiro
    let academyPct = 10;
    try { const af = await academyFeeSettings(); academyPct = Math.max(0, Math.min(50, Math.round(Number(af?.default_pct) || 10))); } catch {}
    return NextResponse.json(
      { bl_seller_pct: sellerPct, bl_onyx_pct: onyxPct, bl_payout_min: payoutMin, academy_fee_pct: academyPct },
      { headers: { 'Cache-Control': 'public, max-age=120' } },
    );
  } catch {
    return NextResponse.json({ bl_seller_pct: 80, bl_onyx_pct: 20, bl_payout_min: 10, academy_fee_pct: 10 });
  }
}
