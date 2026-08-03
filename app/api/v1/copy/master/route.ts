import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authAccount } from '@/lib/copyAuth';
import { normalizeSymbol, aliasesOf } from '@/lib/copySymbols';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ¿Estamos dentro de la franja horaria (UTC) permitida del enlace?
// from/to en "HH:MM". Soporta franjas que cruzan medianoche (ej. 22:00→06:00).
function inSession(from?: string | null, to?: string | null): boolean {
  if (!from || !to) return true;
  const now = new Date();
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const p = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const a = p(from), b = p(to);
  if (a === b) return true;
  return a < b ? (cur >= a && cur < b) : (cur >= a || cur < b);
}

// ¿El símbolo está en la whitelist del enlace? (vacía = todos)
function symbolAllowed(symbol: string, whitelist: any): boolean {
  const wl = Array.isArray(whitelist) ? whitelist : [];
  if (!wl.length) return true;
  const base = normalizeSymbol(symbol);
  const al = aliasesOf(symbol);
  return wl.some((w: string) => {
    const nb = normalizeSymbol(w);
    return nb === base || al.includes(nb);
  });
}

// POST · la EA master reporta un evento de operación. El relay crea un comando
// por cada esclava enlazada y activa — respetando pausas y controles de riesgo.
export async function POST(req: Request) {
  const a = await authAccount(req);
  if (!a) return NextResponse.json({ ok: false, error: 'invalid api key' }, { status: 401 });

  // Pausa GLOBAL del trader (kill switch) → no se copia nada.
  const { data: prof } = await supabaseAdmin.from('profiles').select('copy_paused').eq('id', a.userId).maybeSingle();
  if (prof?.copy_paused) return NextResponse.json({ ok: true, slaves: 0, paused: 'global' });

  // Pausa de la propia cuenta MASTER → deja de mandar.
  if (a.account.copy_paused) return NextResponse.json({ ok: true, slaves: 0, paused: 'master' });

  const b = await req.json().catch(() => ({}));
  const action = b.event === 'close' ? 'close' : b.event === 'modify' ? 'modify' : 'open';
  const symbol = String(b.symbol || '');

  const { data: links } = await supabaseAdmin.from('copy_links')
    .select('id,slave_account_id,mode,multiplier,risk_pct,pip_risk,max_lot,reverse,symbol_map,daily_loss_pct,max_drawdown_pct,max_spread,session_from,session_to,symbol_whitelist,max_deviation_pts,max_signal_age_s,require_sl,max_positions,per_symbol_lot_cap')
    .eq('master_account_id', a.account.id).eq('enabled', true);
  if (!links?.length) return NextResponse.json({ ok: true, slaves: 0 });

  // Estado de pausa de cada cuenta esclava (una consulta).
  const slaveIds = Array.from(new Set(links.map((l) => l.slave_account_id)));
  const { data: slaves } = await supabaseAdmin.from('trading_accounts')
    .select('id,copy_paused').in('id', slaveIds);
  const pausedSlave: Record<string, boolean> = {};
  (slaves || []).forEach((s: any) => { pausedSlave[s.id] = !!s.copy_paused; });

  const side = String(b.side || '');
  const rows: any[] = [];
  let skipped = 0;

  for (const l of links) {
    // Esclava en pausa → no se le manda.
    if (pausedSlave[l.slave_account_id]) { skipped++; continue; }
    // Los filtros de riesgo solo aplican al ABRIR. Cerrar/modificar siempre pasa
    // para no dejar operaciones huérfanas abiertas en la esclava.
    if (action === 'open') {
      if (!inSession(l.session_from, l.session_to)) { skipped++; continue; }
      if (!symbolAllowed(symbol, l.symbol_whitelist)) { skipped++; continue; }
    }
    rows.push({
      link_id: l.id,
      slave_account_id: l.slave_account_id,
      action,
      master_ticket: String(b.ticket || ''),
      base_symbol: symbol,
      side: l.reverse && action === 'open' ? (side === 'buy' ? 'sell' : 'buy') : side,
      volume_hint: Number(b.volume) || 0,
      sl: b.sl != null ? Number(b.sl) : null,
      tp: b.tp != null ? Number(b.tp) : null,
      price: b.price != null ? Number(b.price) : null,
      payload: {
        mode: l.mode, multiplier: l.multiplier, risk_pct: l.risk_pct, pip_risk: l.pip_risk,
        max_lot: l.max_lot, symbol_map: l.symbol_map || {}, masterBalance: Number(a.account.balance) || 0,
        // Límites que la EA esclava aplica en su lado:
        limits: {
          max_lot: Number(l.max_lot) || 0,
          max_spread: Number(l.max_spread) || 0,
          daily_loss_pct: Number(l.daily_loss_pct) || 0,
          max_drawdown_pct: Number(l.max_drawdown_pct) || 0,
          max_deviation_pts: Number(l.max_deviation_pts) || 0,
          max_signal_age_s: Number(l.max_signal_age_s) || 0,
          require_sl: l.require_sl ? 1 : 0,
          max_positions: Number(l.max_positions) || 0,
          per_symbol_lot_cap: Number(l.per_symbol_lot_cap) || 0,
        },
        symbol_map_str: (l.symbol_map && typeof l.symbol_map === 'object') ? Object.keys(l.symbol_map).map((k) => k + '=' + l.symbol_map[k]).join(';') : '',
      },
      status: 'pending',
    });
  }

  if (rows.length) await supabaseAdmin.from('copy_commands').insert(rows);
  return NextResponse.json({ ok: true, slaves: rows.length, skipped });
}
