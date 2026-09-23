import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { copyMentorSettings } from '@/lib/settings';
import { getOffer, saveOffer, mentorCopiers, setSubStatus } from '@/lib/academyCopy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · panel del mentor: su oferta + copiadores + sus cuentas (para elegir maestra).
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const [offer, copiers, s, accts] = await Promise.all([
    getOffer(user.id), mentorCopiers(user.id), copyMentorSettings(),
    supabaseAdmin.from('trading_accounts').select('id,login,nickname,balance').eq('user_id', user.id),
  ]);
  return NextResponse.json({
    enabled: !!s.enabled, onyxFeePct: s.onyx_fee_pct, minPriceCents: s.min_price_cents,
    offer, copiers, accounts: (accts.data || []),
  });
}

// POST · guardar oferta (save) o pausar/reanudar un copiador (copier).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'save') {
      const offer = await saveOffer(user.id, b);
      return NextResponse.json({ ok: true, offer });
    }
    if (b.action === 'copier' && b.student_id) {
      const status = b.status === 'active' ? 'active' : 'paused';
      await setSubStatus(user.id, String(b.student_id), status);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'accion_invalida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
