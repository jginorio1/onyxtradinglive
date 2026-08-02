import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Versión de la app con 3 canales: Stable ← Production ← Beta.
//  · production = lo que ve todo el mundo (sale en el footer)
//  · beta       = lo que prueban los testers
//  · stable     = la última versión buena (respaldo / rollback)
// Al "promover" Beta → Production, todo sube un escalón y se abre una Beta nueva.
export type AppVersion = {
  stable: string;
  production: string;
  beta: string;
  notes: Record<string, string>;   // changelog por versión: { "1.1": "…" }
  history: { at: string; production: string; beta: string }[];
};

const DEFAULT_VERSION: AppVersion = {
  stable: '', production: '1.0', beta: '1.1', notes: {}, history: [],
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

// Sube el número menor: 1.1 → 1.2 (mantiene el mayor). Si es raro, añade ".1".
function bump(ver: string): string {
  const m = String(ver || '1.0').match(/^(\d+)\.(\d+)/);
  if (!m) return (ver || '1.0') + '.1';
  return `${m[1]}.${Number(m[2]) + 1}`;
}

// Promover: production→stable, beta→production, y nueva beta = bump(beta).
export async function promote(): Promise<AppVersion> {
  const v = await appVersion();
  const next: AppVersion = {
    stable: v.production,
    production: v.beta,
    beta: bump(v.beta),
    notes: v.notes,
    history: [{ at: new Date().toISOString(), production: v.beta, beta: bump(v.beta) }, ...(v.history || [])].slice(0, 30),
  };
  await save(next);
  return next;
}

// Editar a mano (números o notas de la beta).
export async function setVersion(patch: Partial<AppVersion>): Promise<AppVersion> {
  const v = await appVersion();
  const next = { ...v, ...patch, notes: { ...v.notes, ...(patch.notes || {}) } };
  await save(next);
  return next;
}
