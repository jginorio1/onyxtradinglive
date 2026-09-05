import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { issueCertificate, certByCode } from '@/lib/academyExtras';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ?code=XXX → datos públicos del certificado (para verificar/mostrar).
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const c = await certByCode(code);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ certificate: c });
}

// POST · el alumno emite su certificado al completar un curso. { mentor_id, module_id }.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.mentor_id || !b.module_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const r = await issueCertificate(user.id, String(b.mentor_id), String(b.module_id));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, code: r.code });
}
