-- NODO DE COBRO ÚNICO · el usuario conecta Stripe una sola vez y guarda su wallet
-- USDT una vez; todos los programas (Bot Lab, embajador, Copy, academia) reutilizan
-- la MISMA cuenta conectada. No borra los campos por-programa (compatibilidad):
-- estos son la fuente canónica y se copian a cada programa al conectar.
alter table profiles add column if not exists payout_stripe_account_id text;   -- cuenta Stripe Express compartida
alter table profiles add column if not exists payout_charges_enabled boolean default false;
alter table profiles add column if not exists payout_usdt_trc20 text;           -- wallet USDT · TRON
alter table profiles add column if not exists payout_usdt_erc20 text;           -- wallet USDT · Ethereum
alter table profiles add column if not exists payout_usdt_network text default 'trc20';  -- red preferida
