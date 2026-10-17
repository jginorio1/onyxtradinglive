import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { saveSetting } from '@/lib/settings';
import { usageConfig, type FeeTier } from '@/lib/usage';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · tarifas de pago por uso (comisión de recarga + precios por uso).
export async function GET() {
  try {
    const { ok } = await requirePerm('finanzas', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const cfg = await usageConfig();
    return NextResponse.json({ ok: true, ...cfg });
  } catch (e: any) { await logError('usage_fees_get', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}

// POST · guardar. { usage_on, ai_call_cents, account_month_cents, topup_fee_min_cents, topup_fee_tiers:[{min,pct}] }
export async function POST(req: Request) {
  try {
    const g = await requirePerm('finanzas', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'sin permiso' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const tiers: FeeTier[] = Array.isArray(b.topup_fee_tiers)
      ? b.topup_fee_tiers
          .map((t: any) => ({ min: Math.max(0, Number(t.min) || 0), pct: Math.max(0, Math.min(100, Number(t.pct) || 0)) }))
          .sort((a: FeeTier, b2: FeeTier) => b2.min - a.min)
      : [];
    const clean = {
      usage_on: b.usage_on !== false,
      ai_call_cents: Math.max(0, Math.round(Number(b.ai_call_cents) || 0)),
      account_month_cents: Math.max(0, Math.round(Number(b.account_month_cents) || 0)),
      topup_fee_min_cents: Math.max(0, Math.round(Number(b.topup_fee_min_cents) || 0)),
      topup_fee_tiers: tiers.length ? tiers : undefined,
    };
    await saveSetting('usage_fees', clean);
    try { await logAdmin(g.user?.email || '', 'usage_fees_save', 'usage_fees', clean); } catch {}
    const cfg = await usageConfig();
    return NextResponse.json({ ok: true, ...cfg });
  } catch (e: any) { await logError('usage_fees_post', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
