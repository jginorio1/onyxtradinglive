import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · SetupIntent para GUARDAR una tarjeta de la auto-recarga con el Payment
// Element DENTRO de Onyx (oscuro, con nuestro tema), sin salir al checkout
// alojado. El número de la tarjeta nunca toca el servidor. Al confirmar en el
// cliente, se llama a /api/wallet/autoreload/save-pm para registrarla.
export async function POST() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });

    // Reutiliza el cliente Stripe ya guardado para la auto-recarga, o crea uno.
    let customer: string | null = null;
    try { const { data } = await supabaseAdmin.from('wallet_autoreload').select('stripe_customer').eq('user_id', user.id).maybeSingle(); customer = (data as any)?.stripe_customer || null; } catch {}
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email || undefined, metadata: { userId: user.id } });
      customer = c.id;
    }
    // Persistimos el cliente YA, para que save-pm lo lea con seguridad (sin confiar
    // en un id enviado por el navegador).
    await supabaseAdmin.from('wallet_autoreload').upsert(
      { user_id: user.id, stripe_customer: customer, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

    const si = await stripe.setupIntents.create({ customer, usage: 'off_session', payment_method_types: ['card'] });
    return NextResponse.json({ clientSecret: si.client_secret });
  } catch (e: any) { await logError('wallet_setup_intent', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
