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
      .eq('user_id', user.id)
      // Orden ESTABLE (por creación) para que los chips no se reordenen en cada refresco.
      .order('created_at', { ascending: true }).order('id', { ascending: true });
    const accIds = (accounts || []).map((a: any) => a.id);

    let trades: any[] = [];
    if (accIds.length) {
      const FULL = 'id,account_id,symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap,position_id,exit_reason,closed_volume';
      const BASE = 'id,account_id,symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap';
      let { data, error } = await sb.from('trades')
        .select(FULL).in('account_id', accIds).order('close_time', { ascending: false }).limit(5000);
      // Tolerante: si aún no existen las columnas de parciales (partials.sql sin correr),
      // reintentamos con las columnas base para no dejar el dashboard vacío.
      if (error) {
        const r2 = await sb.from('trades')
          .select(BASE).in('account_id', accIds).order('close_time', { ascending: false }).limit(5000);
        data = r2.data as any[];
      }
      trades = data || [];
    }
    return NextResponse.json({ accounts: accounts || [], trades });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
