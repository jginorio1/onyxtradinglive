-- ============================================================
-- Capa de "entitlements": el plan efectivo del usuario (profiles.plan) puede venir
-- de DOS fuentes y siempre gana el de mayor rango:
--   · Stripe  → web y Android (columna stripe_plan; lo fija el webhook de Stripe)
--   · Apple / RevenueCat → iOS (columnas iap_*; lo fija el webhook de RevenueCat)
--
-- profiles.plan sigue siendo el campo único que lee TODA la app; aquí solo añadimos
-- de dónde salió cada parte, para poder recalcular el efectivo y revertir cuando una
-- suscripción de Apple caduque (se vuelve al plan de Stripe, o a free). Idempotente.
-- ============================================================

alter table public.profiles add column if not exists stripe_plan   text;      -- plan que fija Stripe (web/Android)
alter table public.profiles add column if not exists iap_plan      text;      -- plan comprado en iOS (Apple/RevenueCat)
alter table public.profiles add column if not exists iap_product   text;      -- id del producto de App Store
alter table public.profiles add column if not exists iap_status    text;      -- active | expired | cancelled | none
alter table public.profiles add column if not exists iap_expires_at timestamptz;
alter table public.profiles add column if not exists rc_user_id    text;      -- app_user_id en RevenueCat (= profiles.id)
alter table public.profiles add column if not exists iap_updated_at timestamptz;

-- Backfill: el plan actual de cada usuario proviene hoy de Stripe → stripe_plan = plan.
update public.profiles set stripe_plan = plan where stripe_plan is null;

create index if not exists idx_profiles_rc_user on public.profiles(rc_user_id);
