import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { offerInfo } from '@/lib/academyCopy';
import { copyMentorSettings } from '@/lib/settings';
import { checkoutForCopy } from '@/lib/stripeConnect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · el alumno se suscribe al copy del mentor → URL de Stripe Checkout.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_off' }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const mentorId = String(b.mentor_id || '');
  if (!mentorId) return NextResponse.json({ error: 'falta mentor' }, { status: 400 });

  const info = await offerInfo(mentorId);
  if (!info.available) return NextResponse.json({ error: 'copy_off' }, { status: 400 });

  const { data: mentor } = await supabaseAdmin.from('mentors')
    .select('stripe_account_id,charges_enabled,code').eq('user_id', mentorId).maybeSingle();
  if (!mentor || !(mentor as any).stripe_account_id || !(mentor as any).charges_enabled) {
    return NextResponse.json({ error: 'mentor_not_ready' }, { status: 400 });
  }

  const s = await copyMentorSettings();
  const session = await checkoutForCopy({
    mentorId, mentorAccount: (mentor as any).stripe_account_id,
    priceCents: info.priceCents!, currency: info.currency || 'usd', code: (mentor as any).code,
    studentId: user.id, customerEmail: user.email || undefined, feePct: s.onyx_fee_pct,
  });
  return NextResponse.json({ url: session.url });
}
