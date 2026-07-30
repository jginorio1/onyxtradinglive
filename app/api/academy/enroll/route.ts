import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { enrollByCode } from '@/lib/academy';
import { recordReferral } from '@/lib/academyExtras';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · inscribirse en una academia con el código del mentor. `ref` = quién invitó.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const code = String(b.code || '').trim();
  if (!code) return NextResponse.json({ error: 'missing_code' }, { status: 400 });
  const r = await enrollByCode(user.id, code);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'self' ? 400 : 404 });
  // Afiliado: registra quién lo trajo (si viene ?ref y es otro miembro).
  const ref = String(b.ref || '').trim();
  if (ref && ref !== user.id) { try { await recordReferral(r.mentor_id!, ref, user.id); } catch {} }
  return NextResponse.json({ ok: true, mentor_id: r.mentor_id });
}
