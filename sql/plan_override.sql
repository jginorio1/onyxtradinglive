-- ============================================================
-- Ajuste MANUAL del plan por el admin (override), que NO se revierte solo.
--
-- Antes, al subir un plan a mano (p. ej. Onyx Builder -> Black Onyx) solo se
-- cambiaba profiles.plan. Luego applyEffectivePlan() recalculaba el plan desde
-- stripe_plan / iap_plan y lo devolvia al anterior. Ahora el override cuenta como
-- una fuente mas: por mayor rango se mantiene hasta que el admin lo quite.
--
--   plan_override        : plan forzado por el admin (null = sin override)
--   plan_override_until  : hasta cuando vale (null = permanente)
--   plan_override_at     : cuando se fijo por ultima vez (auditoria)
--
-- Idempotente: se puede correr varias veces sin problema.
-- ============================================================
alter table public.profiles add column if not exists plan_override       text;
alter table public.profiles add column if not exists plan_override_until  timestamptz;
alter table public.profiles add column if not exists plan_override_at     timestamptz;
