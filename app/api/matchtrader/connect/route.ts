import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { encryptToken } from '@/lib/matchtrader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// El trader pega la API key + URL de su broker MatchTrader. Lo guardamos.
// El motor real (Guardian/Copy) se activa cuando estén los endpoints del broker.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data } = await supabaseAdmin.from('matchtrader_connections')
    .select('id,api_base,system_uuid,login,role,label,enabled,last_sync_at,created_at').eq('user_id', user.id).order('created_at');
  return NextResponse.json({ connections: data || [] });   // nunca devolvemos api_key
}

export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const api_base = String(b.api_base || '').trim();
  const api_key = String(b.api_key || '').trim();
  if (!/^https?:\/\//.test(api_base) || !api_key) return NextResponse.json({ error: 'invalid', code: 'bad_input' }, { status: 400 });
  const role = ['master', 'slave', 'both'].includes(b.role) ? b.role : 'both';
  await supabaseAdmin.from('matchtrader_connections').insert({
    user_id: user.id, account_id: b.account_id || null, api_base,
    api_key: encryptToken(api_key),   // cifrado en reposo si hay MATCHTRADER_ENC_KEY
    system_uuid: b.system_uuid ? String(b.system_uuid).trim() : null,
    login: b.login ? String(b.login).trim() : null,
    role, label: b.label ? String(b.label).slice(0, 60) : null,
    enabled: true,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.id) await supabaseAdmin.from('matchtrader_connections').delete().eq('id', b.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
