import { redirect, notFound } from 'next/navigation';
import { getAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { serverLang } from '@/lib/locale';
import { serverLocked, userHasPin, userPinIsTemp, IDLE_MIN } from '@/lib/adminSecurity';
import AdminClient from './AdminClient';
import LockScreen from './LockScreen';
import ChangePin from './ChangePin';
import TwoFactorGate from './TwoFactorGate';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const { user, isAdmin, role, perms } = await getAdmin();
  if (!user) redirect('/login');
  // Para un usuario logueado que NO es admin, el panel simplemente "no existe":
  // devolvemos 404 en vez de confirmarle que aquí hay una zona de administración.
  if (!isAdmin) notFound();

  // 2FA OBLIGATORIO para administradores. Sin factor → obligar a activarlo;
  // con factor pero sin verificar en esta sesión → pedir el código.
  {
    const sb = createSupabaseServer();
    const lang = serverLang();
    try {
      const { data: factors } = await sb.auth.mfa.listFactors();
      const hasVerified = (factors?.totp || []).some((f: any) => f.status === 'verified');
      if (!hasVerified) return <TwoFactorGate mode="enroll" lang={lang} />;
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel !== 'aal2') return <TwoFactorGate mode="challenge" lang={lang} />;
    } catch { /* si la comprobación falla, no bloqueamos el panel por un fallo transitorio */ }
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
