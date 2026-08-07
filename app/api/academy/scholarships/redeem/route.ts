import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { redeemCode } from '@/lib/academyScholarship';
import { serverLang } from '@/lib/locale';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · un alumno logueado canjea un código de beca. { code }
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const r = await redeemCode(user.id, String(b.code || ''), serverLang());
  if (!r.ok) return NextResponse.json({ error: r.error || 'Error' }, { status: 400 });
  return NextResponse.json({ ok: true, mentorId: r.mentorId });
}
