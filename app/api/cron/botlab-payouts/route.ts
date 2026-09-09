import { NextResponse } from 'next/server';
import { autoBotPayoutDue } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Cron de pagos automáticos de Bot Lab. Paga SOLO el saldo MADURO por Stripe a
// los creadores con cobro conectado. Respeta el freno global (payout_review),
// el interruptor (payout_auto) y el mínimo (payout_min_cents), todo editable en
// Admin → Bot Lab → Ajustes. USDT nunca se automatiza (lo envía el admin a mano).
// Protegido por CRON_SECRET (cabecera Authorization o ?key=).
// ============================================================
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const auth = req.headers.get('authorization') || '';
    const ok = auth === `Bearer ${secret}` || url.searchParams.get('key') === secret;
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  try {
    const r = await autoBotPayoutDue();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
