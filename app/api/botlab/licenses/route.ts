import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { myLicenses } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · las licencias (robots comprados) del trader.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  return NextResponse.json({ licenses: await myLicenses(user.id) });
}
