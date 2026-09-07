-- ============================================================
-- Onyx Academy v30 · métodos de cobro de afiliados elegidos por el mentor
-- El mentor decide qué métodos ofrece (incluida cripto). El referido solo ve
-- esos. Cripto guarda además la red (TRC20/ERC20/BTC…) para no perder fondos.
-- ============================================================

-- Métodos que el mentor acepta para pagar a sus referidos.
-- Por defecto: PayPal, Zelle y Cripto (los más usados).
alter table public.mentors
  add column if not exists affiliate_payout_methods jsonb not null default '["paypal","zelle","crypto"]'::jsonb;

-- Red de la billetera cuando el método del referido es cripto (USDT-TRC20, BTC…).
alter table public.academy_payout_methods
  add column if not exists network text;
