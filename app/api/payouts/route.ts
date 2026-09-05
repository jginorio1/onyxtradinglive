import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Comprueba que esa cuenta de trading es del usuario
async function ownsAccount(userId: string, accountId: string) {
  if (!accountId) return false;
  const { data } = await supabaseAdmin
    .from('trading_accounts').select('id').eq('id', accountId).eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const { data } = await sb.from('payouts').select('*').eq('user_id', user.id).order('date', { ascending: false });
    return NextResponse.json({ payouts: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const accountId = String(b.account_id || '').trim();
    if (!accountId) return NextResponse.json({ error: 'Missing account.', code: 'missing_data' }, { status: 400 });
    if (!(await ownsAccount(user.id, accountId))) {
      return NextResponse.json({ error: 'Account not found.', code: 'not_found' }, { status: 404 });
    }

    // Campos obligatorios: importe mayor que cero y fecha valida
    const amount = Number(String(b.amount ?? '').replace(/[^\d.\-]/g, ''));
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.', code: 'need_amount' }, { status: 400 });
    }
    const date = String(b.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'A valid date is required.', code: 'need_date' }, { status: 400 });
    }

    const { error } = await sb.from('payouts').insert({
      user_id: user.id,
      account_id: accountId,
      amount: Math.round(amount * 100) / 100,
      date,
      note: b.note ? String(b.note).slice(0, 300) : null,
      receipt_url: b.receipt_url ? String(b.receipt_url).slice(0, 500) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const { id } = await req.json().catch(() => ({} as any));
    if (!id) return NextResponse.json({ error: 'Missing id.', code: 'missing_data' }, { status: 400 });
    const { error } = await sb.from('payouts').delete().eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
