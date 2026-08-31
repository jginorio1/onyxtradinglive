import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · últimas entradas del log de copia del trader.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const { data } = await supabaseAdmin.from('copy_log')
    .select('kind,symbol,detail,ok,latency_ms,created_at')
    .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ log: data || [] });
}
