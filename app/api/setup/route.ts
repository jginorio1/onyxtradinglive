import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

// GET · estado de configuración por cuenta, con confirmación en vivo de cada paso.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: planRow } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
  const caps: any = planRow?.capabilities || {};

  const { data: accsRaw } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname,broker,platform,last_sync_at,tv_enabled,onboard')
    .eq('user_id', user.id).order('created_at', { ascending: true });
  const accs = accsRaw || [];
  const now = Date.now();
  const fresh = (ts: any, ms: number) => !!(ts && (now - new Date(ts).getTime()) < ms);

  const accIds = accs.map((a) => a.id);
  const { data: mgr } = accIds.length ? await supabaseAdmin.from('manager_configs')
    .select('account_id,enabled').in('account_id', accIds) : { data: [] } as any;
  const guardianOn: Record<string, boolean> = {};
  (mgr || []).forEach((m: any) => { if (m.enabled) guardianOn[m.account_id] = true; });

  const logins = accs.map((a) => String(a.login));
  const { data: keys } = logins.length ? await supabaseAdmin.from('api_keys')
    .select('account_login,last_used_at,revoked,kind').eq('user_id', user.id).eq('kind', 'copy').in('account_login', logins) : { data: [] } as any;
  const copyKey: Record<string, any> = {};
  (keys || []).forEach((k: any) => { if (!k.revoked) copyKey[String(k.account_login)] = k; });

  const accounts = accs.map((a) => {
    const k = copyKey[String(a.login)];
    return {
      id: a.id, login: a.login, nickname: a.nickname, broker: a.broker,
      platform: (a.platform || 'MT5'),
      goals: a.onboard || {},
      connectorLive: fresh(a.last_sync_at, 300000),
      guardianOn: !!guardianOn[a.id],
      copyKey: !!k,
      copyLive: fresh(k?.last_used_at, 120000),
      tvOn: !!a.tv_enabled,
    };
  });

  return NextResponse.json({ caps, accounts });
}

// PATCH · guardar qué quiere hacer el trader con una cuenta (los objetivos).
export async function PATCH(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || '');
  const goals = (b.goals && typeof b.goals === 'object') ? b.goals : {};
  const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id,user_id').eq('id', accountId).maybeSingle();
  if (!acc || acc.user_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await supabaseAdmin.from('trading_accounts').update({ onboard: goals }).eq('id', accountId);
  return NextResponse.json({ ok: true });
}
