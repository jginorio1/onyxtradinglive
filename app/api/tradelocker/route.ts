import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tlLogin, storeFields } from '@/lib/tradelocker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Conexión RETAIL de TradeLocker: el trader elige su bróker (del catálogo) o escribe
// el "server", y pone su email + contraseña de ESE bróker. Hacemos login contra la
// API de TradeLocker y guardamos SOLO los tokens cifrados (nunca la contraseña).
// Se crea una conexión por cada cuenta de trading que el bróker devuelva.
async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// login numérico estable (trading_accounts.login es bigint) a partir del accountId.
function loginOf(s: string): number {
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 100000000000 + (Math.abs(h) % 800000000000);
}

// GET · catálogo de servers + conexiones del usuario (sin secretos).
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data: servers } = await supabaseAdmin.from('tl_servers')
    .select('code,name,server,demo_default,is_prop,copy_allowed').eq('enabled', true).order('sort');
  const { data: conns } = await supabaseAdmin.from('tradelocker_connections')
    .select('id,server,demo,label,tl_account_id,acc_num,role,copy_enabled,status,last_sync_at,created_at')
    .eq('user_id', user.id).order('created_at');
  return NextResponse.json({ servers: servers || [], connections: conns || [] });
}

// POST · conectar. { server_code?, server?, demo?, email, password }
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const email = String(b.email || '').trim();
  const password = String(b.password || '');
  let server = String(b.server || '').trim();
  let demo = !!b.demo;
  let isProp = false;

  // Si viene del catálogo, tomamos su server real + entorno + flag prop.
  if (b.server_code) {
    const { data: s } = await supabaseAdmin.from('tl_servers').select('*').eq('code', String(b.server_code)).eq('enabled', true).maybeSingle();
    if (!s) return NextResponse.json({ error: 'bróker no válido', code: 'bad_server' }, { status: 400 });
    server = String((s as any).server); demo = b.demo != null ? !!b.demo : !!(s as any).demo_default; isProp = !!(s as any).is_prop;
  }
  if (!server || !email || !password) return NextResponse.json({ error: 'faltan datos', code: 'bad_input' }, { status: 400 });

  const res = await tlLogin(demo, server, email, password);
  if (!res.ok || !res.accounts?.length) return NextResponse.json({ error: res.error || 'login falló', code: 'login' }, { status: 400 });

  // AUTO-APRENDIZAJE del catálogo: si el trader conectó con un server escrito a mano
  // (no del catálogo) y ese server aún no existe, lo añadimos solo para que aparezca
  // en el menú de futuros traders y en el panel admin. El dueño puede renombrarlo/ocultarlo.
  if (!b.server_code && server) {
    try {
      const code = 'auto_' + server.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36);
      const { data: exists } = await supabaseAdmin.from('tl_servers').select('code').eq('server', server).maybeSingle();
      if (!exists) await supabaseAdmin.from('tl_servers').insert({ code, name: server, server, demo_default: demo, is_prop: false, copy_allowed: true, enabled: true, sort: 100 });
    } catch {}
  }

  const created: any[] = [];
  for (const acc of res.accounts) {
    const login = loginOf(acc.id);
    // Cuenta de trading (para Guardian/Copy/dashboard). Upsert por (user, login, server).
    const { data: ta } = await supabaseAdmin.from('trading_accounts').upsert({
      user_id: user.id, login, server, name: acc.name || server,
      broker: server, currency: acc.currency, platform: 'tradelocker',
    }, { onConflict: 'user_id,login,server' }).select('id').maybeSingle();
    const accountId = (ta as any)?.id || null;

    const fields = storeFields(res, acc, demo, server);
    // Una conexión por cuenta. Reconecta: actualiza tokens si ya existía.
    const { data: existing } = await supabaseAdmin.from('tradelocker_connections')
      .select('id').eq('user_id', user.id).eq('tl_account_id', acc.id).maybeSingle();
    if ((existing as any)?.id) {
      await supabaseAdmin.from('tradelocker_connections').update({ ...fields, status: 'ok', account_id: accountId }).eq('id', (existing as any).id);
    } else {
      await supabaseAdmin.from('tradelocker_connections').insert({
        user_id: user.id, account_id: accountId, label: acc.name || server,
        role: 'both', copy_enabled: false, enabled: true, ...fields,
      });
    }
    created.push({ tl_account_id: acc.id, name: acc.name, currency: acc.currency, balance: acc.balance });
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
  await supabaseAdmin.from('tradelocker_connections').update(patch).eq('id', b.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}

// DELETE · desconectar (borra tokens). { id }
export async function DELETE(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  if (!b.id) return NextResponse.json({ error: 'id' }, { status: 400 });
  await supabaseAdmin.from('tradelocker_connections').delete().eq('id', b.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
