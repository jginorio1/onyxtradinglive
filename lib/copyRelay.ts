// ============================================================
// Onyx Connect · relay de copy desde el sync del master.
// El Onyx Connect ya reporta las posiciones abiertas en cada sync;
// aquí comparamos con la foto anterior y generamos las órdenes de
// copia (open/close) por cada esclava enlazada. Así el MASTER no
// necesita un EA aparte: le basta con Onyx Connect.
//
// Reglas idénticas al endpoint /api/v1/copy/master:
//   · respeta pausa global, de master y de cada esclava,
//   · aplica sesión y whitelist SOLO al abrir,
//   · en cierre siempre manda (para no dejar huérfanas).
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeSymbol, aliasesOf } from '@/lib/copySymbols';

function mapStr(m: any): string { if (!m || typeof m !== 'object') return ''; return Object.keys(m).map((k) => k + '=' + m[k]).join(';'); }

function inSession(from?: string | null, to?: string | null): boolean {
  if (!from || !to) return true;
  const now = new Date();
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const p = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const a = p(from), b = p(to);
  if (a === b) return true;
  return a < b ? (cur >= a && cur < b) : (cur >= a || cur < b);
}

function symbolAllowed(symbol: string, whitelist: any): boolean {
  const wl = Array.isArray(whitelist) ? whitelist : [];
  if (!wl.length) return true;
  const base = normalizeSymbol(symbol);
  const al = aliasesOf(symbol);
  return wl.some((w: string) => { const nb = normalizeSymbol(w); return nb === base || al.includes(nb); });
}

export type OpenPos = { ticket: any; symbol: string; side: string; volume: number; sl?: number; tp?: number; price?: number };

// Devuelve true si la cuenta es MASTER de al menos un enlace activo.
export async function isCopyMaster(accountId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('copy_links')
    .select('id').eq('master_account_id', accountId).eq('enabled', true).limit(1);
  return !!(data && data.length);
}

// Genera las órdenes de copia a partir del diff de posiciones abiertas.
export async function relayMasterSnapshot(opts: {
  userId: string;
  masterAccountId: string;
  masterBalance: number;
  opened: OpenPos[];       // posiciones que aparecieron desde el último sync
  closedTickets: string[]; // tickets que desaparecieron desde el último sync
}) {
  const { userId, masterAccountId, masterBalance, opened, closedTickets } = opts;
  if (!opened.length && !closedTickets.length) return;

  // Pausa global del trader (kill switch).
  const { data: prof } = await supabaseAdmin.from('profiles').select('copy_paused').eq('id', userId).maybeSingle();
  if ((prof as any)?.copy_paused) return;

  // Pausa de la propia cuenta master.
  const { data: macc } = await supabaseAdmin.from('trading_accounts').select('copy_paused').eq('id', masterAccountId).maybeSingle();
  if ((macc as any)?.copy_paused) return;

  const { data: links } = await supabaseAdmin.from('copy_links')
    .select('id,slave_account_id,mode,multiplier,risk_pct,pip_risk,max_lot,reverse,symbol_map,daily_loss_pct,max_drawdown_pct,max_spread,session_from,session_to,symbol_whitelist,max_deviation_pts,max_signal_age_s,require_sl,max_positions,per_symbol_lot_cap')
    .eq('master_account_id', masterAccountId).eq('enabled', true);
  if (!links?.length) return;

  // Pausa de cada esclava.
  const slaveIds = Array.from(new Set(links.map((l) => l.slave_account_id)));
  const { data: slaves } = await supabaseAdmin.from('trading_accounts').select('id,copy_paused').in('id', slaveIds);
  const pausedSlave: Record<string, boolean> = {};
  (slaves || []).forEach((s: any) => { pausedSlave[s.id] = !!s.copy_paused; });

  const mkPayload = (l: any) => ({
    mode: l.mode, multiplier: l.multiplier, risk_pct: l.risk_pct, pip_risk: l.pip_risk,
    max_lot: l.max_lot, symbol_map: l.symbol_map || {}, masterBalance: Number(masterBalance) || 0,
    limits: {
      max_lot: Number(l.max_lot) || 0, max_spread: Number(l.max_spread) || 0,
      daily_loss_pct: Number(l.daily_loss_pct) || 0, max_drawdown_pct: Number(l.max_drawdown_pct) || 0,
      max_deviation_pts: Number(l.max_deviation_pts) || 0, max_signal_age_s: Number(l.max_signal_age_s) || 0,
      require_sl: l.require_sl ? 1 : 0, max_positions: Number(l.max_positions) || 0,
      per_symbol_lot_cap: Number(l.per_symbol_lot_cap) || 0,
    },
    symbol_map_str: mapStr(l.symbol_map),
  });

  const rows: any[] = [];
  for (const l of links) {
    if (pausedSlave[l.slave_account_id]) continue;

    // Aperturas: aplican sesión + whitelist.
    for (const p of opened) {
      if (!inSession(l.session_from, l.session_to)) continue;
      if (!symbolAllowed(p.symbol, l.symbol_whitelist)) continue;
      rows.push({
        link_id: l.id, slave_account_id: l.slave_account_id, action: 'open',
        master_ticket: String(p.ticket || ''), base_symbol: p.symbol,
        side: l.reverse ? (p.side === 'buy' ? 'sell' : 'buy') : p.side,
        volume_hint: Number(p.volume) || 0,
        sl: p.sl != null ? Number(p.sl) : null, tp: p.tp != null ? Number(p.tp) : null,
        price: p.price != null ? Number(p.price) : null,
        payload: mkPayload(l), status: 'pending',
      });
    }
    // Cierres: siempre pasan.
    for (const tk of closedTickets) {
      rows.push({
        link_id: l.id, slave_account_id: l.slave_account_id, action: 'close',
        master_ticket: String(tk), base_symbol: '', side: '', volume_hint: 0,
        sl: null, tp: null, price: null, payload: mkPayload(l), status: 'pending',
      });
    }
  }

  if (rows.length) await supabaseAdmin.from('copy_commands').insert(rows);
}
