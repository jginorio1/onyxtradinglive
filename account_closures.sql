-- Lápidas de cuentas dadas de baja (el usuario borró su cuenta desde Mi cuenta).
-- La cuenta se borra de verdad (auth + perfil en cascada), pero antes guardamos
-- un registro mínimo aquí para poder CONTAR y VER las bajas en Admin → Usuarios.
-- No guarda datos sensibles: solo email, nombre, plan y fecha.
create table if not exists public.account_closures (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,                         -- id que tenía (ya no existe en auth)
  email       text,
  full_name   text,
  plan        text,
  reason      text,                         -- motivo opcional que escriba el usuario
  created_at  timestamptz not null default now()
);
create index if not exists account_closures_created_idx on public.account_closures (created_at desc);

-- Solo el service role (backend admin) la lee/escribe. RLS cerrado a usuarios.
alter table public.account_closures enable row level security;
-- (sin políticas = nadie con rol anon/authenticated accede; el service role ignora RLS)
