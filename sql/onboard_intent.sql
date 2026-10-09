-- ============================================================
-- Bienvenida: intencion del usuario + paywall visto una sola vez.
--
--   onboard_intent        : que servicios le interesan (monitor, guardian, copy,
--                           robots, academy, all). Ordena su panel y sirve para marketing.
--   onboard_paywall_seen  : true cuando ya vio la pantalla de planes de bienvenida,
--                           para no volver a mostrarla.
--
-- Idempotente: se puede correr varias veces sin problema.
-- ============================================================
alter table public.profiles add column if not exists onboard_intent        text[] default '{}';
alter table public.profiles add column if not exists onboard_paywall_seen   boolean default false;
