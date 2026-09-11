-- ============================================================
-- Onyx Bot Lab v3 · datos para revisar un robot antes de aprobarlo.
-- Ejecutar tras botlab_v2.sql.
-- ============================================================

-- Enlace a la prueba de rendimiento (backtest, Myfxbook, statement…) que sube el creador.
alter table public.bot_products add column if not exists proof_url text;
-- Notas internas del revisor (por qué se aprobó o rechazó).
alter table public.bot_products add column if not exists review_note text;
