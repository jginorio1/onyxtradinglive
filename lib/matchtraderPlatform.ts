// ============================================================
// MatchTrader — PLATFORM API (retail). Este es el conector para el modelo de Onyx:
// cada TRADER conecta SU cuenta de SU bróker (FundedNext, etc.) con su propio login.
//
// Flujo de auth (documentado):
//   1) POST {base}/manager/mtr-login { email, password, brokerId }
//        → token (cookie co-auth), y por cada cuenta: tradingApiToken + system.uuid + tradingApiDomain
//   2) Llamadas de trading a {tradingDomain}/mtr-api/{systemUuid}/... con cabeceras:
//        Auth-trading-api: <tradingApiToken>   y   Cookie: co-auth=<token>
//   3) El token dura 15 min → refresh con POST {base}/manager/refresh-token (máx 4/h → cada 15 min = 24/7)
//   brokerId (=partnerId) se obtiene solo de GET {base}/manager/platform-details.
//
// SEGURIDAD: guardamos SOLO los tokens cifrados (co-auth + tradingApiToken), NUNCA la
// contraseña. Si el token muere y no se puede refrescar, la conexión queda 'reauth' y
// el trader reconecta (vuelve a poner su contraseña una vez).
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluate } from '@/lib/managerGuard';
import { relayMasterSnapshot } from '@/lib/copyRelay';

// ---- cifrado en reposo (AES-256-GCM) si hay MATCHTRADER_ENC_KEY ----
function enc(plain: string): string {
  try {
    const crypto = require('crypto'); const keyHex = process.env.MATCHTRADER_ENC_KEY || '';
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
    const crypto = require('crypto'); const keyHex = process.env.MATCHTRADER_ENC_KEY || '';
    if (!keyHex) return s;
    const key = Buffer.from(keyHex, 'hex'); const [, iv, tag, data] = s.split(':');
    const dc = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    dc.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([dc.update(Buffer.from(data, 'base64')), dc.final()]).toString('utf8');
  } catch { return s; }
}
export const encToken = enc;

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sideDn = (v: any): 'buy' | 'sell' => (String(v || '').toUpperCase() === 'SELL' ? 'sell' : 'buy');
const sideUp = (v: string) => (v === 'sell' ? 'SELL' : 'BUY');

export type MtpAccount = { id: string; name: string; systemUuid: string; tradingDomain: string; tradingApiToken: string; currency: string; demo: boolean };
export type MtpLoginResult = { ok: boolean; error?: string; coToken?: string; accounts?: MtpAccount[] };
export type MtpPosition = { ticket: string; symbol: string; side: 'buy' | 'sell'; volume: number; openPrice?: number; sl?: number; tp?: number };

// ============================================================
// AUTODETECCIÓN INTELIGENTE de la URL de la Platform API de un bróker.
// Dado un dominio o nombre, prueba EN PARALELO decenas de hosts típicos contra el
// endpoint REAL /manager/platform-details (público). Si ninguno responde y hay clave
// de IA, le pide a Claude más candidatos... pero SIEMPRE se verifican contra la API:
// nada que la IA proponga se acepta sin que el bróker responda de verdad.
// ============================================================
export type Discover = { found: boolean; base_url?: string; brokerName?: string; partnerId?: string; tried: number; candidates: string[] };

// Comprueba UN host: ¿responde /manager/platform-details con partnerId? (timeout corto)
async function probeHost(host: string): Promise<{ ok: boolean; base?: string; brokerName?: string; partnerId?: string }> {
  const url = 'https://' + host + '/manager/platform-details';
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { ok: false };
    const j = await r.json().catch(() => null as any);
    if (j && j.partnerId != null) return { ok: true, base: (j.platformUrl || ('https://' + host)).replace(/\/$/, ''), brokerName: j.brokerName || '', partnerId: String(j.partnerId) };
    return { ok: false };
  } catch { clearTimeout(t); return { ok: false }; }
}

// Extrae el dominio registrable de una entrada (URL, host o dominio suelto).
function domainOf(input: string): string | null {
  let s = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!s || !s.includes('.')) return null;
  return s;
}

// Genera hosts candidatos a partir de un dominio (subdominios típicos de MatchTrader).
function candidateHosts(domain: string): string[] {
  const parts = domain.split('.');
  const apex = parts.length > 2 ? parts.slice(-2).join('.') : domain;   // fundednext.com
  const brand = apex.split('.')[0];                                     // fundednext
  const prefixes = ['mtr', 'mtr-api', 'mtr-prod', 'platform', 'trade', 'trading', 'webtrader', 'wt', 'web', 'terminal', 'app', 'portal', 'client', 'my', 'live', 'prod', 'api', 'match', 'matchtrader', 'mt', 'broker', 'dashboard'];
  const hosts = new Set<string>();
  hosts.add(apex); hosts.add('www.' + apex);
  if (domain !== apex) hosts.add(domain);           // el propio host dado
  for (const p of prefixes) hosts.add(p + '.' + apex);
  // Patrón MatchTrader alojado: <marca>.match-trader.com y mtr.<marca>.match-trader.com
  hosts.add(brand + '.match-trader.com');
  hosts.add('mtr.' + brand + '.match-trader.com');
  return Array.from(hosts);
}

// Prueba una lista de hosts en lotes; devuelve el primero que responda.
async function probeMany(hosts: string[]): Promise<{ ok: boolean; base?: string; brokerName?: string; partnerId?: string; host?: string } | null> {
  const batch = 8;
  for (let i = 0; i < hosts.length; i += batch) {
    const slice = hosts.slice(i, i + batch);
    const res = await Promise.all(slice.map(async (h) => ({ h, r: await probeHost(h) })));
    const hit = res.find((x) => x.r.ok);
    if (hit) return { ...hit.r, host: hit.h };
  }
  return null;
}

// IA: pide a Claude hosts probables de la Platform API de un bróker (solo hostnames).
async function aiCandidates(nameOrDomain: string): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return [];
  const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content:
        `The broker/prop firm "${nameOrDomain}" uses the MatchTrader white-label platform. Give up to 10 most-likely BASE HOSTNAMES of its MatchTrader Platform API / web trader (e.g. "mtr.brokerdomain.com"). Only hostnames, no scheme, no paths. Respond as a JSON array of strings, most likely first.` }] }),
    });
    if (!r.ok) return [];
    const j = await r.json(); const txt = j?.content?.[0]?.text || '';
    const m = txt.match(/\[[\s\S]*\]/); if (!m) return [];
    const arr = JSON.parse(m[0]); if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => String(s).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()).filter((s: string) => s.includes('.')).slice(0, 10);
  } catch { return []; }
}

// Punto de entrada: autodetecta la URL de la Platform API de un bróker.
export async function discoverBrokerApi(input: string, useAi = true): Promise<Discover> {
  const raw = String(input || '').trim();
  const domain = domainOf(raw);
  const tried: string[] = [];

  // 1) Candidatos deterministas del dominio (si lo hay).
  if (domain) {
    const hosts = candidateHosts(domain); tried.push(...hosts);
    const hit = await probeMany(hosts);
    if (hit?.ok) return { found: true, base_url: hit.base, brokerName: hit.brokerName, partnerId: hit.partnerId, tried: tried.length, candidates: hosts };
  }

  // 2) IA (opcional): propone hosts; se VERIFICAN igual contra la API.
  if (useAi) {
    const ai = await aiCandidates(raw || domain || '');
    const fresh = ai.filter((h) => !tried.includes(h)); tried.push(...fresh);
    if (fresh.length) {
      const hit = await probeMany(fresh);
      if (hit?.ok) return { found: true, base_url: hit.base, brokerName: hit.brokerName, partnerId: hit.partnerId, tried: tried.length, candidates: tried.slice(-20) };
    }
  }
  return { found: false, tried: tried.length, candidates: tried.slice(0, 20) };
}

// Obtiene el brokerId (partnerId) del bróker a partir de su URL base. Público.
export async function mtpBrokerId(base: string): Promise<string | null> {
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/manager/platform-details', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.partnerId != null ? String(j.partnerId) : null;
  } catch { return null; }
}

// LOGIN retail. Devuelve el token de sesión + la lista de cuentas del trader.
export async function mtpLogin(base: string, email: string, password: string, brokerId?: string): Promise<MtpLoginResult> {
  const root = base.replace(/\/$/, '');
  const bid = brokerId || (await mtpBrokerId(root)) || '0';
  let r: Response;
  try {
    r = await fetch(root + '/manager/mtr-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, brokerId: bid }),
    });
  } catch (e: any) { return { ok: false, error: 'red: ' + (e?.message || 'fetch') }; }
  if (!r.ok) return { ok: false, error: r.status === 401 ? 'credenciales inválidas' : ('HTTP ' + r.status) };
  const j = await r.json().catch(() => null as any);
  if (!j?.token) return { ok: false, error: 'sin token' };
  const list = (j.tradingAccounts && j.tradingAccounts.length ? j.tradingAccounts : [j.selectedTradingAccount]).filter(Boolean);
  const accounts: MtpAccount[] = list.map((a: any) => ({
    id: String(a.uuid || a.tradingAccountId || ''),
    name: String(a.offer?.name || a.uuid || ''),
    systemUuid: String(a.offer?.system?.uuid || ''),
    tradingDomain: String(a.offer?.system?.tradingApiDomain || root).replace(/\/$/, ''),
    tradingApiToken: String(a.tradingApiToken || ''),
    currency: String(a.offer?.currency || 'USD'),
    demo: !!a.offer?.demo,
  })).filter((a: MtpAccount) => a.systemUuid && a.tradingApiToken);
  return { ok: true, coToken: String(j.token), accounts };
}

// Refresca el token de sesión (cookie). Devuelve el nuevo co-auth o null.
async function mtpRefresh(base: string, coToken: string): Promise<string | null> {
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/manager/refresh-token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Cookie: 'co-auth=' + coToken },
    });
    if (!r.ok) return null;
    // El nuevo token viene en Set-Cookie o en el cuerpo, según despliegue.
    const setC = r.headers.get('set-cookie') || '';
    const m = setC.match(/co-auth=([^;]+)/);
    if (m) return m[1];
    const j = await r.json().catch(() => null as any);
    return j?.token ? String(j.token) : coToken;   // si no cambia, seguimos con el mismo
  } catch { return null; }
}

// Cabeceras de trading para una conexión ya autenticada.
function tHeaders(conn: any, coToken: string) {
  return { 'Content-Type': 'application/json', 'Auth-trading-api': dec(conn.trading_token), Cookie: 'co-auth=' + coToken };
}
const tUrl = (conn: any, path: string) => (String(conn.trading_domain || conn.api_base || '').replace(/\/$/, '')) + '/mtr-api/' + conn.system_uuid + path;

// --- Lecturas ---
export async function mtpGetPositions(conn: any, coToken: string): Promise<MtpPosition[]> {
  const r = await fetch(tUrl(conn, '/open-positions'), { headers: tHeaders(conn, coToken) as any });
  if (!r.ok) throw new Error('pos_http_' + r.status);
  const j = await r.json().catch(() => ({} as any));
  return (j?.positions || []).map((p: any) => ({
    ticket: String(p.id), symbol: String(p.symbol || p.alias || ''), side: sideDn(p.side),
    volume: num(p.volume), openPrice: num(p.openPrice) || undefined,
    sl: num(p.stopLoss) || undefined, tp: num(p.takeProfit) || undefined,
  })).filter((p: MtpPosition) => p.ticket);
}
export async function mtpGetBalance(conn: any, coToken: string): Promise<{ balance: number; equity: number }> {
  try {
    const r = await fetch(tUrl(conn, '/balance'), { headers: tHeaders(conn, coToken) as any });
    if (r.ok) { const j = await r.json(); return { balance: num(j?.balance), equity: num(j?.equity) || num(j?.balance) }; }
  } catch {}
  return { balance: 0, equity: 0 };
}

// --- Ejecución ---
export async function mtpOpen(conn: any, coToken: string, o: { symbol: string; side: 'buy' | 'sell'; volume: number; sl?: number; tp?: number }): Promise<string> {
  const r = await fetch(tUrl(conn, '/position/open'), {
    method: 'POST', headers: tHeaders(conn, coToken) as any,
    body: JSON.stringify({ instrument: o.symbol, orderSide: sideUp(o.side), volume: o.volume, slPrice: o.sl || 0, tpPrice: o.tp || 0, isMobile: false }),
  });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok || String(j?.status).toUpperCase() === 'REJECTED') throw new Error('open_' + (j?.errorMessage || r.status));
  return String(j?.orderId || '');
}
export async function mtpClose(conn: any, coToken: string, pos: { ticket: string; symbol: string; side: 'buy' | 'sell'; volume: number }): Promise<boolean> {
  const r = await fetch(tUrl(conn, '/position/close'), {
    method: 'POST', headers: tHeaders(conn, coToken) as any,
    body: JSON.stringify({ positionId: pos.ticket, instrument: pos.symbol, orderSide: sideUp(pos.side), volume: String(pos.volume) }),
  });
  const j = await r.json().catch(() => ({} as any));
  return r.ok && String(j?.status || 'OK').toUpperCase() !== 'REJECTED';
}
export async function mtpEdit(conn: any, coToken: string, pos: { ticket: string; symbol: string; side: 'buy' | 'sell'; volume: number; sl?: number; tp?: number }): Promise<boolean> {
  const r = await fetch(tUrl(conn, '/position/edit'), {
    method: 'POST', headers: tHeaders(conn, coToken) as any,
    body: JSON.stringify({ instrument: pos.symbol, id: pos.ticket, orderSide: sideUp(pos.side), volume: pos.volume, slPrice: pos.sl || 0, tpPrice: pos.tp || 0, isMobile: false }),
  });
  const j = await r.json().catch(() => ({} as any));
  return r.ok && String(j?.status || 'OK').toUpperCase() !== 'REJECTED';
}

// Guarda tras conectar: tokens cifrados + datos de la cuenta elegida.
export function storeFields(coToken: string, acc: MtpAccount) {
  return {
    api_base: acc.tradingDomain,          // dominio de trading
    trading_domain: acc.tradingDomain,
    system_uuid: acc.systemUuid,
    account_uuid: acc.id,
    co_token: enc(coToken),
    trading_token: enc(acc.tradingApiToken),
    token_at: new Date().toISOString(),
    status: 'ok',
  };
}

// Mantiene la sesión viva: refresca cada ~14 min (respeta 4/h). Devuelve el co-auth vigente.
async function ensureToken(conn: any): Promise<string | null> {
  const co = dec(conn.co_token);
  const ageMin = (Date.now() - new Date(conn.token_at || 0).getTime()) / 60000;
  if (ageMin < 14) return co;
  const base = String(conn.api_base || conn.trading_domain || '');
  const fresh = await mtpRefresh(base, co);
  if (!fresh) return null;   // no se pudo refrescar → hay que reconectar
  await supabaseAdmin.from('matchtrader_connections').update({ co_token: enc(fresh), token_at: new Date().toISOString(), status: 'ok' }).eq('id', conn.id);
  return fresh;
}

// Ejecuta la cola de copia (esclava) por API — mismo copy_commands que los EAs.
async function drainSlave(conn: any, coToken: string): Promise<number> {
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
        const ticket = await mtpOpen(conn, coToken, { symbol, side: c.side === 'sell' ? 'sell' : 'buy', volume: vol, sl: c.sl || undefined, tp: c.tp || undefined });
        await supabaseAdmin.from('copy_commands').update({ status: 'done', slave_ticket: ticket, done_at: nowIso }).eq('id', c.id); done++;
      } else if (c.action === 'close' || c.action === 'modify') {
        const { data: opn } = await supabaseAdmin.from('copy_commands').select('slave_ticket,base_symbol,side')
          .eq('slave_account_id', conn.account_id).eq('master_ticket', c.master_ticket).eq('action', 'open')
          .not('slave_ticket', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const st = (opn as any)?.slave_ticket;
        if (st) {
          const sym = map[c.base_symbol] || c.base_symbol; const sd = (c.side || (opn as any)?.side || 'buy') === 'sell' ? 'sell' : 'buy';
          if (c.action === 'close') await mtpClose(conn, coToken, { ticket: st, symbol: sym, side: sd, volume: Number(c.volume_hint) || 0 });
          else await mtpEdit(conn, coToken, { ticket: st, symbol: sym, side: sd, volume: Number(c.volume_hint) || 0, sl: c.sl || undefined, tp: c.tp || undefined });
        }
        await supabaseAdmin.from('copy_commands').update({ status: 'done', done_at: nowIso }).eq('id', c.id); done++;
      }
    } catch (e: any) {
      await supabaseAdmin.from('copy_commands').update({ status: 'failed', error: String(e?.message || 'exec').slice(0, 200), done_at: nowIso }).eq('id', c.id);
    }
  }
  return done;
}

// Sync de una conexión Platform: Guardian + Copy (mismo motor que MT/cTrader).
export async function syncPlatform(conn: any) {
  const co = await ensureToken(conn);
  if (!co) { await supabaseAdmin.from('matchtrader_connections').update({ status: 'reauth' }).eq('id', conn.id); return { ok: false, reason: 'reauth' }; }

  let positions: MtpPosition[]; let bal: { balance: number; equity: number };
  try { positions = await mtpGetPositions(conn, co); bal = await mtpGetBalance(conn, co); }
  catch (e: any) {
    // 401 → intenta un refresh inmediato y reintenta una vez.
    if (String(e?.message || '').includes('401')) {
      const base = String(conn.api_base || conn.trading_domain || ''); const fresh = await mtpRefresh(base, dec(conn.co_token));
      if (fresh) { await supabaseAdmin.from('matchtrader_connections').update({ co_token: enc(fresh), token_at: new Date().toISOString() }).eq('id', conn.id);
        try { positions = await mtpGetPositions({ ...conn }, fresh); bal = await mtpGetBalance({ ...conn }, fresh); } catch { return { ok: false, reason: 'fetch' }; }
      } else { await supabaseAdmin.from('matchtrader_connections').update({ status: 'reauth' }).eq('id', conn.id); return { ok: false, reason: 'reauth' }; }
    } else return { ok: false, reason: String(e?.message || 'fetch') };
  }

  // Guardian
  if (conn.account_id) {
    const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', conn.account_id).maybeSingle();
    if (cfgRow?.enabled) {
      const verdict = await evaluate({ userId: conn.user_id, accountId: conn.account_id, serverOffsetMin: 0, balance: bal.balance, equity: bal.equity, openCount: positions.length, rawConfig: cfgRow.config, enabled: true } as any);
      if (verdict && ((verdict as any).close_all || (verdict as any).allow_new === false)) {
        for (const p of positions) { try { await mtpClose(conn, co, { ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume }); } catch {} }
      }
    }
  }

  // Copy máster: diff con la foto anterior
  if (conn.copy_enabled && conn.role !== 'slave' && conn.account_id) {
    const prev: Record<string, MtpPosition> = {}; for (const p of (conn.master_snapshot?.positions || [])) prev[p.ticket] = p;
    const now: Record<string, MtpPosition> = {}; for (const p of positions) now[p.ticket] = p;
    const opened = positions.filter((p) => !prev[p.ticket]);
    const closedTickets = Object.keys(prev).filter((t) => !now[t]);
    await relayMasterSnapshot({ userId: conn.user_id, masterAccountId: conn.account_id, masterBalance: bal.balance,
      opened: opened.map((p) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume, sl: p.sl, tp: p.tp, price: p.openPrice })),
      closedTickets });
  }

  // Copy esclava: ejecuta la cola por API
  let executed = 0;
  if (conn.copy_enabled && conn.role !== 'master' && conn.account_id) { try { executed = await drainSlave(conn, co); } catch {} }

  await supabaseAdmin.from('matchtrader_connections').update({ master_snapshot: { at: Date.now(), positions }, last_sync_at: new Date().toISOString() }).eq('id', conn.id);
  return { ok: true, positions: positions.length, balance: bal.balance, executed };
}
