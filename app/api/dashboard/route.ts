import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Devuelve cuentas + operaciones del usuario (para el auto-refresco del dashboard).
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { data: accounts } = await sb.from('trading_accounts')
      .select('id,login,nickname,broker,platform,balance,currency,fund_target,fund_max_daily,fund_max_total,fund_start,acc_type,challenge_status,challenge_cost')
      .eq('user_id', user.id);
    const accIds = (accounts || []).map((a: any) => a.id);

    let trades: any[] = [];
    if (accIds.length) {
      const { data } = await sb.from('trades')
        .select('id,account_id,symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap')
        .in('account_id', accIds).order('close_time', { ascending: false }).limit(5000);
      trades = data || [];
    }
    return NextResponse.json({ accounts: accounts || [], trades });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
