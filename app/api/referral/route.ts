import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureRefCode } from '@/lib/memberReferral';
import { memberReferralSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// GET · mi enlace "Invita y gana" + mis estadísticas de referidos de miembro.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const s = await memberReferralSettings();
    if (!s.enabled) return NextResponse.json({ enabled: false });

    const code = await ensureRefCode(user.id);

    // Invitados (usuarios atados a mí) y cuántos ya pagaron (recompensa 'referrer')
    const [{ count: invited }, { count: qualified }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('member_ref_by', user.id),
      supabaseAdmin.from('member_rewards').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id).eq('kind', 'referrer'),
    ]);

    // ¿ya es embajador aprobado? Para no mostrarle el puente redundante.
    const { data: amb } = await supabaseAdmin.from('ambassadors').select('status').eq('user_id', user.id).maybeSingle();
    const isAmbassador = amb?.status === 'approved';

    // Crédito mío: pendiente (en ventana) y ya aplicado
    const { data: mine } = await supabaseAdmin.from('member_rewards').select('amount,status').eq('beneficiary', user.id);
    let pending = 0, applied = 0;
    for (const r of (mine || []) as any[]) {
      if (r.status === 'pending') pending += Number(r.amount) || 0;
      else if (r.status === 'applied') applied += Number(r.amount) || 0;
    }

    return NextResponse.json({
      enabled: true,
      link: `${APP}/?ref=${code}`,
      code,
      referrerCredit: s.referrer_credit,
      friendCredit: s.friend_credit,
      holdDays: s.hold_days,
      bridge: s.bridge_threshold,
      isAmbassador,
      invited: invited || 0,
      qualified: qualified || 0,
      pending: Math.round(pending * 100) / 100,
      applied: Math.round(applied * 100) / 100,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
