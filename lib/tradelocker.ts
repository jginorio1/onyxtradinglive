// ============================================================
// TradeLocker — Trading API (retail). Conector para el modelo de Onyx: cada TRADER
// conecta SU cuenta de SU bróker (que use TradeLocker) con su propio login.
//
// TradeLocker es UNA sola plataforma multi-bróker: un único endpoint para todos.
//   Base demo: https://demo.tradelocker.com/backend-api
//   Base real: https://live.tradelocker.com/backend-api
//
// Flujo de auth (documentado, api v2.11):
//   1) POST {base}/auth/jwt/token { email, password, server }
//        → { accessToken, refreshToken, expireDate }
//   2) GET  {base}/auth/jwt/all-accounts        (Bearer accessToken)
//        → accounts[]: { id (accountId), accNum, currency, accountBalance, ... }
//   3) Trading a {base}/trade/accounts/{accountId}/...  con cabeceras:
//        Authorization: Bearer <accessToken>   y   accNum: <accNum>
//   4) accessToken caduca (~1 h) → refresh con POST {base}/auth/jwt/refresh { refreshToken }
//
// Posiciones y estado llegan como ARRAYS: el orden de columnas se define en
// GET {base}/trade/config → positionsConfig / accountDetailsConfig. Aquí mapeamos
// por NOMBRE de columna (robusto ante cambios de orden).
//
// SEGURIDAD: guardamos SOLO los tokens cifrados (access + refresh), NUNCA la
// contraseña. Si el refresh falla, la conexión queda 'reauth' y el trader reconecta.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluate } from '@/lib/managerGuard';
import { relayMasterSnapshot } from '@/lib/copyRelay';

// Todo fetch de este módulo lleva timeout (12s): si la API del bróker no responde,
// la llamada se aborta en vez de colgarse (evita agotar la función serverless).
const _rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);
function fetch(input: any, init: any = {}): Promise<Response> {
  const signal = init.signal ?? ((AbortSignal as any).timeout ? (AbortSignal as any).timeout(12000) : undefined);
  return _rawFetch(input, { ...init, signal });
}

// ---- cifrado en reposo (AES-256-GCM). Comparte clave con MatchTrader si existe. ----
function encKey(): string { return process.env.TRADELOCKER_ENC_KEY || process.env.MATCHTRADER_ENC_KEY || ''; }
function enc(plain: string): string {
  try {
    const crypto = require('crypto'); const keyHex = encKey();
    if (!keyHex) return plain;
    const key = Buffer.from(keyHex, 'hex'); const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const d = Buffer.concat([c.update(Buffer.from(plain, 'utf8')), c.final()]);
    return ['enc', iv.toString('base64'), c.getAuthTag().toString('base64'), d.toString('base64')].join(':');
  } catch { return plain; }
}
function dec(raw: string): string {
  const s = String(raw || ''); if (!s.startsWith('enc:')) return s;
  try {
    const crypto = require('crypto'); const keyHex = encKey();
    if (!keyHex) return s;
    const key = Buffer.from(keyHex, 'hex'); const [, iv, tag, data] = s.split(':');
    const dc = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    dc.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([dc.update(Buffer.from(data, 'base64')), dc.final()]).toString('utf8');
  } catch { return s; }
}
export const encToken = enc;

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sideDn = (v: any): 'buy' | 'sell' => (String(v || '').toLowerCase() === 'sell' ? 'sell' : 'buy');

export const TL_BASE = (demo: boolean) => (demo ? 'https://demo.tradelocker.com/backend-api' : 'https://live.tradelocker.com/backend-api');

export type TlAccount = { id: string; accNum: string; name: string; currency: string; balance: number; status: string };
export type TlLoginResult = { ok: boolean; error?: string; accessToken?: string; refreshToken?: string; expireDate?: string; accounts?: TlAccount[] };
export type TlPosition = { ticket: string; instrumentId: string; symbol: string; side: 'buy' | 'sell'; volume: number; openPrice?: number; sl?: number; tp?: number; routeId?: string };

// ============================================================
// AUTH
// ============================================================

// LOGIN retail. Devuelve access/refresh + lista de cuentas del trader.
export async function tlLogin(demo: boolean, server: string, email: string, password: string): Promise<TlLoginResult> {
  const base = TL_BASE(demo);
  let r: Response;
  try {
    r = await fetch(base + '/auth/jwt/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password, server }),
    });
  } catch (e: any) { return { ok: false, error: 'red: ' + (e?.message || 'fetch') }; }
  if (!r.ok) return { ok: false, error: r.status === 400 || r.status === 401 ? 'credenciales o server inválidos' : ('HTTP ' + r.status) };
  const j = await r.json().catch(() => null as any);
  if (!j?.accessToken) return { ok: false, error: 'sin token' };
  const accounts = await tlAccounts(base, j.accessToken).catch(() => [] as TlAccount[]);
  return { ok: true, accessToken: String(j.accessToken), refreshToken: String(j.refreshToken || ''), expireDate: String(j.expireDate || ''), accounts };
}

// Lista las cuentas del token: id (accountId) + accNum (cabecera para /trade).
export async function tlAccounts(base: string, accessToken: string): Promise<TlAccount[]> {
  const r = await fetch(base + '/auth/jwt/all-accounts', { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } });
  if (!r.ok) throw new Error('accounts_http_' + r.status);
  const j = await r.json().catch(() => ({} as any));
  return (j?.accounts || []).map((a: any) => ({
    id: String(a.id || ''), accNum: String(a.accNum ?? ''), name: String(a.name || a.id || ''),
    currency: String(a.currency || 'USD'), balance: num(a.accountBalance ?? a.aaccountBalance),
    status: String(a.status || ''),
  })).filter((a: TlAccount) => a.id && a.accNum !== '');
}

// Refresca el accessToken. Devuelve { accessToken, refreshToken, expireDate } o null.
async function tlRefresh(demo: boolean, refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expireDate: string } | null> {
  try {
    const r = await fetch(TL_BASE(demo) + '/auth/jwt/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null as any);
    if (!j?.accessToken) return null;
    return { accessToken: String(j.accessToken), refreshToken: String(j.refreshToken || refreshToken), expireDate: String(j.expireDate || '') };
  } catch { return null; }
}

// ============================================================
// CONFIG (mapa de columnas de posiciones y estado — por nombre, robusto)
// ============================================================
type ColMap = { pos: Record<string, number>; acc: Record<string, number> };
const cfgCache = new Map<string, { at: number; map: ColMap }>();

function idxByNames(cols: any[], names: string[]): number {
  for (const n of names) {
    const i = cols.findIndex((c: any) => String(c?.id || c?.name || '').toLowerCase() === n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

async function tlConfig(base: string, accessToken: string, accNum: string): Promise<ColMap> {
  const key = base + '|' + accNum;
  const hit = cfgCache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return hit.map;
  const r = await fetch(base + '/trade/config', { headers: { Authorization: 'Bearer ' + accessToken, accNum, Accept: 'application/json' } });
  const j = await r.json().catch(() => ({} as any));
  const pcols = j?.d?.positionsConfig?.columns || j?.d?.positionsConfig || [];
  const acols = j?.d?.accountDetailsConfig?.columns || j?.d?.accountDetailsConfig || [];
  const map: ColMap = {
    pos: {
      id: idxByNames(pcols, ['id', 'positionId']),
      instrument: idxByNames(pcols, ['tradableInstrumentId', 'instrumentId']),
      route: idxByNames(pcols, ['routeId']),
      side: idxByNames(pcols, ['side']),
      qty: idxByNames(pcols, ['qty', 'volume']),
      open: idxByNames(pcols, ['avgPrice', 'openPrice', 'price']),
      sl: idxByNames(pcols, ['stopLoss', 'sl', 'stopLossPrice']),
      tp: idxByNames(pcols, ['takeProfit', 'tp', 'takeProfitPrice']),
    },
    acc: {
      balance: idxByNames(acols, ['balance']),
      equity: idxByNames(acols, ['projectedBalance', 'equity']),
    },
  };
  cfgCache.set(key, { at: Date.now(), map });
  return map;
}

// Instrumentos: symbol → { tradableInstrumentId, routeId (TRADE) }. Cache por cuenta.
const instCache = new Map<string, { at: number; byName: Record<string, { id: string; route: string }>; byId: Record<string, { name: string; route: string }> }>();
async function tlInstruments(base: string, accessToken: string, accountId: string, accNum: string) {
  const key = base + '|' + accountId;
  const hit = instCache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return hit;
  const r = await fetch(base + '/trade/accounts/' + accountId + '/instruments', { headers: { Authorization: 'Bearer ' + accessToken, accNum, Accept: 'application/json' } });
  const j = await r.json().catch(() => ({} as any));
  const list = j?.d?.instruments || [];
  const byName: Record<string, { id: string; route: string }> = {};
  const byId: Record<string, { name: string; route: string }> = {};
  for (const it of list) {
    const id = String(it.tradableInstrumentId || it.id || '');
    const name = String(it.name || it.symbol || '');
    const routes = it.routes || [];
    const trade = routes.find((x: any) => String(x.type).toUpperCase() === 'TRADE') || routes[0] || {};
    const route = String(trade.id || '');
    if (id && name) { byName[name.toUpperCase()] = { id, route }; byId[id] = { name, route }; }
  }
  const rec = { at: Date.now(), byName, byId };
  instCache.set(key, rec);
  return rec;
}

// ============================================================
// LECTURAS
// ============================================================
function authHeaders(conn: any, accessToken: string) {
  return { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + accessToken, accNum: String(conn.acc_num) };
}
const tlAccountId = (conn: any) => String(conn.tl_account_id || conn.account_uuid || '');

export async function tlGetPositions(conn: any, accessToken: string): Promise<TlPosition[]> {
  const base = TL_BASE(!!conn.demo); const accId = tlAccountId(conn);
  const map = await tlConfig(base, accessToken, String(conn.acc_num));
  const inst = await tlInstruments(base, accessToken, accId, String(conn.acc_num)).catch(() => null as any);
  const r = await fetch(base + '/trade/accounts/' + accId + '/positions', { headers: authHeaders(conn, accessToken) as any });
  if (!r.ok) throw new Error('pos_http_' + r.status);
  const j = await r.json().catch(() => ({} as any));
  const rows: any[][] = j?.d?.positions || [];
  const P = map.pos;
  return rows.map((row) => {
    const instrumentId = String(P.instrument >= 0 ? row[P.instrument] : '');
    const nm = inst?.byId?.[instrumentId];
    return {
      ticket: String(P.id >= 0 ? row[P.id] : ''),
      instrumentId,
      symbol: nm?.name || instrumentId,
      side: sideDn(P.side >= 0 ? row[P.side] : 'buy'),
      volume: num(P.qty >= 0 ? row[P.qty] : 0),
      openPrice: num(P.open >= 0 ? row[P.open] : 0) || undefined,
      sl: num(P.sl >= 0 ? row[P.sl] : 0) || undefined,
      tp: num(P.tp >= 0 ? row[P.tp] : 0) || undefined,
      routeId: (P.route >= 0 ? String(row[P.route]) : nm?.route) || nm?.route,
    };
  }).filter((p) => p.ticket);
}

export async function tlGetBalance(conn: any, accessToken: string): Promise<{ balance: number; equity: number }> {
  try {
    const base = TL_BASE(!!conn.demo); const accId = tlAccountId(conn);
    const map = await tlConfig(base, accessToken, String(conn.acc_num));
    const r = await fetch(base + '/trade/accounts/' + accId + '/state', { headers: authHeaders(conn, accessToken) as any });
    if (!r.ok) throw new Error('state_http_' + r.status);
    const j = await r.json().catch(() => ({} as any));
    const arr: any[] = j?.d?.accountDetailsData || [];
    const balance = num(map.acc.balance >= 0 ? arr[map.acc.balance] : 0);
    const equity = num(map.acc.equity >= 0 ? arr[map.acc.equity] : 0) || balance;
    return { balance, equity };
  } catch { return { balance: 0, equity: 0 }; }
}

// ============================================================
// EJECUCIÓN
// ============================================================
// Resuelve instrumento (id + routeId) desde un símbolo base.
async function resolveInstrument(conn: any, accessToken: string, symbol: string): Promise<{ id: string; route: string } | null> {
  const base = TL_BASE(!!conn.demo); const accId = tlAccountId(conn);
  const inst = await tlInstruments(base, accessToken, accId, String(conn.acc_num)).catch(() => null as any);
  if (!inst) return null;
  const up = String(symbol || '').toUpperCase();
  return inst.byName[up] || inst.byName[up.replace(/[^A-Z0-9]/g, '')] || null;
}

// Abre a mercado. Devuelve orderId.
export async function tlOpen(conn: any, accessToken: string, o: { symbol: string; side: 'buy' | 'sell'; volume: number; sl?: number; tp?: number }): Promise<string> {
  const base = TL_BASE(!!conn.demo); const accId = tlAccountId(conn);
  const ins = await resolveInstrument(conn, accessToken, o.symbol);
  if (!ins) throw new Error('open_instr_no_encontrado:' + o.symbol);
  const body: any = { qty: o.volume, side: o.side, type: 'market', validity: 'IOC', tradableInstrumentId: Number(ins.id), routeId: Number(ins.route), price: 0 };
  if (o.sl) { body.stopLoss = o.sl; body.stopLossType = 'absolute'; }
  if (o.tp) { body.takeProfit = o.tp; body.takeProfitType = 'absolute'; }
  const r = await fetch(base + '/trade/accounts/' + accId + '/orders', { method: 'POST', headers: authHeaders(conn, accessToken) as any, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok || String(j?.s) !== 'ok') throw new Error('open_' + (j?.errmsg || j?.s || r.status));
  return String(j?.d?.orderId || '');
}

// Cierra una posición (qty 0 = total; o parcial). positionId = ticket.
export async function tlClose(conn: any, accessToken: string, pos: { ticket: string; volume?: number }): Promise<boolean> {
  const base = TL_BASE(!!conn.demo);
  const r = await fetch(base + '/trade/positions/' + pos.ticket, {
    method: 'DELETE', headers: authHeaders(conn, accessToken) as any,
    body: JSON.stringify({ qty: Number(pos.volume) > 0 ? Number(pos.volume) : 0 }),
  });
  if (r.status === 204) return true;
  const j = await r.json().catch(() => ({} as any));
  return r.ok && String(j?.s || 'ok') === 'ok';
}

// Modifica SL/TP de una posición.
export async function tlEdit(conn: any, accessToken: string, pos: { ticket: string; sl?: number; tp?: number }): Promise<boolean> {
  const base = TL_BASE(!!conn.demo);
  const body: any = {};
  if (pos.sl != null) { body.stopLoss = pos.sl; body.stopLossType = 'absolute'; }
  if (pos.tp != null) { body.takeProfit = pos.tp; body.takeProfitType = 'absolute'; }
  const r = await fetch(base + '/trade/positions/' + pos.ticket, { method: 'PATCH', headers: authHeaders(conn, accessToken) as any, body: JSON.stringify(body) });
  if (r.status === 204) return true;
  const j = await r.json().catch(() => ({} as any));
  return r.ok && String(j?.s || 'ok') === 'ok';
}

// ============================================================
// GUARDADO + SESIÓN
// ============================================================
// Campos a guardar tras conectar: tokens cifrados + datos de la cuenta elegida.
export function storeFields(res: TlLoginResult, acc: TlAccount, demo: boolean, server: string) {
  return {
    demo,
    server,
    tl_account_id: acc.id,       // accountId (path de /trade)
    acc_num: acc.accNum,         // accNum (cabecera)
    access_token: enc(res.accessToken || ''),
    refresh_token: enc(res.refreshToken || ''),
    token_at: new Date().toISOString(),
    expire_at: res.expireDate || null,
    status: 'ok',
  };
}

// Mantiene el accessToken vivo: refresca ~2 min antes de expirar (o si pasó 1 turno).
async function ensureToken(conn: any): Promise<string | null> {
  const access = dec(conn.access_token);
  const exp = conn.expire_at ? new Date(conn.expire_at).getTime() : 0;
  const soon = exp && (exp - Date.now() < 120_000);            // caduca en <2 min
  const age = (Date.now() - new Date(conn.token_at || 0).getTime()) / 60000;
  if (access && !soon && age < 30) return access;
  const rt = dec(conn.refresh_token);
  if (!rt) return access || null;
  const fresh = await tlRefresh(!!conn.demo, rt);
  if (!fresh) return null;
  await supabaseAdmin.from('tradelocker_connections').update({
    access_token: enc(fresh.accessToken), refresh_token: enc(fresh.refreshToken), token_at: new Date().toISOString(), expire_at: fresh.expireDate || null, status: 'ok',
  }).eq('id', conn.id);
  return fresh.accessToken;
}

// ============================================================
// COPY esclava por API (misma cola copy_commands que los EAs)
// ============================================================
async function drainSlave(conn: any, accessToken: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: cmds } = await supabaseAdmin.from('copy_commands')
    .select('id,action,master_ticket,base_symbol,side,volume_hint,sl,tp,payload,execute_after')
    .eq('slave_account_id', conn.account_id).eq('status', 'pending').order('created_at', { ascending: true }).limit(25);
  if (!cmds?.length) return 0;
  let done = 0;
  for (const c of cmds as any[]) {
    if (c.execute_after && c.execute_after > nowIso) continue;
    try {
      const pay = c.payload || {}; const map = pay.symbol_map || {};
      const symbol = map[c.base_symbol] || c.base_symbol;
      if (c.action === 'open') {
        let vol = (Number(c.volume_hint) || 0) * (Number(pay.multiplier) || 1);
        const maxLot = Number(pay?.limits?.max_lot || pay.max_lot || 0);
        if (maxLot > 0) vol = Math.min(vol, maxLot);
        vol = Math.max(0, Math.round(vol * 100) / 100);
        if (vol <= 0) { await supabaseAdmin.from('copy_commands').update({ status: 'skipped', error: 'vol<=0', done_at: nowIso }).eq('id', c.id); continue; }
        const ticket = await tlOpen(conn, accessToken, { symbol, side: c.side === 'sell' ? 'sell' : 'buy', volume: vol, sl: c.sl || undefined, tp: c.tp || undefined });
        await supabaseAdmin.from('copy_commands').update({ status: 'done', slave_ticket: ticket, done_at: nowIso }).eq('id', c.id); done++;
      } else if (c.action === 'close' || c.action === 'modify') {
        const { data: opn } = await supabaseAdmin.from('copy_commands').select('slave_ticket')
          .eq('slave_account_id', conn.account_id).eq('master_ticket', c.master_ticket).eq('action', 'open')
          .not('slave_ticket', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const st = (opn as any)?.slave_ticket;
        if (st) {
          if (c.action === 'close') await tlClose(conn, accessToken, { ticket: st, volume: Number(c.volume_hint) || 0 });
          else await tlEdit(conn, accessToken, { ticket: st, sl: c.sl || undefined, tp: c.tp || undefined });
        }
        await supabaseAdmin.from('copy_commands').update({ status: 'done', done_at: nowIso }).eq('id', c.id); done++;
      }
    } catch (e: any) {
      await supabaseAdmin.from('copy_commands').update({ status: 'failed', error: String(e?.message || 'exec').slice(0, 200), done_at: nowIso }).eq('id', c.id);
    }
  }
  return done;
}

// ============================================================
// SYNC de una conexión: Guardian + Copy (mismo motor que MT/cTrader/MatchTrader)
// ============================================================
export async function syncTradeLocker(conn: any) {
  const access = await ensureToken(conn);
  if (!access) { await supabaseAdmin.from('tradelocker_connections').update({ status: 'reauth' }).eq('id', conn.id); return { ok: false, reason: 'reauth' }; }

  let positions: TlPosition[]; let bal: { balance: number; equity: number };
  try { positions = await tlGetPositions(conn, access); bal = await tlGetBalance(conn, access); }
  catch (e: any) {
    // 401 → refresh inmediato y un reintento.
    if (String(e?.message || '').includes('401')) {
      const fresh = await tlRefresh(!!conn.demo, dec(conn.refresh_token));
      if (fresh) {
        await supabaseAdmin.from('tradelocker_connections').update({ access_token: enc(fresh.accessToken), refresh_token: enc(fresh.refreshToken), token_at: new Date().toISOString(), expire_at: fresh.expireDate || null }).eq('id', conn.id);
        try { positions = await tlGetPositions(conn, fresh.accessToken); bal = await tlGetBalance(conn, fresh.accessToken); } catch { return { ok: false, reason: 'fetch' }; }
      } else { await supabaseAdmin.from('tradelocker_connections').update({ status: 'reauth' }).eq('id', conn.id); return { ok: false, reason: 'reauth' }; }
    } else return { ok: false, reason: String(e?.message || 'fetch') };
  }

  // Guardian: mismo motor de riesgo (cierra todo si el veredicto lo exige).
  if (conn.account_id) {
    const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', conn.account_id).maybeSingle();
    if (cfgRow?.enabled) {
      const verdict = await evaluate({ userId: conn.user_id, accountId: conn.account_id, serverOffsetMin: 0, balance: bal.balance, equity: bal.equity, openCount: positions.length, rawConfig: cfgRow.config, enabled: true } as any);
      if (verdict && ((verdict as any).close_all || (verdict as any).allow_new === false)) {
        for (const p of positions) { try { await tlClose(conn, access, { ticket: p.ticket, volume: p.volume }); } catch {} }
      }
    }
  }

  // Copy máster: diff contra la foto anterior → publica aperturas/cierres.
  if (conn.copy_enabled && conn.role !== 'slave' && conn.account_id) {
    const prev: Record<string, TlPosition> = {}; for (const p of (conn.master_snapshot?.positions || [])) prev[p.ticket] = p;
    const now: Record<string, TlPosition> = {}; for (const p of positions) now[p.ticket] = p;
    const opened = positions.filter((p) => !prev[p.ticket]);
    const closedTickets = Object.keys(prev).filter((t) => !now[t]);
    await relayMasterSnapshot({ userId: conn.user_id, masterAccountId: conn.account_id, masterBalance: bal.balance,
      opened: opened.map((p) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume, sl: p.sl, tp: p.tp, price: p.openPrice })),
      closedTickets });
  }

  // Copy esclava: ejecuta la cola por API.
  let executed = 0;
  if (conn.copy_enabled && conn.role !== 'master' && conn.account_id) { try { executed = await drainSlave(conn, access); } catch {} }

  await supabaseAdmin.from('tradelocker_connections').update({ master_snapshot: { at: Date.now(), positions }, last_sync_at: new Date().toISOString() }).eq('id', conn.id);
  return { ok: true, positions: positions.length, balance: bal.balance, executed };
}
