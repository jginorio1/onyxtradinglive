import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function genKey() {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 28; i++) s += c[Math.floor(Math.random() * c.length)];
  return 'onyx_live_' + s;
}

export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key = genKey();
  // Escribimos con service_role (validando antes al usuario) para evitar problemas de RLS.
  const { error } = await supabaseAdmin.from('api_keys').insert({
    user_id: user.id, key, label: body.label || 'Mi cuenta MT',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key });
}

export async function PATCH(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('api_keys').update({ revoked: true }).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
