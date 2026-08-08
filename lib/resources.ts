import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { aiSpend } from '@/lib/aiCost';

// ============================================================
// Panel de Recursos · lo que la app puede medir por sí misma (sin tokens):
// tamaño de la base de datos y de cada tabla, almacenamiento (Storage), conexiones,
// latencia de la BD, errores recientes, gasto/uso de IA y usuarios.
// Los medidores de infraestructura en vivo (CPU/RAM/ancho de banda) viven en
// Vercel y Supabase: enlazamos a sus paneles (deepLinks) donde salen exactos.
// ============================================================

export type ResourceStats = {
  db: { bytes: number; connections: number; tables: { name: string; bytes: number }[] };
  storage: { totalBytes: number; buckets: { name: string; bytes: number; objects: number }[] };
  latency: { dbMs: number };
  errors: { last24h: number; last7d: number };
  ai: { monthCents: number; calls: number; tokens: number };
  users: { total: number; new24h: number; new7d: number };
  // Costo de operación del mes (lo que nos cuesta): infra fija (recurrentes de
  // categoría 'infra' en Finanzas) + IA. Comisiones de Stripe y pagos a afiliados
  // se ven completos en Finanzas (P&L) para no recalcular ingresos aquí.
  costs: { infraFixed: number; aiMonth: number; total: number; items: { name: string; vendor: string | null; monthly: number }[] };
  deepLinks: {
    vercelUsage: string; vercelObservability: string; vercelBilling: string;
    supabaseReports: string; supabaseDatabase: string; supabaseBilling: string;
  };
  meta: { at: number };
};

async function count(table: string, sinceIso?: string): Promise<number> {
  try {
    let q: any = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
    if (sinceIso) q = q.gte('created_at', sinceIso);
    const { count } = await q;
    return Number(count || 0);
  } catch { return 0; }
}

// Ref del proyecto Supabase a partir de la URL (https://<ref>.supabase.co).
function supabaseRef(): string {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const m = u.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
    return m ? m[1] : '';
  } catch { return ''; }
}

export async function resourceStats(): Promise<ResourceStats> {
  const now = Date.now();
  const d1 = new Date(now - 24 * 3600e3).toISOString();
  const d7 = new Date(now - 7 * 24 * 3600e3).toISOString();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).getTime();

  // 1) BD + Storage (RPC) — también sirve para medir la latencia del round-trip.
  let db = { bytes: 0, connections: 0, tables: [] as { name: string; bytes: number }[] };
  let storage = { totalBytes: 0, buckets: [] as { name: string; bytes: number; objects: number }[] };
  let dbMs = 0;
  try {
    const t0 = Date.now();
    const { data } = await supabaseAdmin.rpc('onyx_resource_stats');
    dbMs = Date.now() - t0;
    const j: any = data || {};
    db = {
      bytes: Number(j.db_bytes || 0),
      connections: Number(j.connections || 0),
      tables: Array.isArray(j.tables) ? j.tables.map((t: any) => ({ name: String(t.name), bytes: Number(t.bytes || 0) })) : [],
    };
    const bs = Array.isArray(j.buckets) ? j.buckets.map((b: any) => ({ name: String(b.name), bytes: Number(b.bytes || 0), objects: Number(b.objects || 0) })) : [];
    storage = { totalBytes: bs.reduce((s: number, b: any) => s + b.bytes, 0), buckets: bs };
  } catch { /* la función SQL puede no estar creada aún */ }

  // 2) Errores, IA y usuarios (en paralelo).
  const [err24, err7, ai, uTotal, uNew24, uNew7] = await Promise.all([
    count('app_errors', d1),
    count('app_errors', d7),
    aiSpend(monthStart, now).catch(() => ({ totalCents: 0, calls: 0, tokens: 0 } as any)),
    count('profiles'),
    count('profiles', d1),
    count('profiles', d7),
  ]);

  // Costo de infraestructura fija del mes: recurrentes activos de categoría 'infra'
  // (Vercel, Supabase, dominio, Resend…) que el dueño registra en Finanzas. Se
  // prorratea el anual entre 12 y se respeta la ventana de fechas.
  const aiMonth = Number((ai as any).totalCents || 0) / 100;
  let infraFixed = 0; let items: { name: string; vendor: string | null; monthly: number }[] = [];
  try {
    const { data: exp } = await supabaseAdmin.from('onyx_expenses')
      .select('name,vendor,amount,interval,kind,category,active,incurred_on,ends_on')
      .eq('category', 'infra').eq('kind', 'recurring').eq('active', true);
    const asDate = (s: string) => new Date(String(s) + 'T00:00:00Z').getTime();
    for (const e of (exp || []) as any[]) {
      const start = asDate(e.incurred_on);
      const end = e.ends_on ? asDate(e.ends_on) : Infinity;
      if (!(start <= now && end >= now)) continue;
      const monthly = e.interval === 'yearly' ? Number(e.amount || 0) / 12 : Number(e.amount || 0);
      infraFixed += monthly;
      items.push({ name: String(e.name || 'Infra'), vendor: e.vendor || null, monthly: Math.round(monthly * 100) / 100 });
    }
  } catch { /* si no existe la tabla, infra queda en 0 */ }
  items.sort((a, b) => b.monthly - a.monthly);
  const total = Math.round((infraFixed + aiMonth) * 100) / 100;

  const ref = supabaseRef();
  return {
    db,
    storage,
    latency: { dbMs },
    errors: { last24h: err24, last7d: err7 },
    ai: { monthCents: Number((ai as any).totalCents || 0), calls: Number((ai as any).calls || 0), tokens: Number((ai as any).tokens || 0) },
    users: { total: uTotal, new24h: uNew24, new7d: uNew7 },
    costs: { infraFixed: Math.round(infraFixed * 100) / 100, aiMonth: Math.round(aiMonth * 100) / 100, total, items },
    deepLinks: {
      vercelUsage: 'https://vercel.com/dashboard/usage',
      vercelObservability: 'https://vercel.com/dashboard/observability',
      vercelBilling: 'https://vercel.com/dashboard/settings/billing',
      supabaseReports: ref ? `https://supabase.com/dashboard/project/${ref}/reports/database` : 'https://supabase.com/dashboard/project/_/reports/database',
      supabaseDatabase: ref ? `https://supabase.com/dashboard/project/${ref}/database/tables` : 'https://supabase.com/dashboard/project/_/database/tables',
      supabaseBilling: ref ? `https://supabase.com/dashboard/project/${ref}/settings/billing` : 'https://supabase.com/dashboard/project/_/settings/billing',
    },
    meta: { at: now },
  };
}
