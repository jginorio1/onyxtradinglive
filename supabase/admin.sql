-- ============================================================
-- Onyx Trading Live · MIGRACIÓN del panel súper-admin
-- Pega esto en Supabase → SQL Editor → Run
-- (Es seguro ejecutarlo aunque ya tengas datos: solo añade cosas.)
-- ============================================================

-- 1) Nuevos campos de control en profiles
alter table profiles add column if not exists is_admin  boolean not null default false;
alter table profiles add column if not exists banned    boolean not null default false;
alter table profiles add column if not exists full_name text;

-- 2) Tabla de PLANES (editable desde el panel de admin)
create table if not exists plans (
  id           text primary key,          -- free | pro | elite | (los que crees)
  name         text not null,
  price_month  numeric not null default 0,
  price_year   numeric not null default 0,
  stripe_price_id       text,             -- price_... de Stripe (mensual)
  stripe_price_id_year  text,             -- price_... de Stripe (anual, opcional)
  max_accounts int not null default 1,
  features     jsonb not null default '[]'::jsonb,
  badge        text,                      -- ej. "Más popular"
  active       boolean not null default true,
  sort         int not null default 0,
  updated_at   timestamptz default now()
);

-- Semilla inicial (no pisa lo que ya exista)
insert into plans (id, name, price_month, price_year, max_accounts, features, badge, active, sort) values
  ('free',  'Free',  0,   0,   1,   '["1 cuenta MT","Estadísticas básicas","30 días de historial"]',                                   null,          true, 0),
  ('pro',   'Pro',   19,  190, 5,   '["5 cuentas MT","Todas las estadísticas","Historial ilimitado","Calendario y gráficas","Reglas de fondeo"]', 'Más popular', true, 1),
  ('elite', 'Elite', 39,  390, 999, '["Cuentas ilimitadas","Todo lo de Pro","Informes automáticos","Alertas por Telegram","Soporte prioritario"]', null,          true, 2)
on conflict (id) do nothing;

-- 3) Registro de acciones del admin (auditoría)
create table if not exists admin_log (
  id          uuid primary key default uuid_generate_v4(),
  admin_email text,
  action      text,
  target      text,
  meta        jsonb,
  created_at  timestamptz default now()
);

-- 4) RLS
alter table plans     enable row level security;
alter table admin_log enable row level security;

-- Cualquiera puede LEER los planes activos (para la página de precios).
drop policy if exists "plans public read" on plans;
create policy "plans public read" on plans for select using (active = true);

-- Escrituras de plans y todo admin_log: solo la service_role (el backend del panel).
-- La service_role salta RLS, así que no hacen falta políticas de escritura aquí.

create index if not exists idx_admin_log_created on admin_log(created_at desc);
