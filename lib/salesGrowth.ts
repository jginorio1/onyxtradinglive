import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { salesSettings, activeClients, subtreeRepIds, assignClient } from '@/lib/sales';

// ---------- EMBUDO DE CONVERSIÓN ----------
// Por vendedor: clics (su enlace) → registros (atados a él) → pruebas → pagados.
export async function funnelStats(): Promise<{ totals: any; rows: any[] }> {
  const { data: reps } = await supabaseAdmin.from('sales_reps').select('id,code,level,display_name,user_id').eq('status', 'active');
  const list = (reps || []) as any[];
  const rows: any[] = [];
  const totals = { clicks: 0, signups: 0, trials: 0, paid: 0 };
  for (const r of list) {
    const { count: clicks } = await supabaseAdmin.from('sales_clicks').select('*', { count: 'exact', head: true }).eq('code', (r.code || '').toLowerCase());
    const { data: clients } = await supabaseAdmin.from('sales_clients').select('user_id,first_paid_at').eq('rep_id', r.id);
    const signups = (clients || []).length;
    const paid = (clients || []).filter((c: any) => c.first_paid_at).length;
    const { data: grants } = await supabaseAdmin.from('sales_grants').select('client_user_id').eq('rep_id', r.id).eq('kind', 'trial');
    const trials = new Set((grants || []).map((g: any) => g.client_user_id).filter(Boolean)).size;
    let name = r.display_name;
    if (!name) { const { data: p } = await supabaseAdmin.from('profiles').select('email').eq('id', r.user_id).maybeSingle(); name = (p as any)?.email || 'Rep'; }
    const conv = signups > 0 ? Math.round((paid / signups) * 100) : 0;   // registro→pagado
    rows.push({ rep_id: r.id, level: r.level, name, clicks: clicks || 0, signups, trials, paid, conv });
    totals.clicks += clicks || 0; totals.signups += signups; totals.trials += trials; totals.paid += paid;
  }
  rows.sort((a, b) => b.paid - a.paid);
  return { totals, rows };
}

// ---------- LEADS SIN DUEÑO ----------
// Usuarios registrados que no están atados a ningún vendedor (candidatos a repartir).
export async function unassignedLeads(limit = 100): Promise<any[]> {
  const { data: cs } = await supabaseAdmin.from('sales_clients').select('user_id');
  const taken = new Set((cs || []).map((c: any) => c.user_id));
  const { data: profs } = await supabaseAdmin.from('profiles')
    .select('id,email,name,plan,subscription_status,created_at').order('created_at', { ascending: false }).limit(500);
  const out: any[] = [];
  for (const p of (profs || []) as any[]) {
    if (taken.has(p.id)) continue;
    out.push({ user_id: p.id, email: p.email || null, name: p.name || null, plan: p.plan || 'free', status: p.subscription_status || null, since: p.created_at });
    if (out.length >= limit) break;
  }
  return out;
}

// Reparte los leads sin dueño entre los vendedores activos (nivel vendedor),
// balanceando por quien tiene menos clientes. Devuelve cuántos asignó.
export async function assignLeadsRoundRobin(max = 200): Promise<{ assigned: number }> {
  const { data: reps } = await supabaseAdmin.from('sales_reps').select('id').eq('status', 'active').eq('level', 'vendedor');
  const sellers = (reps || []) as any[];
  if (!sellers.length) return { assigned: 0 };
  // Carga actual por vendedor.
  const load: Record<string, number> = {};
  for (const r of sellers) { const { count } = await supabaseAdmin.from('sales_clients').select('*', { count: 'exact', head: true }).eq('rep_id', r.id); load[r.id] = count || 0; }
  const leads = await unassignedLeads(max);
  let assigned = 0;
  for (const lead of leads) {
    // vendedor con menos carga
    let pick = sellers[0].id; let min = load[pick];
    for (const r of sellers) { if (load[r.id] < min) { min = load[r.id]; pick = r.id; } }
    const ok = await assignClient(lead.user_id, pick, 'manual');
    if (ok) { load[pick]++; assigned++; }
  }
  return { assigned };
}

// ---------- ASCENSOS AUTOMÁTICOS ----------
// Sube de nivel según umbrales (reversible; el dueño puede apagar auto_promote y
// puede degradar manualmente). Avisa al vendedor. Devuelve los ascendidos.
export async function autoPromoteAll(): Promise<{ promoted: number; details: any[] }> {
  const s = await salesSettings();
  if (s.auto_promote === false) return { promoted: 0, details: [] };
  const l1Need = Number(s.promote_to_l1_clients) || 0;
  const l2Need = Number(s.promote_to_l2_team) || 0;
  const { data: reps } = await supabaseAdmin.from('sales_reps').select('id,level,user_id,display_name').eq('status', 'active');
  const details: any[] = []; let promoted = 0;
  for (const r of (reps || []) as any[]) {
    let to: 'l1' | 'l2' | null = null;
    if (r.level === 'vendedor' && l1Need > 0) { const ac = await activeClients(r.id); if (ac >= l1Need) to = 'l1'; }
    else if (r.level === 'l1' && l2Need > 0) { const team = await subtreeRepIds(r.id); if (team.length >= l2Need) to = 'l2'; }
    if (!to) continue;
    await supabaseAdmin.from('sales_reps').update({ level: to, auto_promoted: true, promoted_at: new Date().toISOString() }).eq('id', r.id);
    promoted++; details.push({ rep_id: r.id, to });
    try {
      const { salesSettings: ss } = await import('@/lib/sales');
      const set = await ss();
      const roleName = to === 'l2' ? (set.level_names?.l2 || 'Director') : (set.level_names?.l1 || 'Lead');
      const { notifyRep } = await import('@/lib/salesNotify');
      await notifyRep(r.id, 'promoted', { client: roleName });
    } catch { /* opcional */ }
  }
  return { promoted, details };
}

// Chequeo puntual de UN rep (se llama tras un pago, barato). Sube vendedor→l1.
export async function maybeAutoPromote(repId: string): Promise<void> {
  try {
    const s = await salesSettings();
    if (s.auto_promote === false) return;
    const { data: r } = await supabaseAdmin.from('sales_reps').select('id,level').eq('id', repId).maybeSingle();
    if (!r || (r as any).level !== 'vendedor') return;
    const need = Number(s.promote_to_l1_clients) || 0;
    if (need <= 0) return;
    const ac = await activeClients(repId);
    if (ac < need) return;
    await supabaseAdmin.from('sales_reps').update({ level: 'l1', auto_promoted: true, promoted_at: new Date().toISOString() }).eq('id', repId);
    try { const { notifyRep } = await import('@/lib/salesNotify'); await notifyRep(repId, 'promoted', { client: s.level_names?.l1 || 'Lead' }); } catch { /* opcional */ }
  } catch { /* opcional */ }
}
