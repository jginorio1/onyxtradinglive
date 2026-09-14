-- ============================================================
-- Onyx · Diario v3: riesgo por operación (para R:R)
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
--
-- Añade al diario por operación:
--   risk_amount → cuánto arriesgaste en la operación (en la divisa de la cuenta).
--                 Con esto la ficha calcula el resultado en R = neto / riesgo.
-- ============================================================

alter table trade_journal add column if not exists risk_amount numeric;   -- riesgo $ del trade (opcional)
