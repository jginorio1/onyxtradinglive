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
  ip?: string | null;              // IP desde donde entró (se contabiliza desde que se active)
  city?: string | null;            // ciudad (cabecera de Vercel)
  meta?: any;
};

const HOUR = 3600 * 1000;
const MIN = 60 * 1000;

// Registra un evento de actividad. NUNCA lanza (no debe tumbar la petición real).
export async function logActivity(r: ActivityRow): Promise<void> {
  try {
    const row: any = {
      actor_id: r.actor_id || null,
      actor_email: (r.actor_email || '').toLowerCase() || null,
      actor_name: r.actor_name || null,
      actor_role: r.actor_role || null,
      kind: String(r.kind || 'event').slice(0, 40),
      path: r.path ? String(r.path).split('?')[0].slice(0, 200) : null,
      label: r.label ? String(r.label).slice(0, 200) : null,
      country: r.country ? String(r.country).slice(0, 4) : null,
    };
    if (r.ip) row.ip = String(r.ip).slice(0, 60);
    if (r.city) row.city = String(r.city).slice(0, 60);
    row.meta = r.meta || {};
    // Si las columnas ip/city aún no existen, reintenta sin ellas (no pierde el evento).
    const { error } = await supabaseAdmin.from('activity_events').insert(row);
    if (error && (r.ip || r.city)) { delete row.ip; delete row.city; await supabaseAdmin.from('activity_events').insert(row); }
  } catch { /* silencioso */ }
}

// Nombre legible de la sección de la app a partir de la ruta (con o sin ?view=).
// Sirve para decir "en qué parte está" el usuario en el panel admin.
export function sectionLabel(full: string, lang: 'es' | 'en' = 'es'): string {
  const en = lang === 'en';
  const [p, q = ''] = String(full || '/').split('?');
  const view = new URLSearchParams(q).get('view') || '';
  const VIEW: Record<string, [string, string]> = {
    plan: ['Mi plan y hábitos', 'My plan & habits'], copy: ['Onyx Copy', 'Onyx Copy'],
    robots: ['Mis robots', 'My robots'], reto: ['Mi reto', 'My challenge'],
    neto: ['Ganancia neta', 'Net profit'], journal: ['Diario', 'Journal'],
    coach: ['Onyx AI (coach)', 'Onyx AI (coach)'], manager: ['Gestor', 'Manager'],
  };
  if (/^\/dashboard/.test(p) && VIEW[view]) return en ? VIEW[view][1] : VIEW[view][0];
  const R: Record<string, [string, string]> = {
    '/dashboard': ['Dashboard', 'Dashboard'], '/': ['Inicio', 'Home'],
    '/conectar': ['Conectar cuenta', 'Connect account'], '/academy': ['Academia', 'Academy'],
    '/bot-lab': ['Bot Lab', 'Bot Lab'], '/copy': ['Onyx Copy', 'Onyx Copy'],
    '/pricing': ['Precios', 'Pricing'], '/soporte': ['Soporte', 'Support'],
    '/contacto': ['Contacto', 'Contact'], '/como-usar': ['Guías', 'Guides'],
    '/account': ['Mi cuenta', 'My account'], '/mi-cuenta': ['Mi cuenta', 'My account'],
  };
  for (const k of Object.keys(R)) { if (p === k || p.startsWith(k + '/')) return en ? R[k][1] : R[k][0]; }
  return p.replace(/^\//, '').split('/')[0] || (en ? 'App' : 'App');
}

// PRESENCIA de UN usuario: ¿está en línea?, ¿en qué sección?, última vez, IP/ciudad.
// "En línea" = tuvo actividad en los últimos ~3 minutos.
export async function userPresence(userId: string, lang: 'es' | 'en' = 'es') {
  try {
    const { data } = await supabaseAdmin.from('activity_events')
      .select('path,label,created_at,ip,city,country')
      .eq('actor_id', userId).order('created_at', { ascending: false }).limit(1);
    const last: any = (data || [])[0];
    if (!last) return { online: false, lastSeen: null, section: null, ip: null, city: null, country: null };
    const online = Date.now() - new Date(last.created_at).getTime() < 3 * MIN;
    const section = last.label || sectionLabel(last.path || '/', lang);
    return { online, lastSeen: last.created_at, section, ip: last.ip || null, city: last.city || null, country: last.country || null };
  } catch { return { online: false, lastSeen: null, section: null, ip: null, city: null, country: null }; }
}

// PRESENCIA de VARIOS usuarios a la vez (para la lista). Una sola lectura del
// historial reciente; se queda con el evento más nuevo de cada usuario.
export async function presenceFor(userIds: string[], lang: 'es' | 'en' = 'es') {
  const out: Record<string, any> = {};
  if (!userIds.length) return out;
  try {
    const since = new Date(Date.now() - 30 * 24 * HOUR).toISOString();
    const { data } = await supabaseAdmin.from('activity_events')
      .select('actor_id,path,label,created_at,ip,city,country')
      .in('actor_id', userIds).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(5000);
    for (const r of (data || []) as any[]) {
      if (!r.actor_id || out[r.actor_id]) continue;   // ya tenemos el más nuevo
      out[r.actor_id] = {
        online: Date.now() - new Date(r.created_at).getTime() < 3 * MIN,
        lastSeen: r.created_at,
        section: r.label || sectionLabel(r.path || '/', lang),
        ip: r.ip || null, city: r.city || null, country: r.country || null,
      };
    }
  } catch {}
  return out;
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

// Tablero de EMPLEADOS (Fase 2): cruza el equipo (profiles admin/rol) con su
// actividad del día (activity_events) y sus acciones de backend (admin_log).
// Marca activo/inactivo según cuándo se le vio por última vez.
export async function employeeBoard(idleHours = 5) {
  const dayAgo = new Date(Date.now() - 24 * HOUR).toISOString();
  let team: any[] = [];
  try {
    const { data } = await supabaseAdmin.from('profiles').select('id,email,full_name,is_admin,role')
      .or('is_admin.eq.true,role.in.(support,marketing,admin,owner)').limit(200);
    team = data || [];
  } catch {}
  // Actividad y acciones del día (una sola lectura de cada tabla, se agrupa en memoria).
  const [actRes, logRes] = await Promise.all([
    supabaseAdmin.from('activity_events').select('actor_email,created_at').eq('actor_role', 'employee').gte('created_at', dayAgo).limit(5000),
    supabaseAdmin.from('admin_log').select('admin_email,created_at').gte('created_at', dayAgo).limit(5000),
  ]);
  const evByEmail: Record<string, { n: number; last: string }> = {};
  (actRes.data || []).forEach((r: any) => { const e = (r.actor_email || '').toLowerCase(); if (!e) return; const cur = evByEmail[e] || { n: 0, last: r.created_at }; cur.n++; if (r.created_at > cur.last) cur.last = r.created_at; evByEmail[e] = cur; });
  const actByEmail: Record<string, number> = {};
  (logRes.data || []).forEach((r: any) => { const e = (r.admin_email || '').toLowerCase(); if (!e) return; actByEmail[e] = (actByEmail[e] || 0) + 1; });
  const idleCut = Date.now() - idleHours * HOUR;
  const rows = team.map((t: any) => {
    const email = (t.email || '').toLowerCase();
    const ev = evByEmail[email];
    const lastSeen = ev?.last || null;
    const active = !!lastSeen && new Date(lastSeen).getTime() >= idleCut;
    return { email, name: t.full_name || t.email, role: t.is_admin ? (t.role || 'admin') : (t.role || '—'), events: ev?.n || 0, actions: actByEmail[email] || 0, lastSeen, active };
  });
  rows.sort((a, b) => (b.lastSeen ? new Date(b.lastSeen).getTime() : 0) - (a.lastSeen ? new Date(a.lastSeen).getTime() : 0));
  return rows;
}

// Distribución por PAÍS (Fase 3). Agrupa la actividad reciente por país y cuenta
// eventos y usuarios únicos. Devuelve el top ordenado por usuarios.
export async function geoStats(hours = 24) {
  const since = new Date(Date.now() - hours * HOUR).toISOString();
  const { data } = await supabaseAdmin.from('activity_events').select('country,actor_email')
    .gte('created_at', since).not('country', 'is', null).limit(8000);
  const byC: Record<string, { events: number; users: Set<string> }> = {};
  (data || []).forEach((r: any) => {
    const c = (r.country || '').toUpperCase(); if (!c) return;
    const cur = byC[c] || { events: 0, users: new Set<string>() };
    cur.events++; if (r.actor_email) cur.users.add(r.actor_email);
    byC[c] = cur;
  });
  const rows = Object.entries(byC).map(([country, v]) => ({ country, events: v.events, users: v.users.size }));
  rows.sort((a, b) => b.users - a.users || b.events - a.events);
  return rows.slice(0, 15);
}

// Embudo de conversión EN VIVO (Fase 3). Cuenta usuarios únicos que llegaron a
// cada pantalla clave en la ventana dada. Aproximación honesta por navegación.
export async function funnelStats(hours = 24) {
  const since = new Date(Date.now() - hours * HOUR).toISOString();
  const { data } = await supabaseAdmin.from('activity_events').select('actor_email,path,kind')
    .gte('created_at', since).limit(12000);
  const steps: { key: string; label: string; test: (p: string, k: string) => boolean }[] = [
    { key: 'visit', label: 'Entró a la app', test: (p) => /^\/(dashboard|$|en$)/.test(p) || p === '/' },
    { key: 'pricing', label: 'Vio precios', test: (p) => /^\/pricing/.test(p) },
    { key: 'checkout', label: 'Abrió checkout', test: (p) => /checkout|stripe|account\/billing|\/pay/i.test(p) },
    { key: 'purchase', label: 'Compró', test: (_p, k) => k === 'purchase' },
  ];
  const sets = steps.map(() => new Set<string>());
  (data || []).forEach((r: any) => {
    const who = r.actor_email || ''; if (!who) return;
    steps.forEach((s, i) => { if (s.test(r.path || '', r.kind || '')) sets[i].add(who); });
  });
  const base = sets[0].size || 1;
  return steps.map((s, i) => ({ key: s.key, label: s.label, users: sets[i].size, pct: Math.round((sets[i].size / base) * 100) }));
}

// Retención: borra el detalle fino más viejo que `days`. Lo llama un cron diario.
export async function pruneActivity(days = 90): Promise<number> {
  const cut = new Date(Date.now() - days * 24 * HOUR).toISOString();
  try {
    const { count } = await supabaseAdmin.from('activity_events').delete({ count: 'exact' }).lt('created_at', cut);
    return count || 0;
  } catch { return 0; }
}
