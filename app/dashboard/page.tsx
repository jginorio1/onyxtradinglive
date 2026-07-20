import { redirect } from 'next/navigation';
import Link from 'next/link';
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

  const totalBalance = (accounts || []).reduce((s: number, a: any) => s + Number(a.balance || 0), 0);

  return (
    <>
      <div className="topbar"><div className="wrap">
        <div className="logo"><span className="mark">◆</span> Onyx</div>
        <div className="navl">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/dashboard/keys">Conectar cuenta</Link>
          <Link href="/pricing">Plan</Link>
        </div>
        <div className="row">
          <span className="pill green">{profile?.plan || 'free'}</span>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost">Salir</button></form>
        </div>
      </div></div>

      <div className="wrap" style={{ padding: '24px 22px' }}>
        <div className="row between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ marginBottom: 2 }}>📊 Analíticas</h1>
            <p className="muted" style={{ fontSize: 14 }}>{user.email} · {(accounts || []).length} cuenta(s) · Balance ${totalBalance.toLocaleString()}</p>
          </div>
          <Link className="btn btn-ghost" href="/dashboard/keys">+ Conectar cuenta</Link>
        </div>

        {(!accounts || accounts.length === 0) ? (
          <div className="card">
            <h3>Conecta tu primera cuenta</h3>
            <p className="muted" style={{ margin: '8px 0 14px' }}>Instala el Onyx Connector (MT4/MT5), genera una API key y en segundos verás aquí todas tus estadísticas.</p>
            <Link className="btn btn-primary" href="/dashboard/keys">Conectar cuenta →</Link>
          </div>
        ) : trades.length === 0 ? (
          <div className="card"><p className="muted">Cuenta conectada. En cuanto cierres operaciones, aparecerán aquí tus analíticas.</p></div>
        ) : (
          <DashboardClient trades={trades} accounts={(accounts || []) as any} />
        )}
      </div>
    </>
  );
}
