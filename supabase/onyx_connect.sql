-- ============================================================
-- Onyx Connect — un solo EA que reporta su estado.
-- Añade a trading_accounts:
--   · trade_allowed : si el AutoTrading de MetaTrader está ENCENDIDO
--                     (el EA puede ejecutar: Guardian, Copy, TradingView).
--   · spread        : spread en vivo (en puntos) que reporta el EA.
-- Correr una sola vez en el editor SQL de Supabase. Es seguro re-ejecutar.
-- ============================================================

alter table if exists public.trading_accounts
  add column if not exists trade_allowed boolean,
  add column if not exists spread numeric;

-- (opcional) un índice no hace falta; son columnas de estado por cuenta.
