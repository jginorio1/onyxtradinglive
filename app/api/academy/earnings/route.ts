import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor } from '@/lib/academy';
import { mentorPayoutDetail } from '@/lib/academyBilling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ingresos del mentor: ventas, comisión de Onyx, saldo y payouts (solo el mentor).
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  // Debe tener la capacidad de academia Y ser mentor (tener su academia creada).
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  if (!((plan?.capabilities as any)?.academy)) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const mentor = await getMentor(user.id);
  if (!mentor) return NextResponse.json({ error: 'no_mentor' }, { status: 400 });
  return NextResponse.json(await mentorPayoutDetail(user.id));
}
