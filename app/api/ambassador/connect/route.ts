import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambOnboardingLink, ambConnectStatus, ambExpressLoginLink } from '@/lib/ambassadorPayout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · estado de la cuenta Connect del embajador (para cobrar por Stripe)
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const { data: amb } = await supabaseAdmin.from('ambassadors').select('id').eq('user_id', user.id).maybeSingle();
    if (!amb) return NextResponse.json({ connected: false, payoutsEnabled: false });
    const st = await ambConnectStatus(amb.id);
    const dash = st.payoutsEnabled ? await ambExpressLoginLink(amb.id) : null;
    return NextResponse.json({ ...st, dashboard: dash });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · genera el enlace de onboarding de Stripe (crea la cuenta Express si hace falta)
export async function POST() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const { data: amb } = await supabaseAdmin.from('ambassadors').select('id').eq('user_id', user.id).maybeSingle();
    if (!amb) return NextResponse.json({ error: 'Not an ambassador.', code: 'not_ambassador' }, { status: 403 });
    const url = await ambOnboardingLink(amb.id, user.id, user.email || undefined);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
