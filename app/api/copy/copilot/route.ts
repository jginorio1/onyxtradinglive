import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { copyCopilot } from '@/lib/copyCopilot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · Onyx AI copiloto de copia (#10): sugerencias en vivo sobre las copias del trader.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const out = await copyCopilot(user.id);
  return NextResponse.json(out);
}
