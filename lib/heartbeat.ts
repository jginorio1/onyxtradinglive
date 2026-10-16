import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// LATIDOS DEL SISTEMA (heartbeats)
// Marca cuándo corrió/recibió algo un proceso que queremos vigilar (ej. el
// webhook de Stripe). Tolerante: si la tabla no existe aún, no rompe nada.
// Se muestra con fecha y hora en Pagos → Revisión / integridad → Automatismos.
// ============================================================

export type Heartbeat = { name: string; last_at: string; meta: any; hits: number };

// Marca un latido. Nunca lanza (no debe romper el flujo que lo llama).
export async function touchHeartbeat(name: string, meta?: any): Promise<void> {
  try {
    // Lee el contador actual para incrementarlo (volúmenes bajos, 1 fila).
    const { data } = await supabaseAdmin.from('system_heartbeats').select('hits').eq('name', name).maybeSingle();
    const hits = (Number((data as any)?.hits) || 0) + 1;
    await supabaseAdmin.from('system_heartbeats').upsert(
      { name, last_at: new Date().toISOString(), meta: meta ?? null, hits },
      { onConflict: 'name' }
    );
  } catch { /* la tabla puede no existir todavía; no rompemos el flujo */ }
}

// Lee uno o varios latidos (para la pantalla de Revisión).
export async function getHeartbeats(names?: string[]): Promise<Record<string, Heartbeat>> {
  const out: Record<string, Heartbeat> = {};
  try {
    let q = supabaseAdmin.from('system_heartbeats').select('name,last_at,meta,hits');
    if (names && names.length) q = q.in('name', names);
    const { data } = await q.limit(100);
    for (const h of (data || []) as any[]) out[h.name] = h as Heartbeat;
  } catch { /* opcional */ }
  return out;
}
