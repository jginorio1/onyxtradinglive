import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { myProducts, saveProduct, deleteProduct, sellerEarnings, sellerConnectStatus, sellerOnboardingLink, listPayouts, createPayout } from '@/lib/botlab';
import { botScore } from '@/lib/botScore';

// Historial mínimo REAL para poder poner un robot a la venta (evita mandar a
// revisión robots recién creados sin operaciones). Ajustable a futuro.
const MIN_TRADES_TO_SELL = 20;
const MIN_DAYS_TO_SELL = 7;

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
  if (b.action === 'save') {
    // Requisito de historial REAL: el robot debe haber operado antes de venderse.
    // Así no llega a revisión un robot recién construido sin operaciones.
    const p = b.product || {};
    const text = [p.name, p.tagline, p.description].filter(Boolean).join(' \n ');
    const s = await botScore({ sellerId: user.id, accountId: p.bot_account, magic: p.bot_magic, text });
    if (!s.hasData) {
      return NextResponse.json({ error: 'Este robot aún no tiene operaciones reales. Instálalo, déjalo operar y podrás venderlo cuando tenga historial.' }, { status: 400 });
    }
    if (s.trades < MIN_TRADES_TO_SELL || s.days < MIN_DAYS_TO_SELL) {
      return NextResponse.json({ error: `Aún es pronto para venderlo. Necesita al menos ${MIN_TRADES_TO_SELL} operaciones y ${MIN_DAYS_TO_SELL} días operando (lleva ${s.trades} operaciones · ${s.days} días).` }, { status: 400 });
    }
    const r = await saveProduct(user.id, p, false);
    return NextResponse.json({ ok: true, id: r?.id });
  }
  if (b.action === 'delete') { await deleteProduct(user.id, String(b.id || ''), false); return NextResponse.json({ ok: true }); }
  if (b.action === 'payout') {
    const e = await sellerEarnings(user.id);
    if (e.availableCents < 1000) return NextResponse.json({ error: 'Necesitas al menos $10 disponibles para retirar.' }, { status: 400 });
    await createPayout({ sellerId: user.id, amountCents: e.availableCents, method: b.method === 'usdt' ? 'usdt' : 'stripe', destination: b.destination || null, note: 'Solicitado por el creador' });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
