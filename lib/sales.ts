import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Red de VENTAS · motor. Árbol de 3 niveles (vendedor → N1 → N2),
// comisión recurrente por cada pago mensual, con maduración + reversa +
// frenos (mismo esquema de seguridad que Embajadores).
// ============================================================

export type SalesSettings = {
  enabled: boolean;
  direct_rate: number;        // % para el vendedor que trajo al cliente
  override1_rate: number;     // % override para su supervisor N1
  override2_rate: number;     // % override para el supervisor N2
  commission_months: number;  // meses de comisión por cliente; 0 = ilimitado (∞)
  hold_days: number;          // retención anti-reembolso antes de poder cobrar
  min_payout: number;         // mínimo para pagar
  trial_max_days: number;     // tope de días de prueba que puede dar un vendedor
  discount_max_pct: number;   // tope de descuento (%) que puede dar un vendedor
  // Candados anti-abuso (0 = ilimitado):
  trial_max_per_client: number;   // máx. veces que un cliente puede recibir prueba (de cualquier vendedor)
  trial_max_total_days: number;   // tope de días gratis acumulados por cliente (suma de todas sus pruebas)
  trial_daily_cap: number;        // máx. pruebas que un vendedor puede dar en 24h
  discount_daily_cap: number;     // máx. cupones que un vendedor puede generar en 24h
  auto_payout: boolean;       // paga solo cuando el saldo madura
  review_before_pay: boolean; // freno global: encola pero apruebas tú
  allow_recruit: boolean;     // los supervisores pueden reclutar su equipo
  level_names: { l2: string; l1: string; vendedor: string };  // nombres personalizados de las posiciones
  // Sobre qué líneas de ingreso se paga comisión (configurable con interruptores).
  commission_scope: { subscriptions: boolean; addons: boolean; guardian: boolean; academy: boolean; botlab: boolean; copy: boolean };
  // Permisos por defecto de cada nivel (se pueden sobreescribir por rep en sales_reps.perms).
  perms_defaults: { l2: RepPerms; l1: RepPerms; vendedor: RepPerms };
  // Criterios de las evaluaciones 360 (editables).
  eval_criteria: string[];
  // Umbrales del "plan de manejo": puntaje 0-100 → Estrella / Sólido / En riesgo.
  tier_thresholds: { star: number; risk: number };
  // Reseñas de clientes: se piden solas tras X días de ser cliente.
  review: { enabled: boolean; after_days: number; email: boolean };
  // % por línea (opcional): protege el margen en líneas que ya pagan a otros
  // (Academia al mentor, Bot Lab al creador). Si una línea tiene valor aquí, ese
  // % manda para esa línea; en blanco/undefined hereda el global.
  line_rates?: Partial<Record<'subscriptions' | 'addons' | 'guardian' | 'academy' | 'botlab' | 'copy', { direct?: number | null; override1?: number | null; override2?: number | null }>>;
};

// Qué puede hacer un representante dentro del sistema.
export type RepPerms = {
  can_trial: boolean;      // dar pruebas
  can_discount: boolean;   // dar descuentos
  can_clients: boolean;    // ver y gestionar sus clientes
  can_tickets: boolean;    // atender tickets de sus clientes
  can_recruit: boolean;    // reclutar/gestionar su equipo (solo tiene sentido en supervisores)
  can_team: boolean;       // ver el desempeño de su equipo
};

const PERM_ALL: RepPerms = { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: true, can_team: true };
const PERM_SELLER: RepPerms = { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: false, can_team: false };

const DEFAULTS: SalesSettings = {
  enabled: true, direct_rate: 20, override1_rate: 7, override2_rate: 4,
  commission_months: 0, hold_days: 30, min_payout: 50,
  trial_max_days: 14, discount_max_pct: 20,
  trial_max_per_client: 1, trial_max_total_days: 21, trial_daily_cap: 10, discount_daily_cap: 10,
  auto_payout: true, review_before_pay: false, allow_recruit: true,
  level_names: { l2: 'Director', l1: 'Lead', vendedor: 'Advisor' },
  commission_scope: { subscriptions: true, addons: true, guardian: true, academy: false, botlab: false, copy: false },
  perms_defaults: { l2: { ...PERM_ALL }, l1: { ...PERM_ALL }, vendedor: { ...PERM_SELLER } },
  eval_criteria: ['Comunicación', 'Conocimiento del producto', 'Puntualidad', 'Cierre de ventas', 'Trabajo en equipo', 'Actitud'],
  tier_thresholds: { star: 75, risk: 45 },
  review: { enabled: true, after_days: 20, email: false },
  line_rates: {},
};

// Permisos efectivos de un rep: default del nivel + override propio (rep.perms).
export function permsFor(rep: Pick<Rep, 'level'> & { perms?: any }, s: SalesSettings): RepPerms {
  const base = (s.perms_defaults && (s.perms_defaults as any)[rep.level]) || (rep.level === 'vendedor' ? PERM_SELLER : PERM_ALL);
  const ov = rep && (rep as any).perms;
  return { ...base, ...(ov && typeof ov === 'object' ? ov : {}) };
}

export async function salesSettings(): Promise<SalesSettings> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'sales').maybeSingle();
    return { ...DEFAULTS, ...((data?.value as any) || {}) };
  } catch { return DEFAULTS; }
}

export async function saveSalesSettings(patch: Partial<SalesSettings>): Promise<SalesSettings> {
  const prev = await salesSettings();
  const value = { ...prev, ...patch };
  await supabaseAdmin.from('app_settings').upsert({ key: 'sales', value, updated_at: new Date().toISOString() });
  return value;
}

// Código de invitación único y legible (base del enlace ?sv=).
function slug(s: string): string {
  return String(s || 'sv').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'sv';
}
export async function uniqueRepCode(seed: string): Promise<string> {
  const base = slug(seed);
  for (let i = 0; i < 12; i++) {
    const code = i === 0 ? base : base + Math.random().toString(36).slice(2, 5);
    const { data } = await supabaseAdmin.from('sales_reps').select('id').eq('code', code).maybeSingle();
    if (!data) return code;
  }
  return base + Date.now().toString(36).slice(-4);
}

export type Rep = {
  id: string; user_id: string; level: 'vendedor' | 'l1' | 'l2'; parent_id: string | null;
  code: string; status: string; rate_override: number | null; display_name: string | null;
  stripe_account_id: string | null; payouts_enabled: boolean; on_hold: boolean; note?: string | null;
  perms?: any | null;
};

export async function repByUser(userId: string): Promise<Rep | null> {
  const { data } = await supabaseAdmin.from('sales_reps').select('*').eq('user_id', userId).maybeSingle();
  return (data as any) || null;
}
export async function repById(id: string): Promise<Rep | null> {
  const { data } = await supabaseAdmin.from('sales_reps').select('*').eq('id', id).maybeSingle();
  return (data as any) || null;
}
export async function repByCode(code: string): Promise<Rep | null> {
  const { data } = await supabaseAdmin.from('sales_reps').select('*').eq('code', code).eq('status', 'active').maybeSingle();
  return (data as any) || null;
}

// Cadena de beneficiarios hacia arriba desde el vendedor dueño del cliente:
//   direct (el vendedor) · override1 (su padre) · override2 (el abuelo).
export async function beneficiaryChain(directRepId: string): Promise<{ direct: Rep | null; up1: Rep | null; up2: Rep | null }> {
  const direct = await repById(directRepId);
  const up1 = direct?.parent_id ? await repById(direct.parent_id) : null;
  const up2 = up1?.parent_id ? await repById(up1.parent_id) : null;
  return { direct, up1, up2 };
}

// Todos los descendientes de un rep (para el rollup del supervisor y el admin).
export async function subtreeRepIds(rootId: string): Promise<string[]> {
  const out: string[] = [];
  let frontier = [rootId];
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const { data } = await supabaseAdmin.from('sales_reps').select('id').in('parent_id', frontier);
    const kids = (data || []).map((r: any) => r.id).filter((id: string) => !out.includes(id));
    out.push(...kids);
    frontier = kids;
  }
  return out;
}

// % que le toca a un beneficiario según su nivel en el reparto (el override del
// rep manda si está puesto).
export function pctFor(rep: Rep | null, slot: 'direct' | 'override1' | 'override2', s: SalesSettings, line?: string): number {
  if (!rep) return 0;
  // % por línea (Academia/Bot Lab con tarifa propia para no doblar comisión) manda si está puesto.
  if (line && s.line_rates && (s.line_rates as any)[line]) {
    const v = (s.line_rates as any)[line][slot];
    if (v != null && v !== '') return Number(v);
  }
  if (rep.rate_override != null && rep.rate_override !== ('' as any)) return Number(rep.rate_override);
  return slot === 'direct' ? s.direct_rate : slot === 'override1' ? s.override1_rate : s.override2_rate;
}

// Cuántos meses de comisión ya se generaron para un cliente (nivel direct).
async function monthsBilled(clientUserId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('sales_commissions')
    .select('*', { count: 'exact', head: true })
    .eq('client_user_id', clientUserId).eq('level', 'direct').neq('status', 'reversed');
  return count || 0;
}

// Acredita comisiones de un cobro a toda la cadena. Idempotente por invoice_id.
export async function creditFromPayment(opts: {
  clientUserId: string; invoiceId: string; baseAmount: number; currency?: string;
  line?: 'subscriptions' | 'addons' | 'guardian' | 'academy' | 'botlab' | 'copy';
}): Promise<{ credited: number; reason?: string }> {
  const s = await salesSettings();
  if (!s.enabled) return { credited: 0, reason: 'disabled' };
  // Alcance: solo se paga comisión sobre las líneas de ingreso activadas.
  const line = opts.line || 'subscriptions';
  const scope = s.commission_scope || ({ subscriptions: true } as any);
  if (scope[line] === false) return { credited: 0, reason: 'scope_off' };

  const { data: sc } = await supabaseAdmin.from('sales_clients').select('rep_id').eq('user_id', opts.clientUserId).maybeSingle();
  const directRepId = (sc as any)?.rep_id;
  if (!directRepId) return { credited: 0, reason: 'no_rep' };

  if (s.commission_months > 0) {
    const done = await monthsBilled(opts.clientUserId);
    if (done >= s.commission_months) return { credited: 0, reason: 'cap_months' };
  }

  const { direct, up1, up2 } = await beneficiaryChain(directRepId);
  const availableAt = new Date(Date.now() + (s.hold_days || 0) * 86400000).toISOString();
  const base = Number(opts.baseAmount) || 0;
  const currency = opts.currency || 'USD';
  const rows: any[] = [];
  const add = (rep: Rep | null, slot: 'direct' | 'override1' | 'override2', level: string) => {
    if (!rep || rep.status !== 'active') return;
    const pct = pctFor(rep, slot, s, line);
    if (!(pct > 0)) return;
    rows.push({
      rep_id: rep.id, client_user_id: opts.clientUserId, level, invoice_id: opts.invoiceId,
      base_amount: base, pct, amount: Math.round(base * pct) / 100, currency,
      status: 'pending', available_at: availableAt,
    });
  };
  add(direct, 'direct', 'direct');
  add(up1, 'override1', 'override1');
  add(up2, 'override2', 'override2');
  if (!rows.length) return { credited: 0, reason: 'no_rates' };

  // upsert idempotente por (invoice_id, rep_id, level)
  const { error } = await supabaseAdmin.from('sales_commissions').upsert(rows, { onConflict: 'invoice_id,rep_id,level', ignoreDuplicates: true });
  if (error) return { credited: 0, reason: error.message };

  try { await supabaseAdmin.from('sales_clients').update({ first_paid_at: new Date().toISOString() }).eq('user_id', opts.clientUserId).is('first_paid_at', null); } catch {}
  return { credited: rows.length };
}

// Reversa (clawback) por reembolso/contracargo: anula las comisiones de esa factura.
export async function reverseFromInvoice(invoiceId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('sales_commissions')
    .update({ status: 'reversed' }).eq('invoice_id', invoiceId).neq('status', 'paid').select('id');
  return (data || []).length;
}

// Saldos de un rep: retenido, disponible y pagado.
export async function balances(repId: string): Promise<{ pending: number; available: number; paid: number }> {
  const { data } = await supabaseAdmin.from('sales_commissions').select('amount,status,available_at').eq('rep_id', repId);
  const now = Date.now();
  let pending = 0, available = 0, paid = 0;
  (data || []).forEach((c: any) => {
    const amt = Number(c.amount) || 0;
    if (c.status === 'paid') paid += amt;
    else if (c.status === 'reversed') return;
    else if (c.status === 'available' || (c.available_at && new Date(c.available_at).getTime() <= now)) available += amt;
    else pending += amt;
  });
  return { pending: Math.round(pending * 100) / 100, available: Math.round(available * 100) / 100, paid: Math.round(paid * 100) / 100 };
}

// Ata un cliente recién registrado a un vendedor por su código (atribución de por
// vida). Idempotente: si ya está atado, no hace nada. No se ata a sí mismo.
export async function attachClientByCode(userId: string, code: string, source: 'link' | 'invite' | 'manual' = 'link'): Promise<{ linked: boolean }> {
  try {
    const { data: prev } = await supabaseAdmin.from('sales_clients').select('id').eq('user_id', userId).maybeSingle();
    if (prev) return { linked: false };
    const rep = await repByCode(code);
    if (!rep || rep.user_id === userId) return { linked: false };
    await supabaseAdmin.from('sales_clients').insert({ rep_id: rep.id, user_id: userId, source });
    await supabaseAdmin.from('profiles').update({ sales_rep_id: rep.id }).eq('id', userId);
    return { linked: true };
  } catch { return { linked: false }; }
}

// Asignación/reasignación manual (admin o supervisor): mueve el cliente a un rep.
export async function assignClient(userId: string, repId: string, source: 'manual' | 'invite' = 'manual'): Promise<boolean> {
  try {
    await supabaseAdmin.from('sales_clients').upsert({ rep_id: repId, user_id: userId, source }, { onConflict: 'user_id' });
    await supabaseAdmin.from('profiles').update({ sales_rep_id: repId }).eq('id', userId);
    return true;
  } catch { return false; }
}

export async function recordClick(code: string) {
  try { await supabaseAdmin.from('sales_clicks').insert({ code: String(code || '').toLowerCase() }); } catch {}
}

// Lista de clientes de un rep, con estado (plan + suscripción) y correo.
export async function listClients(repId: string): Promise<any[]> {
  const { data: cs } = await supabaseAdmin.from('sales_clients').select('user_id,source,created_at,first_paid_at').eq('rep_id', repId).order('created_at', { ascending: false }).limit(500);
  const rows = cs || [];
  if (!rows.length) return [];
  const ids = rows.map((r: any) => r.user_id);
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,email,name,plan,subscription_status,comp_until').in('id', ids);
  const byId: Record<string, any> = {}; (profs || []).forEach((p: any) => { byId[p.id] = p; });
  return rows.map((r: any) => {
    const p = byId[r.user_id] || {};
    const active = p.plan && p.plan !== 'free' && ['active', 'trialing'].includes(p.subscription_status);
    return { user_id: r.user_id, email: p.email || null, name: p.name || null, plan: p.plan || 'free', status: p.subscription_status || null, active: !!active, comp_until: p.comp_until || null, source: r.source, since: r.created_at };
  });
}

// Rollup del equipo: cada rep descendiente con su nº de clientes y saldo.
export async function teamRollup(rootId: string): Promise<any[]> {
  const ids = await subtreeRepIds(rootId);
  if (!ids.length) return [];
  const { data: reps } = await supabaseAdmin.from('sales_reps').select('id,user_id,level,display_name,status').in('id', ids);
  const out: any[] = [];
  for (const r of (reps || []) as any[]) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', r.user_id).maybeSingle();
    const { count } = await supabaseAdmin.from('sales_clients').select('*', { count: 'exact', head: true }).eq('rep_id', r.id);
    const bal = await balances(r.id);
    out.push({ id: r.id, level: r.level, name: r.display_name || (prof as any)?.email || 'Rep', email: (prof as any)?.email || null, status: r.status, clients: count || 0, available: bal.available });
  }
  return out;
}

// Dar PRUEBA a un cliente existente del rep: extiende su acceso de cortesía
// (comp_until) hasta N días, con tope trial_max_days. Registra el grant.
export async function grantTrial(repId: string, clientUserId: string, days: number): Promise<{ ok: boolean; error?: string; until?: string }> {
  const s = await salesSettings();
  // El cliente debe pertenecer a este rep.
  const { data: sc } = await supabaseAdmin.from('sales_clients').select('id').eq('rep_id', repId).eq('user_id', clientUserId).maybeSingle();
  if (!sc) return { ok: false, error: 'no es tu cliente' };

  // --- Candados anti-abuso (0 = ilimitado) ---
  const maxPer = Number(s.trial_max_per_client) || 0;
  const maxTotal = Number(s.trial_max_total_days) || 0;
  const dailyCap = Number(s.trial_daily_cap) || 0;

  // Pruebas previas de ESTE cliente (de cualquier vendedor) → nº y días acumulados.
  let priorCount = 0, priorDays = 0;
  if (maxPer > 0 || maxTotal > 0) {
    const { data: prev } = await supabaseAdmin.from('sales_grants').select('value').eq('client_user_id', clientUserId).eq('kind', 'trial');
    priorCount = (prev || []).length;
    priorDays = (prev || []).reduce((a: number, g: any) => a + (Number(g.value) || 0), 0);
  }
  if (maxPer > 0 && priorCount >= maxPer) return { ok: false, error: `Este cliente ya recibió el máximo de ${maxPer} prueba${maxPer === 1 ? '' : 's'}.` };

  // Límite diario de pruebas de ESTE vendedor (ventana de 24h).
  if (dailyCap > 0) {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabaseAdmin.from('sales_grants').select('*', { count: 'exact', head: true }).eq('rep_id', repId).eq('kind', 'trial').gte('created_at', since);
    if ((count || 0) >= dailyCap) return { ok: false, error: `Llegaste al límite de ${dailyCap} pruebas en 24 horas.` };
  }

  // Días a conceder: tope por prueba + que la suma no pase el tope total del cliente.
  let d = Math.max(1, Math.min(Number(days) || 0, s.trial_max_days || 14));
  if (maxTotal > 0) {
    const remaining = maxTotal - priorDays;
    if (remaining <= 0) return { ok: false, error: `Este cliente ya alcanzó el máximo de ${maxTotal} días gratis acumulados.` };
    if (d > remaining) d = remaining;   // recorta para no pasar el tope total
  }

  const { data: prof } = await supabaseAdmin.from('profiles').select('plan,comp_plan,comp_until').eq('id', clientUserId).maybeSingle();
  const now = Date.now();
  const base = (prof as any)?.comp_until ? Math.max(now, new Date((prof as any).comp_until).getTime()) : now;
  const until = new Date(base + d * 86400000).toISOString();
  const compPlan = (prof as any)?.comp_plan || ((prof as any)?.plan && (prof as any).plan !== 'free' ? (prof as any).plan : 'pro');
  await supabaseAdmin.from('profiles').update({ comp_plan: compPlan, comp_until: until, comp_warned: false, comp_expired_seen: false }).eq('id', clientUserId);
  await supabaseAdmin.from('sales_grants').insert({ rep_id: repId, client_user_id: clientUserId, kind: 'trial', value: d });
  return { ok: true, until };
}

// Cuántos clientes activos (pagando) tiene un rep ahora mismo.
export async function activeClients(repId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('sales_clients').select('user_id').eq('rep_id', repId);
  const ids = (data || []).map((r: any) => r.user_id);
  if (!ids.length) return 0;
  const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
    .in('id', ids).neq('plan', 'free').in('subscription_status', ['active', 'trialing']);
  return count || 0;
}
