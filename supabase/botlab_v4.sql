-- ============================================================
-- Onyx Bot Lab v4 · liga el producto al robot REAL del creador.
-- Como el robot corre en nuestra plataforma, su EA ya reporta cada
-- operación (tabla trades, por cuenta + magic). Con esto calculamos un
-- score de verificación con datos reales, no con un link auto-declarado.
-- Ejecutar tras botlab_v3.sql.
-- ============================================================

-- Cuenta + magic del robot real (para jalar su historial de operaciones).
alter table public.bot_products add column if not exists bot_account uuid;   -- trading_accounts.id
alter table public.bot_products add column if not exists bot_magic   bigint; -- número mágico del EA

-- Score de verificación calculado (0–100) y cuándo se calculó, para no recalcular en cada carga.
alter table public.bot_products add column if not exists verify_score int;
alter table public.bot_products add column if not exists verify_at    timestamptz;
