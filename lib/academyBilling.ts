import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Facturación del ALUMNO en las academias que paga.
// Los cobros viven en la cuenta de Stripe CONECTADA del mentor (Stripe Connect),
// así que aquí consultamos Stripe con { stripeAccount } para traer el detalle
// real: importe, próximo cobro, estado, si se va a cancelar, y las facturas.
// Todo es de solo lectura excepto cancelar/reactivar y abrir el portal de Stripe.
// Fail-safe: si Stripe falla, mostramos lo guardado en la BD sin romper la vista.
// ============================================================

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';

type Item = {
  mentor_id: string; academy_name: string; academy_code: string | null;
  kind: 'membership' | 'subscription' | 'one_time';
  product_name: string;
  amount_cents: number | null; currency: string; interval: string | null;
  status: string;                 // active | past_due | canceled | trialing
  next_charge: string | null;     // ISO — próximo cobro (si sigue activa)
  expires: string | null;         // ISO — hasta cuándo tiene acceso (si canceló al final del periodo)
  cancel_at_period_end: boolean;
  started_at: string | null;
  can_manage: boolean;            // hay suscripción gestionable en Stripe
  invoices: { date: string; amount_cents: number; currency: string; status: string; url: string | null; pdf: string | null }[];
};

// Nombre de la academia + cuenta conectada del mentor.
async function mentorInfo(mentorId: string) {
  const { data } = await supabaseAdmin.from('mentors').select('academy_name,code,stripe_account_id').eq('user_id', mentorId).maybeSingle();
  return { name: (data as any)?.academy_name || 'Academia', code: (data as any)?.code || null, account: (data as any)?.stripe_account_id || null };
}

// Enriquecer un item con datos EN VIVO de Stripe (suscripción + facturas).
async function enrichFromStripe(base: Item, subId: string | null, account: string | null, sessionId?: string | null): Promise<Item> {
  if (!account) return base;
  try {
    if (subId) {
      const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] }, { stripeAccount: account });
      const price = sub.items?.data?.[0]?.price;
      base.amount_cents = price?.unit_amount ?? base.amount_cents;
      base.currency = (price?.currency || base.currency || 'usd');
      base.interval = price?.recurring?.interval || base.interval;
      base.status = sub.status || base.status;
      base.cancel_at_period_end = !!sub.cancel_at_period_end;
      const end = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      if (sub.cancel_at_period_end || sub.status === 'canceled') { base.expires = end; base.next_charge = null; }
      else { base.next_charge = end; base.expires = null; }
      base.started_at = sub.start_date ? new Date(sub.start_date * 1000).toISOString() : base.started_at;
      base.can_manage = true;
      // Facturas de esta suscripción (últimas 6).
      const inv: any = await stripe.invoices.list({ subscription: subId, limit: 6 }, { stripeAccount: account });
      base.invoices = (inv.data || []).map((i: any) => ({
        date: new Date((i.status_transitions?.paid_at || i.created) * 1000).toISOString(),
        amount_cents: i.amount_paid ?? i.amount_due ?? 0, currency: i.currency || base.currency,
        status: i.status || 'paid', url: i.hosted_invoice_url || null, pdf: i.invoice_pdf || null,
      }));
    } else if (sessionId) {
      // Pago único: importe desde la sesión de checkout.
      const s: any = await stripe.checkout.sessions.retrieve(sessionId, { stripeAccount: account });
      base.amount_cents = s.amount_total ?? base.amount_cents;
      base.currency = s.currency || base.currency;
    }
  } catch { /* fail-safe: dejamos lo de la BD */ }
  return base;
}

// Facturación de un alumno en TODAS sus academias (o filtrada por mentorId).
export async function studentBilling(studentId: string, onlyMentor?: string): Promise<Item[]> {
  // Membresías de comunidad.
  let mq = supabaseAdmin.from('academy_memberships').select('mentor_id,status,stripe_subscription_id,current_period_end,created_at').eq('student_id', studentId);
  if (onlyMentor) mq = mq.eq('mentor_id', onlyMentor);
  const { data: mems } = await mq;
  // Compras de niveles (suscripción o pago único).
  let pq = supabaseAdmin.from('academy_purchases').select('mentor_id,product_id,kind,status,stripe_subscription_id,stripe_session_id,current_period_end,created_at').eq('student_id', studentId);
  if (onlyMentor) pq = pq.eq('mentor_id', onlyMentor);
  const { data: buys } = await pq;

  const items: Item[] = [];

  for (const m of (mems || []) as any[]) {
    const mi = await mentorInfo(m.mentor_id);
    let it: Item = {
      mentor_id: m.mentor_id, academy_name: mi.name, academy_code: mi.code, kind: 'membership',
      product_name: 'Membresía', amount_cents: null, currency: 'usd', interval: 'month',
      status: m.status, next_charge: m.status === 'active' ? m.current_period_end : null, expires: m.status !== 'active' ? m.current_period_end : null,
      cancel_at_period_end: false, started_at: m.created_at || null, can_manage: !!m.stripe_subscription_id, invoices: [],
    };
    it = await enrichFromStripe(it, m.stripe_subscription_id, mi.account);
    items.push(it);
  }

  const prodIds = Array.from(new Set((buys || []).map((b: any) => b.product_id)));
  const { data: prods } = prodIds.length ? await supabaseAdmin.from('academy_products').select('id,name,currency,interval').in('id', prodIds) : { data: [] } as any;
  const prodOf: Record<string, any> = {}; (prods || []).forEach((p: any) => { prodOf[p.id] = p; });

  for (const b of (buys || []) as any[]) {
    const mi = await mentorInfo(b.mentor_id);
    const p = prodOf[b.product_id] || {};
    let it: Item = {
      mentor_id: b.mentor_id, academy_name: mi.name, academy_code: mi.code,
      kind: b.kind === 'one_time' ? 'one_time' : 'subscription',
      product_name: p.name || 'Nivel', amount_cents: null, currency: p.currency || 'usd', interval: b.kind === 'one_time' ? null : (p.interval || 'month'),
      status: b.status, next_charge: (b.kind !== 'one_time' && b.status === 'active') ? b.current_period_end : null,
      expires: (b.kind !== 'one_time' && b.status !== 'active') ? b.current_period_end : null,
      cancel_at_period_end: false, started_at: b.created_at || null, can_manage: !!b.stripe_subscription_id, invoices: [],
    };
    it = await enrichFromStripe(it, b.stripe_subscription_id, mi.account, b.stripe_session_id);
    items.push(it);
  }

  // Activas primero, luego por fecha.
  items.sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || String(b.started_at).localeCompare(String(a.started_at)));
  return items;
}

// Buscar la suscripción activa del alumno en una academia (membresía o nivel).
async function findSub(studentId: string, mentorId: string): Promise<{ subId: string | null; account: string | null }> {
  const mi = await mentorInfo(mentorId);
  const { data: mem } = await supabaseAdmin.from('academy_memberships').select('stripe_subscription_id').eq('student_id', studentId).eq('mentor_id', mentorId).maybeSingle();
  if ((mem as any)?.stripe_subscription_id) return { subId: (mem as any).stripe_subscription_id, account: mi.account };
  const { data: buy } = await supabaseAdmin.from('academy_purchases').select('stripe_subscription_id').eq('student_id', studentId).eq('mentor_id', mentorId).not('stripe_subscription_id', 'is', null).limit(1).maybeSingle();
  return { subId: (buy as any)?.stripe_subscription_id || null, account: mi.account };
}

// Portal de facturación de Stripe (cambiar tarjeta, ver facturas, cancelar) en la
// cuenta conectada del mentor. Devuelve la URL o null.
export async function academyPortal(studentId: string, mentorId: string): Promise<string | null> {
  const { subId, account } = await findSub(studentId, mentorId);
  if (!subId || !account) return null;
  try {
    const sub: any = await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account });
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customer) return null;
    const ps: any = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl()}/account#academias` }, { stripeAccount: account });
    return ps.url || null;
  } catch { return null; }
}

// ============================================================
// INGRESOS del MENTOR (el otro lado): ventas, comisión de Onyx, saldo y payouts.
// El dinero está en su cuenta conectada; leemos saldo y payouts EN VIVO de Stripe,
// y el detalle de ventas del libro de comisiones (onyx_commissions).
// ============================================================
export async function mentorPayoutDetail(mentorId: string) {
  const { data: m } = await supabaseAdmin.from('mentors').select('stripe_account_id').eq('user_id', mentorId).maybeSingle();
  const account = (m as any)?.stripe_account_id || null;

  // Resumen + detalle de ventas desde el libro de comisiones.
  const { data: comm } = await supabaseAdmin.from('onyx_commissions')
    .select('student_id,product_id,gross_cents,fee_cents,currency,kind,created_at').eq('mentor_id', mentorId).order('created_at', { ascending: false }).limit(60);
  const rows = (comm || []) as any[];
  const sids = Array.from(new Set(rows.map((r) => r.student_id).filter(Boolean)));
  const pids = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean)));
  const [{ data: profs }, { data: prods }] = await Promise.all([
    sids.length ? supabaseAdmin.from('profiles').select('id,full_name,email').in('id', sids) : Promise.resolve({ data: [] } as any),
    pids.length ? supabaseAdmin.from('academy_products').select('id,name').in('id', pids) : Promise.resolve({ data: [] } as any),
  ]);
  const nameOf: Record<string, string> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p.full_name || (p.email || '').split('@')[0] || 'Alumno'; });
  const prodOf: Record<string, string> = {}; (prods || []).forEach((p: any) => { prodOf[p.id] = p.name; });

  const grossCents = rows.reduce((s, r) => s + (r.gross_cents || 0), 0);
  const feeCents = rows.reduce((s, r) => s + (r.fee_cents || 0), 0);
  const sales = rows.map((r) => ({
    student: r.student_id ? (nameOf[r.student_id] || 'Alumno') : 'Alumno',
    product: r.kind === 'membership' ? 'Membresía' : (prodOf[r.product_id] || 'Nivel'),
    kind: r.kind, gross_cents: r.gross_cents || 0, fee_cents: r.fee_cents || 0, net_cents: (r.gross_cents || 0) - (r.fee_cents || 0),
    currency: r.currency || 'usd', date: r.created_at,
  }));

  // Saldo y payouts EN VIVO desde Stripe (cuenta conectada). Fail-safe.
  let balance: { available: number; pending: number; currency: string } | null = null;
  let payouts: { amount_cents: number; currency: string; status: string; arrival: string | null; created: string }[] = [];
  if (account) {
    try {
      const bal: any = await stripe.balance.retrieve({ stripeAccount: account });
      const av = (bal.available || [])[0]; const pe = (bal.pending || [])[0];
      balance = { available: av?.amount || 0, pending: pe?.amount || 0, currency: (av?.currency || pe?.currency || 'usd') };
    } catch { /* fail-safe */ }
    try {
      const po: any = await stripe.payouts.list({ limit: 8 }, { stripeAccount: account });
      payouts = (po.data || []).map((p: any) => ({
        amount_cents: p.amount || 0, currency: p.currency || 'usd', status: p.status || 'paid',
        arrival: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
        created: new Date((p.created || 0) * 1000).toISOString(),
      }));
    } catch { /* fail-safe */ }
  }

  return {
    summary: { grossCents, feeCents, netCents: grossCents - feeCents, sales: rows.length },
    balance, payouts, sales,
    hasAccount: !!account,
  };
}

// Cancelar (al final del periodo) o reactivar la suscripción del alumno.
export async function setAcademyCancel(studentId: string, mentorId: string, cancel: boolean): Promise<{ ok: boolean; error?: string }> {
  const { subId, account } = await findSub(studentId, mentorId);
  if (!subId || !account) return { ok: false, error: 'no_sub' };
  try {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: cancel }, { stripeAccount: account });
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e?.message || 'stripe_error' }; }
}
