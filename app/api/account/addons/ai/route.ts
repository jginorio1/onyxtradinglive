import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { addonSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · compra UN paquete de consultas de Onyx AI (PAGO ÚNICO, no recurrente).
// Cobra una vez a la tarjeta que ya tiene guardada y suma las consultas al mes
// en curso. El mes siguiente NO se vuelve a cobrar: si necesita más, compra otro.
function periodNow(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const s = await addonSettings();
    if (!s.ai_pack_enabled) return NextResponse.json({ error: 'Add-on disabled.', code: 'addon_off' }, { status: 400 });

    const qty = Math.max(1, Math.min(10, Number((await req.json())?.qty) || 1));  // cuántos paquetes a la vez
    const perPack = Math.max(1, Number(s.ai_pack_qty || 100));
    const price = Math.max(0.5, Number(s.ai_pack_price || 5));
    const amountCents = Math.round(price * 100 * qty);
    const consultas = perPack * qty;

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id,plan').eq('id', user.id).maybeSingle();
    const customer = (prof as any)?.stripe_customer_id;
    if (!customer) return NextResponse.json({ error: 'No payment method on file. Add a card first.', code: 'no_customer' }, { status: 400 });

    // Cobro único a la tarjeta guardada (sin redirección). Factura inmediata.
    try {
      await stripe.invoiceItems.create({ customer, amount: amountCents, currency: 'usd', description: `Onyx AI · +${consultas} consultas` } as any);
      const inv: any = await stripe.invoices.create({ customer, collection_method: 'charge_automatically', auto_advance: true } as any);
      const paid: any = await stripe.invoices.pay(inv.id);
      if (paid?.status !== 'paid') return NextResponse.json({ error: 'Payment not completed.', code: 'not_paid', status: paid?.status }, { status: 402 });
    } catch (e: any) {
      return NextResponse.json({ error: `Stripe: ${e?.message || 'charge failed'}`, code: 'charge' }, { status: 402 });
    }

    // Acredita las consultas al mes en curso (consumible; no se arrastra).
    const period = periodNow();
    try {
      await supabaseAdmin.from('ai_packs').insert({ user_id: user.id, period, qty: consultas, cents: amountCents });
    } catch { /* si la tabla no existe aún, el cobro ya se hizo; se reintenta el registro manual */ }

    return NextResponse.json({ ok: true, added: consultas, period });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
