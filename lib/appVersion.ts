import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Versión de la app con 3 canales: Stable ← Production ← Beta.
//  · production = lo que ve todo el mundo (sale en el footer)
//  · beta       = lo que prueban los testers
//  · stable     = la última versión buena (respaldo / rollback)
export type VersionLog = {
  at: string;
  action: 'promote' | 'rollback' | 'edit';
  from: string;
  to: string;
  by: string;      // email de quién lo hizo
  note: string;    // notas del cambio
};

export type AppVersion = {
  stable: string;
  production: string;
  beta: string;
  notes: Record<string, string>;   // changelog por versión: { "1.1": "…" }
  log: VersionLog[];               // historial detallado y automático
};

const DEFAULT_VERSION: AppVersion = {
  stable: '', production: '1.0', beta: '1.1', notes: {}, log: [],
};

export async function appVersion(): Promise<AppVersion> {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'app_version').maybeSingle();
    return { ...DEFAULT_VERSION, ...(data?.value || {}) };
  } catch { return DEFAULT_VERSION; }
}

async function save(v: AppVersion) {
  await supabaseAdmin.from('app_settings').upsert({ key: 'app_version', value: v, updated_at: new Date().toISOString() });
}

const pushLog = (v: AppVersion, e: Omit<VersionLog, 'at'>): VersionLog[] =>
  [{ at: new Date().toISOString(), ...e }, ...(v.log || [])].slice(0, 60);

// Sube el número menor: 1.1 → 1.2 (mantiene el mayor). Si es raro, añade ".1".
function bump(ver: string): string {
  const m = String(ver || '1.0').match(/^(\d+)\.(\d+)/);
  if (!m) return (ver || '1.0') + '.1';
  return `${m[1]}.${Number(m[2]) + 1}`;
}

// Promover: production→stable, beta→production, y nueva beta = bump(beta).
export async function promote(by: string, note: string): Promise<AppVersion> {
  const v = await appVersion();
  const next: AppVersion = {
    stable: v.production,
    production: v.beta,
    beta: bump(v.beta),
    notes: v.notes,
    log: pushLog(v, { action: 'promote', from: v.production, to: v.beta, by, note }),
  };
  await save(next);
  return next;
}

// Rollback: Production vuelve a la versión Stable (la buena). La beta no cambia.
export async function rollback(by: string, note: string): Promise<AppVersion> {
  const v = await appVersion();
  if (!v.stable) return v;   // no hay respaldo al que volver
  const next: AppVersion = {
    ...v,
    production: v.stable,
    log: pushLog(v, { action: 'rollback', from: v.production, to: v.stable, by, note }),
  };
  await save(next);
  return next;
}

// Editar a mano (número de beta o notas). Se registra en el log como 'edit'.
export async function setVersion(patch: Partial<AppVersion>, by: string): Promise<AppVersion> {
  const v = await appVersion();
  const changedBeta = typeof patch.beta === 'string' && patch.beta !== v.beta;
  const next: AppVersion = { ...v, ...patch, notes: { ...v.notes, ...(patch.notes || {}) } };
  if (changedBeta) next.log = pushLog(v, { action: 'edit', from: v.beta, to: patch.beta as string, by, note: 'editó la versión Beta' });
  await save(next);
  return next;
}
