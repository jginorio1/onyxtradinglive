import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dxLogin, storeFields } from '@/lib/dxtrade';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Conexión RETAIL de DXtrade: el trader elige su bróker (del catálogo) o escribe el
// host de su bróker, y pone su usuario + contraseña (+ dominio) de ESE bróker. Hacemos
// login contra la API SCA de DXtrade y guardamos SOLO el token cifrado (nunca la
// contraseña). Se crea una conexión por cada cuenta que el bróker devuelva.
async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// login numérico estable (trading_accounts.login es bigint) a partir del account.
function loginOf(s: string): number {
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 100000000000 + (Math.abs(h) % 800000000000);
}

// GET · catálogo de servers + conexiones del usuario (sin secretos).
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data: servers } = await supabaseAdmin.from('dx_servers')
    .select('code,name,host,domain_default,demo_default,is_prop,copy_allowed').eq('enabled', true).order('sort');
  const { data: conns } = await supabaseAdmin.from('dxtrade_connections')
    .select('id,server,domain,demo,label,dx_account,role,copy_enabled,status,last_sync_at,created_at')
    .eq('user_id', user.id).order('created_at');
  return NextResponse.json({ servers: servers || [], connections: conns || [] });
}

// POST · conectar. { server_code?, host?, domain?, demo?, username, password }
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const username = String(b.username || b.email || '').trim();
  const password = String(b.password || '');
  let host = String(b.host || b.server || '').trim();
  let domain = String(b.domain || '').trim() || 'default';
  let demo = !!b.demo;
  let isProp = false;

  // Si viene del catálogo, tomamos su host real + dominio + entorno + flag prop.
  if (b.server_code) {
    const { data: s } = await supabaseAdmin.from('dx_servers').select('*').eq('code', String(b.server_code)).eq('enabled', true).maybeSingle();
    if (!s) return NextResponse.json({ error: 'bróker no válido', code: 'bad_server' }, { status: 400 });
    host = String((s as any).host); domain = String((s as any).domain_default || 'default');
    demo = b.demo != null ? !!b.demo : !!(s as any).demo_default; isProp = !!(s as any).is_prop;
  }
  if (!host || !username || !password) return NextResponse.json({ error: 'faltan datos', code: 'bad_input' }, { status: 400 });

  const res = await dxLogin(host, domain, username, password);
  if (!res.ok || !res.accounts?.length) return NextResponse.json({ error: res.error || 'login falló', code: 'login' }, { status: 400 });

  // AUTO-APRENDIZAJE del catálogo: si el trader conectó con un host escrito a mano
  // (no del catálogo) y ese host aún no existe, lo añadimos para el menú de futuros
  // traders y el panel admin. El dueño puede renombrarlo/ocultarlo.
  if (!b.server_code && host) {
    try {
      const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const code = 'auto_' + cleanHost.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36);
      const { data: exists } = await supabaseAdmin.from('dx_servers').select('code').eq('host', cleanHost).maybeSingle();
      if (!exists) await supabaseAdmin.from('dx_servers').insert({ code, name: cleanHost, host: cleanHost, domain_default: domain, demo_default: demo, is_prop: false, copy_allowed: true, enabled: true, sort: 100 });
    } catch {}
  }

  const created: any[] = [];
  for (const acc of res.accounts) {
    const login = loginOf(acc.account);
    const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const { data: ta } = await supabaseAdmin.from('trading_accounts').upsert({
      user_id: user.id, login, server: cleanHost, name: acc.name || acc.account,
      broker: cleanHost, currency: acc.currency, platform: 'dxtrade',
    }, { onConflict: 'user_id,login,server' }).select('id').maybeSingle();
    const accountId = (ta as any)?.id || null;

    const fields = storeFields(res, acc, demo, host, domain);
    const { data: existing } = await supabaseAdmin.from('dxtrade_connections')
      .select('id').eq('user_id', user.id).eq('dx_account', acc.account).maybeSingle();
    if ((existing as any)?.id) {
      await supabaseAdmin.from('dxtrade_connections').update({ ...fields, status: 'ok', account_id: accountId }).eq('id', (existing as any).id);
    } else {
      await supabaseAdmin.from('dxtrade_connections').insert({
        user_id: user.id, account_id: accountId, label: acc.name || acc.account,
        role: 'both', copy_enabled: false, enabled: true, ...fields,
      });
    }
    created.push({ dx_account: acc.account, name: acc.name, currency: acc.currency, balance: acc.balance });
  }
  return NextResponse.json({ ok: true, connected: created, is_prop: isProp });
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
  await supabaseAdmin.from('dxtrade_connections').update(patch).eq('id', b.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}

// DELETE · desconectar (borra token). { id }
export async function DELETE(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  if (!b.id) return NextResponse.json({ error: 'id' }, { status: 400 });
  await supabaseAdmin.from('dxtrade_connections').delete().eq('id', b.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
