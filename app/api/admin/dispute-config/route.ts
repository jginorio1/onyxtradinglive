import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { disputeConfig, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET/POST · respaldo automático de disputas (envía la evidencia sola N días antes
// del plazo si no la revisaste). Solo Owner.
export async function GET() {
  const { isAdmin, role } = await getAdmin();
  if (!isAdmin || role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ config: await disputeConfig() });
}

export async function POST(req: Request) {
  const { isAdmin, role } = await getAdmin();
  if (!isAdmin || role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const cur = await disputeConfig();
  const next = {
    auto_submit: typeof b.auto_submit === 'boolean' ? b.auto_submit : cur.auto_submit,
    days_before: Math.max(0, Math.min(30, Math.round(Number(b.days_before ?? cur.days_before) || 2))),
  };
  await saveSetting('dispute_autosubmit', next);
  return NextResponse.json({ ok: true, config: next });
}
