-- ============================================================
-- Lead Manager v1 — de dónde vienen los clientes registrados.
-- Modelo híbrido: auto-detección (UTM + referrer, first-touch) + pregunta de
-- respaldo en el onboarding ("¿Cómo nos conociste?") solo cuando el origen quedó
-- en "directo/desconocido". Aquí guardamos el resultado en el perfil.
--
-- lead_source      : fuente normalizada (facebook, instagram, google, referral,
--                    whatsapp, youtube, tiktok, email, ads, web, direct, otro…).
-- lead_detected    : true si vino de auto-detección, false si lo respondió el usuario.
-- lead_utm_*       : UTM crudos del primer toque (para campañas finas).
-- lead_landing     : página de entrada.
-- Tolerante: si la columna ya existe, no hace nada.
-- ============================================================

alter table public.profiles
  add column if not exists lead_source   text,
  add column if not exists lead_detected boolean,
  add column if not exists lead_utm_source   text,
  add column if not exists lead_utm_medium   text,
  add column if not exists lead_utm_campaign text,
  add column if not exists lead_landing  text;

-- Índice para agrupar rápido por fuente en el Lead Manager.
create index if not exists idx_profiles_lead_source on public.profiles (lead_source);

-- Extiende el trigger de alta para copiar también lead_source/UTM desde la
-- metadata del signUp (así no se pierde aunque el usuario salte el onboarding).
-- Mantiene la copia de signup_source que ya existía.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, signup_source, lead_source, lead_detected, lead_utm_source, lead_utm_medium, lead_utm_campaign, lead_landing)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'signup_source', ''),
    nullif(new.raw_user_meta_data->>'lead_source', ''),
    case when (new.raw_user_meta_data->>'lead_detected') = 'true' then true
         when (new.raw_user_meta_data->>'lead_detected') = 'false' then false
         else null end,
    nullif(new.raw_user_meta_data->>'lead_utm_source', ''),
    nullif(new.raw_user_meta_data->>'lead_utm_medium', ''),
    nullif(new.raw_user_meta_data->>'lead_utm_campaign', ''),
    nullif(new.raw_user_meta_data->>'lead_landing', '')
  )
  on conflict (id) do update
    set signup_source = coalesce(public.profiles.signup_source, excluded.signup_source),
        lead_source   = coalesce(public.profiles.lead_source,   excluded.lead_source),
        lead_detected = coalesce(public.profiles.lead_detected, excluded.lead_detected),
        lead_utm_source   = coalesce(public.profiles.lead_utm_source,   excluded.lead_utm_source),
        lead_utm_medium   = coalesce(public.profiles.lead_utm_medium,   excluded.lead_utm_medium),
        lead_utm_campaign = coalesce(public.profiles.lead_utm_campaign, excluded.lead_utm_campaign),
        lead_landing  = coalesce(public.profiles.lead_landing,  excluded.lead_landing);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
