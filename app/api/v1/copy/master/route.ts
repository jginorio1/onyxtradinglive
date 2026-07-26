import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authAccount } from '@/lib/copyAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · la EA master reporta un evento de operación. El relay crea un comando
// por cada esclava enlazada y activa.
export async function POST(req: Request) {
  const a = await authAccount(req);
  if (!a) return NextResponse.json({ ok: false, error: 'invalid api key' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const action = b.event === 'close' ? 'close' : b.event === 'modify' ? 'modify' : 'open';

  const { data: links } = await supabaseAdmin.from('copy_links')
    .select('id,slave_account_id,mode,multiplier,risk_pct,pip_risk,max_lot,reverse,symbol_map')
    .eq('master_account_id', a.account.id).eq('enabled', true);
  if (!links?.length) return NextResponse.json({ ok: true, slaves: 0 });

  let side = String(b.side || '');
  const rows = links.map((l) => ({
    link_id: l.id,
    slave_account_id: l.slave_account_id,
    action,
    master_ticket: String(b.ticket || ''),
    base_symbol: String(b.symbol || ''),
    side: l.reverse && action === 'open' ? (side === 'buy' ? 'sell' : 'buy') : side,
    volume_hint: Number(b.volume) || 0,
    sl: b.sl != null ? Number(b.sl) : null,
    tp: b.tp != null ? Number(b.tp) : null,
    price: b.price != null ? Number(b.price) : null,
    payload: {
      mode: l.mode, multiplier: l.multiplier, risk_pct: l.risk_pct, pip_risk: l.pip_risk,
      max_lot: l.max_lot, symbol_map: l.symbol_map || {}, masterBalance: Number(a.account.balance) || 0,
    },
    status: 'pending',
  }));
  await supabaseAdmin.from('copy_commands').insert(rows);
  return NextResponse.json({ ok: true, slaves: rows.length });
}
