import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authAccount } from '@/lib/copyAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · la EA esclava (modo LOCAL) pide UNA vez su configuración del enlace,
// para no tener que meter el sizing/límites a mano. Luego copia local (rápido).
export async function GET(req: Request) {
  const a = await authAccount(req);
  if (!a) return NextResponse.json({ error: 'invalid api key' }, { status: 401 });

  const { data: l } = await supabaseAdmin.from('copy_links')
    .select('mode,multiplier,risk_pct,pip_risk,max_lot,max_spread,daily_loss_pct,max_drawdown_pct')
    .eq('slave_account_id', a.account.id).eq('enabled', true)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();

  if (!l) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    mode: l.mode || 'balance',
    multiplier: Number(l.multiplier) || 1,
    risk_pct: Number(l.risk_pct) || 0,
    pip_risk: Number(l.pip_risk) || 0,
    max_lot: Number(l.max_lot) || 0,
    max_spread: Number(l.max_spread) || 0,
    daily_loss_pct: Number(l.daily_loss_pct) || 0,
    max_drawdown_pct: Number(l.max_drawdown_pct) || 0,
  });
}
