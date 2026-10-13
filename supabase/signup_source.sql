-- Fuente de registro del usuario: 'web' | 'ios' | 'android' (null = desconocido).
-- Se captura en el signUp (metadata) y el trigger la copia al perfil.
-- Los usuarios anteriores quedan en null (no se puede saber hacia atrás).

alter table public.profiles
  add column if not exists signup_source text;

-- Actualiza el trigger de alta para copiar la fuente desde raw_user_meta_data.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, signup_source)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'signup_source', '')
  )
  on conflict (id) do update
    set signup_source = coalesce(public.profiles.signup_source, excluded.signup_source);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
