import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mtpLogin, storeFields } from '@/lib/matchtraderPlatform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Conexión RETAIL de MatchTrader: el trader elige su bróker (del catálogo) y pone
// su email + contraseña de ESE bróker. Hacemos login contra la Platform API, y
// guardamos SOLO los tokens cifrados (nunca la contraseña). Se crea una cuenta por
// cada cuenta de trading que el bróker devuelva.
async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// login numérico estable (la tabla trading_accounts usa bigint) a partir del uuid.
function loginOf(uuid: string): number {
  let h = 5381; for (let i = 0; i < uuid.length; i++) h = ((h << 5) + h + uuid.charCodeAt(i)) | 0;
  return 100000000000 + (Math.abs(h) % 800000000000);
}

// GET · catálogo de brókers + conexiones del usuario (sin secretos).
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data: brokers } = await supabaseAdmin.from('mt_brokers')
    .select('code,name,is_prop,copy_allowed').eq('enabled', true).order('sort');
  const { data: conns } = await supabaseAdmin.from('matchtrader_connections')
    .select('id,broker_code,label,account_uuid,role,copy_enabled,status,last_sync_at,created_at')
    .eq('user_id', user.id).eq('kind', 'platform').order('created_at');
  return NextResponse.json({ brokers: brokers || [], connections: conns || [] });
}

// POST · conectar. { broker_code, email, password }
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const code = String(b.broker_code || '').trim();
  const email = String(b.email || '').trim();
  const password = String(b.password || '');
  if (!code || !email || !password) return NextResponse.json({ error: 'faltan datos', code: 'bad_input' }, { status: 400 });

  const { data: broker } = await supabaseAdmin.from('mt_brokers').select('*').eq('code', code).eq('enabled', true).maybeSingle();
  if (!broker) return NextResponse.json({ error: 'bróker no válido', code: 'bad_broker' }, { status: 400 });

  const res = await mtpLogin((broker as any).base_url, email, password);
  if (!res.ok || !res.accounts?.length) return NextResponse.json({ error: res.error || 'login falló', code: 'login' }, { status: 400 });

  const created: any[] = [];
  for (const acc of res.accounts) {
    const login = loginOf(acc.id);
    // Cuenta de trading (para Guardian/Copy/dashboard). Upsert por (user, login, server).
    const { data: ta } = await supabaseAdmin.from('trading_accounts').upsert({
      user_id: user.id, login, server: code, name: acc.name || (broker as any).name,
      broker: (broker as any).name, currency: acc.currency, platform: 'matchtrader',
    }, { onConflict: 'user_id,login,server' }).select('id').maybeSingle();
    const accountId = (ta as any)?.id || null;

    const fields = storeFields(res.coToken!, acc);
    // Una conexión por cuenta. Reconecta: actualiza tokens si ya existía.
    const { data: existing } = await supabaseAdmin.from('matchtrader_connections')
      .select('id').eq('user_id', user.id).eq('account_uuid', acc.id).eq('kind', 'platform').maybeSingle();
    if ((existing as any)?.id) {
      await supabaseAdmin.from('matchtrader_connections').update({ ...fields, status: 'ok', account_id: accountId }).eq('id', (existing as any).id);
    } else {
      await supabaseAdmin.from('matchtrader_connections').insert({
        user_id: user.id, account_id: accountId, kind: 'platform', broker_code: code,
        label: acc.name || (broker as any).name, role: 'both', copy_enabled: false,
        enabled: true, ...fields,
      });
    }
    created.push({ account_uuid: acc.id, name: acc.name, demo: acc.demo });
  }
  return NextResponse.json({ ok: true, connected: created, is_prop: !!(broker as any).is_prop });
}

// PATCH · ajustes de una conexión: { id, copy_enabled?, role? }
export async function PATCH(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  if (!b.id) return NextResponse.json({ error: 'id' }, { status: 400 });
  const patch: any = {};
  if (b.copy_enabled != null) patch.copy_enabled = !!b.copy_enabled;
  if (['master', 'slave', 'both'].includes(b.role)) patch.role = b.role;
  await supabaseAdmin.from('matchtrader_connections').update(patch).eq('id', b.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}

// DELETE · quitar conexión. { id }
export async function DELETE(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.id) await supabaseAdmin.from('matchtrader_connections').delete().eq('id', b.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
