import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Gastos automáticos que salen de Onyx (dinero que pagamos/regalamos) y que
// deben restarse en el P&L, además de los gastos manuales:
//   · Comisiones a embajadores (tabla commissions) — cash a embajadores.
//   · Recompensas de "Invita y gana" de miembros (member_rewards) — crédito
//     que se aplica a la suscripción del miembro (coste real para Onyx).
// NO incluye pagos de afiliados de academia: esos los paga el MENTOR, no Onyx.
// ============================================================

export type AutoExpenses = { ambassadors: number; members: number };

// Suma en dólares de lo devengado en el mes [mStart, mEnd] (excluye revertidos).
export async function autoExpensesForMonth(mStart: number, mEnd: number): Promise<AutoExpenses> {
  const fromISO = new Date(mStart).toISOString();
  const toISO = new Date(mEnd).toISOString();
  let ambassadors = 0, members = 0;
  try {
    const { data } = await supabaseAdmin.from('commissions')
      .select('amount,status,created_at').gte('created_at', fromISO).lte('created_at', toISO);
    ambassadors = (data || []).filter((r: any) => r.status !== 'reversed').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  } catch {}
  try {
    const { data } = await supabaseAdmin.from('member_rewards')
      .select('amount,status,created_at').gte('created_at', fromISO).lte('created_at', toISO);
    members = (data || []).filter((r: any) => r.status !== 'reversed').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  } catch {}
  return { ambassadors: Math.round(ambassadors), members: Math.round(members) };
}
