import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadBots } from '@/lib/bots';
import { alertOncePerDay } from '@/lib/telegram';
import { sendPush } from '@/lib/push';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Vigila los bots EN VIVO y avisa (una vez al día) si un bot rompe su drawdown
// máximo o se desvía del backtest. Protegido con CRON_SECRET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    // Planes que incluyen el módulo de bots
    const { data: plans } = await supabaseAdmin.from('plans').select('id,capabilities');
    const algoPlans = (plans || []).filter((p: any) => p.capabilities?.algo).map((p: any) => p.id);
    if (!algoPlans.length) return NextResponse.json({ ok: true, users: 0 });

    const { data: users } = await supabaseAdmin.from('profiles').select('id').in('plan', algoPlans).limit(1000);
    let alerts = 0;

    for (const u of users || []) {
      let r: any;
      try { r = await loadBots((u as any).id); } catch { continue; }
      for (const b of (r?.bots || [])) {
        if (b.mode !== 'live') continue;

        if (b.ddPct > b.criteria.maxDD) {
          const ok = await alertOncePerDay((u as any).id, 'funding', `bot_dd_${b.magic}`,
            `🤖 Onyx · ${b.name}\n⚠️ Drawdown ${b.ddPct}% supera tu tope de ${b.criteria.maxDD}%. Revisa el bot.`).catch(() => false);
          if (ok) { alerts++; sendPush((u as any).id, { title: `Onyx · ${b.name}`, body: `Drawdown ${b.ddPct}% > ${b.criteria.maxDD}%`, url: '/dashboard/bots' }).catch(() => {}); }
        }

        if (b.divergence?.status === 'diverge') {
          const ok = await alertOncePerDay((u as any).id, 'funding', `bot_div_${b.magic}`,
            `🤖 Onyx · ${b.name}\n⚠️ Diverge del backtest (PF vivo ${b.divergence.pfLive} vs ${b.divergence.pfExp}). Posible sobreoptimización.`).catch(() => false);
          if (ok) { alerts++; sendPush((u as any).id, { title: `Onyx · ${b.name}`, body: 'Diverge del backtest', url: '/dashboard/bots' }).catch(() => {}); }
        }
      }
    }
    return NextResponse.json({ ok: true, users: (users || []).length, alerts });
  } catch (e: any) {
    await logError('bots_check', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
