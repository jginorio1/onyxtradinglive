-- ============================================================
-- Ganancias parciales / cierres parciales por posición.
-- Cada cierre (deal en MT5, orden en MT4, deal en cTrader/Match-Trader) sigue
-- siendo una fila en trades (única por account_id+ticket). Estas columnas
-- permiten AGRUPAR los cierres de la misma posición y saber cómo salió:
--   position_id  = id de la posición original (agrupa TP1, TP2, runner…).
--   exit_reason  = tp | sl | trailing | manual | so (stop out) | other.
--   closed_volume= volumen cerrado en ESTE cierre (para sumar parciales).
-- Correr una vez. Idempotente.
-- ============================================================
alter table if exists public.trades
  add column if not exists position_id   text,
  add column if not exists exit_reason   text,
  add column if not exists closed_volume numeric;

create index if not exists idx_trades_position on public.trades (account_id, position_id);

notify pgrst, 'reload schema';
