import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings, balances } from '@/lib/ambassadors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · el embajador solicita cobrar su saldo disponible
export async function POST() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { data: amb } = await supabaseAdmin.from('ambassadors').select('*').eq('user_id', user.id).maybeSingle();
    if (!amb || amb.status !== 'approved') return NextResponse.json({ error: 'Not an ambassador.', code: 'not_ambassador' }, { status: 403 });

    const settings = await ambSettings();
    const bal = await balances(amb.id);

    if (bal.available < settings.min_payout) {
      return NextResponse.json({ error: `Minimum ${settings.min_payout}.`, code: 'below_min', min: settings.min_payout }, { status: 400 });
    }
    if (!amb.payout_details) {
      return NextResponse.json({ error: 'Missing payout details.', code: 'no_payout_details' }, { status: 400 });
    }
    const { data: openPay } = await supabaseAdmin.from('ambassador_payouts').select('id').eq('ambassador_id', amb.id).eq('status', 'requested').maybeSingle();
    if (openPay) return NextResponse.json({ error: 'Payout already requested.', code: 'payout_pending' }, { status: 400 });

    const { data: pay, error } = await supabaseAdmin.from('ambassador_payouts').insert({
      ambassador_id: amb.id, amount: bal.available, method: amb.payout_method, details: amb.payout_details, status: 'requested',
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Reservamos esas comisiones para este pago
    const now = new Date().toISOString();
    await supabaseAdmin.from('commissions').update({ payout_id: pay.id })
      .eq('ambassador_id', amb.id).in('status', ['pending', 'available']).lte('available_at', now).is('payout_id', null);

    return NextResponse.json({ ok: true, amount: bal.available });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
