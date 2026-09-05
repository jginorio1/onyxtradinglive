import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { guardianAcademySettings } from '@/lib/settings';
import { guardianStatus } from '@/lib/guardianAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lo que necesita la tarjeta del alumno: precios, si está activo, y qué
// Guardian ya tiene (para no ofrecerle lo que ya posee).
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ enabled: false });

  const s = await guardianAcademySettings();
  const st = await guardianStatus(user.id);
  return NextResponse.json({
    enabled: !!s.enabled,
    proCents: s.pro_cents, eliteCents: s.elite_cents, currency: s.currency,
    tier: st.tier,          // 'none' | 'pro' | 'elite' (comprado en la academia)
    fromPlan: st.fromPlan,  // ya trae Guardian por su plan de Onyx
    hasManager: st.hasManager,
    hasElite: st.hasElite,
  });
}

// POST · crea el checkout de suscripción hacia la cuenta de Stripe de ONYX.
// El precio se toma de los ajustes (no de un Price fijo), con price_data inline.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Inicia sesión.', code: 'no_auth' }, { status: 401 });

    const { tier } = await req.json();
    const lvl = tier === 'elite' ? 'elite' : 'pro';

    const s = await guardianAcademySettings();
    if (!s.enabled) return NextResponse.json({ error: 'No disponible.', code: 'off' }, { status: 400 });
    const cents = lvl === 'elite' ? s.elite_cents : s.pro_cents;
    if (!cents || cents < 100) return NextResponse.json({ error: 'Precio no configurado.', code: 'no_price' }, { status: 400 });

    // No dejar comprar lo que ya se tiene por el plan de Onyx.
    const st = await guardianStatus(user.id);
    if (lvl === 'elite' && st.hasElite) return NextResponse.json({ error: 'Ya tienes Guardian completo.', code: 'has_elite' }, { status: 400 });
    if (lvl === 'pro' && st.hasManager) return NextResponse.json({ error: 'Ya tienes Guardian.', code: 'has_manager' }, { status: 400 });

    let base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
    if (!base) { const u = new URL(req.url); base = `${u.protocol}//${u.host}`; }
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

    // Cliente de Stripe (reutiliza el del perfil o lo crea).
    const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    let customer = prof?.stripe_customer_id;
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email!, metadata: { userId: user.id } });
      customer = c.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }

    const meta = { userId: user.id, kind: 'guardian_academy', tier: lvl };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (s.currency || 'usd').toLowerCase(),
          unit_amount: Math.round(cents),
          recurring: { interval: 'month' },
          product_data: { name: `Onyx Guardian ${lvl === 'elite' ? 'Elite' : 'Pro'}` },
        },
      }],
      success_url: `${base}/dashboard/academy?guardian=success`,
      cancel_url: `${base}/dashboard/academy?guardian=cancel`,
      metadata: meta,
      subscription_data: { metadata: meta },   // la suscripción lleva el kind para el webhook
    } as any);

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'error'}`, code: 'stripe' }, { status: 500 });
  }
}
