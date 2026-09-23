import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { salesSettings, balances, subtreeRepIds, type SalesSettings } from '@/lib/sales';

// ============================================================
// Motor de DESEMPEÑO + ATENCIÓN de la red de ventas.
//  · repScorecard   → todas las métricas de un representante + puntaje 0-100 + tier
//  · scoreboard     → tarjetas de todo el equipo (admin) o de una rama (supervisor)
//  · csMetrics      → atención al cliente (tickets, tiempo de respuesta)
//  · reseñas / evaluaciones 360 / acciones (plan de manejo)
// El puntaje y el tier alimentan el "plan de manejo" (IA recomienda, tú decides).
// ============================================================

const DAY = 86400000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type Scorecard = {
  rep_id: string;
  clients: number; active: number; new30: number; churned: number;
  revenue30: number;                 // ventas generadas (base) últimos 30 días
  earned: number; pending: number; available: number; paid: number; earned30: number;
  trials: number; discounts: number; trial_conv: number;   // % conversión de pruebas
  rating: number; reviews: number;                          // reseñas de clientes
  tickets_open: number; tickets_answered: number; resp_hrs: number | null;
  score: number;                     // 0-100 compuesto
  tier: 'star' | 'solid' | 'risk';
  parts: { rating: number; conversion: number; activity: number; service: number; retention: number };
};

// Métricas de atención al cliente de un rep (a partir de los tickets de SUS clientes).
export async function csMetrics(clientIds: string[], repUserId?: string): Promise<{ open: number; answered: number; respHrs: number | null }> {
  if (!clientIds.length) return { open: 0, answered: 0, respHrs: null };
  const { data: tickets } = await supabaseAdmin.from('support_tickets')
    .select('id,status,created_at,user_id').in('user_id', clientIds).order('created_at', { ascending: false }).limit(150);
  const list = (tickets || []) as any[];
  const open = list.filter((t) => t.status !== 'closed').length;
  if (!list.length) return { open, answered: 0, respHrs: null };
  const ids = list.map((t) => t.id);
  const { data: msgs } = await supabaseAdmin.from('support_messages')
    .select('ticket_id,sender,sender_id,created_at').in('ticket_id', ids).order('created_at', { ascending: true }).limit(2000);
  const firstAgent: Record<string, number> = {};
  let answered = 0;
  const createdAt: Record<string, number> = {}; list.forEach((t) => { createdAt[t.id] = new Date(t.created_at).getTime(); });
  (msgs || []).forEach((m: any) => {
    if (m.sender === 'agent' && !firstAgent[m.ticket_id]) {
      // Si sabemos el usuario del rep, cuenta las que respondió él; si no, cualquier agente.
      if (!repUserId || !m.sender_id || m.sender_id === repUserId) { firstAgent[m.ticket_id] = new Date(m.created_at).getTime(); answered++; }
    }
  });
  const gaps = Object.keys(firstAgent).map((tid) => (firstAgent[tid] - (createdAt[tid] || firstAgent[tid])) / 3600000).filter((h) => h >= 0 && h < 24 * 30);
  const respHrs = gaps.length ? round1(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  return { open, answered, respHrs };
}

// Tarjeta completa de un representante.
export async function repScorecard(repId: string, s?: SalesSettings): Promise<Scorecard> {
  const cfg = s || (await salesSettings());
  const now = Date.now();

  // Clientes del rep + estado.
  const { data: cs } = await supabaseAdmin.from('sales_clients').select('user_id,created_at,first_paid_at').eq('rep_id', repId).limit(1000);
  const rows = (cs || []) as any[];
  const ids = rows.map((r) => r.user_id);
  let active = 0, churned = 0;
  let profs: any[] = [];
  if (ids.length) {
    const { data } = await supabaseAdmin.from('profiles').select('id,plan,subscription_status').in('id', ids);
    profs = data || [];
  }
  const stById: Record<string, any> = {}; profs.forEach((p) => { stById[p.id] = p; });
  rows.forEach((r) => {
    const p = stById[r.user_id] || {};
    const isActive = p.plan && p.plan !== 'free' && ['active', 'trialing'].includes(p.subscription_status);
    if (isActive) active++;
    else if (r.first_paid_at) churned++;   // pagó alguna vez y ya no está activo
  });
  const new30 = rows.filter((r) => now - new Date(r.created_at).getTime() <= 30 * DAY).length;

  // Comisiones / ventas.
  const { data: comms } = await supabaseAdmin.from('sales_commissions')
    .select('level,base_amount,amount,status,created_at').eq('rep_id', repId).limit(4000);
  let earned = 0, earned30 = 0, revenue30 = 0;
  (comms || []).forEach((c: any) => {
    if (c.status === 'reversed') return;
    const amt = Number(c.amount) || 0; earned += amt;
    const t = new Date(c.created_at).getTime();
    if (now - t <= 30 * DAY) { earned30 += amt; if (c.level === 'direct') revenue30 += Number(c.base_amount) || 0; }
  });
  const bal = await balances(repId);

  // Pruebas y descuentos + conversión de pruebas.
  const { data: grants } = await supabaseAdmin.from('sales_grants').select('kind,client_user_id').eq('rep_id', repId).limit(2000);
  const trials = (grants || []).filter((g: any) => g.kind === 'trial').length;
  const discounts = (grants || []).filter((g: any) => g.kind === 'discount').length;
  const trialClients = Array.from(new Set((grants || []).filter((g: any) => g.kind === 'trial' && g.client_user_id).map((g: any) => g.client_user_id)));
  let convBase = trialClients.length, convHit = 0;
  if (convBase) {
    const paidSet = new Set(rows.filter((r) => r.first_paid_at).map((r) => r.user_id));
    convHit = trialClients.filter((id) => paidSet.has(id)).length;
  }
  const trial_conv = convBase ? Math.round((convHit / convBase) * 100) : 0;

  // Reseñas.
  const { data: revs } = await supabaseAdmin.from('sales_reviews').select('rating').eq('rep_id', repId).limit(1000);
  const reviews = (revs || []).length;
  const rating = reviews ? round1((revs || []).reduce((a: number, r: any) => a + (Number(r.rating) || 0), 0) / reviews) : 0;

  // Atención al cliente.
  const { data: rep } = await supabaseAdmin.from('sales_reps').select('user_id').eq('id', repId).maybeSingle();
  const cs2 = await csMetrics(ids, (rep as any)?.user_id);

  // ---- Puntaje 0-100 (ponderado). Cada parte 0-100. ----
  const pRating = reviews ? (rating / 5) * 100 : 60;                          // sin reseñas → neutro 60
  const pConversion = convBase ? trial_conv : (active ? 65 : 40);            // sin pruebas → según si tiene activos
  const activeRatio = rows.length ? active / rows.length : 0;
  const pActivity = Math.min(100, activeRatio * 100 * 0.7 + Math.min(active, 20) / 20 * 30);
  const pService = cs2.respHrs == null ? 70 : Math.max(0, 100 - cs2.respHrs * 6) * 0.7 + (cs2.open <= 2 ? 30 : cs2.open <= 5 ? 15 : 0);
  const churnRate = rows.filter((r) => r.first_paid_at).length ? churned / rows.filter((r) => r.first_paid_at).length : 0;
  const pRetention = Math.max(0, 100 - churnRate * 100);
  const parts = { rating: Math.round(pRating), conversion: Math.round(pConversion), activity: Math.round(pActivity), service: Math.round(pService), retention: Math.round(pRetention) };
  const score = Math.round(pRating * 0.4 + pConversion * 0.15 + pActivity * 0.15 + pService * 0.15 + pRetention * 0.15);
  const th = cfg.tier_thresholds || { star: 75, risk: 45 };
  const tier: Scorecard['tier'] = score >= th.star ? 'star' : score < th.risk ? 'risk' : 'solid';

  return {
    rep_id: repId, clients: rows.length, active, new30, churned,
    revenue30: round2(revenue30), earned: round2(earned), pending: bal.pending, available: bal.available, paid: bal.paid, earned30: round2(earned30),
    trials, discounts, trial_conv, rating, reviews,
    tickets_open: cs2.open, tickets_answered: cs2.answered, resp_hrs: cs2.respHrs,
    score, tier, parts,
  };
}

// Tarjetas del equipo. rootRepId null = TODO (admin); si se pasa, solo su rama.
export async function scoreboard(rootRepId: string | null): Promise<any[]> {
  const s = await salesSettings();
  let reps: any[] = [];
  if (rootRepId) {
    const ids = await subtreeRepIds(rootRepId);
    if (!ids.length) return [];
    const { data } = await supabaseAdmin.from('sales_reps').select('id,user_id,level,display_name,parent_id,status').in('id', ids);
    reps = data || [];
  } else {
    const { data } = await supabaseAdmin.from('sales_reps').select('id,user_id,level,display_name,parent_id,status').order('created_at', { ascending: true }).limit(300);
    reps = data || [];
  }
  const out: any[] = [];
  for (const r of reps) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('email,name').eq('id', r.user_id).maybeSingle();
    const card = await repScorecard(r.id, s);
    out.push({ ...card, level: r.level, parent_id: r.parent_id, status: r.status, name: r.display_name || (prof as any)?.name || (prof as any)?.email || 'Rep', email: (prof as any)?.email || null });
  }
  return out.sort((a, b) => b.score - a.score);
}

// -------- Reseñas --------
export async function submitReview(opts: { repId: string; clientUserId?: string | null; rating: number; comment?: string; source?: string }): Promise<{ ok: boolean; error?: string }> {
  const rating = Math.max(1, Math.min(5, Math.round(Number(opts.rating) || 0)));
  if (!opts.repId || !(rating >= 1)) return { ok: false, error: 'datos incompletos' };
  await supabaseAdmin.from('sales_reviews').insert({ rep_id: opts.repId, client_user_id: opts.clientUserId || null, rating, comment: String(opts.comment || '').slice(0, 1000) || null, source: opts.source || 'prompt' });
  return { ok: true };
}
export async function reviewsForRep(repId: string, limit = 100): Promise<any[]> {
  const { data } = await supabaseAdmin.from('sales_reviews').select('id,rating,comment,source,created_at,client_user_id').eq('rep_id', repId).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}
export async function reviewsForTeam(rootRepId: string | null, limit = 200): Promise<any[]> {
  let repIds: string[];
  if (rootRepId) repIds = await subtreeRepIds(rootRepId);
  else { const { data } = await supabaseAdmin.from('sales_reps').select('id').limit(500); repIds = (data || []).map((r: any) => r.id); }
  if (!repIds.length) return [];
  const { data } = await supabaseAdmin.from('sales_reviews').select('id,rep_id,rating,comment,source,created_at').in('rep_id', repIds).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

// -------- Evaluaciones 360 --------
export async function submitEvaluation(opts: { period?: string; raterRepId: string | null; rateeRepId: string; direction: string; scores: Record<string, number>; comment?: string }): Promise<{ ok: boolean; error?: string }> {
  const period = opts.period || new Date().toISOString().slice(0, 7);
  const vals = Object.values(opts.scores || {}).map((n) => Number(n) || 0).filter((n) => n > 0);
  const overall = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const { error } = await supabaseAdmin.from('sales_evaluations').upsert({
    period, rater_rep_id: opts.raterRepId, ratee_rep_id: opts.rateeRepId, direction: opts.direction,
    scores: opts.scores || {}, overall, comment: String(opts.comment || '').slice(0, 1000) || null,
  }, { onConflict: 'period,rater_rep_id,ratee_rep_id,direction' } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
export async function evaluationsFor(rateeRepId: string, limit = 50): Promise<any[]> {
  const { data } = await supabaseAdmin.from('sales_evaluations').select('*').eq('ratee_rep_id', rateeRepId).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

// -------- Plan de manejo (acciones) --------
export async function logAction(opts: { repId: string; kind: string; note?: string; tier?: string; by?: string }): Promise<{ ok: boolean }> {
  await supabaseAdmin.from('sales_actions').insert({ rep_id: opts.repId, kind: opts.kind, note: String(opts.note || '').slice(0, 1000) || null, tier: opts.tier || null, created_by: opts.by || null });
  return { ok: true };
}
export async function actionsFor(repId: string, limit = 30): Promise<any[]> {
  const { data } = await supabaseAdmin.from('sales_actions').select('*').eq('rep_id', repId).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

// Recomendación basada en reglas (respaldo si la IA no está disponible).
export function ruleSuggestion(card: Scorecard, names: { l2: string; l1: string; vendedor: string }, lang: 'es' | 'en' = 'es'): { headline: string; actions: string[] } {
  const es = lang === 'es';
  if (card.tier === 'star') return {
    headline: es ? '⭐ Estrella — candidato a ascenso o bono' : '⭐ Star — promotion or bonus candidate',
    actions: es ? ['Reconocer públicamente', 'Considerar ascenso a supervisor', 'Darle más cuentas o mentoría de otros'] : ['Recognize publicly', 'Consider promotion to supervisor', 'Give more accounts or let them mentor others'],
  };
  if (card.tier === 'risk') {
    const a: string[] = [];
    if (card.rating && card.rating < 3.5) a.push(es ? 'Baja satisfacción: revisar reseñas y hacer coaching de atención' : 'Low satisfaction: review reviews and coach on service');
    if (card.resp_hrs != null && card.resp_hrs > 12) a.push(es ? 'Respuesta lenta a tickets: fijar meta de <6 h' : 'Slow ticket replies: set a <6h target');
    if (card.trial_conv < 30 && card.trials) a.push(es ? 'Baja conversión de pruebas: acompañar en el cierre' : 'Low trial conversion: help with closing');
    if (card.churned > card.active) a.push(es ? 'Retención floja: plan de seguimiento con sus clientes' : 'Weak retention: follow-up plan with clients');
    if (!a.length) a.push(es ? 'Reunión 1:1 y plan de mejora a 30 días' : '1:1 meeting and 30-day improvement plan');
    return { headline: es ? '⚠ En riesgo — requiere plan de mejora' : '⚠ At risk — needs improvement plan', actions: a };
  }
  return {
    headline: es ? '✓ Sólido — mantener el ritmo' : '✓ Solid — keep the pace',
    actions: es ? ['Fijar una meta clara para subir a Estrella', 'Reforzar lo que mejor le funciona'] : ['Set a clear goal to reach Star', 'Double down on what works best'],
  };
}
