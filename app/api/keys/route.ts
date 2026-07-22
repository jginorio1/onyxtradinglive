import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function genKey() {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 28; i++) s += c[Math.floor(Math.random() * c.length)];
  return 'onyx_live_' + s;
}

// Cupos del plan: 1 clave activa = 1 cuenta
async function usage(userId: string) {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).single();
  const planId = prof?.plan || 'free';
  const { data: planRow } = await supabaseAdmin.from('plans').select('id,name,max_accounts,price_month').eq('id', planId).maybeSingle();
  const max = Number(planRow?.max_accounts ?? 1);
  const { count } = await supabaseAdmin.from('api_keys').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('revoked', false);
  return { planId, planName: planRow?.name || planId, max, used: count || 0, unlimited: max >= 999 };
}

// GET · claves del usuario + cupos + estado de sincronización
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const { data: keys } = await supabaseAdmin
      .from('api_keys').select('id,key,label,revoked,created_at,last_used_at,account_login,broker,acc_type,acc_size,currency')
      .eq('user_id', user.id).eq('revoked', false).order('created_at', { ascending: false });

    const { data: accounts } = await supabaseAdmin
      .from('trading_accounts').select('login,balance,last_sync_at').eq('user_id', user.id);

    const byLogin: any = {};
    (accounts || []).forEach((a: any) => { byLogin[String(a.login)] = a; });

    const rows = (keys || []).map((k: any) => ({ ...k, account: k.account_login ? byLogin[String(k.account_login)] || null : null }));
    const u = await usage(user.id);
    const { data: plans } = await supabaseAdmin.from('plans').select('id,name,max_accounts,price_month').eq('active', true).order('sort', { ascending: true });

    return NextResponse.json({ keys: rows, usage: u, plans: plans || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · crear una clave para una cuenta concreta (respeta el límite del plan)
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const u = await usage(user.id);
    if (!u.unlimited && u.used >= u.max) {
      return NextResponse.json({ error: `Tu plan ${u.planName} permite ${u.max} cuenta(s). Revoca una clave o mejora tu plan para conectar más.`, limit: true }, { status: 403 });
    }

    const b = await req.json().catch(() => ({} as any));
    const login = b.account_login ? Number(String(b.account_login).replace(/\D/g, '')) : null;

    // No permitir dos claves activas para el mismo número de cuenta
    if (login) {
      const { data: dup } = await supabaseAdmin.from('api_keys').select('id').eq('user_id', user.id).eq('account_login', login).eq('revoked', false).maybeSingle();
      if (dup) return NextResponse.json({ error: `Ya tienes una clave activa para la cuenta ${login}.` }, { status: 400 });
    }

    const type = ['challenge', 'funded', 'own', 'demo'].includes(b.acc_type) ? b.acc_type : 'own';
    const key = genKey();
    const { error } = await supabaseAdmin.from('api_keys').insert({
      user_id: user.id,
      key,
      label: String(b.label || 'Mi cuenta MT').slice(0, 60),
      account_login: login,
      broker: b.broker ? String(b.broker).slice(0, 60) : null,
      acc_type: type,
      acc_size: b.acc_size ? Number(String(b.acc_size).replace(/[^\d.]/g, '')) || null : null,
      currency: (b.currency || 'USD').toUpperCase().slice(0, 6),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ key });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · revocar una clave (libera el cupo al instante)
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const { id } = await req.json();
    const { error } = await supabaseAdmin.from('api_keys').update({ revoked: true }).eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
