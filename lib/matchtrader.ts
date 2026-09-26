// ============================================================
// Conector MatchTrader (Broker API) — server-side, EJECUCIÓN REAL.
// MatchTrader no corre EAs: se integra contra la Broker API REST del bróker.
// Guardian y Copy usan el MISMO motor que MetaTrader/cTrader: evaluate()
// (Guardian) y relayMasterSnapshot() (Copy). Aquí ya están implementadas las
// llamadas reales de la documentación:
//   · Auth:        Authorization: Bearer <token del CRM>
//   · Open:        POST /open-position   { systemUuid, login, instrument, orderSide, volume, slPrice?, tpPrice? }
//   · Close:       POST /close-position  { systemUuid, login, closePositions:[{ id }] }
//   · Edit SL/TP:  POST /edit-position   { systemUuid, login, id, slPrice?, tpPrice? }
//   · Open data:   POST /open-positions  { systemUuid, login }  → lista de posiciones
// Las RUTAS relativas son configurables por variables de entorno por si tu bróker
// las expone con otro path (no hay que tocar código):
//   MATCHTRADER_PATH_OPEN, MATCHTRADER_PATH_CLOSE, MATCHTRADER_PATH_EDIT,
//   MATCHTRADER_PATH_POSITIONS, MATCHTRADER_PATH_ACCOUNT
// La URL base y el token los pega el trader al conectar la cuenta (api_base/api_key).
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluate } from '@/lib/managerGuard';
import { relayMasterSnapshot } from '@/lib/copyRelay';

export type MtrPosition = { ticket: string; symbol: string; side: 'buy' | 'sell'; volume: number; openTime?: number; openPrice?: number; sl?: number; tp?: number };
export type MtrAccount = { balance: number; equity: number; openCount: number };

// Rutas relativas de la Broker API (con defaults de la doc; overrideables por env).
const P = {
  open: process.env.MATCHTRADER_PATH_OPEN || '/open-position',
  close: process.env.MATCHTRADER_PATH_CLOSE || '/close-position',
  edit: process.env.MATCHTRADER_PATH_EDIT || '/edit-position',
  positions: process.env.MATCHTRADER_PATH_POSITIONS || '/open-positions',
  account: process.env.MATCHTRADER_PATH_ACCOUNT || '/balance-snapshots',
};

// Cifrado del token en reposo (opcional): si MATCHTRADER_ENC_KEY está definido,
// el token se guarda cifrado (AES-256-GCM) y se descifra aquí en memoria; si no,
// se usa tal cual (compatibilidad). Nunca se devuelve el token al cliente.
function tokenOf(conn: any): string {
  const raw = String(conn?.api_key || '');
  if (!raw.startsWith('enc:')) return raw;
  try {
    const crypto = require('crypto');
    const keyHex = process.env.MATCHTRADER_ENC_KEY || '';
    if (!keyHex) return raw;
    const key = Buffer.from(keyHex, 'hex');
    const [, ivB64, tagB64, dataB64] = raw.split(':');
    const iv = Buffer.from(ivB64, 'base64'); const tag = Buffer.from(tagB64, 'base64');
    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv); dec.setAuthTag(tag);
    return Buffer.concat([dec.update(Buffer.from(dataB64, 'base64')), dec.final()]).toString('utf8');
  } catch { return raw; }
}

// Cifra un token para guardarlo (lo usa la ruta connect). Devuelve el texto plano
// si no hay clave configurada, de modo que el sistema sigue funcionando igual.
export function encryptToken(plain: string): string {
  try {
    const crypto = require('crypto');
    const keyHex = process.env.MATCHTRADER_ENC_KEY || '';
    if (!keyHex) return plain;
    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(12);
    const enc = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([enc.update(Buffer.from(plain, 'utf8')), enc.final()]);
    const tag = enc.getAuthTag();
    return ['enc', iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
  } catch { return plain; }
}

// ----- Cliente HTTP de la Broker API (Bearer, TLS) -----
async function mtrFetch(conn: any, path: string, body: any) {
  const base = String(conn.api_base || '').replace(/\/$/, '');
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tokenOf(conn) },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text().catch(() => '');
  let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error('mtr_http_' + res.status + (json?.message ? ':' + json.message : ''));
  return json;
}

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sideOf = (v: any): 'buy' | 'sell' => (String(v || '').toUpperCase() === 'SELL' ? 'sell' : 'buy');

// Normaliza cualquier forma de respuesta de posiciones a MtrPosition[].
function mapPositions(j: any): MtrPosition[] {
  const arr: any[] = Array.isArray(j) ? j : (j?.positions || j?.openPositions || j?.data || []);
  return (arr || []).map((p) => ({
    ticket: String(p.id ?? p.positionId ?? p.ticket ?? p.orderId ?? ''),
    symbol: String(p.symbol ?? p.instrument ?? ''),
    side: sideOf(p.side ?? p.orderSide ?? p.type),
    volume: num(p.volume ?? p.lots ?? p.size),
    openTime: p.openTime ? new Date(p.openTime).getTime() : (p.open_time ? new Date(p.open_time).getTime() : undefined),
    openPrice: num(p.openPrice ?? p.open_price ?? p.price) || undefined,
    sl: num(p.slPrice ?? p.stopLoss ?? p.stop_loss ?? p.sl) || undefined,
    tp: num(p.tpPrice ?? p.takeProfit ?? p.take_profit ?? p.tp) || undefined,
  })).filter((p) => p.ticket);
}

// Posiciones abiertas de la cuenta (login).
export async function mtrGetPositions(conn: any): Promise<MtrPosition[]> {
  const j = await mtrFetch(conn, P.positions, { systemUuid: conn.system_uuid, login: conn.login });
  return mapPositions(j);
}

// Balance/equity/nº de abiertas. Intenta un endpoint de cuenta; si el bróker no lo
// expone, deriva lo que puede de las posiciones (nunca rompe el ciclo).
export async function mtrGetAccount(conn: any, positions?: MtrPosition[]): Promise<MtrAccount> {
  let balance = 0, equity = 0;
  try {
    const j = await mtrFetch(conn, P.account, { systemUuid: conn.system_uuid, login: conn.login });
    const row = Array.isArray(j) ? j[j.length - 1] : (j?.snapshots ? j.snapshots[j.snapshots.length - 1] : j);
    balance = num(row?.balance);
    equity = num(row?.equity) || balance;
  } catch { /* sin endpoint de cuenta: seguimos con lo que haya */ }
  const pos = positions || [];
  return { balance, equity, openCount: pos.length };
}

// Cierra una posición por id (Guardian para frenar, Copy para cerrar).
export async function mtrClosePosition(conn: any, ticket: string): Promise<boolean> {
  const j = await mtrFetch(conn, P.close, {
    systemUuid: conn.system_uuid, login: conn.login,
    closePositions: [{ id: String(ticket) }],
  });
  return String(j?.status || 'OK').toUpperCase() !== 'REJECTED';
}

// Abre una posición (esclava de Copy o acciones del gestor).
export async function mtrOpenPosition(conn: any, o: { symbol: string; side: 'buy' | 'sell'; volume: number; sl?: number; tp?: number }): Promise<string> {
  const j = await mtrFetch(conn, P.open, {
    systemUuid: conn.system_uuid, login: conn.login,
    instrument: o.symbol, orderSide: o.side === 'sell' ? 'SELL' : 'BUY',
    volume: o.volume, slPrice: o.sl || undefined, tpPrice: o.tp || undefined,
  });
  if (String(j?.status || '').toUpperCase() === 'REJECTED') throw new Error('mtr_open_rejected');
  return String(j?.orderId || '');
}

// Edita SL/TP de una posición abierta.
export async function mtrEditPosition(conn: any, id: string, sl?: number, tp?: number): Promise<boolean> {
  const j = await mtrFetch(conn, P.edit, {
    systemUuid: conn.system_uuid, login: conn.login, id: String(id),
    slPrice: sl || undefined, tpPrice: tp || undefined,
  });
  return String(j?.status || 'OK').toUpperCase() !== 'REJECTED';
}

// ----- Copy ESCLAVA por API (MatchTrader no tiene EA) -----
// La esclava ejecuta los comandos de la MISMA cola copy_commands que usan los EAs:
//   · open  → abre la posición por API y guarda el ticket devuelto (slave_ticket)
//   · close → busca el slave_ticket de la apertura de ese master_ticket y la cierra
//   · modify→ ajusta SL/TP de esa posición
// Lote: modo 'multiplier' (por defecto) = lote del máster × multiplicador, con tope
// max_lot. Otros modos caen al mismo cálculo (v1 por API); el path EA sigue teniendo
// el cálculo completo por riesgo.
async function drainSlaveCommands(conn: any): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: cmds } = await supabaseAdmin.from('copy_commands')
    .select('id,action,master_ticket,base_symbol,side,volume_hint,sl,tp,payload,execute_after')
    .eq('slave_account_id', conn.account_id).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(25);
  if (!cmds?.length) return 0;
  let done = 0;
  for (const c of cmds as any[]) {
    if (c.execute_after && c.execute_after > nowIso) continue;   // retraso anti-patrón aún no vencido
    try {
      const pay = c.payload || {};
      const map = pay.symbol_map || {};
      const symbol = map[c.base_symbol] || c.base_symbol;
      if (c.action === 'open') {
        const mult = Number(pay.multiplier) || 1;
        let vol = (Number(c.volume_hint) || 0) * mult;
        const maxLot = Number(pay?.limits?.max_lot || pay.max_lot || 0);
        if (maxLot > 0) vol = Math.min(vol, maxLot);
        vol = Math.max(0, Math.round(vol * 100) / 100);
        if (vol <= 0) { await supabaseAdmin.from('copy_commands').update({ status: 'skipped', error: 'vol<=0', done_at: nowIso }).eq('id', c.id); continue; }
        const ticket = await mtrOpenPosition(conn, { symbol, side: c.side === 'sell' ? 'sell' : 'buy', volume: vol, sl: c.sl || undefined, tp: c.tp || undefined });
        await supabaseAdmin.from('copy_commands').update({ status: 'done', slave_ticket: ticket, done_at: nowIso }).eq('id', c.id);
        done++;
      } else if (c.action === 'close') {
        // Ticket de la esclava = el que guardamos al abrir ese master_ticket.
        const { data: opn } = await supabaseAdmin.from('copy_commands')
          .select('slave_ticket').eq('slave_account_id', conn.account_id).eq('master_ticket', c.master_ticket)
          .eq('action', 'open').not('slave_ticket', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const st = (opn as any)?.slave_ticket;
        if (st) { await mtrClosePosition(conn, st); }
        await supabaseAdmin.from('copy_commands').update({ status: 'done', done_at: nowIso }).eq('id', c.id);
        done++;
      } else if (c.action === 'modify') {
        const { data: opn } = await supabaseAdmin.from('copy_commands')
          .select('slave_ticket').eq('slave_account_id', conn.account_id).eq('master_ticket', c.master_ticket)
          .eq('action', 'open').not('slave_ticket', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const st = (opn as any)?.slave_ticket;
        if (st) await mtrEditPosition(conn, st, c.sl || undefined, c.tp || undefined);
        await supabaseAdmin.from('copy_commands').update({ status: 'done', done_at: nowIso }).eq('id', c.id);
        done++;
      }
    } catch (e: any) {
      await supabaseAdmin.from('copy_commands').update({ status: 'failed', error: String(e?.message || 'exec').slice(0, 200), done_at: nowIso }).eq('id', c.id);
    }
  }
  return done;
}

// ----- Sync: MISMO Guardian + Copy que MetaTrader/cTrader -----
// El cron (app/api/cron/matchtrader) llama a esto por cada conexión activa.
export async function syncMatchtrader(conn: any) {
  if (!conn?.login) return { ok: false, reason: 'missing_login' };
  let positions: MtrPosition[], account: MtrAccount;
  try {
    positions = await mtrGetPositions(conn);
    account = await mtrGetAccount(conn, positions);
  } catch (e: any) {
    return { ok: false, reason: String(e?.message || 'fetch_failed') };
  }

  // --- Guardian (idéntico motor que MT/cTrader) ---
  const isMaster = conn.role !== 'slave';   // 'master' o 'both' emiten; 'slave' no
  if (conn.account_id) {
    const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', conn.account_id).maybeSingle();
    if (cfgRow?.enabled) {
      const verdict = await evaluate({
        userId: conn.user_id, accountId: conn.account_id, serverOffsetMin: 0,
        balance: account.balance, equity: account.equity, openCount: account.openCount,
        rawConfig: cfgRow.config, enabled: true,
      } as any);
      if (verdict && ((verdict as any).close_all || (verdict as any).allow_new === false)) {
        // Cierra lo que se abrió estando bloqueado (misma idea que el EA).
        for (const p of positions) { try { await mtrClosePosition(conn, p.ticket); } catch {} }
      }
    }
  }

  // --- Copy: diferencia con la foto anterior → abiertas / cerradas ---
  if (isMaster && conn.account_id) {
    const prev: Record<string, MtrPosition> = {};
    for (const p of (conn.master_snapshot?.positions || [])) prev[p.ticket] = p;
    const now: Record<string, MtrPosition> = {};
    for (const p of positions) now[p.ticket] = p;
    const opened = positions.filter((p) => !prev[p.ticket]);
    const closedTickets = Object.keys(prev).filter((t) => !now[t]);
    await relayMasterSnapshot({
      userId: conn.user_id, masterAccountId: conn.account_id, masterBalance: account.balance,
      opened: opened.map((p) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume, sl: p.sl, tp: p.tp, price: p.openPrice })),
      closedTickets,
    });
  }

  // --- Copy ESCLAVA: ejecuta por API los comandos pendientes de esta cuenta ---
  let executed = 0;
  if (conn.role !== 'master' && conn.account_id) {
    try { executed = await drainSlaveCommands(conn); } catch {}
  }

  // Guarda la foto nueva (para el diff del próximo ciclo) y la marca de sync.
  await supabaseAdmin.from('matchtrader_connections').update({
    master_snapshot: { at: Date.now(), positions },
    last_sync_at: new Date().toISOString(),
  }).eq('id', conn.id);

  return { ok: true, positions: positions.length, balance: account.balance, executed };
}
