import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · crea o valida un código promocional en Stripe para que el descuento se
// aplique automático en el checkout (allow_promotion_codes ya está activo).
// body: { code, percent, endsAt? }  ·  action GET-like con ?code= para validar.
export async function POST(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede gestionar cupones.' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const code = String(b.code || '').trim().toUpperCase();
    const percent = Math.max(1, Math.min(100, Math.round(Number(b.percent) || 0)));
    if (!code) return NextResponse.json({ error: 'Escribe un código.' }, { status: 400 });

    // ¿Ya existe ese promotion code activo? Si sí, lo damos por válido.
    const found = await stripe.promotionCodes.list({ code, limit: 1 });
    if (found.data.length) {
      const pc: any = found.data[0];
      const pct = pc.coupon?.percent_off;
      return NextResponse.json({ ok: true, existed: true, code, percent: pct ?? null, active: pc.active });
    }

    if (b.validateOnly) return NextResponse.json({ ok: false, existed: false, code });
    if (!percent) return NextResponse.json({ error: 'Indica el % de descuento para crearlo.' }, { status: 400 });

    // Crear cupón (% off) y el promotion code con el texto exacto.
    const coupon = await stripe.coupons.create({ percent_off: percent, duration: 'once', name: `Onyx ${code}` });
    const params: any = { coupon: coupon.id, code };
    if (b.endsAt) { const t = Math.floor(new Date(b.endsAt).getTime() / 1000); if (!isNaN(t) && t > Date.now() / 1000) params.expires_at = t; }
    const promo = await stripe.promotionCodes.create(params);
    return NextResponse.json({ ok: true, existed: false, created: true, code: promo.code, percent });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}` }, { status: 500 });
  }
}
