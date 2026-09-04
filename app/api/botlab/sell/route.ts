import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { myProducts, saveProduct, deleteProduct, sellerEarnings, sellerConnectStatus, sellerOnboardingLink, listPayouts, createPayout } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · panel del creador: sus robots, ganancias, estado de cobro y payouts.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const [products, earnings, connect, payouts] = await Promise.all([
    myProducts(user.id), sellerEarnings(user.id), sellerConnectStatus(user.id), listPayouts(user.id),
  ]);
  return NextResponse.json({ products, earnings, connect, payouts });
}

// POST · acciones del creador: guardar/borrar robot, conectar cobro, pedir retiro.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'connect') {
    try { const url = await sellerOnboardingLink(user.id, user.email || undefined); return NextResponse.json({ url }); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'No se pudo iniciar el cobro.' }, { status: 500 }); }
  }
  if (b.action === 'save') { const r = await saveProduct(user.id, b.product || {}, false); return NextResponse.json({ ok: true, id: r?.id }); }
  if (b.action === 'delete') { await deleteProduct(user.id, String(b.id || ''), false); return NextResponse.json({ ok: true }); }
  if (b.action === 'payout') {
    const e = await sellerEarnings(user.id);
    if (e.availableCents < 1000) return NextResponse.json({ error: 'Necesitas al menos $10 disponibles para retirar.' }, { status: 400 });
    await createPayout({ sellerId: user.id, amountCents: e.availableCents, method: b.method === 'usdt' ? 'usdt' : 'stripe', destination: b.destination || null, note: 'Solicitado por el creador' });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
