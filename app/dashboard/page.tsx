import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await sb.from('profiles').select('plan').eq('id', user.id).single();
  const { data: accounts } = await sb.from('trading_accounts').select('id,login,nickname,broker,platform,balance,currency').eq('user_id', user.id);
  const accIds = (accounts || []).map((a: any) => a.id);

  let trades: any[] = [];
  if (accIds.length) {
    const { data } = await sb.from('trades')
      .select('account_id,symbol,side,volume,open_time,close_time,net_profit')
      .in('account_id', accIds).order('close_time', { ascending: false }).limit(5000);
    trades = data || [];
  }

  return <DashboardClient email={user.email || ''} plan={profile?.plan || 'free'} accounts={(accounts || []) as any} trades={trades as any} />;
}
