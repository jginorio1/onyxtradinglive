-- ============================================================
-- Onyx Academy v29 · Onyx Guardian de pago dentro de la academia
-- El alumno puede SUSCRIBIRSE a Guardian (Pro o Elite) desde la comunidad.
-- El cobro va a la cuenta de Stripe de Onyx (no del mentor). Reversible:
-- si cancela, el webhook vuelve el tier a 'none' y Guardian se apaga.
-- ============================================================

-- Nivel de Guardian pagado por el alumno dentro de la academia.
--   'none' = no tiene · 'pro' = básico · 'elite' = completo
alter table public.profiles
  add column if not exists academy_guardian_tier text not null default 'none';

-- Suscripción de Stripe que respalda ese Guardian (para revocar al cancelar).
alter table public.profiles
  add column if not exists academy_guardian_sub_id text;

-- Índice para localizar rápido por suscripción desde el webhook.
create index if not exists idx_profiles_guardian_sub
  on public.profiles (academy_guardian_sub_id);
