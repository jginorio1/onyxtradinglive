import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Claves de COPY TRADING, separadas e identificadas de las del Guardian.
//
// Cada cuenta que participe en copy (master o esclava) usa SU propia clave
// Copy en la EA de copy. Revocar una clave Copy no afecta al Guardian, y al
// revés: son dos llaveros distintos (api_keys.kind = 'copy' vs 'guardian').
// ============================================================

function genKey() {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 28; i++) s += c[Math.floor(Math.random() * c.length)];
  return 'onyx_copy_' + s;
}

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function hasCopy(userId: string) {
  const { data: p } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', p?.plan || 'free').maybeSingle();
  return !!(plan?.capabilities as any)?.copy;
}

// GET · claves Copy activas del usuario, por cuenta.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data: keys } = await supabaseAdmin.from('api_keys')
    .select('id,key,account_login,label,created_at,last_used_at')
    .eq('user_id', user.id).eq('kind', 'copy').eq('revoked', false)
    .order('created_at', { ascending: false });
  return NextResponse.json({ keys: keys || [] });
}

// POST · generar (o regenerar) la clave Copy de una cuenta concreta.
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  if (!(await hasCopy(user.id))) return NextResponse.json({ error: 'Tu plan no incluye copy trading.', code: 'no_plan' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const accountId = String(b.account_id || '');
  const { data: acc } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname').eq('id', accountId).eq('user_id', user.id).maybeSingle();
  if (!acc) return NextResponse.json({ error: 'Cuenta no válida.' }, { status: 400 });

  // Una sola clave Copy activa por cuenta: si regenera, revoca la anterior.
  await supabaseAdmin.from('api_keys').update({ revoked: true })
    .eq('user_id', user.id).eq('kind', 'copy').eq('account_login', acc.login).eq('revoked', false);

  const key = genKey();
  const { error } = await supabaseAdmin.from('api_keys').insert({
    user_id: user.id, key, kind: 'copy',
    account_login: acc.login,
    label: `Copy · ${acc.nickname || acc.login}`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key, account_login: acc.login });
}

// PATCH · revocar una clave Copy (no toca la Guardian de esa cuenta).
export async function PATCH(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (id) await supabaseAdmin.from('api_keys').update({ revoked: true }).eq('id', id).eq('user_id', user.id).eq('kind', 'copy');
  return NextResponse.json({ ok: true });
}
