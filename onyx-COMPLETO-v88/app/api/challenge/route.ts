import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mergeConfig, sanitize, PROP_TEMPLATES } from '@/lib/manager';
import { loadAllChallenges } from '@/lib/challenge';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
  return { user, caps: (plan?.capabilities as any) || {} };
}

// GET · marcadores + config actual del reto por cuenta + plantillas de firma
export async function GET() {
  const { user, caps } = await me();
  if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
  if (!caps.manager) return NextResponse.json({ error: 'plan', code: 'no_plan', locked: true, boards: [], accounts: [] }, { status: 200 });

  const boards = await loadAllChallenges(user.id);

  const { data: accounts } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname,broker,acc_size,balance,firm_template').eq('user_id', user.id).order('created_at', { ascending: true });
  const { data: cfgs } = await supabaseAdmin.from('manager_configs').select('account_id,config').eq('user_id', user.id);
  const byAcc: any = {};
  (cfgs || []).forEach((c: any) => { byAcc[c.account_id] = mergeConfig(c.config); });

  const rows = (accounts || []).map((a: any) => {
    const c = byAcc[a.id] || mergeConfig(null);
    return {
      id: a.id, login: a.login, name: a.nickname || String(a.login), broker: a.broker,
      rules: { ...c.challenge, base: c.limits.base, reset_hour: c.limits.reset_hour,
        daily_loss: c.limits.daily_loss, daily_loss_pct: c.limits.daily_loss_pct,
        total_loss: c.limits.total_loss, total_loss_pct: c.limits.total_loss_pct },
    };
  });

  const custom = await getSetting<{ list: any[] }>('prop_templates', { list: [] });
  const firms = (custom?.list?.length ? custom.list : PROP_TEMPLATES);

  return NextResponse.json({ boards, accounts: rows, firms });
}

// PATCH · guardar las reglas del reto de una cuenta (mide; no toca operaciones)
export async function PATCH(req: Request) {
  const { user, caps } = await me();
  if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
  if (!caps.manager) return NextResponse.json({ error: 'Tu plan no incluye Guardian.', code: 'no_plan' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const accountId = String(b.account_id || '');
  const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id').eq('id', accountId).eq('user_id', user.id).maybeSingle();
  if (!acc) return NextResponse.json({ error: 'Cuenta no válida.', code: 'invalid' }, { status: 400 });

  const { data: row } = await supabaseAdmin.from('manager_configs').select('config,version').eq('account_id', accountId).maybeSingle();
  const cur = mergeConfig(row?.config);

  // Reglas de pérdida → limits (misma fuente que Guardian). Resto → challenge.
  cur.limits.base = b.base ?? cur.limits.base;
  cur.limits.reset_hour = b.reset_hour ?? cur.limits.reset_hour;
  if (b.daily_loss !== undefined) cur.limits.daily_loss = Number(b.daily_loss) || 0;
  if (b.daily_loss_pct !== undefined) cur.limits.daily_loss_pct = !!b.daily_loss_pct;
  if (b.total_loss !== undefined) cur.limits.total_loss = Number(b.total_loss) || 0;
  if (b.total_loss_pct !== undefined) cur.limits.total_loss_pct = !!b.total_loss_pct;

  cur.challenge.on = b.on !== undefined ? !!b.on : cur.challenge.on;
  cur.challenge.firm = b.firm ?? cur.challenge.firm;
  cur.challenge.phase = b.phase ?? cur.challenge.phase;
  if (b.profit_target !== undefined) cur.challenge.profit_target = Number(b.profit_target) || 0;
  if (b.profit_target_pct !== undefined) cur.challenge.profit_target_pct = !!b.profit_target_pct;
  if (b.min_days !== undefined) cur.challenge.min_days = Number(b.min_days) || 0;
  if (b.max_days !== undefined) cur.challenge.max_days = Number(b.max_days) || 0;
  if (b.consistency !== undefined) cur.challenge.consistency = Number(b.consistency) || 0;
  if (b.no_weekend_hold !== undefined) cur.challenge.no_weekend_hold = !!b.no_weekend_hold;

  const clean = sanitize(cur);
  const nextVersion = Number(row?.version || 0) + 1;

  const { error } = await supabaseAdmin.from('manager_configs').upsert({
    user_id: user.id, account_id: accountId, config: clean, version: nextVersion,
  }, { onConflict: 'account_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
