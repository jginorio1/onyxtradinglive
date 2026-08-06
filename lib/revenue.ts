import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Normaliza un importe a mensual (para el MRR).
function monthly(amount: number, interval: string, count = 1): number {
  const per = amount * count;
  if (interval === 'year') return per / 12;
  if (interval === 'week') return (per * 52) / 12;
  if (interval === 'day') return (per * 365) / 12;
  return per;
}
const money = (cents: number) => Math.round(cents) / 100;

export type RevenueData = {
  configured: boolean; error?: string; currency: string;
  from: string; to: string;
  mrr: number; arr: number; activeSubs: number; arpu: number;
  collected: number; collectedPrev: number; collectedDelta: number | null;
  newSubs: number; canceledSubs: number; failed: number; churnPct: number;
  moveNew: number; moveLost: number; moveNet: number;
  plans: { name: string; subs: number; mrr: number; pct: number }[];
  monthly: { label: string; total: number }[];
  recent: { at: number; amount: number; email: string; ok: boolean }[];
  coupons: { code: string; percent: number | null; redeemed: number; active: boolean; source: string }[];
};

// Mapa priceId → nombre de plan, leído de la tabla plans.
async function planMap(es = true): Promise<Record<string, string>> {
  const m: Record<string, string> = {};
  try {
    const { data } = await supabaseAdmin.from('plans').select('name,name_en,stripe_price_id,stripe_price_id_year');
    for (const p of data || []) {
      const label = (es ? p.name : (p.name_en || p.name)) || 'Plan';
      if (p.stripe_price_id) m[p.stripe_price_id] = label;
      if (p.stripe_price_id_year) m[p.stripe_price_id_year] = label;
    }
  } catch {}
  return m;
}

export async function computeRevenue(fromMs: number, toMs: number, es = true): Promise<RevenueData> {
  const empty = (extra: Partial<RevenueData> = {}): RevenueData => ({
    configured: true, currency: 'usd', from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(),
    mrr: 0, arr: 0, activeSubs: 0, arpu: 0, collected: 0, collectedPrev: 0, collectedDelta: null,
    newSubs: 0, canceledSubs: 0, failed: 0, churnPct: 0, moveNew: 0, moveLost: 0, moveNet: 0,
    plans: [], monthly: [], recent: [], coupons: [], ...extra,
  });
  if (!process.env.STRIPE_SECRET_KEY) return { ...empty(), configured: false };

  const fromS = Math.floor(fromMs / 1000), toS = Math.floor(toMs / 1000);
  const span = Math.max(1, toS - fromS);
  const prevFromS = fromS - span, prevToS = fromS;
  let currency = 'usd';

  try {
    const pm = await planMap(es);

    // Suscripciones activas → MRR + desglose por plan
    let mrrCents = 0, activeSubs = 0;
    const byPlan: Record<string, { subs: number; mrr: number }> = {};
    for await (const s of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
      activeSubs++;
      let name = 'Otro';
      const first: any = s.items.data[0]?.price;
      if (first?.id && pm[first.id]) name = pm[first.id];
      else if (first?.nickname) name = first.nickname;
      let subMrr = 0;
      for (const it of s.items.data) {
        const p: any = it.price;
        if (p?.unit_amount && p?.recurring?.interval) { subMrr += monthly(p.unit_amount, p.recurring.interval, it.quantity || 1); currency = p.currency || currency; }
      }
      mrrCents += subMrr;
      byPlan[name] = byPlan[name] || { subs: 0, mrr: 0 };
      byPlan[name].subs++; byPlan[name].mrr += subMrr;
    }

    // Altas en el rango (cualquier estado) → nuevas + MRR nuevo
    let newSubs = 0, newMrrCents = 0;
    for await (const s of (stripe.subscriptions.list({ status: 'all', created: { gte: fromS, lte: toS }, limit: 100 }) as any)) {
      newSubs++;
      for (const it of s.items.data) { const p: any = it.price; if (p?.unit_amount && p?.recurring?.interval) newMrrCents += monthly(p.unit_amount, p.recurring.interval, it.quantity || 1); }
    }

    // Cancelaciones en el rango → perdidas + MRR perdido
    let canceledSubs = 0, lostMrrCents = 0, seen = 0;
    for await (const s of stripe.subscriptions.list({ status: 'canceled', limit: 100 })) {
      if (++seen > 400) break;
      const ca = s.canceled_at || 0;
      if (ca >= fromS && ca <= toS) {
        canceledSubs++;
        for (const it of s.items.data) { const p: any = it.price; if (p?.unit_amount && p?.recurring?.interval) lostMrrCents += monthly(p.unit_amount, p.recurring.interval, it.quantity || 1); }
      }
    }

    // Cobros: rango, período anterior, fallidos, últimos 6 meses, recientes
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - 182 * 86400;
    const startFetch = Math.min(prevFromS, sixMonthsAgo, fromS);
    let collected = 0, collectedPrev = 0, failed = 0, charges = 0;
    const buckets: Record<string, number> = {};
    const recent: RevenueData['recent'] = [];
    for await (const c of stripe.charges.list({ limit: 100, created: { gte: startFetch } })) {
      if (++charges > 3000) break;
      currency = c.currency || currency;
      const t = c.created;
      const paid = c.paid && c.status === 'succeeded';
      if (paid) {
        if (t >= fromS && t <= toS) collected += c.amount;
        if (t >= prevFromS && t < prevToS) collectedPrev += c.amount;
        const d = new Date(t * 1000);
        const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
        buckets[key] = (buckets[key] || 0) + c.amount;
      }
      if (c.status === 'failed' && t >= fromS && t <= toS) failed++;
      if (recent.length < 8 && t >= fromS && t <= toS) recent.push({ at: t, amount: money(c.amount), email: c.billing_details?.email || c.receipt_email || '', ok: paid });
    }

    // Serie de 6 meses
    const monthsArr: { label: string; total: number }[] = [];
    const MON = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const nowD = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - i, 1));
      const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      monthsArr.push({ label: (es ? MON : MON_EN)[d.getUTCMonth()], total: money(buckets[key] || 0) });
    }

    const plans = Object.entries(byPlan)
      .map(([name, v]) => ({ name, subs: v.subs, mrr: money(v.mrr), pct: mrrCents ? Math.round((v.mrr / mrrCents) * 100) : 0 }))
      .sort((a, b) => b.mrr - a.mrr);

    const collectedDelta = collectedPrev > 0 ? Math.round(((collected - collectedPrev) / collectedPrev) * 100) : null;
    const churnPct = activeSubs + canceledSubs > 0 ? Math.round((canceledSubs / (activeSubs + canceledSubs)) * 1000) / 10 : 0;

    // Cupones: canjes de cada código promocional (barra "Onyx …" y embajador).
    const coupons: RevenueData['coupons'] = [];
    try {
      for await (const pc of (stripe.promotionCodes.list({ limit: 100 }) as any)) {
        const name = String(pc.coupon?.name || '');
        const source = name.startsWith('Onyx ') ? (es ? 'Barra' : 'Bar') : name.startsWith('Embajador') ? (es ? 'Embajador' : 'Ambassador') : (es ? 'Otro' : 'Other');
        coupons.push({ code: pc.code, percent: pc.coupon?.percent_off ?? null, redeemed: Number(pc.times_redeemed || 0), active: !!pc.active, source });
      }
    } catch { /* si falla, dejamos la lista vacía */ }
    coupons.sort((a, b) => b.redeemed - a.redeemed);

    return {
      configured: true, currency, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(),
      mrr: money(mrrCents), arr: money(mrrCents * 12), activeSubs, arpu: activeSubs ? money(mrrCents / activeSubs) : 0,
      collected: money(collected), collectedPrev: money(collectedPrev), collectedDelta,
      newSubs, canceledSubs, failed, churnPct,
      moveNew: money(newMrrCents), moveLost: money(lostMrrCents), moveNet: money(newMrrCents - lostMrrCents),
      plans, monthly: monthsArr, recent,
    };
  } catch (e: any) {
    return empty({ error: e?.message || 'Error al leer Stripe' });
  }
}
