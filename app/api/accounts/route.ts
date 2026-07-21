import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Renombrar (nickname) una cuenta del usuario
export async function PATCH(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const b = await req.json();
  const fields: any = {};
  if (b.nickname !== undefined) fields.nickname = (b.nickname || '').slice(0, 40);
  ['fund_target', 'fund_max_daily', 'fund_max_total', 'fund_start'].forEach((k) => {
    if (b[k] !== undefined) fields[k] = b[k] === '' || b[k] === null ? null : Number(b[k]);
  });
  if (!Object.keys(fields).length) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('trading_accounts')
    .update(fields)
    .eq('id', b.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
