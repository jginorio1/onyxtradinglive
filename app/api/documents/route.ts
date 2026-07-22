import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOC_TYPES = ['certificate', 'payout', 'contract', 'id', 'other'];

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
    const { data } = await sb.from('account_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    return NextResponse.json({ documents: data || [] });
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
    const imageUrl = String(b.image_url || '').trim();
    if (!accountId) return NextResponse.json({ error: 'Missing account.', code: 'missing_data' }, { status: 400 });
    if (!imageUrl) return NextResponse.json({ error: 'File is missing.', code: 'file_missing' }, { status: 400 });
    if (!(await ownsAccount(user.id, accountId))) {
      return NextResponse.json({ error: 'Account not found.', code: 'not_found' }, { status: 404 });
    }

    const { error } = await sb.from('account_documents').insert({
      user_id: user.id,
      account_id: accountId,
      doc_type: DOC_TYPES.includes(b.doc_type) ? b.doc_type : 'certificate',
      title: b.title ? String(b.title).slice(0, 120) : null,
      image_url: imageUrl.slice(0, 500),
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
    const { error } = await sb.from('account_documents').delete().eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
