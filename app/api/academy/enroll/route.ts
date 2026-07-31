import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { enrollByCode, subsStatus, isEnrolled } from '@/lib/academy';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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
  // Puertas cerradas: no dejar entrar nuevos (los que ya están inscritos sí pasan).
  const { data: mrow } = await supabaseAdmin.from('mentors').select('user_id').eq('code', code).maybeSingle();
  if (mrow) {
    const mid = (mrow as any).user_id;
    if (!(await isEnrolled(mid, user.id))) {
      const subs = await subsStatus(mid);
      if (!subs.open) return NextResponse.json({ closed: true, reopenAt: subs.reopenAt, note: subs.note }, { status: 200 });
    }
  }
  const r = await enrollByCode(user.id, code);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'self' ? 400 : 404 });
  // Afiliado: registra quién lo trajo (si viene ?ref y es otro miembro).
  const ref = String(b.ref || '').trim();
  if (ref && ref !== user.id) { try { await recordReferral(r.mentor_id!, ref, user.id); } catch {} }
  return NextResponse.json({ ok: true, mentor_id: r.mentor_id });
}
