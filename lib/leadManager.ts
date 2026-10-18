// ============================================================
// Lead Manager — de dónde vienen los CLIENTES registrados y cuánto ingreso
// aporta cada fuente. Alimenta el bloque "Lead manager" del tablero.
//   · Clientes por fuente  = altas de perfiles agrupadas por lead_source.
//   · Ingreso por fuente   = MRR de suscripciones Stripe activas, atribuido al
//                            lead_source del dueño de la cuenta (por customer id).
// Tolerante: si falta la columna lead_source (SQL sin correr) o Stripe no está
// configurado, devuelve lo que pueda sin romper.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type LeadManager = {
  days: number;
  totals: { customers: number; revenueMonthly: number; activeSubs: number; leading: string };
  bySourceCustomers: Array<{ key: string; count: number }>;
  bySourceRevenue: Array<{ key: string; amount: number }>;
  currency: string;
  revenueConfigured: boolean;
};

const money = (cents: number) => Math.round(cents) / 100;
function monthly(amount: number, interval: string, count = 1): number {
  const per = amount * count;
  if (interval === 'year') return per / 12;
  if (interval === 'week') return (per * 52) / 12;
  if (interval === 'day') return (per * 365) / 12;
  return per;
}
// Normaliza la fuente de un perfil. lead_source manda; si quedó vacío o
// "directo/web" lo dejamos como 'direct' (desconocido). No usamos signup_source
// (plataforma: web/ios/android) como canal.
function srcOf(p: any): string {
  const s = String(p?.lead_source || '').toLowerCase().trim();
  if (!s || s === 'web' || s === 'direct') return 'direct';
  return s;
}

export async function leadManagerStats(days = 30): Promise<LeadManager> {
  const out: LeadManager = {
    days, totals: { customers: 0, revenueMonthly: 0, activeSubs: 0, leading: '' },
    bySourceCustomers: [], bySourceRevenue: [], currency: 'usd', revenueConfigured: false,
  };
  const sinceMs = Date.now() - days * 86400000;

  // Perfiles. Tolerante: si lead_source no existe aún, caemos a un select básico.
  let rows: any[] = [];
  const full = await supabaseAdmin.from('profiles').select('id, lead_source, stripe_customer_id, created_at').limit(100000);
  if (!full.error && full.data) rows = full.data;
  else {
    const basic = await supabaseAdmin.from('profiles').select('id, stripe_customer_id, created_at').limit(100000);
    rows = basic.data || [];
  }

  // Clientes por fuente (altas dentro del rango).
  const cust: Record<string, number> = {};
  const custMap: Record<string, string> = {};   // stripe_customer_id → fuente (todos, para ingresos)
  for (const p of rows) {
    const s = srcOf(p);
    if (p.stripe_customer_id) custMap[String(p.stripe_customer_id)] = s;
    const t = p.created_at ? new Date(p.created_at).getTime() : 0;
    if (t >= sinceMs) { cust[s] = (cust[s] || 0) + 1; out.totals.customers++; }
  }
  out.bySourceCustomers = Object.entries(cust).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

  // Ingreso por fuente: MRR de suscripciones activas atribuido al dueño.
  const rev: Record<string, number> = {};   // en centavos
  if (process.env.STRIPE_SECRET_KEY) {
    out.revenueConfigured = true;
    try {
      const { stripe } = await import('@/lib/stripe');
      for await (const s of stripe.subscriptions.list({ status: 'active', limit: 100 }) as any) {
        out.totals.activeSubs++;
        const cid = typeof s.customer === 'string' ? s.customer : s.customer?.id;
        const src = (cid && custMap[cid]) || 'direct';
        let subMrr = 0;
        for (const it of s.items.data) {
          const p: any = it.price;
          if (p?.unit_amount && p?.recurring?.interval) { subMrr += monthly(p.unit_amount, p.recurring.interval, it.quantity || 1); out.currency = p.currency || out.currency; }
        }
        rev[src] = (rev[src] || 0) + subMrr;
      }
    } catch { /* Stripe falló: dejamos ingresos vacíos */ }
  }
  out.bySourceRevenue = Object.entries(rev).map(([key, cents]) => ({ key, amount: money(cents) })).sort((a, b) => b.amount - a.amount);
  out.totals.revenueMonthly = money(Object.values(rev).reduce((a, b) => a + b, 0));

  // Fuente líder: por ingreso si lo hay; si no, por número de clientes.
  out.totals.leading = out.bySourceRevenue[0]?.key || out.bySourceCustomers[0]?.key || '';
  return out;
}
