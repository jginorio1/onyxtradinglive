import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureMentor } from '@/lib/academy';
import { onboardingLink, connectStatus, expressLoginLink } from '@/lib/stripeConnect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return { user, caps: (plan?.capabilities as any) || {} };
}

export async function GET() {
  const { user, caps } = await me();
  if (!user || !caps?.academy) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ configured: false });
  const st = await connectStatus(user.id);
  const dash = st.chargesEnabled ? await expressLoginLink(user.id) : null;
  return NextResponse.json({ configured: true, ...st, dashboard: dash });
}

// POST · genera el enlace de onboarding de Stripe Connect (crea la cuenta si falta).
export async function POST() {
  const { user, caps } = await me();
  if (!user || !caps?.academy) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_off' }, { status: 400 });
  await ensureMentor(user.id);
  const url = await onboardingLink(user.id, user.email || undefined);
  return NextResponse.json({ url });
}
