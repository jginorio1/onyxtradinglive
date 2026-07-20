import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase());
  const isAdmin = admins.includes((user.email || '').toLowerCase());
  if (!isAdmin) {
    return <div className="wrap" style={{ padding: '60px 22px' }}><h1>Acceso restringido</h1><p className="muted">Esta zona es solo para administradores.</p></div>;
  }

  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false });
  const { count: accounts } = await supabaseAdmin.from('trading_accounts').select('*', { count: 'exact', head: true });
  const { count: trades } = await supabaseAdmin.from('trades').select('*', { count: 'exact', head: true });
  const paid = (profiles || []).filter((p: any) => p.plan && p.plan !== 'free').length;

  return (
    <>
      <div className="topbar"><div className="wrap">
        <div className="logo"><span className="mark">◆</span> Onyx · Admin</div>
        <div className="row"><Link className="btn btn-ghost" href="/dashboard">Mi cuenta</Link></div>
      </div></div>

      <div className="wrap" style={{ padding: '28px 22px' }}>
        <h1 style={{ marginBottom: 20 }}>Panel de administrador</h1>
        <div className="grid g4" style={{ marginBottom: 22 }}>
          <div className="card kpi"><div className="lbl">Usuarios</div><div className="val">{profiles?.length || 0}</div></div>
          <div className="card kpi"><div className="lbl">De pago</div><div className="val pos">{paid}</div></div>
          <div className="card kpi"><div className="lbl">Cuentas MT</div><div className="val">{accounts || 0}</div></div>
          <div className="card kpi"><div className="lbl">Operaciones</div><div className="val">{trades || 0}</div></div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Usuarios</h3>
          <table>
            <thead><tr><th>Email</th><th>Plan</th><th>Estado sub.</th><th>Alta</th></tr></thead>
            <tbody>
              {(profiles || []).map((p: any) => (
                <tr key={p.id}>
                  <td>{p.email}</td>
                  <td>{p.plan !== 'free' ? <span className="pill green">{p.plan}</span> : <span className="pill">free</span>}</td>
                  <td className="muted">{p.subscription_status || '—'}</td>
                  <td className="muted">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
