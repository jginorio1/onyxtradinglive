import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { adminListAcademies, getDefaultFeePct, setDefaultFeePct, setMentorFeePct, getPlanFees, setPlanFee, logFeeChange, feeLog } from '@/lib/academyPay';
import { academyPerksSettings, saveSetting } from '@/lib/settings';
import { platformBalancePayouts } from '@/lib/academyBilling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · panel del dueño: % por defecto + comisión por plan + lista de academias + perks + historial.
export async function GET() {
  const { ok } = await requirePerm('academy', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [data, perks, planFees, log, platform] = await Promise.all([adminListAcademies(), academyPerksSettings(), getPlanFees(), feeLog(), platformBalancePayouts()]);
  return NextResponse.json({ ...data, perks, planFees, feeLog: log, platform });
}

// POST · editar la comisión: global (default_pct) o por mentor (mentor_id + fee_pct).
export async function POST(req: Request) {
  const { ok, user } = await requirePerm('academy', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'default') {
      const pct = await setDefaultFeePct(Number(b.default_pct));
      await logAdmin(user.email, 'academy_fee_default', String(pct));
      await logFeeChange(user.email, 'default', null, pct);
      return NextResponse.json({ ok: true, defaultFeePct: pct });
    }
    if (b.action === 'plan' && b.plan_id) {
      const raw = b.fee_pct === '' || b.fee_pct == null ? null : Number(b.fee_pct);
      const val = await setPlanFee(String(b.plan_id), raw);
      await logAdmin(user.email, 'academy_fee_plan', String(b.plan_id), { fee_pct: val });
      await logFeeChange(user.email, 'plan', String(b.plan_id), val);
      return NextResponse.json({ ok: true, plan_id: b.plan_id, fee_pct: val });
    }
    if (b.action === 'perks') {
      await saveSetting('academy_perks', { guardian_autogrant: !!b.guardian_autogrant });
      await logAdmin(user.email, 'academy_perks', 'guardian_autogrant=' + (!!b.guardian_autogrant));
      return NextResponse.json({ ok: true, guardian_autogrant: !!b.guardian_autogrant });
    }
    if (b.action === 'mentor' && b.mentor_id) {
      const raw = b.fee_pct === '' || b.fee_pct == null ? null : Number(b.fee_pct);
      const val = await setMentorFeePct(String(b.mentor_id), raw);
      await logAdmin(user.email, 'academy_fee_mentor', String(b.mentor_id), { fee_pct: val });
      await logFeeChange(user.email, 'mentor', String(b.mentor_id), val);
      return NextResponse.json({ ok: true, feePct: val, effectiveFeePct: val == null ? await getDefaultFeePct() : val });
    }
    return NextResponse.json({ error: 'accion_invalida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
