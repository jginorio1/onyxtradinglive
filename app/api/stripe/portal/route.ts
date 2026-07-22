import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';

export async function POST() {
  try {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

  const { data: prof } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  if (!prof?.stripe_customer_id) return NextResponse.json({ error: 'No active subscription yet.', code: 'no_sub' }, { status: 400 });

  let base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (!base) base = 'https://onyxtradinglive.com';
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

  const session = await stripe.billingPortal.sessions.create({
    customer: prof.stripe_customer_id,
    return_url: `${base}/account`,
  });
  return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: `Stripe: ${e?.message || 'unknown error'}`, code: 'stripe' }, { status: 500 });
  }
}
