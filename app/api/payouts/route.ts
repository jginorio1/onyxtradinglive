import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { data } = await sb.from('payouts').select('*').eq('user_id', user.id).order('date', { ascending: false });
  return NextResponse.json({ payouts: data || [] });
}

export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json();
  if (!b.account_id) return NextResponse.json({ error: 'falta account_id' }, { status: 400 });
  const { error } = await sb.from('payouts').insert({
    user_id: user.id, account_id: b.account_id,
    amount: Number(b.amount) || 0, date: b.date || null, note: b.note || null, receipt_url: b.receipt_url || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await req.json();
  const { error } = await sb.from('payouts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
