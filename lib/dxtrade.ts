// ============================================================
// DXtrade (Devexperts) — SCA REST API. Conector para el modelo de Onyx: cada TRADER
// conecta SU cuenta de SU bróker (que use DXtrade) con su propio login.
//
// A diferencia de TradeLocker (un solo host multi-bróker), DXtrade se despliega POR
// BRÓKER: cada bróker/prop firm tiene su propio host. La API vive bajo /dxsca-web.
//   Base = {host}/dxsca-web     (ej. https://dxtrade.ftmo.com/dxsca-web)
//
// Flujo de auth (SCA REST):
//   1) POST {base}/login { username, domain, password }
//        → { sessionToken }        (cabecera: Authorization: DXAPI <sessionToken>)
//   2) GET  {base}/accounts        (Bearer DXAPI) → cuentas del usuario
//        cada cuenta se identifica como "clearing:code" (ej. "default:AB12345").
//   3) Cartera:  GET {base}/accounts/{account}/portfolio
//        → { balances:[...], positions:[{ symbol, quantity(signo), positionCode, ... }] }
//   4) Órdenes:  POST {base}/accounts/{account}/orders
//        { account, orderCode, type:"MARKET", instrument, quantity, positionEffect, side, timeInForce }
//   5) La sesión NO usa refresh token: se mantiene viva con GET {base}/ping.
//      Si caduca por inactividad, la conexión queda 'reauth' y el trader reconecta.
//
// Simplificación clave vs TradeLocker: las posiciones usan el SÍMBOLO directo
// (no hay tradableInstrumentId ni routeId que resolver). La cantidad viene con signo
// (positiva = long, negativa = short).
//
// SEGURIDAD: guardamos SOLO el sessionToken cifrado, NUNCA la contraseña.
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
function encKey(): string { return process.env.DXTRADE_ENC_KEY || process.env.MATCHTRADER_ENC_KEY || ''; }
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

// Normaliza el host que escribe el trader (o el catálogo) a una base con /dxsca-web.
export function DX_BASE(server: string): string {
  let h = String(server || '').trim();
  if (!h) return '';
  if (!/^https?:\/\//i.test(h)) h = 'https://' + h;
  h = h.replace(/\/+$/, '');
  if (!/\/dxsca-web$/i.test(h)) h += '/dxsca-web';
  return h;
}

export type DxAccount = { account: string; name: string; currency: string; balance: number; status: string };
export type DxLoginResult = { ok: boolean; error?: string; sessionToken?: string; accounts?: DxAccount[] };
export type DxPosition = { ticket: string; symbol: string; side: 'buy' | 'sell'; volume: number; openPrice?: number; sl?: number; tp?: number };

// ============================================================
// AUTH
// ============================================================

// LOGIN retail. Devuelve sessionToken + lista de cuentas del trader.
export async function dxLogin(server: string, domain: string, username: string, password: string): Promise<DxLoginResult> {
  const base = DX_BASE(server);
  if (!base) return { ok: false, error: 'server vacío' };
  let r: Response;
  try {
    r = await fetch(base + '/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, domain: domain || 'default', password }),
    });
  } catch (e: any) { return { ok: false, error: 'red: ' + (e?.message || 'fetch') }; }
  if (!r.ok) return { ok: false, error: r.status === 400 || r.status === 401 ? 'credenciales o server inválidos' : ('HTTP ' + r.status) };
  const j = await r.json().catch(() => null as any);
  const token = String(j?.sessionToken || j?.token || '');
  if (!token) return { ok: false, error: 'sin token' };
  const accounts = await dxAccounts(base, token, username, domain || 'default').catch(() => [] as DxAccount[]);
  return { ok: true, sessionToken: token, accounts };
}

function dxHeaders(token: string) { return { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'DXAPI ' + token }; }

// Lista las cuentas del usuario. Si el bróker no expone /accounts, cae a "default:{username}".
export async function dxAccounts(base: string, token: string, username: string, domain: string): Promise<DxAccount[]> {
  try {
    const r = await fetch(base + '/accounts', { headers: dxHeaders(token) as any });
    if (r.ok) {
      const j = await r.json().catch(() => ({} as any));
      const list = j?.accounts || j || [];
      const accs: DxAccount[] = (Array.isArray(list) ? list : []).map((a: any) => ({
        account: String(a.account || a.accountId || a.code || ''),
        name: String(a.name || a.account || ''),
        currency: String(a.currency || a.balanceCurrency || 'USD'),
        balance: num(a.balance ?? a.equity ?? 0),
        status: String(a.status || 'ACTIVE'),
      })).filter((a: DxAccount) => a.account);
      if (accs.length) return accs;
    }
  } catch {}
  // Fallback: convención "clearing:code". La mayoría de props usan domain como clearing.
  const acc = (domain || 'default') + ':' + username;
  return [{ account: acc, name: username, currency: 'USD', balance: 0, status: 'ACTIVE' }];
}

// Mantiene viva la sesión (DXtrade caduca por inactividad). true si sigue válida.
async function dxPing(base: string, token: string): Promise<boolean> {
  try { const r = await fetch(base + '/ping', { headers: dxHeaders(token) as any }); return r.ok; } catch { return false; }
}

// ============================================================
// LECTURAS
// ============================================================
const dxAccountOf = (conn: any) => String(conn.dx_account || '');

// Cartera: posiciones + balances de una cuenta.
async function dxPortfolio(base: string, token: string, account: string): Promise<any> {
  const r = await fetch(base + '/accounts/' + encodeURIComponent(account) + '/portfolio', { headers: dxHeaders(token) as any });
  if (!r.ok) throw new Error('portfolio_http_' + r.status);
  return r.json().catch(() => ({} as any));
}

export async function dxGetPositions(conn: any, token: string): Promise<DxPosition[]> {
  const base = DX_BASE(conn.server);
  const j = await dxPortfolio(base, token, dxAccountOf(conn));
  const rows: any[] = j?.positions || j?.d?.positions || [];
  return rows.map((p: any) => {
    const qty = num(p.quantity ?? p.qty ?? p.volume);
    return {
      ticket: String(p.positionCode || p.code || p.positionId || p.id || ''),
      symbol: String(p.symbol || p.instrument || ''),
      side: (qty < 0 || String(p.side || '').toUpperCase() === 'SELL') ? 'sell' : 'buy',
      volume: Math.abs(qty),
      openPrice: num(p.averagePrice ?? p.avgPrice ?? p.openPrice) || undefined,
      sl: num(p.stopLoss ?? p.sl) || undefined,
      tp: num(p.takeProfit ?? p.tp) || undefined,
    } as DxPosition;
  }).filter((p) => p.ticket && p.symbol);
}

export async function dxGetBalance(conn: any, token: string): Promise<{ balance: number; equity: number }> {
  try {
    const base = DX_BASE(conn.server);
    // /metrics da balance/equity; si no existe, sacamos de portfolio.balances.
    let balance = 0, equity = 0;
    try {
      const r = await fetch(base + '/accounts/' + encodeURIComponent(dxAccountOf(conn)) + '/metrics', { headers: dxHeaders(token) as any });
      if (r.ok) { const m = await r.json().catch(() => ({} as any)); const d = m?.metrics || m; balance = num(d?.balance); equity = num(d?.equity ?? d?.nav ?? d?.projectedBalance); }
    } catch {}
    if (!balance || !equity) {
      const j = await dxPortfolio(base, token, dxAccountOf(conn));
      const bals: any[] = j?.balances || [];
      const b = bals[0] || {};
      balance = balance || num(b.balance ?? b.value ?? b.cash);
      equity = equity || num(b.equity ?? b.nav ?? j?.equity) || balance;
    }
    return { balance, equity: equity || balance };
  } catch { return { balance: 0, equity: 0 }; }
}

// ============================================================
// EJECUCIÓN
// ============================================================
function orderCode(): string { return 'onyx-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Abre a mercado. Devuelve orderCode/orderId.
export async function dxOpen(conn: any, token: string, o: { symbol: string; side: 'buy' | 'sell'; volume: number; sl?: number; tp?: number }): Promise<string> {
  const base = DX_BASE(conn.server); const account = dxAccountOf(conn);
  const code = orderCode();
  const body: any = {
    account, orderCode: code, type: 'MARKET', instrument: o.symbol,
    quantity: o.volume, positionEffect: 'OPENING', side: o.side === 'sell' ? 'SELL' : 'BUY',
    timeInForce: { type: 'GTC' },
  };
  // SL/TP como órdenes adjuntas (bracket) cuando el bróker lo soporta.
  if (o.sl) body.stopLoss = { price: o.sl };
  if (o.tp) body.takeProfit = { price: o.tp };
  const r = await fetch(base + '/accounts/' + encodeURIComponent(account) + '/orders', { method: 'POST', headers: dxHeaders(token) as any, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error('open_' + (j?.errorMessage || j?.error || r.status));
  return String(j?.orderId || j?.orderCode || code);
}

// Cierra una posición (total o parcial) con una orden opuesta CLOSING.
export async function dxClose(conn: any, token: string, pos: { ticket: string; symbol?: string; side?: 'buy' | 'sell'; volume?: number }): Promise<boolean> {
  const base = DX_BASE(conn.server); const account = dxAccountOf(conn);
  // Si no nos pasan símbolo/lado, los sacamos de la cartera por el positionCode.
  let symbol = pos.symbol, side = pos.side, volume = Number(pos.volume) || 0;
  if (!symbol || !side || !volume) {
    try {
      const list = await dxGetPositions(conn, token);
      const p = list.find((x) => x.ticket === pos.ticket);
      if (p) { symbol = symbol || p.symbol; side = side || p.side; if (!volume) volume = p.volume; }
    } catch {}
  }
  if (!symbol || !volume) return false;
  const body: any = {
    account, orderCode: orderCode(), type: 'MARKET', instrument: symbol,
    quantity: volume, positionEffect: 'CLOSING', side: side === 'buy' ? 'SELL' : 'BUY',
    timeInForce: { type: 'GTC' }, positionCode: pos.ticket,
  };
  const r = await fetch(base + '/accounts/' + encodeURIComponent(account) + '/orders', { method: 'POST', headers: dxHeaders(token) as any, body: JSON.stringify(body) });
  if (r.status === 200 || r.status === 201 || r.status === 204) return true;
  const j = await r.json().catch(() => ({} as any));
  return r.ok && !j?.error;
}

// Modifica SL/TP de una posición (best-effort: PATCH de la posición si el bróker lo expone).
export async function dxEdit(conn: any, token: string, pos: { ticket: string; sl?: number; tp?: number }): Promise<boolean> {
  const base = DX_BASE(conn.server); const account = dxAccountOf(conn);
  const body: any = { account, positionCode: pos.ticket };
  if (pos.sl != null) body.stopLoss = { price: pos.sl };
  if (pos.tp != null) body.takeProfit = { price: pos.tp };
  try {
    const r = await fetch(base + '/accounts/' + encodeURIComponent(account) + '/positions/' + encodeURIComponent(pos.ticket) + '/protection', { method: 'POST', headers: dxHeaders(token) as any, body: JSON.stringify(body) });
    if (r.status === 200 || r.status === 201 || r.status === 204) return true;
    const j = await r.json().catch(() => ({} as any));
    return r.ok && !j?.error;
  } catch { return false; }
}

// ============================================================
// GUARDADO + SESIÓN
// ============================================================
export function storeFields(res: DxLoginResult, acc: DxAccount, demo: boolean, server: string, domain: string) {
  return {
    demo,
    server: DX_BASE(server).replace(/\/dxsca-web$/i, ''),  // guardamos el host limpio
    domain: domain || 'default',
    dx_account: acc.account,
    access_token: enc(res.sessionToken || ''),
    refresh_token: '',                 // DXtrade no usa refresh; se mantiene con ping
    token_at: new Date().toISOString(),
    expire_at: null,
    status: 'ok',
  };
}

// La sesión se mantiene con ping. Devuelve el token si sigue válida, o null (→ reauth).
async function ensureToken(conn: any): Promise<string | null> {
  const token = dec(conn.access_token);
  if (!token) return null;
  const base = DX_BASE(conn.server);
  const alive = await dxPing(base, token);
  return alive ? token : null;
}

// ============================================================
// COPY esclava por API (misma cola copy_commands que los EAs)
// ============================================================
async function drainSlave(conn: any, token: string): Promise<number> {
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
        const ticket = await dxOpen(conn, token, { symbol, side: c.side === 'sell' ? 'sell' : 'buy', volume: vol, sl: c.sl || undefined, tp: c.tp || undefined });
        await supabaseAdmin.from('copy_commands').update({ status: 'done', slave_ticket: ticket, done_at: nowIso }).eq('id', c.id); done++;
      } else if (c.action === 'close' || c.action === 'modify') {
        const { data: opn } = await supabaseAdmin.from('copy_commands').select('slave_ticket')
          .eq('slave_account_id', conn.account_id).eq('master_ticket', c.master_ticket).eq('action', 'open')
          .not('slave_ticket', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const st = (opn as any)?.slave_ticket;
        if (st) {
          if (c.action === 'close') await dxClose(conn, token, { ticket: st, volume: Number(c.volume_hint) || 0 });
          else await dxEdit(conn, token, { ticket: st, sl: c.sl || undefined, tp: c.tp || undefined });
        }
        await supabaseAdmin.from('copy_commands').update({ status: 'done', done_at: nowIso }).eq('id', c.id); done++;
      } else if (c.action === 'close_all') {
        const all = await dxGetPositions(conn, token);
        for (const p of all) { try { await dxClose(conn, token, { ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume }); } catch {} }
        await supabaseAdmin.from('copy_commands').update({ status: 'done', done_at: nowIso }).eq('id', c.id); done++;
      }
    } catch (e: any) {
      await supabaseAdmin.from('copy_commands').update({ status: 'failed', error: String(e?.message || 'exec').slice(0, 200), done_at: nowIso }).eq('id', c.id);
    }
  }
  return done;
}

// ============================================================
// SYNC de una conexión: Guardian + Copy (mismo motor que MT/cTrader/MatchTrader/TradeLocker)
// ============================================================
export async function syncDxtrade(conn: any) {
  const token = await ensureToken(conn);
  if (!token) { await supabaseAdmin.from('dxtrade_connections').update({ status: 'reauth' }).eq('id', conn.id); return { ok: false, reason: 'reauth' }; }

  let positions: DxPosition[]; let bal: { balance: number; equity: number };
  try { positions = await dxGetPositions(conn, token); bal = await dxGetBalance(conn, token); }
  catch (e: any) {
    if (String(e?.message || '').includes('401')) { await supabaseAdmin.from('dxtrade_connections').update({ status: 'reauth' }).eq('id', conn.id); return { ok: false, reason: 'reauth' }; }
    return { ok: false, reason: String(e?.message || 'fetch') };
  }

  // Guardian: mismo motor de riesgo (cierra todo si el veredicto lo exige).
  if (conn.account_id) {
    const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', conn.account_id).maybeSingle();
    if (cfgRow?.enabled) {
      const verdict = await evaluate({ userId: conn.user_id, accountId: conn.account_id, serverOffsetMin: 0, balance: bal.balance, equity: bal.equity, openCount: positions.length, rawConfig: cfgRow.config, enabled: true } as any);
      if (verdict && ((verdict as any).close_all || (verdict as any).allow_new === false)) {
        for (const p of positions) { try { await dxClose(conn, token, { ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume }); } catch {} }
      }
    }
  }

  // Copy máster: diff contra la foto anterior → publica aperturas/cierres.
  if (conn.copy_enabled && conn.role !== 'slave' && conn.account_id) {
    const prev: Record<string, DxPosition> = {}; for (const p of (conn.master_snapshot?.positions || [])) prev[p.ticket] = p;
    const now: Record<string, DxPosition> = {}; for (const p of positions) now[p.ticket] = p;
    const opened = positions.filter((p) => !prev[p.ticket]);
    const closedTickets = Object.keys(prev).filter((t) => !now[t]);
    await relayMasterSnapshot({ userId: conn.user_id, masterAccountId: conn.account_id, masterBalance: bal.balance,
      opened: opened.map((p) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume, sl: p.sl, tp: p.tp, price: p.openPrice })),
      closedTickets });
  }

  // Copy esclava: ejecuta la cola por API.
  let executed = 0;
  if (conn.copy_enabled && conn.role !== 'master' && conn.account_id) { try { executed = await drainSlave(conn, token); } catch {} }

  await supabaseAdmin.from('dxtrade_connections').update({ master_snapshot: { at: Date.now(), positions }, last_sync_at: new Date().toISOString() }).eq('id', conn.id);
  return { ok: true, positions: positions.length, balance: bal.balance, executed };
}
