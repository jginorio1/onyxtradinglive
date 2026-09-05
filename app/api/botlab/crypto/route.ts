import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { submitTxid } from '@/lib/cryptoPay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · el cliente reporta el hash (txid) de su pago USDT. { paymentId, txid }
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const b = await req.json().catch(() => ({}));
  const pid = String(b.paymentId || ''); const txid = String(b.txid || '').trim();
  if (!pid || !txid) return NextResponse.json({ error: 'Pega el hash de tu transacción.' }, { status: 400 });
  await submitTxid(pid, user?.id || null, txid);
  return NextResponse.json({ ok: true });
}
