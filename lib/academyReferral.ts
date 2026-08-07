import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { notify } from '@/lib/notify';

// ============================================================
// Pagos a los referidos del mentor · rieles A (crédito) y B (manual).
//  Ciclo de vida de cada recompensa: pending → available → paid | reversed.
//  · qualify…  crea la recompensa (pending) al pagar el referido.
//  · releaseDueRewards  (cron) pasa pending→available y, en riel A, aplica crédito.
//  · payReferrer  (mentor) liquida en riel B y deja recibo.
//  La atribución (quién trajo a quién) vive en academy_referrals (recordReferral).
// ============================================================

const nameOf = (p: any) => p?.full_name || (p?.email || '').split('@')[0] || 'Trader';
const DAY = 864e5;

export type AffiliateSettings = {
  type: 'flat' | 'pct';
  reward_cents: number;
  pct: number;
  currency: string;
  recurring: boolean;
  hold_days: number;
  min_cents: number;
  rail: 'credit' | 'manual';
  payout_methods: string[];   // métodos que el mentor ofrece a sus referidos
};

// Métodos de cobro válidos y el conjunto por defecto (si el mentor no configura).
export const PAYOUT_METHODS = ['paypal', 'zelle', 'bank', 'cash', 'crypto', 'other'] as const;
export const DEFAULT_PAYOUT_METHODS = ['paypal', 'zelle', 'crypto'];
export function cleanPayoutMethods(v: any): string[] {
  const list = Array.isArray(v) ? v.map((x) => String(x)).filter((x) => (PAYOUT_METHODS as readonly string[]).includes(x)) : [];
  const uniq = Array.from(new Set(list));
  return uniq.length ? uniq : DEFAULT_PAYOUT_METHODS;   // nunca dejar la lista vacía
}

export async function affiliateSettings(mentorId: string): Promise<AffiliateSettings> {
  const { data: m } = await supabaseAdmin.from('mentors')
    .select('affiliate_type,affiliate_pct,affiliate_reward_cents,affiliate_currency,affiliate_recurring,affiliate_hold_days,affiliate_min_cents,affiliate_rail,affiliate_payout_methods')
    .eq('user_id', mentorId).maybeSingle();
  const r: any = m || {};
  return {
    type: r.affiliate_type === 'pct' ? 'pct' : 'flat',
    reward_cents: Math.max(0, Math.round(Number(r.affiliate_reward_cents) || 0)),
    pct: Math.max(0, Math.min(90, Number(r.affiliate_pct) || 0)),
    currency: (r.affiliate_currency || 'usd').toLowerCase(),
    recurring: !!r.affiliate_recurring,
    hold_days: Math.max(0, Math.min(120, Math.round(Number(r.affiliate_hold_days ?? 14)))),
    min_cents: Math.max(0, Math.round(Number(r.affiliate_min_cents) || 0)),
    rail: r.affiliate_rail === 'credit' ? 'credit' : 'manual',
    payout_methods: cleanPayoutMethods(r.affiliate_payout_methods),
  };
}

export async function saveAffiliateSettings(mentorId: string, b: any) {
  const patch: any = {
    affiliate_type: b.type === 'pct' ? 'pct' : 'flat',
    affiliate_reward_cents: Math.max(0, Math.round(Number(b.reward_cents) || 0)),
    affiliate_pct: Math.max(0, Math.min(90, Number(b.pct) || 0)),
    affiliate_recurring: !!b.recurring,
    affiliate_hold_days: Math.max(0, Math.min(120, Math.round(Number(b.hold_days ?? 14)))),
    affiliate_min_cents: Math.max(0, Math.round(Number(b.min_cents) || 0)),
    affiliate_rail: b.rail === 'credit' ? 'credit' : 'manual',
  };
  if (b.payout_methods !== undefined) patch.affiliate_payout_methods = cleanPayoutMethods(b.payout_methods);
  if (b.currency) patch.affiliate_currency = String(b.currency).toLowerCase().slice(0, 3);
  await supabaseAdmin.from('mentors').update(patch).eq('user_id', mentorId);
  return affiliateSettings(mentorId);
}

function computeReward(s: AffiliateSettings, grossCents: number): number {
  if (s.type === 'pct') return Math.max(0, Math.round((grossCents || 0) * (s.pct / 100)));
  return s.reward_cents;
}

// Referidor atribuido a un alumno en una academia (o null).
async function referrerFor(mentorId: string, referredId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('academy_referrals').select('referrer_id').eq('mentor_id', mentorId).eq('referred_id', referredId).maybeSingle();
  const rid = (data as any)?.referrer_id;
  return rid && rid !== referredId ? rid : null;
}

// Núcleo: crea la recompensa (pending) si hay referidor y monto > 0. Idempotente por (mentor, ref).
export async function qualifyReferral(o: { mentorId: string; referredId: string; grossCents: number; currency?: string; ref: string; kind: 'first' | 'renewal' | 'one_time' }) {
  try {
    if (!o.ref) return;
    const referrerId = await referrerFor(o.mentorId, o.referredId);
    if (!referrerId) return;
    const s = await affiliateSettings(o.mentorId);
    if (o.kind === 'renewal' && !s.recurring) return;    // renovación solo si el mentor lo activó
    const amount = computeReward(s, o.grossCents);
    if (amount <= 0) return;
    const availableAt = new Date(Date.now() + s.hold_days * DAY).toISOString();
    const { data, error } = await supabaseAdmin.from('academy_reward_events').upsert({
      mentor_id: o.mentorId, referrer_id: referrerId, referred_id: o.referredId,
      amount_cents: amount, currency: (o.currency || s.currency || 'usd').toLowerCase().slice(0, 3),
      status: 'pending', rail: s.rail, stripe_ref: o.ref, kind: o.kind, available_at: availableAt,
    }, { onConflict: 'mentor_id,stripe_ref', ignoreDuplicates: true }).select('id').maybeSingle();
    if (error || !data) return;                          // duplicado ignorado → no re-notifica
    await notify(referrerId, { kind: 'info', title: '🎉 Ganaste una recompensa por referido', body: 'Tu invitado pagó. Estará disponible tras la ventana de espera.', url: '/dashboard/academy' });
  } catch { /* nunca bloquea el pago */ }
}

// Renovación/primer pago de una FACTURA de suscripción: resuelve mentor/alumno por subId.
export async function qualifyReferralByInvoice(o: { subId: string; grossCents: number; currency?: string; invoiceId: string; isRenewal: boolean }) {
  if (!o.subId || !o.invoiceId || !o.grossCents) return;
  let mentorId: string | null = null; let studentId: string | null = null;
  const { data: mem } = await supabaseAdmin.from('academy_memberships').select('mentor_id,student_id').eq('stripe_subscription_id', o.subId).maybeSingle();
  if (mem) { mentorId = (mem as any).mentor_id; studentId = (mem as any).student_id; }
  else {
    const { data: buy } = await supabaseAdmin.from('academy_purchases').select('mentor_id,student_id').eq('stripe_subscription_id', o.subId).maybeSingle();
    if (buy) { mentorId = (buy as any).mentor_id; studentId = (buy as any).student_id; }
  }
  if (!mentorId || !studentId) return;
  await qualifyReferral({ mentorId, referredId: studentId, grossCents: o.grossCents, currency: o.currency, ref: o.invoiceId, kind: o.isRenewal ? 'renewal' : 'first' });
}

// Reembolso/disputa: anula recompensas de esa referencia si aún no se pagaron.
export async function reverseRewardsByRef(ref?: string | null) {
  if (!ref) return;
  await supabaseAdmin.from('academy_reward_events').update({ status: 'reversed', reversed_at: new Date().toISOString() })
    .eq('stripe_ref', ref).in('status', ['pending', 'available']);
}

// CRON · pending→available cuando vence la espera; y en riel A aplica el crédito.
export async function releaseDueRewards(): Promise<{ released: number; credited: number }> {
  let released = 0; let credited = 0;
  try {
    // 1) Vencer la ventana de espera.
    const { data: due } = await supabaseAdmin.from('academy_reward_events').select('id')
      .eq('status', 'pending').lte('available_at', new Date().toISOString()).limit(500);
    const ids = (due || []).map((r: any) => r.id);
    if (ids.length) { await supabaseAdmin.from('academy_reward_events').update({ status: 'available' }).in('id', ids); released = ids.length; }

    // 2) Riel A (crédito): aplica saldo al referido-pagador… ojo: el crédito va al REFERIDOR.
    const { data: avail } = await supabaseAdmin.from('academy_reward_events')
      .select('id,mentor_id,referrer_id,amount_cents,currency').eq('status', 'available').eq('rail', 'credit').limit(500);
    for (const ev of (avail || []) as any[]) {
      const { data: p } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', ev.referrer_id).maybeSingle();
      const cust = (p as any)?.stripe_customer_id;
      if (!cust) continue;                               // aún sin cliente en Stripe: el crédito espera (o el mentor paga manual)
      try {
        await stripe.customers.createBalanceTransaction(cust, {
          amount: -Math.abs(Number(ev.amount_cents) || 0),
          currency: String(ev.currency || 'usd').toLowerCase(),
          description: 'Onyx Academy · recompensa por referido',
        } as any);
        await supabaseAdmin.from('academy_reward_events').update({ status: 'paid', paid_method: 'credit', paid_at: new Date().toISOString() }).eq('id', ev.id);
        await supabaseAdmin.from('academy_referral_payouts').insert({ mentor_id: ev.mentor_id, referrer_id: ev.referrer_id, total_cents: ev.amount_cents, currency: ev.currency, method: 'credit', note: 'Crédito automático' });
        await notify(ev.referrer_id, { kind: 'info', title: '💸 Recompensa acreditada', body: 'Aplicamos tu recompensa como crédito en tu cuenta.', url: '/dashboard/academy' });
        credited++;
      } catch { /* reintenta en la próxima pasada */ }
    }
  } catch {}
  return { released, credited };
}

// Método de cobro del referido (por academia).
export async function setPayoutMethod(mentorId: string, referrerId: string, method: string, handle: string, network?: string) {
  await supabaseAdmin.from('academy_payout_methods').upsert({
    mentor_id: mentorId, referrer_id: referrerId,
    method: String(method || '').slice(0, 20), handle: String(handle || '').slice(0, 120),
    network: method === 'crypto' ? String(network || '').slice(0, 20) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'mentor_id,referrer_id' });
}
async function payoutMethod(mentorId: string, referrerId: string) {
  const { data } = await supabaseAdmin.from('academy_payout_methods').select('method,handle,network').eq('mentor_id', mentorId).eq('referrer_id', referrerId).maybeSingle();
  return (data as any) || null;
}

// Riel B · el mentor liquida a un referido: todo lo 'available' pasa a 'paid' con recibo.
export async function payReferrer(mentorId: string, referrerId: string, method?: string, note?: string) {
  const { data: evs } = await supabaseAdmin.from('academy_reward_events')
    .select('id,amount_cents,currency').eq('mentor_id', mentorId).eq('referrer_id', referrerId).eq('status', 'available');
  const rows = (evs || []) as any[];
  if (!rows.length) return { ok: false, error: 'nada_por_pagar' };
  const total = rows.reduce((s, r) => s + (r.amount_cents || 0), 0);
  const currency = rows[0].currency || 'usd';
  const meth = method || (await payoutMethod(mentorId, referrerId))?.method || 'manual';
  const { data: payout } = await supabaseAdmin.from('academy_referral_payouts')
    .insert({ mentor_id: mentorId, referrer_id: referrerId, total_cents: total, currency, method: meth, note: note ? String(note).slice(0, 300) : null })
    .select('id').single();
  await supabaseAdmin.from('academy_reward_events').update({
    status: 'paid', paid_method: meth, paid_note: note ? String(note).slice(0, 300) : null,
    paid_at: new Date().toISOString(), payout_id: (payout as any)?.id || null,
  }).eq('mentor_id', mentorId).eq('referrer_id', referrerId).eq('status', 'available');
  await notify(referrerId, { kind: 'info', title: '💸 Te pagaron tu recompensa', body: `Recibiste ${(total / 100).toLocaleString()} por tus referidos.`, url: '/dashboard/academy' });
  return { ok: true, total_cents: total, currency };
}

function bucket(rows: any[]) {
  const b = { pendingCents: 0, availableCents: 0, paidCents: 0, count: rows.length };
  for (const r of rows) {
    if (r.status === 'pending') b.pendingCents += r.amount_cents || 0;
    else if (r.status === 'available') b.availableCents += r.amount_cents || 0;
    else if (r.status === 'paid') b.paidCents += r.amount_cents || 0;
  }
  return b;
}

// Panel del mentor: ajustes + referidos agrupados con estados + métodos + pagos recientes.
export async function mentorAffiliateData(mentorId: string) {
  const settings = await affiliateSettings(mentorId);
  const { data: evs } = await supabaseAdmin.from('academy_reward_events')
    .select('referrer_id,amount_cents,status,created_at').eq('mentor_id', mentorId).order('created_at', { ascending: false }).limit(1000);
  const rows = (evs || []) as any[];
  const refIds = Array.from(new Set(rows.map((r) => r.referrer_id)));
  const [{ data: profs }, { data: methods }] = await Promise.all([
    refIds.length ? supabaseAdmin.from('profiles').select('id,full_name,email').in('id', refIds) : Promise.resolve({ data: [] as any }),
    refIds.length ? supabaseAdmin.from('academy_payout_methods').select('referrer_id,method,handle,network').eq('mentor_id', mentorId).in('referrer_id', refIds) : Promise.resolve({ data: [] as any }),
  ]);
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  const mmap = new Map((methods || []).map((m: any) => [m.referrer_id, m]));
  const byRef: Record<string, any[]> = {};
  for (const r of rows) (byRef[r.referrer_id] ||= []).push(r);
  const referrers = Object.entries(byRef).map(([id, list]) => ({
    user_id: id, name: nameOf(pmap.get(id)), method: mmap.get(id) || null, ...bucket(list),
  })).sort((a, b) => b.availableCents - a.availableCents || b.pendingCents - a.pendingCents);
  const totals = {
    availableCents: referrers.reduce((s, r) => s + r.availableCents, 0),
    pendingCents: referrers.reduce((s, r) => s + r.pendingCents, 0),
    paidCents: referrers.reduce((s, r) => s + r.paidCents, 0),
  };
  const { data: payouts } = await supabaseAdmin.from('academy_referral_payouts')
    .select('referrer_id,total_cents,currency,method,note,created_at').eq('mentor_id', mentorId).order('created_at', { ascending: false }).limit(50);
  const pay = (payouts || []).map((p: any) => ({ ...p, name: nameOf(pmap.get(p.referrer_id)) }));
  return { settings, referrers, totals, payouts: pay };
}

// Vista del referido en UNA academia: desglose + método + historial.
export async function referrerView(userId: string, mentorId: string) {
  const settings = await affiliateSettings(mentorId);
  const [{ data: evs }, method, { data: payouts }, { data: attrib }] = await Promise.all([
    supabaseAdmin.from('academy_reward_events').select('amount_cents,currency,status,kind,created_at,paid_at,paid_method').eq('mentor_id', mentorId).eq('referrer_id', userId).order('created_at', { ascending: false }).limit(200),
    payoutMethod(mentorId, userId),
    supabaseAdmin.from('academy_referral_payouts').select('total_cents,currency,method,note,created_at').eq('mentor_id', mentorId).eq('referrer_id', userId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('academy_referrals').select('referred_id').eq('mentor_id', mentorId).eq('referrer_id', userId),
  ]);
  const rows = (evs || []) as any[];
  const b = bucket(rows);
  return {
    settings, method: method || null,
    totals: { pendingCents: b.pendingCents, availableCents: b.availableCents, paidCents: b.paidCents },
    referred: (attrib || []).length,
    events: rows,
    payouts: (payouts || []) as any[],
  };
}
