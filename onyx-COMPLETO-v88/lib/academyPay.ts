import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FEE_PCT } from '@/lib/stripeConnect';
import { academyFeeSettings, academyPerksSettings, saveSetting } from '@/lib/settings';

// ============================================================
// Academia · productos (niveles), compras y acceso por nivel + comisiones.
// ============================================================

// Comisión de Onyx para un mentor (%). Orden de prioridad (de más a menos específico):
//   1) override por mentor (mentors.fee_pct)
//   2) comisión de SU PLAN de Onyx (plans.capabilities.academy_fee_pct) — baja al subir de plan
//   3) % por defecto (app_settings)
//   4) env (FEE_PCT).
const clampPct = (n: any) => Math.max(0, Math.min(50, Number(n)));

// Comisión definida por el plan de Onyx del mentor (o null si su plan no fija una).
export async function planFeePctFor(mentorUserId: string): Promise<number | null> {
  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', mentorUserId).maybeSingle();
    const planId = (prof as any)?.plan || 'free';
    const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', planId).maybeSingle();
    const pct = (plan as any)?.capabilities?.academy_fee_pct;
    if (pct != null && Number.isFinite(Number(pct))) return clampPct(pct);
  } catch {}
  return null;
}

export async function feeForMentor(mentorId: string): Promise<number> {
  try {
    const { data: m } = await supabaseAdmin.from('mentors').select('fee_pct').eq('user_id', mentorId).maybeSingle();
    const own = (m as any)?.fee_pct;
    if (own != null && Number.isFinite(Number(own))) return clampPct(own);   // 1) override manual
    const planPct = await planFeePctFor(mentorId);
    if (planPct != null) return planPct;                                     // 2) plan del mentor
    const s = await academyFeeSettings();
    if (s?.default_pct != null && Number.isFinite(Number(s.default_pct))) return clampPct(s.default_pct); // 3) global
  } catch {}
  return FEE_PCT;                                                            // 4) env
}

// ---- Comisión por PLAN (editable por el dueño) ----
const PLAN_ORDER = ['free', 'pro', 'elite', 'black_onyx', 'black'];
// Lista de planes con su comisión de academia (null = usa la global).
export async function getPlanFees() {
  const { data } = await supabaseAdmin.from('plans').select('id,name,capabilities');
  const rows = (data || []) as any[];
  rows.sort((a, b) => {
    const ia = PLAN_ORDER.indexOf(a.id); const ib = PLAN_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return rows.map((p) => ({
    id: p.id, name: p.name || p.id,
    academy: !!(p.capabilities?.academy),
    fee_pct: p.capabilities?.academy_fee_pct != null ? Number(p.capabilities.academy_fee_pct) : null,
  }));
}
// Fija (o borra, con null/'') la comisión de un plan dentro de su JSON capabilities.
export async function setPlanFee(planId: string, pct: number | null) {
  const { data: p } = await supabaseAdmin.from('plans').select('capabilities').eq('id', planId).maybeSingle();
  const caps = { ...(((p as any)?.capabilities) || {}) };
  const val = pct == null || (pct as any) === '' || Number.isNaN(Number(pct)) ? null : clampPct(pct);
  if (val == null) delete caps.academy_fee_pct; else caps.academy_fee_pct = val;
  await supabaseAdmin.from('plans').update({ capabilities: caps }).eq('id', planId);
  return val;
}

// ---- Historial de cambios de comisión (quién / cuándo / cuánto) ----
export async function logFeeChange(actor: string | null | undefined, scope: 'default' | 'plan' | 'mentor', target: string | null, pct: number | null) {
  try {
    await supabaseAdmin.from('academy_fee_log').insert({ actor_email: actor || null, scope, target: target || null, pct: pct == null ? null : Number(pct) });
  } catch { /* si la tabla no existe aún, no rompe el guardado */ }
}
export async function feeLog(limit = 60) {
  const { data } = await supabaseAdmin.from('academy_fee_log').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data || []) as any[];
}

export async function listProducts(mentorId: string, onlyActive = false) {
  let q = supabaseAdmin.from('academy_products').select('*').eq('mentor_id', mentorId).order('position');
  if (onlyActive) q = q.eq('active', true);
  const { data } = await q;
  return (data || []) as any[];
}
export async function getProduct(id: string) {
  const { data } = await supabaseAdmin.from('academy_products').select('*').eq('id', id).maybeSingle();
  return data as any;
}
export async function saveProduct(mentorId: string, b: any) {
  const row: any = {
    name: String(b.name || 'Nivel').slice(0, 80),
    description: b.description ? String(b.description).slice(0, 500) : null,
    kind: b.kind === 'one_time' ? 'one_time' : (b.kind === 'audit' ? 'audit' : 'subscription'),
    interval: b.interval === 'year' ? 'year' : 'month',
    price_cents: Math.max(0, Math.round(Number(b.price_cents) || 0)),
    currency: (b.currency || 'usd').toLowerCase().slice(0, 3),
    grants: b.grants === 'all' || !Array.isArray(b.grants) ? 'all' : b.grants.map((x: any) => String(x)).slice(0, 100),
    perks: { copy: false, guardian: !!(b.perks?.guardian) }, // copy trading retirado de la academia
    active: b.active !== false,
    position: Number(b.position) || 0,
  };
  if (b.id) { await supabaseAdmin.from('academy_products').update(row).eq('id', b.id).eq('mentor_id', mentorId); return { id: b.id }; }
  const { data } = await supabaseAdmin.from('academy_products').insert({ ...row, mentor_id: mentorId }).select('id').single();
  return data as any;
}
export async function deleteProduct(mentorId: string, id: string) {
  await supabaseAdmin.from('academy_products').delete().eq('id', id).eq('mentor_id', mentorId);
}

// Compras activas de un alumno en una academia.
export async function studentPurchases(studentId: string, mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_purchases').select('*').eq('student_id', studentId).eq('mentor_id', mentorId).eq('status', 'active');
  return (data || []) as any[];
}

// Conjunto de módulos a los que el alumno tiene acceso: sus compras activas
// UNIDAS a las becas vigentes (beca completa = acceso gratis mientras dure).
export async function accessibleModules(studentId: string, mentorId: string): Promise<{ all: boolean; ids: Set<string> }> {
  const ids = new Set<string>();
  let all = false;

  const buys = await studentPurchases(studentId, mentorId);
  if (buys.length) {
    const prodIds = buys.map((b) => b.product_id);
    const { data: prods } = await supabaseAdmin.from('academy_products').select('id,grants').in('id', prodIds);
    for (const p of (prods || []) as any[]) {
      if (p.grants === 'all') { all = true; break; }
      if (Array.isArray(p.grants)) p.grants.forEach((m: string) => ids.add(m));
    }
  }

  // Becas vigentes (import diferido para evitar ciclos).
  if (!all) {
    try {
      const { scholarshipModules } = await import('@/lib/academyScholarship');
      const sch = await scholarshipModules(studentId, mentorId);
      if (sch.all) all = true; else sch.ids.forEach((m) => ids.add(m));
    } catch {}
  }
  return { all, ids };
}

// Perks (extras) que tiene un alumno por sus compras activas (unión).
export async function perksFor(studentId: string, mentorId: string) {
  const buys = await studentPurchases(studentId, mentorId);
  if (!buys.length) return { copy: false, guardian: false };
  const { data: prods } = await supabaseAdmin.from('academy_products').select('perks').in('id', buys.map((b) => b.product_id));
  let guardian = false;
  for (const p of (prods || []) as any[]) { if (p.perks?.guardian) guardian = true; }
  return { copy: false, guardian }; // copy trading ya no se otorga por la academia
}

// Para el mentor: quién compró un nivel con extras (para darles el acceso a mano).
// NO ejecuta copy/guardian automáticamente (seguridad): solo lista.
export async function entitlements(mentorId: string) {
  const { data: prods } = await supabaseAdmin.from('academy_products').select('id,name,perks').eq('mentor_id', mentorId);
  const withPerks = (prods || []).filter((p: any) => p.perks?.guardian);
  if (!withPerks.length) return [];
  const { data: buys } = await supabaseAdmin.from('academy_purchases').select('student_id,product_id').eq('mentor_id', mentorId).eq('status', 'active').in('product_id', withPerks.map((p: any) => p.id));
  const ids = Array.from(new Set((buys || []).map((b: any) => b.student_id)));
  if (!ids.length) return [];
  const { data: profs } = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids);
  const nameOf: Record<string, any> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p; });
  const prodOf: Record<string, any> = {}; withPerks.forEach((p: any) => { prodOf[p.id] = p; });
  return (buys || []).map((b: any) => ({
    student_id: b.student_id, name: nameOf[b.student_id]?.full_name || (nameOf[b.student_id]?.email || '').split('@')[0] || 'Alumno',
    tier: prodOf[b.product_id]?.name || '', perks: prodOf[b.product_id]?.perks || {},
  }));
}

// Recalcula si un alumno tiene Onyx Guardian concedido por una compra activa.
// Solo concede si el dueño activó el interruptor global. Reversible: si cancela o
// se apaga el interruptor, se revoca. NUNCA toca copy trading (dinero).
export async function syncGuardianGrant(studentId: string) {
  try {
    const s = await academyPerksSettings();
    let grant = false;
    if (s?.guardian_autogrant) {
      const { data: buys } = await supabaseAdmin.from('academy_purchases').select('product_id').eq('student_id', studentId).eq('status', 'active');
      const pids = (buys || []).map((b: any) => b.product_id);
      if (pids.length) {
        const { data: prods } = await supabaseAdmin.from('academy_products').select('perks').in('id', pids);
        grant = (prods || []).some((p: any) => p.perks?.guardian);
      }
    }
    await supabaseAdmin.from('profiles').update({ academy_guardian: grant }).eq('id', studentId);
  } catch { /* silencioso: no bloquea el pago */ }
}

// ============================================================
// Membresía de pago de la comunidad (suscripción para entrar).
// ============================================================
export async function membershipInfo(mentorId: string) {
  const { data: m } = await supabaseAdmin.from('mentors').select('membership_price_cents,membership_year_cents,membership_currency,membership_interval').eq('user_id', mentorId).maybeSingle();
  const price = (m as any)?.membership_price_cents || 0;
  const yearCents = (m as any)?.membership_year_cents || 0;
  // % de ahorro del plan anual vs 12 meses.
  const yearSavePct = (price > 0 && yearCents > 0) ? Math.max(0, Math.round((1 - (yearCents / (price * 12))) * 100)) : 0;
  return { paid: price > 0, priceCents: price, yearCents, yearSavePct, currency: (m as any)?.membership_currency || 'usd', interval: (m as any)?.membership_interval || 'month' };
}
export async function hasMembership(studentId: string, mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_memberships').select('status').eq('mentor_id', mentorId).eq('student_id', studentId).maybeSingle();
  return !!data && (data as any).status === 'active';
}
export async function grantMembership(o: { mentorId: string; studentId: string; grossCents: number; currency?: string; subId?: string; periodEnd?: number; feePct?: number }) {
  // Solo DA ACCESO. La comisión se registra por FACTURA (invoice.paid), así se
  // anota también en cada renovación mensual, no solo en el primer pago.
  await supabaseAdmin.from('academy_memberships').upsert({
    mentor_id: o.mentorId, student_id: o.studentId, status: 'active',
    stripe_subscription_id: o.subId || null,
    current_period_end: o.periodEnd ? new Date(o.periodEnd * 1000).toISOString() : null,
  }, { onConflict: 'mentor_id,student_id' });
}

// Inserta una comisión de forma IDEMPOTENTE (por referencia única de Stripe).
// Si el webhook se reintenta, el índice único (mentor_id, stripe_ref) evita duplicar.
export async function recordCommission(o: { mentorId: string; studentId?: string; productId?: string; grossCents: number; currency?: string; kind: string; ref: string; feePct?: number }) {
  if (!o.ref) return;
  const pct = o.feePct != null ? o.feePct : await feeForMentor(o.mentorId);
  const fee = Math.round((o.grossCents || 0) * (pct / 100));
  await supabaseAdmin.from('onyx_commissions').upsert({
    mentor_id: o.mentorId, student_id: o.studentId || null, product_id: o.productId || null,
    gross_cents: o.grossCents || 0, fee_cents: fee, currency: (o.currency || 'usd').toLowerCase().slice(0, 3),
    kind: o.kind, status: 'earned', stripe_ref: o.ref,
  }, { onConflict: 'mentor_id,stripe_ref', ignoreDuplicates: true });
}

// Comisión de una FACTURA de suscripción (primer pago y cada renovación). Busca
// mentor/alumno por el id de suscripción en membresías o compras.
export async function recordInvoiceCommission(o: { subId: string; grossCents: number; currency?: string; invoiceId: string }) {
  if (!o.subId || !o.invoiceId || !o.grossCents) return;
  const { data: mem } = await supabaseAdmin.from('academy_memberships').select('mentor_id,student_id').eq('stripe_subscription_id', o.subId).maybeSingle();
  if (mem) { await recordCommission({ mentorId: (mem as any).mentor_id, studentId: (mem as any).student_id, grossCents: o.grossCents, currency: o.currency, kind: 'membership', ref: o.invoiceId }); return; }
  const { data: buy } = await supabaseAdmin.from('academy_purchases').select('mentor_id,student_id,product_id').eq('stripe_subscription_id', o.subId).maybeSingle();
  if (buy) await recordCommission({ mentorId: (buy as any).mentor_id, studentId: (buy as any).student_id, productId: (buy as any).product_id, grossCents: o.grossCents, currency: o.currency, kind: 'subscription', ref: o.invoiceId });
}

// Reembolso/disputa: marca la comisión como revertida (no la borra). Por factura o
// por payment_intent (pago único). No resta dinero: solo corrige el libro.
export async function reverseCommissionByRef(ref?: string | null) {
  if (!ref) return;
  await supabaseAdmin.from('onyx_commissions').update({ status: 'reversed', reversed_at: new Date().toISOString() }).eq('stripe_ref', ref).eq('status', 'earned');
}
export async function setMembershipStatus(subId: string, status: string, periodEnd?: number) {
  const patch: any = { status };
  if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();
  await supabaseAdmin.from('academy_memberships').update(patch).eq('stripe_subscription_id', subId);
}

// Registra/actualiza una compra. Da ACCESO siempre. La comisión:
//  · pago único (one_time): se anota aquí, atada al payment_intent (idempotente).
//  · suscripción: NO aquí — se anota por factura (invoice.paid), incluidas renovaciones.
export async function grantPurchase(o: { mentorId: string; studentId: string; productId: string; kind: string; grossCents: number; currency?: string; subId?: string; sessionId?: string; paymentIntent?: string; periodEnd?: number; feePct?: number }) {
  await supabaseAdmin.from('academy_purchases').upsert({
    mentor_id: o.mentorId, student_id: o.studentId, product_id: o.productId, kind: o.kind, status: 'active',
    stripe_session_id: o.sessionId || null, stripe_subscription_id: o.subId || null,
    current_period_end: o.periodEnd ? new Date(o.periodEnd * 1000).toISOString() : null,
  }, { onConflict: 'student_id,product_id' });
  if (o.kind === 'one_time' && o.paymentIntent) {
    await recordCommission({ mentorId: o.mentorId, studentId: o.studentId, productId: o.productId, grossCents: o.grossCents, currency: o.currency, kind: 'one_time', ref: o.paymentIntent, feePct: o.feePct });
  }
  await syncGuardianGrant(o.studentId);
}
export async function setPurchaseStatus(subId: string, status: string, periodEnd?: number) {
  const patch: any = { status };
  if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();
  const { data: rows } = await supabaseAdmin.from('academy_purchases').update(patch).eq('stripe_subscription_id', subId).select('student_id');
  const sid = (rows || [])[0]?.student_id;
  if (sid) await syncGuardianGrant(sid);
}

// Reportes de suscripciones del mentor: activos, cancelados, MRR estimado.
export async function mentorSubStats(mentorId: string) {
  const [{ data: mem }, { data: buys }, { data: prods }] = await Promise.all([
    supabaseAdmin.from('academy_memberships').select('status,current_period_end').eq('mentor_id', mentorId),
    supabaseAdmin.from('academy_purchases').select('status,product_id,kind').eq('mentor_id', mentorId),
    supabaseAdmin.from('mentors').select('membership_price_cents,membership_interval,membership_currency').eq('user_id', mentorId).maybeSingle(),
  ]);
  const memRows = (mem || []) as any[];
  const activeMem = memRows.filter((r) => r.status === 'active').length;
  const canceledMem = memRows.filter((r) => r.status === 'canceled').length;
  const buyRows = (buys || []) as any[];
  const activeBuys = buyRows.filter((b) => b.status === 'active');
  const canceledBuys = buyRows.filter((b) => b.status === 'canceled').length;
  // MRR ≈ membresías activas × precio mensual + niveles/suscripción activos × precio mensual.
  const price = (prods as any)?.membership_price_cents || 0;
  const memMonthly = (prods as any)?.membership_interval === 'year' ? price / 12 : price;
  let mrr = activeMem * memMonthly;
  const pIds = Array.from(new Set(activeBuys.filter((b) => b.kind !== 'one_time').map((b) => b.product_id)));
  if (pIds.length) {
    const { data: pr } = await supabaseAdmin.from('academy_products').select('id,price_cents,interval,kind').in('id', pIds);
    const pm = new Map((pr || []).map((p: any) => [p.id, p]));
    for (const b of activeBuys) {
      const p = pm.get(b.product_id); if (!p || p.kind === 'one_time') continue;
      mrr += p.interval === 'year' ? (p.price_cents || 0) / 12 : (p.price_cents || 0);
    }
  }
  return { activeMembers: activeMem + activeBuys.length, canceled: canceledMem + canceledBuys, mrrCents: Math.round(mrr) };
}

// Ingresos del mentor (bruto) y comisión de Onyx, a partir del libro de comisiones.
export async function mentorEarnings(mentorId: string) {
  const { data } = await supabaseAdmin.from('onyx_commissions').select('gross_cents,fee_cents').eq('mentor_id', mentorId).neq('status', 'reversed');
  const gross = (data || []).reduce((s: number, r: any) => s + (r.gross_cents || 0), 0);
  const fee = (data || []).reduce((s: number, r: any) => s + (r.fee_cents || 0), 0);
  return { grossCents: gross, feeCents: fee, netCents: gross - fee, sales: (data || []).length };
}
// ============================================================
// Panel del dueño · gestionar comisiones (global + por mentor) y ver academias.
// ============================================================

// % por defecto (editable en el panel).
export async function getDefaultFeePct(): Promise<number> {
  const s = await academyFeeSettings();
  return clampPct(s?.default_pct ?? FEE_PCT);
}
export async function setDefaultFeePct(pct: number) {
  await saveSetting('academy_fee', { default_pct: clampPct(pct) });
  return clampPct(pct);
}
// Override de comisión de un mentor. pct null/'' → vuelve al % por defecto.
export async function setMentorFeePct(mentorUserId: string, pct: number | null) {
  const val = pct == null || Number.isNaN(Number(pct)) ? null : clampPct(pct);
  await supabaseAdmin.from('mentors').update({ fee_pct: val }).eq('user_id', mentorUserId);
  return val;
}

// Lista de academias para el panel del dueño: datos + ventas + comisión efectiva.
export async function adminListAcademies() {
  const def = await getDefaultFeePct();
  const { data: mentors } = await supabaseAdmin.from('mentors')
    .select('user_id,code,academy_name,active,charges_enabled,stripe_account_id,fee_pct,created_at')
    .order('created_at', { ascending: false });
  const rows = (mentors || []) as any[];
  // Nombres/emails de los mentores.
  const ids = rows.map((m) => m.user_id);
  const profs = ids.length ? (await supabaseAdmin.from('profiles').select('id,email,full_name').in('id', ids)).data || [] : [];
  const pmap = new Map((profs as any[]).map((p) => [p.id, p]));
  // Comisiones agregadas por mentor.
  const { data: comm } = ids.length ? await supabaseAdmin.from('onyx_commissions').select('mentor_id,gross_cents,fee_cents').in('mentor_id', ids).neq('status', 'reversed') : { data: [] as any };
  const cagg = new Map<string, { gross: number; fee: number; sales: number }>();
  for (const c of (comm || []) as any[]) {
    const a = cagg.get(c.mentor_id) || { gross: 0, fee: 0, sales: 0 };
    a.gross += c.gross_cents || 0; a.fee += c.fee_cents || 0; a.sales += 1;
    cagg.set(c.mentor_id, a);
  }
  return {
    defaultFeePct: def,
    academies: await Promise.all(rows.map(async (m) => {
      const agg = cagg.get(m.user_id) || { gross: 0, fee: 0, sales: 0 };
      const p = pmap.get(m.user_id) as any;
      // % efectivo real: override del mentor → plan → global. Se resuelve con feeForMentor.
      const effective = await feeForMentor(m.user_id);
      const planPct = await planFeePctFor(m.user_id);
      return {
        userId: m.user_id, code: m.code, name: m.academy_name || '—',
        mentorName: p?.full_name || null, mentorEmail: p?.email || null,
        active: !!m.active, chargesEnabled: !!m.charges_enabled, connected: !!m.stripe_account_id,
        feePct: m.fee_pct == null ? null : Number(m.fee_pct),
        planFeePct: planPct,
        effectiveFeePct: effective,
        grossCents: agg.gross, feeCents: agg.fee, sales: agg.sales,
      };
    })),
  };
}

// Comisión total de Onyx en un rango (para Finanzas admin).
export async function onyxCommissionTotal(fromMs: number, toMs: number) {
  const { data } = await supabaseAdmin.from('onyx_commissions').select('fee_cents,created_at').gte('created_at', new Date(fromMs).toISOString()).lte('created_at', new Date(toMs).toISOString());
  return (data || []).reduce((s: number, r: any) => s + (r.fee_cents || 0), 0) / 100;
}
