-- ============================================================
-- Cambio de plan PROGRAMADO (downgrade diferido) + avisos.
--
-- Filosofía: bajar de plan NUNCA quita funciones al instante. El trader
-- conserva lo que pagó hasta que expira el periodo; en esa fecha baja el plan
-- (Stripe Subscription Schedule) y recién ahí se pausan las funciones sobrantes.
--
-- Correr una vez en Supabase (SQL editor). Es idempotente.
-- ============================================================

-- --- profiles: estado del cambio pendiente ---
alter table profiles add column if not exists pending_plan        text;            -- plan al que bajará
alter table profiles add column if not exists pending_plan_at     timestamptz;     -- cuándo aplica (fin de periodo)
alter table profiles add column if not exists pending_schedule_id text;            -- id del Subscription Schedule (para cancelar)
alter table profiles add column if not exists pending_notified_3d boolean default false;  -- ya se avisó 3 días antes
alter table profiles add column if not exists pending_keep        jsonb;           -- ids de cuentas a conservar (elección del trader)

-- --- trading_accounts: cuenta pausada por límite de plan ---
-- No se borra: si vuelve a subir de plan, se reactiva.
alter table trading_accounts add column if not exists plan_paused boolean default false;

-- Aviso de facturación por Telegram (independiente de la capacidad Telegram del plan)
alter table profiles add column if not exists tg_billing boolean default true;
