import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { memberReferralSettings } from '@/lib/settings';
import { saveSetting } from '@/lib/settings';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ajustes + un resumen del programa "Invita y gana".
export async function GET() {
  const g = await requirePerm('embajadores', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const settings = await memberReferralSettings();
  let stats = { rewards: 0, credited: 0, pending: 0 };
  try {
    const { data } = await supabaseAdmin.from('member_rewards').select('amount,status');
    for (const r of (data || []) as any[]) {
      stats.rewards++;
      if (r.status === 'applied') stats.credited += Number(r.amount) || 0;
      else if (r.status === 'pending') stats.pending += Number(r.amount) || 0;
    }
    stats.credited = Math.round(stats.credited * 100) / 100;
    stats.pending = Math.round(stats.pending * 100) / 100;
  } catch {}
  return NextResponse.json({ settings, stats });
}

// PATCH · guardar ajustes (solo quien gestiona Embajadores).
export async function PATCH(req: Request) {
  const g = await requirePerm('embajadores', 'manage');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const cur = await memberReferralSettings();
  const next = {
    enabled: typeof b.enabled === 'boolean' ? b.enabled : cur.enabled,
    referrer_credit: Math.max(0, Number(b.referrer_credit ?? cur.referrer_credit)),
    friend_credit: Math.max(0, Number(b.friend_credit ?? cur.friend_credit)),
    hold_days: Math.max(0, Number(b.hold_days ?? cur.hold_days)),
    max_per_month: Math.max(0, Number(b.max_per_month ?? cur.max_per_month)),
    max_lifetime: Math.max(0, Number(b.max_lifetime ?? cur.max_lifetime)),
    bridge_threshold: Math.max(0, Number(b.bridge_threshold ?? cur.bridge_threshold)),
  };
  await saveSetting('member_referral', next);
  await logAdmin(g.user.email || '', 'member_referral_settings', 'settings', {});
  return NextResponse.json({ ok: true, settings: next });
}
