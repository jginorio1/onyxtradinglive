-- ============================================================
-- "Noticias y ofertas" (marketing_emails) ENCENDIDO al registrarse.
-- Ya estaba por el default de la columna; aquí lo dejamos EXPLÍCITO en el trigger
-- de alta para que no dependa de nada más. Idempotente.
-- ============================================================

-- 1) Asegura la columna con default true (por si acaso).
alter table public.profiles add column if not exists marketing_emails boolean default true;

-- 2) El trigger de nuevo usuario crea el perfil con marketing_emails = true.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, marketing_emails)
  values (new.id, new.email, true)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 3) (Opcional) Enciende también a los que quedaron en NULL de antes.
--    NO toca a quien se dio de baja (esos están en false, se respetan).
update public.profiles set marketing_emails = true where marketing_emails is null;
