import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mentorAffiliateData, referrerView, saveAffiliateSettings, payReferrer, setPayoutMethod } from '@/lib/academyReferral';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function auth() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// GET · ?m=mentorId → vista del REFERIDO en esa academia.
//       sin ?m       → panel del MENTOR (sus referidos y pagos).
export async function GET(req: Request) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const m = new URL(req.url).searchParams.get('m');
  try {
    if (m) return NextResponse.json(await referrerView(user.id, m));
    return NextResponse.json(await mentorAffiliateData(user.id));
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}

// POST · settings/pay (mentor) · method (referido).
export async function POST(req: Request) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'method') {
      // El referido guarda cómo quiere que le paguen en esta academia.
      if (!b.mentor_id) return NextResponse.json({ error: 'missing_mentor' }, { status: 400 });
      await setPayoutMethod(String(b.mentor_id), user.id, String(b.method || ''), String(b.handle || ''), b.network ? String(b.network) : undefined);
      return NextResponse.json({ ok: true });
    }
    // Acciones de mentor: verifica que sea mentor con academia.
    const { data: mentor } = await supabaseAdmin.from('mentors').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!mentor) return NextResponse.json({ error: 'no_mentor' }, { status: 403 });
    if (b.action === 'settings') {
      const s = await saveAffiliateSettings(user.id, b);
      return NextResponse.json({ ok: true, settings: s });
    }
    if (b.action === 'pay' && b.referrer_id) {
      const r = await payReferrer(user.id, String(b.referrer_id), b.method ? String(b.method) : undefined, b.note ? String(b.note) : undefined);
      return NextResponse.json(r);
    }
    return NextResponse.json({ error: 'accion_invalida' }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
