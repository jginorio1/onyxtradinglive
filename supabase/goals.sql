-- ============================================================
-- Metas de profit del trader (semanal / mensual / anual).
-- Antes se guardaban solo en el navegador (localStorage), por eso "se borraban"
-- al limpiar caché, cambiar de dispositivo o publicar una versión nueva.
-- Ahora viven en el perfil, atadas a la cuenta.
-- ============================================================
alter table if exists public.profiles
  add column if not exists goal_week  numeric not null default 0,
  add column if not exists goal_month numeric not null default 0,
  add column if not exists goal_year  numeric not null default 0;
