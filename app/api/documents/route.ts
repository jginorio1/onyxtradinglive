import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
  const { data } = await sb.from('account_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return NextResponse.json({ documents: data || [] });
}

export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
  const b = await req.json();
  if (!b.account_id || !b.image_url) return NextResponse.json({ error: 'Missing data.', code: 'missing_data' }, { status: 400 });
  const { error } = await sb.from('account_documents').insert({
    user_id: user.id, account_id: b.account_id,
    doc_type: b.doc_type || 'certificate', title: b.title || null, image_url: b.image_url,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
  const { id } = await req.json();
  const { error } = await sb.from('account_documents').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
