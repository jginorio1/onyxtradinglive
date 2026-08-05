-- ============================================================
-- Onyx · Pagos a embajadores por Stripe Connect (+ referencia cripto/manual)
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
-- ============================================================

-- Cuenta Express del embajador (solo RECIBE pagos: capability transfers).
alter table ambassadors add column if not exists stripe_account_id text;
alter table ambassadors add column if not exists payouts_enabled  boolean not null default false;

-- Red de la wallet cripto (TRC20 | ERC20 | BEP20) para evitar enviar a red equivocada.
alter table ambassadors add column if not exists payout_network text;

-- Trazabilidad de cada pago realizado.
alter table ambassador_payouts add column if not exists method      text;   -- stripe | usdt | manual
alter table ambassador_payouts add column if not exists transfer_id text;   -- id de la transferencia de Stripe
alter table ambassador_payouts add column if not exists tx_ref      text;   -- hash cripto / referencia del pago manual

-- Ya no ofrecemos PayPal: los embajadores creados antes quedan en Stripe.
update ambassadors set payout_method = 'stripe' where payout_method = 'paypal';

-- Por defecto, los nuevos embajadores cobran por Stripe.
alter table ambassadors alter column payout_method set default 'stripe';

notify pgrst, 'reload schema';
