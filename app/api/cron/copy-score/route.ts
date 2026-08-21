import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeScoreForAccount } from '@/lib/copyScore';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron · recalcula el Onyx Score de todos los proveedores activos (ventana móvil,
// así suben y bajan de tier según su operativa reciente). Protegido con CRON_SECRET.
// Recomendado: 1 vez al día. Circuit breaker: si el drawdown rompe el gate, baja de tier.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const { data: providers } = await supabaseAdmin.from('strategy_providers')
      .select('id,user_id,account_id,verified,tier').eq('status', 'active').limit(1000);
    let updated = 0; const errors: string[] = [];
    for (const p of (providers || []) as any[]) {
      try {
        const res = await computeScoreForAccount(p.user_id, p.account_id, { verified: !!p.verified });
        await supabaseAdmin.from('strategy_providers').update({
          score: res.score, tier: res.tier, pillars: res.pillars, stats: res.stats,
          scored_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', p.id);
        updated++;
      } catch (e: any) { errors.push(String(p.id) + ': ' + (e?.message || 'error')); }
    }
    return NextResponse.json({ ok: true, updated, total: (providers || []).length, errors: errors.slice(0, 10) });
  } catch (e: any) {
    await logError('cron_copy_score', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
