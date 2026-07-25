import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { serverLocked, userHasPin, userPinIsTemp, IDLE_MIN } from '@/lib/adminSecurity';
import AdminClient from './AdminClient';
import LockScreen from './LockScreen';
import ChangePin from './ChangePin';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const { user, isAdmin, role, perms } = await getAdmin();
  if (!user) redirect('/login');
  if (!isAdmin) {
    return <div className="wrap" style={{ padding: '60px 22px' }}><h1>Acceso restringido</h1><p className="muted">Esta zona es solo para administradores.</p></div>;
  }

  const hasPin = await userHasPin(user.id);

  // Primer acceso con PIN provisional (lo asignó el Owner / llegó por correo):
  // obligamos a cambiarlo por uno propio antes de entrar al panel.
  if (hasPin && await userPinIsTemp(user.id)) {
    return <ChangePin email={user.email || ''} />;
  }

  // Si el panel está bloqueado por inactividad, no cargamos ni enviamos datos:
  // solo la pantalla de PIN. Así la información no llega al navegador bloqueado.
  if (hasPin && serverLocked()) {
    return <LockScreen email={user.email || ''} />;
  }

  const { count: accounts } = await supabaseAdmin.from('trading_accounts').select('*', { count: 'exact', head: true });
  const { count: trades } = await supabaseAdmin.from('trades').select('*', { count: 'exact', head: true });

  return <AdminClient meEmail={user.email || ''} role={role || 'admin'} perms={perms} accounts={accounts || 0} trades={trades || 0} hasPin={hasPin} idleMin={IDLE_MIN} />;
}
