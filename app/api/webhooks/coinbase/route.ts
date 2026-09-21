import { NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/coinbase';
import { confirmByProviderId, rejectCryptoPayment } from '@/lib/cryptoPay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Webhook de Coinbase Commerce. Al confirmarse el pago on-chain, activa el robot
// o el servicio. Idempotente. Configura la URL en Coinbase → Settings → Webhooks.
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-cc-webhook-signature');
  if (!verifyWebhook(raw, sig)) return NextResponse.json({ error: 'firma inválida' }, { status: 400 });
  try {
    const evt = JSON.parse(raw)?.event;
    const type = evt?.type;
    const chargeId = evt?.data?.id as string | undefined;
    if (chargeId) {
      if (type === 'charge:confirmed' || type === 'charge:resolved') {
        await confirmByProviderId(chargeId);
      } else if (type === 'charge:failed') {
        const { data } = await supabaseAdmin.from('crypto_payments').select('id').eq('provider_id', chargeId).maybeSingle();
        if (data) await rejectCryptoPayment((data as any).id);
      }
    }
  } catch { /* no reventar: Coinbase reintenta si devolvemos error */ }
  return NextResponse.json({ received: true });
}
