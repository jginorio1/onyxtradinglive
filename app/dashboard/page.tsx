import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // La sesión decide QUIÉN eres; los datos se leen con la clave de servidor
  // filtrando siempre por tu id, para no depender de las políticas de la base.
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();

  // Perfil de trader (para el saludo personalizado). Tolerante si onboarding_v1.sql aún no corrió.
  let tp: any = {};
  try {
    const { data } = await supabaseAdmin.from('profiles').select('full_name,trade_style,experience,platform,goal').eq('id', user!.id).maybeSingle();
    tp = data || {};
  } catch { /* columnas del perfil aún no creadas */ }
  // Si el nombre no llegó a profiles pero sí está en los metadatos del registro, lo sincronizamos una vez.
  let fullName: string = tp.full_name || '';
  if (!fullName && (user!.user_metadata as any)?.full_name) {
    fullName = String((user!.user_metadata as any).full_name);
    try { await supabaseAdmin.from('profiles').update({ full_name: fullName }).eq('id', user!.id); } catch {}
  }
  const traderProfile = { full_name: fullName, trade_style: tp.trade_style || '', experience: tp.experience || '', platform: tp.platform || '', goal: tp.goal || '' };

  // Onboarding: la primera vez lo mostramos una sola vez. Consulta aparte y
  // tolerante — si la columna aún no existe (SQL sin correr), no rompe el panel.
  // OJO: redirect() lanza una excepción interna, por eso va FUERA del try/catch.
  let needsOnboarding = false;
  try {
    const { data: ob, error } = await supabaseAdmin.from('profiles').select('onboarded_at').eq('id', user.id).maybeSingle();
    if (!error && ob && ob.onboarded_at === null) needsOnboarding = true;
  } catch { /* columna aún no creada: ignorar hasta correr onboarding_v1.sql */ }
  if (needsOnboarding) redirect('/onboarding');

  const { data: accounts } = await supabaseAdmin
    .from('trading_accounts')
    .select('id,login,nickname,broker,platform,balance,currency,fund_target,fund_max_daily,fund_max_total,fund_start,acc_type,challenge_status,challenge_cost')
    .eq('user_id', user.id);

  const accIds = (accounts || []).map((a: any) => a.id);

  let trades: any[] = [];
  if (accIds.length) {
    const { data } = await supabaseAdmin.from('trades')
      .select('id,account_id,symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap')
      .in('account_id', accIds).order('close_time', { ascending: false }).limit(5000);
    trades = data || [];
  }

  return <DashboardClient email={user.email || ''} plan={profile?.plan || 'free'} profile={traderProfile} accounts={(accounts || []) as any} trades={trades as any} />;
}
