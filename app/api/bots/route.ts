import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadBots, loadPortfolio } from '@/lib/bots';
import { hasAlgo, addonSettings } from '@/lib/settings';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista de bots con KPIs; ?view=portfolio → matriz de correlación + curva
export async function GET(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    if (!(await hasAlgo(user.id))) {
      const s = await addonSettings();
      return NextResponse.json({ locked: true, bots: [], addon: { enabled: s.algo_enabled && !!s.algo_price_id, price: s.algo_price } });
    }

    const view = new URL(req.url).searchParams.get('view');
    if (view === 'portfolio') return NextResponse.json({ locked: false, ...(await loadPortfolio(user.id)) });

    const r = await loadBots(user.id);
    return NextResponse.json({ locked: false, ...r });
  } catch (e: any) {
    await logError('bots_get', e);
    return NextResponse.json({ error: e?.message || 'error', bots: [] }, { status: 500 });
  }
}

// PATCH · configurar un bot: nombre, modo (auto/testing/live) y criterios de graduación
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    if (!(await hasAlgo(user.id))) return NextResponse.json({ error: 'plan' }, { status: 403 });

    const b = await req.json().catch(() => ({} as any));
    const magic = Number(b.magic);
    if (!Number.isFinite(magic) || magic === 0) return NextResponse.json({ error: 'falta magic', code: 'missing' }, { status: 400 });

    // Cuenta a la que pertenece el bot (nuevo: un bot es cuenta+magic). Validamos que sea del usuario.
    let account_id: string | null = b.account_id ? String(b.account_id) : null;
    if (account_id) {
      const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id').eq('id', account_id).eq('user_id', user.id).maybeSingle();
      if (!acc) return NextResponse.json({ error: 'cuenta no válida', code: 'bad_account' }, { status: 400 });
    }

    const patch: any = { user_id: user.id, magic };
    if (b.name !== undefined) patch.name = String(b.name).slice(0, 80);
    if (b.mode && ['auto', 'testing', 'live'].includes(String(b.mode))) patch.mode = String(b.mode);
    if (b.criteria && typeof b.criteria === 'object') {
      const cr = b.criteria;
      patch.criteria = {
        minDays: Math.max(0, Number(cr.minDays) || 0),
        minTrades: Math.max(0, Number(cr.minTrades) || 0),
        pf: Math.max(0, Number(cr.pf) || 0),
        maxDD: Math.max(0, Number(cr.maxDD) || 0),
      };
    }
    if (b.backtest && typeof b.backtest === 'object') {
      const bt = b.backtest;
      patch.backtest = {
        pf: bt.pf ? Number(bt.pf) : null,
        winRate: bt.winRate ? Number(bt.winRate) : null,
        maxDD: bt.maxDD ? Number(bt.maxDD) : null,
        note: bt.note ? String(bt.note).slice(0, 120) : null,
      };
    }

    // Upsert por (usuario, cuenta, magic). Hacemos el "existe? update : insert" a mano para no
    // depender de un índice único parcial (account_id puede ser null en filas antiguas).
    if (account_id) {
      patch.account_id = account_id;
      const { data: ex } = await supabaseAdmin.from('bots').select('id')
        .eq('user_id', user.id).eq('magic', magic).eq('account_id', account_id).maybeSingle();
      if (ex) {
        const { error } = await supabaseAdmin.from('bots').update(patch).eq('id', (ex as any).id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabaseAdmin.from('bots').insert(patch);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    // Legacy (sin cuenta): mantenemos el upsert antiguo por (usuario, magic).
    const { error } = await supabaseAdmin.from('bots').upsert(patch, { onConflict: 'user_id,magic' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('bots_patch', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
