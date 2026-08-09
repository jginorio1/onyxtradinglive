import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { copyMentorSettings } from '@/lib/settings';

// ============================================================
// Copy del mentor (Fase 2) · motor. Se apoya en el copy existente (copy_links):
//  · La OFERTA guarda la cuenta maestra del mentor y el precio.
//  · Al suscribirse y conectar su cuenta, se crea un copy_link con escalado
//    PROPORCIONAL por capital (mode='balance') + Guardian/Mi reto obligatorios.
//  · Cancelar/pausar solo apaga el copy_link (enabled=false). Reversible.
// El alumno NUNCA comparte credenciales; el mentor nunca ve ni opera su cuenta.
// ============================================================

const clampMult = (n: any) => Math.max(0.1, Math.min(3, Number(n) || 1));

// Límites de riesgo (Guardian) por defecto según el tipo de cuenta. En fondeo se
// usan las reglas de la firma (Mi reto), dejando margen para no rozar el límite.
function riskLimits(accountType: string, fundedDaily?: number | null, fundedMaxDd?: number | null) {
  if (accountType === 'funded') {
    const daily = fundedDaily && fundedDaily > 0 ? Math.max(1, fundedDaily * 0.8) : 4;   // 80% del límite de la firma
    const maxDd = fundedMaxDd && fundedMaxDd > 0 ? Math.max(2, fundedMaxDd * 0.8) : 8;
    return { daily_loss_pct: Math.round(daily * 10) / 10, max_drawdown_pct: Math.round(maxDd * 10) / 10 };
  }
  return { daily_loss_pct: 5, max_drawdown_pct: 10 }; // capital propio: red de seguridad conservadora
}

// ---- OFERTA del mentor ----
export async function getOffer(mentorId: string) {
  const { data } = await supabaseAdmin.from('academy_copy_offers').select('*').eq('mentor_id', mentorId).maybeSingle();
  return (data as any) || null;
}

export async function saveOffer(mentorId: string, b: any) {
  const s = await copyMentorSettings();
  const priceCents = Math.max(0, Math.round(Number(b.price_cents) || 0));
  const row: any = {
    mentor_id: mentorId,
    master_account_id: b.master_account_id || null,
    enabled: !!b.enabled,
    price_cents: Math.max(priceCents, s.min_price_cents || 0),
    currency: 'usd',
    min_capital_cents: Math.max(0, Math.round(Number(b.min_capital_cents) || 0)),
    allow_funded: b.allow_funded !== false,
    default_multiplier: clampMult(b.default_multiplier),
    updated_at: new Date().toISOString(),
  };
  // El mentor debe aceptar sus responsabilidades para activar la oferta.
  if (b.enabled && b.accepted) row.terms_accepted_at = new Date().toISOString();
  const existing = await getOffer(mentorId);
  if (existing) { await supabaseAdmin.from('academy_copy_offers').update(row).eq('mentor_id', mentorId); return { ...existing, ...row }; }
  const { data } = await supabaseAdmin.from('academy_copy_offers').insert(row).select('*').single();
  return data as any;
}

// Info pública/segura de la oferta de un mentor (para la tarjeta del alumno).
export async function offerInfo(mentorId: string) {
  const [offer, s] = await Promise.all([getOffer(mentorId), copyMentorSettings()]);
  if (!offer || !offer.enabled || !s.enabled || !offer.master_account_id) return { available: false };
  return {
    available: true,
    priceCents: offer.price_cents,
    currency: offer.currency || 'usd',
    minCapitalCents: offer.min_capital_cents || 0,
    allowFunded: offer.allow_funded !== false,
    onyxFeePct: s.onyx_fee_pct,
  };
}

// ---- SUSCRIPCIÓN del alumno ----
export async function getSub(mentorId: string, studentId: string) {
  const { data } = await supabaseAdmin.from('academy_copy_subs').select('*').eq('mentor_id', mentorId).eq('student_id', studentId).maybeSingle();
  return (data as any) || null;
}

// Crea/activa la suscripción tras el pago (idempotente por par mentor+alumno).
export async function activateSub(o: { mentorId: string; studentId: string; subId?: string; periodEnd?: number }) {
  const offer = await getOffer(o.mentorId);
  const patch: any = {
    offer_id: offer?.id || null, mentor_id: o.mentorId, student_id: o.studentId,
    status: 'pending_connect',   // paga → falta que conecte su cuenta
    stripe_subscription_id: o.subId || null,
    current_period_end: o.periodEnd ? new Date(o.periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  await supabaseAdmin.from('academy_copy_subs').upsert(patch, { onConflict: 'mentor_id,student_id' });
  // Si ya tenía cuenta conectada de antes, reactiva el enlace.
  const sub = await getSub(o.mentorId, o.studentId);
  if (sub?.copy_link_id) { await supabaseAdmin.from('copy_links').update({ enabled: true }).eq('id', sub.copy_link_id); await setSubStatus(o.mentorId, o.studentId, 'active'); }
}

// El alumno conecta su cuenta → se crea el copy_link (proporcional + límites).
export async function connectSlave(o: {
  mentorId: string; studentId: string; slaveAccountId: string;
  accountType?: string; riskMultiplier?: number; fundedDaily?: number | null; fundedMaxDd?: number | null; consent?: boolean;
}) {
  if (!o.consent) throw new Error('Debes aceptar los riesgos antes de conectar.');
  const [offer, sub] = await Promise.all([getOffer(o.mentorId), getSub(o.mentorId, o.studentId)]);
  if (!offer?.master_account_id) throw new Error('El mentor no tiene cuenta maestra configurada.');
  if (!sub || sub.status === 'canceled') throw new Error('No tienes una suscripción de copy activa.');

  const accountType = o.accountType === 'funded' ? 'funded' : 'own';
  const mult = clampMult(o.riskMultiplier ?? offer.default_multiplier);
  const lim = riskLimits(accountType, o.fundedDaily, o.fundedMaxDd);

  // ¿ya existe enlace? actualiza; si no, crea. Guardian obligatorio: require_sl + límites.
  const linkRow: any = {
    master_account_id: offer.master_account_id, slave_account_id: o.slaveAccountId, enabled: true,
    mode: 'balance', multiplier: mult, require_sl: true,
    daily_loss_pct: lim.daily_loss_pct, max_drawdown_pct: lim.max_drawdown_pct,
    max_lot: 50,
  };
  let linkId = sub.copy_link_id;
  if (linkId) {
    await supabaseAdmin.from('copy_links').update(linkRow).eq('id', linkId);
  } else {
    const { data } = await supabaseAdmin.from('copy_links').insert(linkRow).select('id').single();
    linkId = (data as any)?.id;
  }

  await supabaseAdmin.from('academy_copy_subs').update({
    slave_account_id: o.slaveAccountId, copy_link_id: linkId, account_type: accountType,
    risk_multiplier: mult, funded_daily_pct: o.fundedDaily ?? null, funded_max_dd_pct: o.fundedMaxDd ?? null,
    status: 'active', consent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('mentor_id', o.mentorId).eq('student_id', o.studentId);
  return { copyLinkId: linkId };
}

export async function setSubStatus(mentorId: string, studentId: string, status: 'active' | 'paused' | 'canceled' | 'pending_connect') {
  const sub = await getSub(mentorId, studentId);
  if (!sub) return;
  // Enciende/apaga el enlace de copy según el estado.
  if (sub.copy_link_id) {
    await supabaseAdmin.from('copy_links').update({ enabled: status === 'active' }).eq('id', sub.copy_link_id);
  }
  await supabaseAdmin.from('academy_copy_subs').update({ status, updated_at: new Date().toISOString() }).eq('id', sub.id);
}

// Sincroniza el estado del copy según el estado de la suscripción de Stripe.
// active/trialing → active (si ya conectó su cuenta) o pending_connect (si falta).
// cualquier otro → canceled (apaga el enlace). Reversible.
export async function syncCopyStatusBySub(subId: string, stripeStatus: string, periodEnd?: number) {
  const { data } = await supabaseAdmin.from('academy_copy_subs')
    .select('id,copy_link_id,status').eq('stripe_subscription_id', subId).maybeSingle();
  if (!data) return;
  const d = data as any;
  const active = stripeStatus === 'active' || stripeStatus === 'trialing';
  const newStatus = !active ? 'canceled' : (d.copy_link_id ? 'active' : 'pending_connect');
  if (d.copy_link_id) await supabaseAdmin.from('copy_links').update({ enabled: newStatus === 'active' }).eq('id', d.copy_link_id);
  const patch: any = { status: newStatus, updated_at: new Date().toISOString() };
  if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();
  await supabaseAdmin.from('academy_copy_subs').update(patch).eq('id', d.id);
}

// Registra la comisión de Onyx del copy en el libro (para Finanzas). Idempotente
// por (mentor_id, stripe_ref). Usa el % de Copy del mentor (no el de academia).
export async function recordCopyCommission(o: { subId: string; grossCents: number; currency?: string; invoiceId: string }) {
  if (!o.subId || !o.invoiceId || !o.grossCents) return;
  const { data } = await supabaseAdmin.from('academy_copy_subs').select('mentor_id,student_id').eq('stripe_subscription_id', o.subId).maybeSingle();
  if (!data) return;
  const s = await copyMentorSettings();
  const fee = Math.round((o.grossCents || 0) * (s.onyx_fee_pct / 100));
  await supabaseAdmin.from('onyx_commissions').upsert({
    mentor_id: (data as any).mentor_id, student_id: (data as any).student_id,
    gross_cents: o.grossCents || 0, fee_cents: fee, currency: (o.currency || 'usd').toLowerCase().slice(0, 3),
    kind: 'copy', status: 'earned', stripe_ref: o.invoiceId,
  }, { onConflict: 'mentor_id,stripe_ref', ignoreDuplicates: true });
}

// Cancela por id de suscripción de Stripe (desde el webhook).
export async function cancelBySub(subId: string) {
  const { data } = await supabaseAdmin.from('academy_copy_subs').select('id,copy_link_id').eq('stripe_subscription_id', subId).maybeSingle();
  if (!data) return;
  if ((data as any).copy_link_id) await supabaseAdmin.from('copy_links').update({ enabled: false }).eq('id', (data as any).copy_link_id);
  await supabaseAdmin.from('academy_copy_subs').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', (data as any).id);
}

// El alumno ajusta su multiplicador de riesgo (0.1–3×).
export async function setRiskMultiplier(mentorId: string, studentId: string, mult: number) {
  const m = clampMult(mult);
  const sub = await getSub(mentorId, studentId);
  if (!sub) return;
  if (sub.copy_link_id) await supabaseAdmin.from('copy_links').update({ multiplier: m }).eq('id', sub.copy_link_id);
  await supabaseAdmin.from('academy_copy_subs').update({ risk_multiplier: m, updated_at: new Date().toISOString() }).eq('id', sub.id);
}

// ---- Panel del mentor: "Mis copiadores" (sin datos sensibles) ----
export async function mentorCopiers(mentorId: string) {
  const { data: subs } = await supabaseAdmin.from('academy_copy_subs')
    .select('student_id,slave_account_id,account_type,risk_multiplier,status,copy_link_id,created_at')
    .eq('mentor_id', mentorId).neq('status', 'canceled').order('created_at', { ascending: false });
  const rows = (subs || []) as any[];
  if (!rows.length) return { count: 0, activeCount: 0, copiers: [] };

  const sids = Array.from(new Set(rows.map((r) => r.student_id)));
  const aids = rows.map((r) => r.slave_account_id).filter(Boolean);
  const [{ data: profs }, { data: accts }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,email,avatar_url').in('id', sids),
    aids.length ? supabaseAdmin.from('trading_accounts').select('id,balance,copy_paused').in('id', aids) : Promise.resolve({ data: [] as any }),
  ]);
  const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
  const amap = new Map((accts || []).map((a: any) => [a.id, a]));

  const copiers = rows.map((r) => {
    const p = pmap.get(r.student_id) as any;
    const a = r.slave_account_id ? amap.get(r.slave_account_id) as any : null;
    const paused = a?.copy_paused;
    return {
      studentId: r.student_id,
      name: p?.full_name || (p?.email || '').split('@')[0] || 'Alumno',
      avatar: p?.avatar_url || null,
      accountType: r.account_type,
      balance: a ? Number(a.balance || 0) : null,
      riskMultiplier: Number(r.risk_multiplier || 1),
      status: r.status === 'active' && paused ? 'paused' : r.status,
    };
  });
  const activeCount = copiers.filter((c) => c.status === 'active').length;
  const capital = copiers.reduce((s, c) => s + (c.balance || 0), 0);
  return { count: copiers.length, activeCount, capital, copiers };
}
