import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { COPY_FEE_PCT } from '@/lib/copyFollow';

// ============================================================
// Onyx Copy F4 · comisión por rendimiento con HIGH-WATER MARK.
// El trader cobra un % de la GANANCIA NUEVA del seguidor (la que supera el
// máximo acumulado ya cobrado). Nunca se cobra en la recuperación de un
// drawdown → alinea incentivos y protege al seguidor. Onyx retiene su parte.
// Se cobra periódicamente (cron mensual) vía Stripe Connect.
// ============================================================

// Ganancia acumulada del seguidor en su cuenta desde que empezó a medir (realizada).
async function cumulativeProfit(accountId: string, sinceIso: string): Promise<number> {
  const { data } = await supabaseAdmin.from('trades').select('net_profit').eq('account_id', accountId).gte('close_time', sinceIso).limit(100000);
  return (data || []).reduce((s: number, t: any) => s + (Number(t.net_profit) || 0), 0);
}

// Cobra (best-effort) la comisión de rendimiento de un seguidor y la registra.
// Solo avanza la marca de agua si el cobro se pudo crear en Stripe.
async function chargeOne(f: any): Promise<{ status: string; profit: number }> {
  const pct = Number(f.perf_fee_pct) || 0;
  if (pct <= 0) return { status: 'skipped', profit: 0 };
  const since = f.perf_started_at || f.created_at;
  const cum = await cumulativeProfit(f.follower_account_id, since);
  const gain = cum - (Number(f.hwm_profit) || 0);          // ganancia NUEVA sobre la marca de agua
  if (gain < 1) return { status: 'skipped', profit: gain }; // nada nuevo que cobrar (o en drawdown)

  const feeTotalCents = Math.round(gain * (pct / 100) * 100);
  const onyxCents = Math.round(feeTotalCents * (COPY_FEE_PCT / 100));
  const netCents = feeTotalCents - onyxCents;
  const now = new Date().toISOString();

  // Cuenta Connect del trader (para recibir su parte).
  const { data: prov } = await supabaseAdmin.from('strategy_providers').select('user_id').eq('id', f.provider_id).maybeSingle();
  const { data: provProf } = await supabaseAdmin.from('profiles').select('copy_stripe_account_id,copy_charges_enabled').eq('id', (prov as any)?.user_id).maybeSingle();
  const providerAccount = (provProf as any)?.copy_stripe_account_id;

  let status = 'failed'; let invoiceId: string | null = null;
  if (f.stripe_customer_id && providerAccount && (provProf as any)?.copy_charges_enabled && feeTotalCents > 0) {
    try {
      await stripe.invoiceItems.create({ customer: f.stripe_customer_id, amount: feeTotalCents, currency: 'usd', description: 'Onyx Copy · comisión por rendimiento' });
      const inv = await stripe.invoices.create({ customer: f.stripe_customer_id, application_fee_amount: onyxCents, transfer_data: { destination: providerAccount }, on_behalf_of: providerAccount, auto_advance: true, collection_method: 'charge_automatically', metadata: { onyx_kind: 'copyperf', onyx_follow: f.id, onyx_provider: f.provider_id } });
      invoiceId = inv.id;
      try { await stripe.invoices.finalizeInvoice(inv.id); } catch {}
      status = 'charged';
    } catch { status = 'failed'; }
  }

  await supabaseAdmin.from('copy_perf_charges').insert({
    follow_id: f.id, provider_id: f.provider_id, period_start: since, period_end: now,
    profit_cents: Math.round(gain * 100), fee_cents: feeTotalCents, onyx_cents: onyxCents, net_cents: netCents,
    currency: 'usd', invoice_id: invoiceId, status,
  });
  // La marca de agua solo sube si de verdad se cobró (si falla, se reintenta el mes que viene).
  if (status === 'charged') await supabaseAdmin.from('copy_follows').update({ hwm_profit: cum, updated_at: now }).eq('id', f.id);
  return { status, profit: gain };
}

// Ejecuta el cobro de rendimiento de todas las copias activas con % > 0.
export async function runPerformanceFees(): Promise<{ processed: number; charged: number; skipped: number; failed: number }> {
  const { data: follows } = await supabaseAdmin.from('copy_follows')
    .select('id,provider_id,follower_account_id,perf_fee_pct,hwm_profit,stripe_customer_id,perf_started_at,created_at')
    .eq('status', 'active').gt('perf_fee_pct', 0).limit(2000);
  let charged = 0, skipped = 0, failed = 0;
  for (const f of (follows || []) as any[]) {
    try {
      const r = await chargeOne(f);
      if (r.status === 'charged') charged++; else if (r.status === 'failed') failed++; else skipped++;
    } catch { failed++; }
  }
  return { processed: (follows || []).length, charged, skipped, failed };
}
