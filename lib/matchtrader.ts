// ============================================================
// Conector MatchTrader (BETA) — server-side.
// MatchTrader no corre EAs: se integra contra la API REST del broker.
// Este módulo deja TODO listo para que Guardian y Copy funcionen IGUAL que en
// MetaTrader/cTrader. Reutiliza el mismo motor: evaluate() (Guardian) y
// relayMasterSnapshot() (Copy). Lo ÚNICO que falta es rellenar las 3 llamadas
// a la API real de tu broker (marcadas con TODO), porque cada broker de
// MatchTrader expone endpoints/autenticación distintos.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluate } from '@/lib/managerGuard';
import { relayMasterSnapshot } from '@/lib/copyRelay';

export type MtrPosition = { ticket: string; symbol: string; side: 'buy' | 'sell'; volume: number; openTime?: number; openPrice?: number; sl?: number; tp?: number };
export type MtrAccount = { balance: number; equity: number; openCount: number };

// ----- 1) Cliente de la API del broker (RELLENAR con la doc real) -----
async function mtrFetch(conn: any, path: string, init?: RequestInit) {
  const base = String(conn.api_base || '').replace(/\/$/, '');
  const res = await fetch(base + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + conn.api_key, ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error('mtr_http_' + res.status);
  return res.json();
}

// Devuelve la cuenta (balance/equity/posiciones abiertas).
export async function mtrGetAccount(conn: any): Promise<MtrAccount> {
  // TODO(broker): sustituir por el endpoint real, p.ej. GET /accounts/{id}
  // const j = await mtrFetch(conn, `/accounts/${conn.system_uuid}`);
  // return { balance: Number(j.balance), equity: Number(j.equity), openCount: Number(j.openPositions) };
  throw new Error('matchtrader_not_configured');
}

// Devuelve las posiciones abiertas.
export async function mtrGetPositions(conn: any): Promise<MtrPosition[]> {
  // TODO(broker): p.ej. GET /positions?accountId=... → mapear al shape MtrPosition[]
  throw new Error('matchtrader_not_configured');
}

// Cierra una posición por su id (lo usa Guardian para frenar y Copy para cerrar).
export async function mtrClosePosition(conn: any, ticket: string): Promise<boolean> {
  // TODO(broker): p.ej. DELETE /positions/{ticket} o POST /positions/{ticket}/close
  throw new Error('matchtrader_not_configured');
}

// Abre una posición (lo usa la esclava de Copy).
export async function mtrOpenPosition(conn: any, o: { symbol: string; side: 'buy' | 'sell'; volume: number; sl?: number; tp?: number }): Promise<string> {
  // TODO(broker): p.ej. POST /orders {symbol, side, volume, sl, tp} → devuelve ticket
  throw new Error('matchtrader_not_configured');
}

// ----- 2) Sync: MISMO Guardian + Copy que MetaTrader/cTrader -----
// Un cron llamará a esto por cada conexión activa. Cuando las 3 funciones de
// arriba estén rellenas, Guardian cerrará lo que abras bloqueado y Copy
// replicará, exactamente igual que en las otras plataformas.
export async function syncMatchtrader(conn: any) {
  let account: MtrAccount, positions: MtrPosition[];
  try {
    account = await mtrGetAccount(conn);
    positions = await mtrGetPositions(conn);
  } catch (e: any) {
    // Aún sin API real configurada → no hace nada (falla seguro).
    return { ok: false, reason: String(e?.message || 'not_configured') };
  }

  // --- Guardian (idéntico motor que MT/cTrader) ---
  const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', conn.account_id).maybeSingle();
  if (cfgRow?.enabled) {
    const verdict = await evaluate({
      userId: conn.user_id, accountId: conn.account_id, serverOffsetMin: 0,
      balance: account.balance, equity: account.equity, openCount: account.openCount,
      rawConfig: cfgRow.config, enabled: true,
    });
    if (verdict && (verdict.close_all || !verdict.allow_new)) {
      // Cierra lo que se abrió estando bloqueado (misma idea que el EA).
      for (const p of positions) { try { await mtrClosePosition(conn, p.ticket); } catch {} }
    }
  }

  // --- Copy: si esta cuenta es MASTER, relaya el snapshot ---
  await relayMasterSnapshot({
    userId: conn.user_id, masterAccountId: conn.account_id, masterBalance: account.balance,
    opened: positions.map((p) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume, sl: p.sl, tp: p.tp, price: p.openPrice })),
    closedTickets: [],   // TODO(broker): diferencia con la foto anterior cuando haya histórico
  });

  await supabaseAdmin.from('matchtrader_connections').update({ last_sync_at: new Date().toISOString() }).eq('id', conn.id);
  return { ok: true };
}
