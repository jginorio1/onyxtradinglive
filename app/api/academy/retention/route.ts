import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getMentor } from '@/lib/academy';
import { retentionStats } from '@/lib/academyRetention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · analíticas de retención (solo el mentor).
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const mrow = await getMentor(user.id);
  if (!mrow) return NextResponse.json({ error: 'no_mentor' }, { status: 403 });
  return NextResponse.json(await retentionStats(mrow.user_id));
}
