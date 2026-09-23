import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · desconectar una cuenta MT (libera el cupo) o eliminarla del todo
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { account_id, mode } = await req.json();
    if (!account_id) return NextResponse.json({ error: 'Missing account.', code: 'missing_data' }, { status: 400 });

    const { data: acc } = await supabaseAdmin
      .from('trading_accounts').select('id,login').eq('id', account_id).eq('user_id', user.id).maybeSingle();
    if (!acc) return NextResponse.json({ error: 'Account not found.', code: 'missing_data' }, { status: 404 });

    // En ambos casos se revoca la clave: es lo que ocupa el cupo
    await supabaseAdmin.from('api_keys')
      .update({ revoked: true })
      .eq('user_id', user.id).eq('account_login', acc.login).eq('revoked', false);

    if (mode === 'delete') {
      // borra la cuenta y, por las claves foráneas, sus operaciones y notas
      const { error } = await supabaseAdmin.from('trading_accounts').delete().eq('id', acc.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ ok: true, deleted: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
