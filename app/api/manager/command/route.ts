import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['close_all', 'close_profitable', 'close_losing', 'close_half', 'sl_to_be'];

// POST · encola una acción rápida. El EA la recoge en su siguiente sync.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).single();
    const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
    if (!plan?.capabilities?.manager) return NextResponse.json({ error: 'Manager not in your plan.', code: 'no_manager' }, { status: 403 });

    const b = await req.json();
    if (!ALLOWED.includes(b.command)) return NextResponse.json({ error: 'Unknown command.', code: 'missing_data' }, { status: 400 });

    const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id,last_sync_at').eq('id', b.account_id).eq('user_id', user.id).maybeSingle();
    if (!acc) return NextResponse.json({ error: 'Account not found.', code: 'missing_data' }, { status: 404 });

    // Si el EA no da señales, avisamos en vez de encolar algo que nadie recogerá
    const live = acc.last_sync_at ? (Date.now() - new Date(acc.last_sync_at).getTime()) < 120000 : false;
    if (!live) return NextResponse.json({ error: 'EA offline.', code: 'ea_offline' }, { status: 400 });

    // no acumular la misma orden dos veces
    await supabaseAdmin.from('manager_commands').update({ status: 'expired' })
      .eq('account_id', acc.id).eq('status', 'pending');

    const { error } = await supabaseAdmin.from('manager_commands').insert({
      user_id: user.id, account_id: acc.id, command: b.command, params: b.params || {},
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
