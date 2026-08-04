-- ============================================================
-- Onyx · Pagos a embajadores por Stripe Connect (+ referencia cripto/manual)
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
-- ============================================================

-- Cuenta Express del embajador (solo RECIBE pagos: capability transfers).
alter table ambassadors add column if not exists stripe_account_id text;
alter table ambassadors add column if not exists payouts_enabled  boolean not null default false;

-- Trazabilidad de cada pago realizado.
alter table ambassador_payouts add column if not exists method      text;   -- stripe | usdt | manual
alter table ambassador_payouts add column if not exists transfer_id text;   -- id de la transferencia de Stripe
alter table ambassador_payouts add column if not exists tx_ref      text;   -- hash cripto / referencia del pago manual

notify pgrst, 'reload schema';
