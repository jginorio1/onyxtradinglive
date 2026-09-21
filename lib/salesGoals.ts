import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { SalesSettings } from '@/lib/sales';

function ym(d = new Date()): string { return d.toISOString().slice(0, 7); }

// ---------- EXTRACTO DEL VENDEDOR ----------
// Línea por línea: cliente, nivel, base, %, monto, estado efectivo y fecha.
export async function repStatement(repId: string, limit = 200): Promise<any[]> {
  const { data } = await supabaseAdmin.from('sales_commissions')
    .select('client_user_id,level,base_amount,pct,amount,currency,status,available_at,created_at,invoice_id')
    .eq('rep_id', repId).order('created_at', { ascending: false }).limit(limit);
  const rows = (data || []) as any[];
  const ids = Array.from(new Set(rows.map((r) => r.client_user_id).filter(Boolean)));
  const byId: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id,email,name').in('id', ids);
    (profs || []).forEach((p: any) => { byId[p.id] = p.email || p.name || ''; });
  }
  const now = Date.now();
  return rows.map((r) => {
    const eff = r.status === 'paid' ? 'paid'
      : r.status === 'reversed' ? 'reversed'
      : (r.status === 'available' || (r.available_at && new Date(r.available_at).getTime() <= now)) ? 'available'
      : 'pending';
    return {
      client: r.level === 'bonus' ? (byId[r.client_user_id] || 'Bono') : (byId[r.client_user_id] || '—'),
      level: r.level, base: Number(r.base_amount) || 0, pct: Number(r.pct) || 0,
      amount: Number(r.amount) || 0, currency: r.currency || 'USD', status: eff,
      when: r.created_at, available_at: r.available_at,
    };
  });
}

// ---------- METAS Y BONOS ----------
export async function goalFor(repId: string, period: string, s: SalesSettings) {
  const { data } = await supabaseAdmin.from('sales_goals').select('*').eq('rep_id', repId).eq('period', period).maybeSingle();
  if (data) return {
    target_clients: Number((data as any).target_clients) || 0,
    target_amount: Number((data as any).target_amount) || 0,
    bonus_amount: Number((data as any).bonus_amount) || 0, custom: true,
  };
  return { target_clients: s.goal_clients || 0, target_amount: s.goal_amount || 0, bonus_amount: s.goal_bonus || 0, custom: false };
}

// Progreso del mes en curso para un rep: clientes nuevos pagados + comisión generada.
export async function goalProgress(repId: string, s: SalesSettings) {
  const period = ym();
  const start = period + '-01T00:00:00.000Z';
  const goal = await goalFor(repId, period, s);
  const { count: newClients } = await supabaseAdmin.from('sales_clients')
    .select('*', { count: 'exact', head: true }).eq('rep_id', repId).gte('first_paid_at', start);
  const { data: comms } = await supabaseAdmin.from('sales_commissions')
    .select('amount,status').eq('rep_id', repId).gte('created_at', start);
  const amount = (comms || []).filter((c: any) => c.status !== 'reversed').reduce((a: number, c: any) => a + (Number(c.amount) || 0), 0);
  const met = (goal.target_clients > 0 || goal.target_amount > 0)
    && (goal.target_clients > 0 ? (newClients || 0) >= goal.target_clients : true)
    && (goal.target_amount > 0 ? amount >= goal.target_amount : true);
  return {
    period, target_clients: goal.target_clients, target_amount: goal.target_amount, bonus_amount: goal.bonus_amount,
    clients: newClients || 0, amount: Math.round(amount * 100) / 100, custom: goal.custom, met: !!met,
  };
}

// Otorga el bono si cumplió la meta y no se ha pagado (idempotente por rep+period).
// Refleja el bono como una comisión (aparece en saldo/extracto).
export async function awardBonusIfMet(repId: string, s: SalesSettings): Promise<boolean> {
  const p = await goalProgress(repId, s);
  const bonus = Number(p.bonus_amount) || 0;
  if (!(bonus > 0) || !p.met) return false;
  const ins = await supabaseAdmin.from('sales_bonuses').insert({ rep_id: repId, period: p.period, amount: bonus, reason: 'goal_met' }).select('id');
  if (ins.error || !ins.data || !ins.data.length) return false;   // ya existía (unique rep+period)
  const hold = s.hold_days || 0;
  await supabaseAdmin.from('sales_commissions').insert({
    rep_id: repId, client_user_id: null, level: 'bonus', invoice_id: `bonus-${p.period}-${repId}`,
    base_amount: 0, pct: 0, amount: bonus, currency: 'USD', status: 'pending',
    available_at: new Date(Date.now() + hold * 86400000).toISOString(),
  });
  try { const { notifyRep } = await import('@/lib/salesNotify'); await notifyRep(repId, 'commission', { amount: bonus }); } catch { /* opcional */ }
  return true;
}
