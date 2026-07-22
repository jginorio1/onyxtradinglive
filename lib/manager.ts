import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Units = 'pips' | 'r' | 'money';

// Configuración por defecto de un gestor nuevo.
// Todo apagado: nunca tocamos las operaciones de nadie sin que lo pida.
export const DEFAULT_CONFIG = {
  breakeven: {
    on: false,
    trigger: 15,        // cuánto tiene que ganar antes de mover el stop
    mode: 'above',      // below | at | above  (dónde queda el stop respecto a la entrada)
    offset: 2,          // colchón extra
    cover_costs: true,  // sumar comisión y swap para que el BE sea real
  },
  trailing: {
    on: false,
    type: 'fixed',      // fixed | highlow | ma | atr  (fase 1 solo fixed)
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
};

export type ManagerConfig = typeof DEFAULT_CONFIG;

// Une lo guardado con los valores por defecto, para que nunca falte una clave
export function mergeConfig(saved: any): ManagerConfig {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    breakeven: { ...DEFAULT_CONFIG.breakeven, ...(s.breakeven || {}) },
    trailing: { ...DEFAULT_CONFIG.trailing, ...(s.trailing || {}) },
    partials: {
      ...DEFAULT_CONFIG.partials,
      ...(s.partials || {}),
      levels: Array.isArray(s.partials?.levels) && s.partials.levels.length
        ? s.partials.levels.slice(0, 4).map((l: any, i: number) => ({ ...DEFAULT_CONFIG.partials.levels[i], ...l }))
        : DEFAULT_CONFIG.partials.levels,
    },
  };
}

// Limpia lo que llega del navegador: números en rango y nada raro
export function sanitize(input: any): ManagerConfig {
  const c = mergeConfig(input);
  const num = (v: any, min: number, max: number, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };

  c.breakeven.on = !!c.breakeven.on;
  c.breakeven.trigger = num(c.breakeven.trigger, 0, 100000, 15);
  c.breakeven.mode = ['below', 'at', 'above'].includes(c.breakeven.mode) ? c.breakeven.mode : 'above';
  c.breakeven.offset = num(c.breakeven.offset, 0, 100000, 2);
  c.breakeven.cover_costs = !!c.breakeven.cover_costs;

  c.trailing.on = !!c.trailing.on;
  c.trailing.type = ['fixed', 'highlow', 'ma', 'atr'].includes(c.trailing.type) ? c.trailing.type : 'fixed';
  c.trailing.distance = num(c.trailing.distance, 1, 100000, 20);
  c.trailing.start = num(c.trailing.start, 0, 100000, 20);

  c.partials.on = !!c.partials.on;
  c.partials.levels = c.partials.levels.slice(0, 4).map((l: any) => ({
    at: num(l.at, 0, 100000, 20),
    close: num(l.close, 0, 100, 0),
    on: !!l.on,
  }));

  return c;
}

// Suma de porcentajes de los TP parciales activos (debe quedar en 100 o menos)
export function partialsTotal(c: ManagerConfig) {
  return c.partials.levels.filter((l: any) => l.on).reduce((t: number, l: any) => t + Number(l.close || 0), 0);
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

// Lo que se le manda al EA: solo lo encendido y ya recortado
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
  };
}
