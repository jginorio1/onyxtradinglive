import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { offerInfo, getSub, connectSlave, setRiskMultiplier } from '@/lib/academyCopy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · datos para la tarjeta del alumno: oferta del mentor + su suscripción + sus cuentas.
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const mentorId = new URL(req.url).searchParams.get('mentor_id') || '';
  if (!mentorId) return NextResponse.json({ error: 'falta mentor' }, { status: 400 });
  const [info, sub, accts] = await Promise.all([
    offerInfo(mentorId), getSub(mentorId, user.id),
    supabaseAdmin.from('trading_accounts').select('id,login,nickname,balance').eq('user_id', user.id),
  ]);
  return NextResponse.json({ info, sub, accounts: (accts.data || []) });
}

// POST · conectar cuenta (connect) o ajustar multiplicador (multiplier).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const mentorId = String(b.mentor_id || '');
  if (!mentorId) return NextResponse.json({ error: 'falta mentor' }, { status: 400 });
  try {
    if (b.action === 'connect' && b.slave_account_id) {
      // La cuenta debe ser del alumno (seguridad).
      const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id').eq('id', b.slave_account_id).eq('user_id', user.id).maybeSingle();
      if (!acc) return NextResponse.json({ error: 'cuenta_invalida' }, { status: 400 });
      const r = await connectSlave({
        mentorId, studentId: user.id, slaveAccountId: String(b.slave_account_id),
        accountType: b.account_type, riskMultiplier: Number(b.risk_multiplier) || 1,
        fundedDaily: b.funded_daily != null ? Number(b.funded_daily) : null,
        fundedMaxDd: b.funded_max_dd != null ? Number(b.funded_max_dd) : null,
        consent: !!b.consent,
      });
      return NextResponse.json({ ok: true, ...r });
    }
    if (b.action === 'multiplier') {
      await setRiskMultiplier(mentorId, user.id, Number(b.risk_multiplier) || 1);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'accion_invalida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
