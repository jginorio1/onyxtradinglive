-- ============================================
-- Onyx · Arreglo: perfiles que faltan
-- ============================================
-- Problema: el disparador que crea el perfil solo actua al registrarse.
-- Las cuentas creadas antes (o si el disparador fallo) se quedaron sin fila
-- en 'profiles', y entonces TODO cae al valor por defecto: plan free.
--
-- Ejecuta este archivo en Supabase → SQL Editor.

-- 1) Crear la fila de perfil de cualquier usuario que no la tenga
insert into profiles (id, email, plan)
select u.id, u.email, 'free'
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

-- 2) Rellenar el correo si quedo vacio en algun perfil
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- 3) Asegurar que el disparador existe para los registros futuros
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, plan)
  values (new.id, new.email, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 4) Devolverte el rol de owner (por si tambien se perdio)
update profiles set is_admin = true, role = 'owner' where email = 'jerryx35@gmail.com';

-- Comprueba el resultado:
select id, email, plan, is_admin, role from profiles;

notify pgrst, 'reload schema';
