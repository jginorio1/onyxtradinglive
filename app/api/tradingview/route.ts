import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { newTvToken } from '@/lib/tradingview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

// POST · señal de PRUEBA: mete una orden real mínima (0.01) en la cola para que
// el trader compruebe que su EA ejecuta. El EA la abre en su cuenta.
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || '');
  const { data: acc } = await supabaseAdmin.from('trading_accounts')
    .select('id,user_id,tv_symbols,copy_paused').eq('id', accountId).maybeSingle();
  if (!acc || acc.user_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: prof } = await supabaseAdmin.from('profiles').select('copy_paused').eq('id', user.id).maybeSingle();
  if (prof?.copy_paused || acc.copy_paused) return NextResponse.json({ error: 'paused' }, { status: 200 });

  const wl = Array.isArray(acc.tv_symbols) ? acc.tv_symbols : [];
  const symbol = String(b.symbol || wl[0] || 'EURUSD').toUpperCase();
  const side = b.side === 'sell' ? 'sell' : 'buy';

  await supabaseAdmin.from('copy_commands').insert({
    link_id: null, source: 'tradingview', slave_account_id: acc.id,
    action: 'open', master_ticket: '', base_symbol: symbol, side,
    volume_hint: 0.01, sl: null, tp: null,
    payload: { source: 'tradingview', test: true, limits: {} }, status: 'pending',
  });
  await supabaseAdmin.from('tv_signals').insert({
    account_id: acc.id, user_id: user.id, action: 'open', symbol, lots: 0.01,
    status: 'queued', raw: { test: true, side },
  });
  return NextResponse.json({ ok: true, symbol, side });
}

// GET · el panel pide las cuentas del trader con sus ajustes de TradingView,
// si su plan lo incluye, y las últimas señales recibidas.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: planRow } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
  const caps: any = planRow?.capabilities || {};
  const allowed = !!(caps.tv || caps.copy);

  const { data: accountsRaw } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname,broker,tv_token,tv_enabled,tv_default_lot,tv_max_lot,tv_symbols')
    .eq('user_id', user.id).order('created_at', { ascending: true });
  const accounts = accountsRaw || [];

  // Estado en vivo del EA de Copy por cuenta: ¿tiene clave de copy y reporta ahora?
  const logins = accounts.map((a) => String(a.login));
  const { data: keys } = logins.length ? await supabaseAdmin.from('api_keys')
    .select('account_login,last_used_at,revoked,kind')
    .eq('user_id', user.id).eq('kind', 'copy').in('account_login', logins) : { data: [] } as any;
  const keyByLogin: Record<string, any> = {};
  (keys || []).forEach((k: any) => { if (!k.revoked) keyByLogin[String(k.account_login)] = k; });
  const now = Date.now();
  const accts = accounts.map((a) => {
    const k = keyByLogin[String(a.login)];
    const eaLive = !!(k?.last_used_at && (now - new Date(k.last_used_at).getTime()) < 120000);
    return { ...a, copyKey: !!k, eaLive };
  });

  const ids = accounts.map((a) => a.id);
  let signals: any[] = [];
  if (ids.length) {
    const { data: sg } = await supabaseAdmin.from('tv_signals')
      .select('id,account_id,action,symbol,lots,sl,tp,status,error,created_at')
      .in('account_id', ids).order('created_at', { ascending: false }).limit(30);
    signals = sg || [];
  }

  return NextResponse.json({ allowed, plan: prof?.plan || 'free', accounts: accts, signals });
}

// PATCH · guardar ajustes / generar-rotar token / activar-desactivar por cuenta.
export async function PATCH(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: planRow } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
  const caps: any = planRow?.capabilities || {};
  if (!caps.tv && !caps.copy) return NextResponse.json({ error: 'plan does not include TradingView' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const accountId = String(b.accountId || '');
  if (!accountId) return NextResponse.json({ error: 'missing accountId' }, { status: 400 });

  // La cuenta debe ser suya.
  const { data: acc } = await supabaseAdmin.from('trading_accounts')
    .select('id,user_id,tv_token').eq('id', accountId).maybeSingle();
  if (!acc || acc.user_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const patch: any = {};
  if (b.action === 'rotate' || !acc.tv_token) patch.tv_token = newTvToken();
  if (typeof b.enabled === 'boolean') patch.tv_enabled = b.enabled;
  if (b.default_lot != null) patch.tv_default_lot = Math.max(0.01, Number(b.default_lot) || 0.01);
  if (b.max_lot != null) patch.tv_max_lot = Math.max(0, Number(b.max_lot) || 0);
  if (Array.isArray(b.symbols)) patch.tv_symbols = b.symbols.map((s: any) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 40);

  if (Object.keys(patch).length) await supabaseAdmin.from('trading_accounts').update(patch).eq('id', accountId);

  const { data: updated } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname,broker,tv_token,tv_enabled,tv_default_lot,tv_max_lot,tv_symbols').eq('id', accountId).maybeSingle();
  return NextResponse.json({ ok: true, account: updated });
}
