import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { studentBilling, academyPortal, setAcademyCancel } from '@/lib/academyBilling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · facturación del alumno en sus academias. ?m=mentorId la filtra a una.
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const m = new URL(req.url).searchParams.get('m') || undefined;
  return NextResponse.json({ items: await studentBilling(user.id, m) });
}

// POST · abrir portal de Stripe, o cancelar / reactivar la suscripción.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const mid = String(b.mentor_id || '');
  if (!mid) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const action = String(b.action || '');
  if (action === 'portal') {
    const url = await academyPortal(user.id, mid);
    return url ? NextResponse.json({ url }) : NextResponse.json({ error: 'no_portal' }, { status: 400 });
  }
  if (action === 'cancel') return NextResponse.json(await setAcademyCancel(user.id, mid, true));
  if (action === 'resume') return NextResponse.json(await setAcademyCancel(user.id, mid, false));
  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
