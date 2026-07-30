import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { adminListAcademies, getDefaultFeePct, setDefaultFeePct, setMentorFeePct } from '@/lib/academyPay';
import { academyPerksSettings, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · panel del dueño: % por defecto + lista de academias + ajuste de perks.
export async function GET() {
  const { ok } = await requirePerm('academy', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [data, perks] = await Promise.all([adminListAcademies(), academyPerksSettings()]);
  return NextResponse.json({ ...data, perks });
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
      return NextResponse.json({ ok: true, defaultFeePct: pct });
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
      return NextResponse.json({ ok: true, feePct: val, effectiveFeePct: val == null ? await getDefaultFeePct() : val });
    }
    return NextResponse.json({ error: 'accion_invalida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
