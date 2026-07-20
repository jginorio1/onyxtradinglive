import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { computeStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';

function money(n: number) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

export default async function Dashboard() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await sb.from('profiles').select('plan,subscription_status').eq('id', user.id).single();
  const { data: accounts } = await sb.from('trading_accounts').select('*').eq('user_id', user.id);
  const accIds = (accounts || []).map((a: any) => a.id);
  let trades: any[] = [];
  if (accIds.length) {
    const { data } = await sb.from('trades')
      .select('symbol,side,volume,close_time,net_profit')
      .in('account_id', accIds).order('close_time', { ascending: false }).limit(1000);
    trades = data || [];
  }
  const s = computeStats(trades as any);

  // curva de equity -> puntos SVG
  const eq = s.equity;
  const W = 720, H = 180;
  let path = '';
  if (eq.length > 1) {
    const min = Math.min(...eq.map(e => e.v)), max = Math.max(...eq.map(e => e.v));
    const rng = (max - min) || 1;
    path = eq.map((e, i) => {
      const x = (i / (eq.length - 1)) * W;
      const y = H - ((e.v - min) / rng) * (H - 20) - 10;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

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
          <span className="pill green">Plan: {profile?.plan || 'free'}</span>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost">Salir</button></form>
        </div>
      </div></div>

      <div className="wrap" style={{ padding: '28px 22px' }}>
        <h1 style={{ marginBottom: 6 }}>Resumen</h1>
        <p className="muted" style={{ marginBottom: 22 }}>{user.email}</p>

        {(!accounts || accounts.length === 0) && (
          <div className="card" style={{ marginBottom: 22 }}>
            <h3>Conecta tu primera cuenta</h3>
            <p className="muted" style={{ margin: '8px 0 14px' }}>Instala el Onyx Connector (MT4/MT5), crea una API key y en segundos verás tus operaciones aquí.</p>
            <Link className="btn btn-primary" href="/dashboard/keys">Conectar cuenta →</Link>
          </div>
        )}

        <div className="grid g4" style={{ marginBottom: 18 }}>
          <div className="card kpi"><div className="lbl">Ganancia neta</div><div className={'val ' + (s.net >= 0 ? 'pos' : 'neg')}>{money(s.net)}</div></div>
          <div className="card kpi"><div className="lbl">Win rate</div><div className="val">{s.winRate.toFixed(0)}%</div></div>
          <div className="card kpi"><div className="lbl">Profit factor</div><div className="val">{s.profitFactor.toFixed(2)}</div></div>
          <div className="card kpi"><div className="lbl">Operaciones</div><div className="val">{s.trades}</div></div>
        </div>

        <div className="grid g2">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Curva de equity</h3>
            {eq.length > 1 ? (
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
                <path d={path} fill="none" stroke="#6c8cff" strokeWidth="2.5" />
              </svg>
            ) : <p className="muted">Aún no hay suficientes operaciones.</p>}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Cuentas conectadas</h3>
            {accounts && accounts.length ? (
              <table><tbody>
                {accounts.map((a: any) => (
                  <tr key={a.id}>
                    <td>#{a.login} <span className="muted">· {a.platform}</span></td>
                    <td className="muted">{a.broker}</td>
                    <td style={{ textAlign: 'right' }}>${Number(a.balance || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="muted">Ninguna todavía.</p>}
          </div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 12 }}>Últimas operaciones</h3>
          {trades.length ? (
            <table>
              <thead><tr><th>Símbolo</th><th>Lado</th><th>Vol</th><th>Cierre</th><th style={{ textAlign: 'right' }}>Neto</th></tr></thead>
              <tbody>
                {trades.slice(0, 20).map((t: any, i: number) => (
                  <tr key={i}>
                    <td>{t.symbol}</td>
                    <td className="muted">{t.side}</td>
                    <td className="muted">{t.volume}</td>
                    <td className="muted">{new Date(t.close_time).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }} className={Number(t.net_profit) >= 0 ? 'pos' : 'neg'}>{money(Number(t.net_profit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Sin operaciones aún.</p>}
        </div>
      </div>
    </>
  );
}
