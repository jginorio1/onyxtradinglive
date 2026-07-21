import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', req.url), { status: 303 });
}
