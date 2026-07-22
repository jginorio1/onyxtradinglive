import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Units = 'pips' | 'r' | 'money';

// ============================================================
// Configuración por defecto de un gestor nuevo.
// Todo apagado: nunca tocamos las operaciones de nadie sin que lo pida.
// ============================================================
export const DEFAULT_CONFIG = {
  // ---- Fase 1: gestión de la operación abierta ----
  breakeven: {
    on: false,
    trigger: 15,        // cuánto tiene que ganar antes de mover el stop
    mode: 'above',      // below | at | above  (dónde queda el stop respecto a la entrada)
    offset: 2,          // colchón extra
    cover_costs: true,  // sumar comisión y swap para que el BE sea real
  },
  trailing: {
    on: false,
    type: 'fixed',      // fixed | highlow | ma | atr  (por ahora solo fixed)
    distance: 20,
    start: 20,          // a partir de cuánta ganancia empieza a perseguir
  },
  partials: {
    on: false,
    levels: [
      { at: 20, close: 50, on: true },
      { at: 40, close: 30, on: false },
      { at: 60, close: 20, on: false },
      { at: 80, close: 0, on: false },
    ],
  },

  // ---- Fase 2: mi plan de trading (cuándo puedo operar) ----
  plan: {
    on: false,
    tz_offset_min: 0,      // diferencia de MI hora respecto a UTC (la manda el navegador)
    days: [1, 2, 3, 4, 5], // 0 domingo ... 6 sábado
    windows: [
      { from: '08:00', to: '11:00', on: true },
      { from: '13:30', to: '16:00', on: false },
      { from: '00:00', to: '00:00', on: false },
    ],
    weekend_close: { on: false, day: 5, time: '20:00' }, // cerrar todo el viernes a las X
    max_trades_day: 0,     // 0 = sin límite
    cooldown_min: 0,       // minutos de espera después de cerrar una operación en pérdida
    tilt: { on: false, losses: 3, pause_min: 120 }, // tras N pérdidas seguidas, pausa
    rigidity: 'friction',  // soft (solo avisa) | friction (espera) | hard (hasta mañana)
    friction_min: 15,      // minutos de espera si pide saltarse la regla
  },

  // ---- Fase 2: límites de la cuenta ----
  limits: {
    on: false,
    base: 'day_start_balance', // day_start_balance | day_start_equity | initial_balance
    reset_hour: 0,             // hora del servidor del bróker a la que empieza el día
    daily_loss: 0,             // pérdida máxima del día
    daily_loss_pct: true,      // true = el número es un %, false = dinero
    daily_target: 0,           // objetivo del día: al llegar, deja de operar
    daily_target_pct: true,
    total_loss: 0,             // pérdida máxima total desde el inicio
    total_loss_pct: true,
    safety_margin: 20,         // % del límite que reservamos: avisa antes de llegar
    max_lots: 0,               // lotaje máximo por operación (0 = sin límite)
    max_open: 0,               // posiciones simultáneas (0 = sin límite)
    on_breach: 'close_and_block', // warn | block_new | close_and_block
  },

  // ---- Fase 2: noticias ----
  news: {
    on: false,
    impact: 'high',        // high | high_medium
    before_min: 15,
    after_min: 15,
    action: 'block_new',   // warn | block_new | close_and_block
    only_symbol: true,     // solo si la noticia afecta a la divisa del símbolo
  },
};

export type ManagerConfig = typeof DEFAULT_CONFIG;

// ============================================================
// Plantillas de prop firms.
// AVISO: son un punto de partida, no la norma oficial. Cada firma cambia sus
// reglas y hay variantes por tipo de cuenta. El trader las edita y las confirma.
// Los dos campos que más se equivocan son `base` y `reset_hour`, por eso van
// siempre visibles y son obligatorios.
// ============================================================
export const PROP_TEMPLATES = [
  { id: 'custom',  name: 'A mi medida',   daily_loss: 0, total_loss: 0, base: 'day_start_balance', reset_hour: 0,
    note_es: 'Pon tus propios números.', note_en: 'Set your own numbers.' },
  { id: 'ftmo',    name: 'FTMO',           daily_loss: 5, total_loss: 10, base: 'day_start_balance', reset_hour: 0,
    note_es: 'Suele medir sobre el balance al inicio del día, hora CE(S)T.', note_en: 'Usually measured on day-start balance, CE(S)T.' },
  { id: 'the5ers', name: 'The5ers',        daily_loss: 4, total_loss: 6,  base: 'day_start_balance', reset_hour: 0,
    note_es: 'Confirma si tu programa mide sobre balance o equity.', note_en: 'Check whether your program uses balance or equity.' },
  { id: 'topstep', name: 'Topstep',        daily_loss: 3, total_loss: 6,  base: 'day_start_balance', reset_hour: 17,
    note_es: 'Su día suele arrancar por la tarde (hora de Chicago). Verifícalo.', note_en: 'Their day usually starts in the afternoon (Chicago). Verify it.' },
  { id: 'funded',  name: 'Otra fondeada',  daily_loss: 5, total_loss: 10, base: 'day_start_balance', reset_hour: 0,
    note_es: 'Copia aquí los números de tu contrato.', note_en: 'Copy the numbers from your contract here.' },
  { id: 'own',     name: 'Capital propio', daily_loss: 2, total_loss: 10, base: 'day_start_equity',  reset_hour: 0,
    note_es: 'Sin norma externa: pon el límite que de verdad respetarías.', note_en: 'No external rule: set a limit you would actually respect.' },
];

const RIGIDITY = ['soft', 'friction', 'hard'];
const BASES = ['day_start_balance', 'day_start_equity', 'initial_balance'];
const BREACH = ['warn', 'block_new', 'close_and_block'];

// Une lo guardado con los valores por defecto, para que nunca falte una clave
export function mergeConfig(saved: any): ManagerConfig {
  const s = saved && typeof saved === 'object' ? saved : {};
  const D = DEFAULT_CONFIG;
  return {
    breakeven: { ...D.breakeven, ...(s.breakeven || {}) },
    trailing: { ...D.trailing, ...(s.trailing || {}) },
    partials: {
      ...D.partials,
      ...(s.partials || {}),
      levels: Array.isArray(s.partials?.levels) && s.partials.levels.length
        ? s.partials.levels.slice(0, 4).map((l: any, i: number) => ({ ...D.partials.levels[i], ...l }))
        : D.partials.levels,
    },
    plan: {
      ...D.plan,
      ...(s.plan || {}),
      days: Array.isArray(s.plan?.days) ? s.plan.days : D.plan.days,
      windows: Array.isArray(s.plan?.windows) && s.plan.windows.length
        ? s.plan.windows.slice(0, 3).map((w: any, i: number) => ({ ...D.plan.windows[i], ...w }))
        : D.plan.windows,
      weekend_close: { ...D.plan.weekend_close, ...(s.plan?.weekend_close || {}) },
      tilt: { ...D.plan.tilt, ...(s.plan?.tilt || {}) },
    },
    limits: { ...D.limits, ...(s.limits || {}) },
    news: { ...D.news, ...(s.news || {}) },
  };
}

const num = (v: any, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// "8:5" -> "08:05". Si no se entiende, devuelve el valor por defecto.
function hhmm(v: any, def: string): string {
  const m = String(v || '').match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return def;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mi = Math.min(59, Math.max(0, Number(m[2])));
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

// Limpia lo que llega del navegador: números en rango y nada raro
export function sanitize(input: any): ManagerConfig {
  const c = mergeConfig(input);

  // --- break even ---
  c.breakeven.on = !!c.breakeven.on;
  c.breakeven.trigger = num(c.breakeven.trigger, 0, 100000, 15);
  c.breakeven.mode = ['below', 'at', 'above'].includes(c.breakeven.mode) ? c.breakeven.mode : 'above';
  c.breakeven.offset = num(c.breakeven.offset, 0, 100000, 2);
  c.breakeven.cover_costs = !!c.breakeven.cover_costs;

  // --- trailing ---
  c.trailing.on = !!c.trailing.on;
  c.trailing.type = ['fixed', 'highlow', 'ma', 'atr'].includes(c.trailing.type) ? c.trailing.type : 'fixed';
  c.trailing.distance = num(c.trailing.distance, 1, 100000, 20);
  c.trailing.start = num(c.trailing.start, 0, 100000, 20);

  // --- parciales ---
  c.partials.on = !!c.partials.on;
  c.partials.levels = c.partials.levels.slice(0, 4).map((l: any) => ({
    at: num(l.at, 0, 100000, 20),
    close: num(l.close, 0, 100, 0),
    on: !!l.on,
  }));

  // --- mi plan de trading ---
  const p = c.plan;
  p.on = !!p.on;
  p.tz_offset_min = num(p.tz_offset_min, -840, 840, 0);
  p.days = (Array.isArray(p.days) ? p.days : [])
    .map((d: any) => num(d, 0, 6, 1))
    .filter((d: number, i: number, a: number[]) => a.indexOf(d) === i)
    .sort((a: number, b: number) => a - b);
  if (!p.days.length) p.days = [1, 2, 3, 4, 5];
  p.windows = p.windows.slice(0, 3).map((w: any) => ({
    from: hhmm(w.from, '08:00'),
    to: hhmm(w.to, '11:00'),
    on: !!w.on,
  }));
  p.weekend_close.on = !!p.weekend_close.on;
  p.weekend_close.day = num(p.weekend_close.day, 0, 6, 5);
  p.weekend_close.time = hhmm(p.weekend_close.time, '20:00');
  p.max_trades_day = num(p.max_trades_day, 0, 200, 0);
  p.cooldown_min = num(p.cooldown_min, 0, 1440, 0);
  p.tilt.on = !!p.tilt.on;
  p.tilt.losses = num(p.tilt.losses, 2, 20, 3);
  p.tilt.pause_min = num(p.tilt.pause_min, 5, 2880, 120);
  p.rigidity = RIGIDITY.includes(p.rigidity) ? p.rigidity : 'friction';
  p.friction_min = num(p.friction_min, 1, 240, 15);

  // --- límites de la cuenta ---
  const l = c.limits;
  l.on = !!l.on;
  l.base = BASES.includes(l.base) ? l.base : 'day_start_balance';
  l.reset_hour = num(l.reset_hour, 0, 23, 0);
  l.daily_loss_pct = !!l.daily_loss_pct;
  l.daily_target_pct = !!l.daily_target_pct;
  l.total_loss_pct = !!l.total_loss_pct;
  l.daily_loss = num(l.daily_loss, 0, l.daily_loss_pct ? 100 : 1e9, 0);
  l.daily_target = num(l.daily_target, 0, l.daily_target_pct ? 1000 : 1e9, 0);
  l.total_loss = num(l.total_loss, 0, l.total_loss_pct ? 100 : 1e9, 0);
  l.safety_margin = num(l.safety_margin, 0, 90, 20);
  l.max_lots = num(l.max_lots, 0, 1000, 0);
  l.max_open = num(l.max_open, 0, 200, 0);
  l.on_breach = BREACH.includes(l.on_breach) ? l.on_breach : 'close_and_block';

  // --- noticias ---
  const n = c.news;
  n.on = !!n.on;
  n.impact = ['high', 'high_medium'].includes(n.impact) ? n.impact : 'high';
  n.before_min = num(n.before_min, 0, 240, 15);
  n.after_min = num(n.after_min, 0, 240, 15);
  n.action = BREACH.includes(n.action) ? n.action : 'block_new';
  n.only_symbol = !!n.only_symbol;

  return c;
}

// Suma de porcentajes de los TP parciales activos (debe quedar en 100 o menos)
export function partialsTotal(c: ManagerConfig) {
  return c.partials.levels.filter((l: any) => l.on).reduce((t: number, l: any) => t + Number(l.close || 0), 0);
}

// Avisos honestos sobre la configuración: cosas que el trader debería revisar
// antes de confiar en ella. Se muestran en el panel, no bloquean el guardado.
export function configWarnings(c: ManagerConfig, lang: 'es' | 'en' = 'es'): string[] {
  const w: string[] = [];
  const es = lang === 'es';

  if (c.plan.on && !c.plan.windows.some((x: any) => x.on)) {
    w.push(es ? 'Tienes el plan de trading encendido pero ninguna franja horaria activa: no podrás operar en ningún momento.'
              : 'Your trading plan is on but no time window is active: you would never be allowed to trade.');
  }
  if (c.limits.on && !c.limits.daily_loss && !c.limits.total_loss && !c.limits.max_lots && !c.limits.max_open) {
    w.push(es ? 'Los límites están encendidos pero todos valen cero, así que no limitan nada.'
              : 'Limits are on but all values are zero, so nothing is actually limited.');
  }
  if (c.limits.on && c.limits.daily_loss_pct && c.limits.daily_loss > 10) {
    w.push(es ? 'Una pérdida diaria de más del 10% es muy alta para la mayoría de reglas de fondeo.'
              : 'A daily loss above 10% is very high for most funded-account rules.');
  }
  if (c.limits.on && c.limits.total_loss && c.limits.daily_loss && c.limits.daily_loss_pct === c.limits.total_loss_pct
      && Number(c.limits.daily_loss) > Number(c.limits.total_loss)) {
    w.push(es ? 'Tu pérdida diaria es mayor que la total: la total saltaría antes y la diaria no serviría de nada.'
              : 'Your daily loss is bigger than the total one: the total would trigger first and the daily one would never apply.');
  }
  if (c.plan.on && c.plan.rigidity === 'soft') {
    w.push(es ? 'En modo "solo avisar" el gestor no impide nada: te avisa y tú decides.'
              : 'In "warn only" mode the manager blocks nothing: it warns you and you decide.');
  }
  if (c.news.on) {
    w.push(es ? 'El calendario de noticias viene de un proveedor externo. Puede fallar o cambiar una hora sin avisar; no lo uses como única protección.'
              : 'The news calendar comes from an external provider. It can fail or shift a time without notice; do not rely on it alone.');
  }
  if (c.trailing.on && c.breakeven.on && c.trailing.start < c.breakeven.trigger) {
    w.push(es ? 'El trailing arranca antes que el break even, así que el break even casi nunca llegará a aplicarse.'
              : 'Trailing starts before break even, so break even will rarely ever apply.');
  }
  return w;
}

// Lee la configuración de una cuenta, o devuelve la de por defecto
export async function getConfig(accountId: string) {
  const { data } = await supabaseAdmin.from('manager_configs').select('*').eq('account_id', accountId).maybeSingle();
  return {
    enabled: !!data?.enabled,
    units: (data?.units || 'pips') as Units,
    version: Number(data?.version || 0),
    config: mergeConfig(data?.config),
  };
}

// ============================================================
// Lo que se le manda al EA: solo lo encendido y ya recortado.
// El EA es tonto a propósito: no decide nada, solo aplica lo que le llega.
// ============================================================
export function forEA(row: any, caps: any) {
  if (!row?.enabled) return null;
  const c = mergeConfig(row.config);
  const advanced = !!caps?.manager_advanced;

  return {
    version: Number(row.version || 1),
    units: row.units || 'pips',
    breakeven: c.breakeven.on ? c.breakeven : { on: false },
    trailing: c.trailing.on ? c.trailing : { on: false },
    // los TP parciales son del plan avanzado
    partials: advanced && c.partials.on ? c.partials.levels.filter((l: any) => l.on && l.close > 0) : [],
    // fase 2 · disciplina y límites (el plan avanzado añade noticias)
    plan: c.plan.on ? {
      on: true,
      days: c.plan.days,
      windows: c.plan.windows.filter((w: any) => w.on),
      weekend_close: c.plan.weekend_close.on ? c.plan.weekend_close : { on: false },
      max_trades_day: c.plan.max_trades_day,
      cooldown_min: c.plan.cooldown_min,
      tilt: c.plan.tilt.on ? c.plan.tilt : { on: false },
      rigidity: c.plan.rigidity,
      friction_min: c.plan.friction_min,
    } : { on: false },
    limits: c.limits.on ? c.limits : { on: false },
    news: advanced && c.news.on ? c.news : { on: false },
  };
}

// ============================================================
// Indicador de disciplina.
// Mide cuántas veces el gestor tuvo que frenarte y cuántas te lo saltaste.
// No es una nota moral: es un espejo. 100 = no hizo falta intervenir.
// ============================================================
export type Discipline = {
  score: number;
  days: number;
  interventions: number;
  overrides: number;
  blocked: number;
  saved: number;
  byKind: Record<string, number>;
};

export async function discipline(userId: string, accountId: string | null, days = 30): Promise<Discipline> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  let q = supabaseAdmin.from('manager_events').select('kind,created_at').eq('user_id', userId).gte('created_at', since);
  if (accountId) q = q.eq('account_id', accountId);
  const { data } = await q;

  const rows = data || [];
  const byKind: Record<string, number> = {};
  rows.forEach((r: any) => { byKind[r.kind] = (byKind[r.kind] || 0) + 1; });

  // "blocked" = te paró · "override" = pediste saltarte la regla y lo hiciste
  const blocked = byKind['blocked'] || 0;
  const overrides = byKind['override'] || 0;
  const saved = (byKind['breakeven'] || 0) + (byKind['partial'] || 0) + (byKind['trailing'] || 0);
  const interventions = blocked + overrides;

  // Cada bloqueo respetado suma, cada salto resta el doble.
  let score = 100;
  if (interventions > 0) score = Math.round(100 * (blocked / (blocked + overrides * 2 || 1)));
  if (interventions === 0) score = 100;

  return { score: Math.max(0, Math.min(100, score)), days, interventions, overrides, blocked, saved, byKind };
}
