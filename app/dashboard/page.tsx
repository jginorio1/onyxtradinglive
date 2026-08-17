import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import DashboardClient from './DashboardClient';
import { guardianOverride } from '@/lib/guardianAccess';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // La sesión decide QUIÉN eres; los datos se leen con la clave de servidor
  // filtrando siempre por tu id, para no depender de las políticas de la base.
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabaseAdmin.from('profiles').select('plan,academy_guardian,academy_guardian_tier').eq('id', user.id).maybeSingle();

  // ¿Se registró para comprar un plan y aún no lo pagó? Lo llevamos al checkout de
  // ese plan (con el descuento de la barra). Atado a la cuenta → funciona aunque el
  // correo se abriera en otro navegador. Se limpia al reenviar para no repetir.
  // OJO: redirect() lanza una excepción interna → va FUERA del try/catch, si no,
  // el catch se la traga y no redirige. Tolerante si la columna aún no existe.
  let pendingDest = '';
  if ((profile?.plan || 'free') === 'free') {
    try {
      const { data: pend } = await supabaseAdmin.from('profiles').select('pending_plan,pending_plan_annual').eq('id', user.id).maybeSingle();
      const pp = (pend as any)?.pending_plan as string | null;
      if (pp && pp !== 'free') {
        await supabaseAdmin.from('profiles').update({ pending_plan: null }).eq('id', user.id);
        pendingDest = `/pricing?plan=${encodeURIComponent(pp)}${(pend as any)?.pending_plan_annual ? '&annual=1' : ''}`;
      }
    } catch { /* columna aún no creada: ignorar */ }
  }
  if (pendingDest) redirect(pendingDest);

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
    let { data, error } = await supabaseAdmin.from('trades')
      .select('id,account_id,symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap,position_id,exit_reason,closed_volume')
      .in('account_id', accIds).order('close_time', { ascending: false }).limit(5000);
    if (error) {
      const r2 = await supabaseAdmin.from('trades')
        .select('id,account_id,symbol,side,volume,open_time,close_time,net_profit,profit,commission,swap')
        .in('account_id', accIds).order('close_time', { ascending: false }).limit(5000);
      data = r2.data as any[];
    }
    trades = data || [];
  }

  return <DashboardClient email={user.email || ''} plan={profile?.plan || 'free'} capOverride={(() => { const o = guardianOverride(profile as any); return Object.keys(o).length ? o : undefined; })()} profile={traderProfile} accounts={(accounts || []) as any} trades={trades as any} />;
}
