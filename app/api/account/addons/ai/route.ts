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

    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id,plan,stripe_subscription_id,is_admin,role').eq('id', user.id).maybeSingle();

    // Gating por plan (igual que aiAllowance.canBuy): el paquete de análisis es un
    // BENEFICIO de los planes de pago. Un usuario del plan gratis NO puede comprarlo
    // por API (la UI ya le oculta el botón): si pudiera, tendría análisis baratos
    // sin hacer upgrade y rompería el incentivo de subir de plan. Debe usar el pago
    // por uso (monedero) o subir de plan. El equipo (staff) no compra: no tiene tope.
    const plan = (prof as any)?.plan || 'free';
    const staff = !!((prof as any)?.is_admin || (prof as any)?.role);
    if (plan === 'free' || staff) {
      return NextResponse.json({ error: 'El paquete de análisis es para planes de pago. Sube de plan o usa el pago por uso.', code: 'plan_required' }, { status: 403 });
    }

    const customer = (prof as any)?.stripe_customer_id;
    if (!customer) return NextResponse.json({ error: 'No payment method on file. Add a card first.', code: 'no_customer' }, { status: 400 });

    // Método de pago a usar: el por defecto del cliente; si no, el de su
    // suscripción; si no, la primera tarjeta guardada. Stripe exige uno explícito
    // cuando el cliente no tiene default fijado (si no, "no default_payment_method").
    let pm: string | undefined;
    try {
      const cust: any = await stripe.customers.retrieve(customer);
      pm = cust?.invoice_settings?.default_payment_method || undefined;
      if (!pm && (prof as any)?.stripe_subscription_id) {
        try { const sub: any = await stripe.subscriptions.retrieve((prof as any).stripe_subscription_id); pm = sub?.default_payment_method || undefined; } catch {}
      }
      if (!pm) {
        const list: any = await stripe.paymentMethods.list({ customer, type: 'card', limit: 1 });
        pm = list?.data?.[0]?.id || undefined;
      }
    } catch {}
    if (!pm) return NextResponse.json({ error: 'No tienes una tarjeta guardada. Agrega una primero.', code: 'no_pm' }, { status: 400 });

    // Cobro único a la tarjeta guardada (sin redirección). Factura inmediata.
    // IMPORTANTE: creamos la factura PRIMERO y colgamos el cargo DE esa factura
    // (invoice: inv.id). Si se crea el invoiceItem suelto y luego la factura sin
    // incluirlo, la factura sale en $0 y el cobro queda huérfano (bug anterior).
    try {
      const inv: any = await stripe.invoices.create({ customer, collection_method: 'charge_automatically', auto_advance: false, default_payment_method: pm } as any);
      await stripe.invoiceItems.create({ customer, invoice: inv.id, amount: amountCents, currency: 'usd', description: `Onyx AI · +${consultas} consultas` } as any);
      await stripe.invoices.finalizeInvoice(inv.id);
      const paid: any = await stripe.invoices.pay(inv.id, { payment_method: pm } as any);
      if (paid?.status !== 'paid') return NextResponse.json({ error: 'Payment not completed.', code: 'not_paid', status: paid?.status }, { status: 402 });
      // Red de seguridad: si por lo que sea el total quedó en 0, NO acreditamos.
      if (Number(paid?.amount_paid || 0) < amountCents) return NextResponse.json({ error: 'Charged amount did not match.', code: 'amount_mismatch', paid: paid?.amount_paid }, { status: 402 });
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
