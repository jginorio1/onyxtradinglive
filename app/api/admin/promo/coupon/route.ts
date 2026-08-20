import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · crea, valida o ACTUALIZA un código promocional en Stripe para que el
// descuento se aplique solo en el checkout (allow_promotion_codes ya está activo).
// Stripe no permite dos códigos activos con el mismo texto: si existe uno con otro
// %, lo desactivamos y creamos uno nuevo con el % pedido (los que ya lo aplicaron
// conservan su descuento; solo dejan de poder canjearlo nuevos).
// body: { code, percent, endsAt?, validateOnly? }
export async function POST(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede gestionar cupones.' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const code = String(b.code || '').trim().toUpperCase();
    const percent = Math.max(0, Math.min(100, Math.round(Number(b.percent) || 0)));
    if (!code) return NextResponse.json({ error: 'Escribe un código.' }, { status: 400 });

    // ¿Hay un promotion code ACTIVO con ese texto?
    const active = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
    const existing: any = active.data[0];
    const existingPct = existing?.coupon?.percent_off ?? null;

    // Existe y coincide con el % pedido (o no se pidió %): lo damos por válido.
    if (existing && (!percent || existingPct === percent)) {
      return NextResponse.json({ ok: true, existed: true, code, percent: existingPct });
    }

    // Solo validar: no crea nada.
    if (b.validateOnly) {
      if (existing) return NextResponse.json({ ok: true, existed: true, code, percent: existingPct });
      return NextResponse.json({ ok: false, existed: false, code });
    }

    // Para crear/actualizar hace falta el %.
    if (!percent) return NextResponse.json({ error: 'Indica el % de descuento.' }, { status: 400 });

    // Candado: solo reemplazamos códigos creados por la barra (nombre "Onyx …").
    // Si el código ya lo usa otra parte (Embajador, retención, o creado a mano en
    // Stripe), NO lo tocamos — el admin debe elegir otro texto.
    let oldPercent: number | null = null;
    if (existing) {
      const owned = String(existing.coupon?.name || '').startsWith('Onyx ');
      if (!owned) return NextResponse.json({ error: `El código "${code}" ya se usa en otra parte (p. ej. embajadores). Elige otro texto para esta barra.`, code, inUseElsewhere: true }, { status: 409 });
      oldPercent = existingPct; try { await stripe.promotionCodes.update(existing.id, { active: false }); } catch {}
    }

    const coupon = await stripe.coupons.create({ percent_off: percent, duration: 'once', name: `Onyx ${code}` });
    const params: any = { coupon: coupon.id, code };
    if (b.endsAt) { const t = Math.floor(new Date(b.endsAt).getTime() / 1000); if (!isNaN(t) && t > Date.now() / 1000) params.expires_at = t; }
    const promo = await stripe.promotionCodes.create(params);
    return NextResponse.json({ ok: true, created: !oldPercent, replaced: oldPercent != null, code: promo.code, percent, oldPercent });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}` }, { status: 500 });
  }
}
