// ============================================================
// Onyx Command Center — motor de monitoreo/actividad.
//
// Dos capas:
//   · PRESENCIA (en vivo): quién está conectado y en qué pantalla AHORA. Es
//     efímera y NO pasa por aquí — vive en un canal Realtime de Supabase que el
//     beacon del cliente publica y el panel admin lee. No se guarda.
//   · HISTORIAL (auditoría): cada acción relevante (page, login, compra, ticket,
//     venta, EA caído…) se escribe en `activity_events`. Sirve para rebobinar
//     sesiones, reportes y alertas. Con retención (prune) para no crecer sin fin.
//
// Privacidad: guardamos ACCIONES (qué pantalla, qué evento), nunca contenido
// sensible ni cada tecla. Solo el service role (backend) escribe/lee la tabla.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ActivityRow = {
  actor_id?: string | null;
  actor_email?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;      // 'employee' | 'trader'
  kind: string;                    // page | login | connect | purchase | ticket | ea_down | sale | checkin | ...
  path?: string | null;
  label?: string | null;           // texto legible corto ("compró Guardian PRO")
  country?: string | null;
  meta?: any;
};

const HOUR = 3600 * 1000;

// Registra un evento de actividad. NUNCA lanza (no debe tumbar la petición real).
export async function logActivity(r: ActivityRow): Promise<void> {
  try {
    await supabaseAdmin.from('activity_events').insert({
      actor_id: r.actor_id || null,
      actor_email: (r.actor_email || '').toLowerCase() || null,
      actor_name: r.actor_name || null,
      actor_role: r.actor_role || null,
      kind: String(r.kind || 'event').slice(0, 40),
      path: r.path ? String(r.path).split('?')[0].slice(0, 200) : null,
      label: r.label ? String(r.label).slice(0, 200) : null,
      country: r.country ? String(r.country).slice(0, 4) : null,
      meta: r.meta || {},
    });
  } catch { /* silencioso */ }
}

// Feed reciente (para el flujo en vivo y el historial). Filtros opcionales.
export async function listEvents(opts: { hours?: number; actor?: string; kind?: string; role?: string; limit?: number } = {}) {
  const since = new Date(Date.now() - (opts.hours || 24) * HOUR).toISOString();
  let q = supabaseAdmin.from('activity_events')
    .select('id,actor_id,actor_email,actor_name,actor_role,kind,path,label,country,created_at')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(Math.min(opts.limit || 120, 500));
  if (opts.actor) q = q.or(`actor_email.ilike.%${opts.actor}%,actor_name.ilike.%${opts.actor}%`);
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.role) q = q.eq('actor_role', opts.role);
  const { data } = await q;
  return data || [];
}

// Rebobinar sesión: línea de tiempo de UN usuario (por id de auth o por email).
export async function userTimeline(who: string, hours = 72) {
  const since = new Date(Date.now() - hours * HOUR).toISOString();
  let q = supabaseAdmin.from('activity_events')
    .select('id,kind,path,label,country,created_at')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(300);
  q = /@/.test(who) ? q.eq('actor_email', who.toLowerCase()) : q.eq('actor_id', who);
  const { data } = await q;
  return data || [];
}

// KPIs del Command Center (los del HISTORIAL). El "en línea" real lo aporta la
// presencia en vivo desde el cliente, no esta función.
export async function monitorStats() {
  const dayAgo = new Date(Date.now() - 24 * HOUR).toISOString();
  const hourAgo = new Date(Date.now() - HOUR).toISOString();
  const [tRes, hRes, kRes, eRes] = await Promise.all([
    supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo),
    supabaseAdmin.from('activity_events').select('kind').gte('created_at', dayAgo).limit(3000),
    supabaseAdmin.from('activity_events').select('actor_email').eq('actor_role', 'employee').gte('created_at', dayAgo).limit(3000),
  ]);
  const byKind: Record<string, number> = {};
  (kRes.data || []).forEach((r: any) => { byKind[r.kind] = (byKind[r.kind] || 0) + 1; });
  const empActive = new Set((eRes.data || []).map((r: any) => r.actor_email).filter(Boolean)).size;
  return {
    eventsToday: tRes.count || 0,
    eventsLastHour: hRes.count || 0,
    perMin: Math.round((hRes.count || 0) / 60),
    byKind, empActive,
  };
}

// Retención: borra el detalle fino más viejo que `days`. Lo llama un cron diario.
export async function pruneActivity(days = 90): Promise<number> {
  const cut = new Date(Date.now() - days * 24 * HOUR).toISOString();
  try {
    const { count } = await supabaseAdmin.from('activity_events').delete({ count: 'exact' }).lt('created_at', cut);
    return count || 0;
  } catch { return 0; }
}
