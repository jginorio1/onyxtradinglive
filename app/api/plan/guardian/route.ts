import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { applyGuardian, guardianSummary, getPlan, computeStats } from '@/lib/tradingPlan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return { user, caps: (plan?.capabilities as any) || {} };
}

// POST · aplica pérdida diaria máx (%) y máx operaciones/día al Guardian de TODAS
// las cuentas del trader, para que el plan y el Guardian queden idénticos.
// Necesita que el Guardian esté en el plan del usuario (caps.manager).
export async function POST(req: Request) {
  const { user, caps } = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!caps?.manager) return NextResponse.json({ error: 'no_manager' }, { status: 403 });

  const g0 = await guardianSummary(user.id);
  if (!g0.hasAccounts) return NextResponse.json({ error: 'no_accounts' }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const dl = Math.max(0, Math.min(100, Number(b.daily_loss_pct)));
  const mt = Math.max(0, Math.min(500, Math.round(Number(b.max_trades_day))));
  if (!Number.isFinite(dl) || !Number.isFinite(mt)) return NextResponse.json({ error: 'bad_values' }, { status: 400 });

  const { updated } = await applyGuardian(user.id, dl, mt);
  const guardian = await guardianSummary(user.id);
  const plan = await getPlan(user.id);
  const stats = await computeStats(user.id, plan);
  return NextResponse.json({ ok: true, updated: updated.length, accounts: guardian.accounts, guardian, plan, stats });
}
