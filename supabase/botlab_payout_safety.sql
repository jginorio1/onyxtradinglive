-- Seguridad de pagos de Bot Lab: maduración (available_at), reparto correcto del
-- referido (affiliate_cents descontado del creador), y clawback por reembolso.

-- Comisiones del creador: guardamos el % del referido que salió de ESTA venta,
-- la fecha en que el saldo madura, el payout que lo pagó y si se revirtió.
alter table bot_commissions add column if not exists affiliate_cents integer not null default 0;
alter table bot_commissions add column if not exists available_at timestamptz;
alter table bot_commissions add column if not exists payout_id uuid;
alter table bot_commissions add column if not exists reversed_at timestamptz;

-- Referidos: misma maduración y enlace al payout.
alter table bot_referrals add column if not exists available_at timestamptz;
alter table bot_referrals add column if not exists payout_id uuid;

-- Payouts: id de la transferencia Stripe (para clawback) y moneda.
alter table bot_payouts add column if not exists transfer_id text;
alter table bot_payouts add column if not exists currency text default 'usd';

create index if not exists bot_commissions_ref_idx on bot_commissions (ref);
create index if not exists bot_referrals_ref2_idx on bot_referrals (ref);

-- EMBAJADORES: clawback por reembolso/contracargo tardío. Marca de reversión en la
-- comisión (el transfer_id del payout ya existe en ambassador_payouts) para poder
-- revertir del transfer Stripe SOLO el monto de la comisión afectada.
alter table commissions add column if not exists reversed_at timestamptz;
create index if not exists commissions_invoice_idx on commissions (invoice_id);
