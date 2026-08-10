-- ============================================================
-- Onyx Academy · v17 — Comisión por plan del mentor + historial de cambios.
-- Idempotente. Correr DESPUÉS de academy_v16.sql.
-- ============================================================

-- 1) Comisión de academia por plan, dentro del JSON capabilities de cada plan.
--    Es solo la SEMILLA por defecto; luego se edita desde el panel del dueño.
--    Entre más alto el plan, menor la comisión. (El operador `||` fusiona el JSON.)
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":15}'::jsonb where id = 'free';
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":10}'::jsonb where id = 'pro';
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":6}'::jsonb  where id = 'elite';
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":3}'::jsonb  where id in ('black_onyx', 'black');

-- 2) Historial de cambios de comisión (quién / cuándo / ámbito / valor).
create table if not exists academy_fee_log (
  id          uuid primary key default gen_random_uuid(),
  actor_email text,
  scope       text not null,          -- default | plan | mentor
  target      text,                   -- id del plan o del mentor (null para 'default')
  pct         numeric,                -- % nuevo; null = vuelve al valor heredado
  created_at  timestamptz not null default now()
);
create index if not exists idx_fee_log_created on academy_fee_log (created_at desc);

notify pgrst, 'reload schema';
