import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACC_TYPES = ['own', 'demo', 'challenge', 'funded'];
const CH_STATUS = ['none', 'phase1', 'phase2', 'passed', 'failed', 'funded'];

// Renombrar y configurar una cuenta del usuario
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const id = String(b.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing account.', code: 'missing_data' }, { status: 400 });

    const fields: any = {};
    if (b.nickname !== undefined) fields.nickname = String(b.nickname || '').slice(0, 40);
    if (b.acc_type !== undefined) fields.acc_type = ACC_TYPES.includes(b.acc_type) ? b.acc_type : null;
    if (b.challenge_status !== undefined) fields.challenge_status = CH_STATUS.includes(b.challenge_status) ? b.challenge_status : null;

    // Numeros: no aceptamos NaN ni negativos, se guardan como nulo si vienen vacios
    for (const k of ['fund_target', 'fund_max_daily', 'fund_max_total', 'fund_start', 'challenge_cost']) {
      if (b[k] === undefined) continue;
      if (b[k] === '' || b[k] === null) { fields[k] = null; continue; }
      const n = Number(String(b[k]).replace(/[^\d.\-]/g, ''));
      if (!isFinite(n) || n < 0) {
        return NextResponse.json({ error: `Invalid value for ${k}.`, code: 'bad_number', field: k }, { status: 400 });
      }
      fields[k] = n;
    }

    if (!Object.keys(fields).length) return NextResponse.json({ error: 'Nothing to update.', code: 'missing_data' }, { status: 400 });

    const { data: updated, error } = await supabaseAdmin
      .from('trading_accounts')
      .update(fields)
      .eq('id', id).eq('user_id', user.id)
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated?.length) return NextResponse.json({ error: 'Account not found.', code: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
