import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FIELDS = 'id,email,plan,subscription_status,stripe_customer_id,stripe_subscription_id,full_name,timezone,lang,notify_email,notify_weekly,notify_funding,notify_marketing,created_at';

// GET · todo lo que necesita la página Mi cuenta
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const { data: prof } = await supabaseAdmin.from('profiles').select(FIELDS).eq('id', user.id).single();
    const { data: plans } = await supabaseAdmin.from('plans').select('*').eq('active', true).order('sort', { ascending: true });
    const { data: accounts } = await supabaseAdmin.from('trading_accounts').select('id,login,broker,server,platform,balance,last_sync_at').eq('user_id', user.id).order('created_at', { ascending: true });
    const { data: keys } = await supabaseAdmin.from('api_keys').select('key,label,revoked,last_used_at').eq('user_id', user.id).eq('revoked', false).limit(1);

    // Datos de la suscripción en Stripe (si tiene)
    let sub: any = null;
    if (prof?.stripe_subscription_id) {
      try {
        const s: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
        sub = {
          status: s.status,
          currentPeriodEnd: s.current_period_end ? s.current_period_end * 1000 : null,
          cancelAtPeriodEnd: !!s.cancel_at_period_end,
          interval: s.items?.data?.[0]?.price?.recurring?.interval || 'month',
          amount: (s.items?.data?.[0]?.price?.unit_amount || 0) / 100,
          currency: (s.items?.data?.[0]?.price?.currency || 'usd').toUpperCase(),
        };
      } catch { /* la suscripción pudo borrarse en Stripe */ }
    }

    return NextResponse.json({
      profile: prof || null,
      plans: plans || [],
      accounts: accounts || [],
      apiKey: keys?.[0]?.key || null,
      subscription: sub,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · guardar datos del perfil y preferencias
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const b = await req.json();
    const fields: any = {};
    ['full_name', 'timezone', 'lang'].forEach((k) => { if (b[k] !== undefined) fields[k] = String(b[k] || '').slice(0, 120); });
    ['notify_email', 'notify_weekly', 'notify_funding', 'notify_marketing'].forEach((k) => { if (b[k] !== undefined) fields[k] = !!b[k]; });
    if (!Object.keys(fields).length) return NextResponse.json({ ok: true });

    const { error } = await supabaseAdmin.from('profiles').update(fields).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
