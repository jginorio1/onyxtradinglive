-- ============================================================
-- Onyx Trading Live · esquema de base de datos (Supabase / Postgres)
-- Pega esto en Supabase → SQL Editor → Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- Perfiles (extiende auth.users de Supabase Auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',              -- free | pro | elite
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,                        -- active | trialing | past_due | canceled
  created_at timestamptz default now()
);

-- API keys que usa el conector EA (MT4/MT5)
create table if not exists api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null unique,
  label text,
  revoked boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Cuentas de trading conectadas
create table if not exists trading_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  login bigint not null,
  broker text, server text, name text, currency text,
  leverage int, platform text default 'MT5',
  balance numeric, equity numeric,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, login, server)
);

-- Operaciones cerradas (idempotente por ticket)
create table if not exists trades (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references trading_accounts(id) on delete cascade,
  ticket bigint not null,
  symbol text, side text, volume numeric,
  open_time timestamptz, open_price numeric,
  close_time timestamptz, close_price numeric,
  profit numeric, commission numeric, swap numeric, net_profit numeric,
  created_at timestamptz default now(),
  unique (account_id, ticket)
);

-- Posiciones abiertas (estado actual; se reemplaza en cada sync)
create table if not exists open_positions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references trading_accounts(id) on delete cascade,
  ticket bigint not null,
  symbol text, side text, volume numeric,
  open_time timestamptz, open_price numeric,
  sl numeric, tp numeric, profit numeric,
  updated_at timestamptz default now(),
  unique (account_id, ticket)
);

create index if not exists idx_trades_account on trades(account_id, close_time);
create index if not exists idx_accounts_user  on trading_accounts(user_id);

-- ============================================================
-- Seguridad a nivel de fila (RLS): cada usuario solo ve lo suyo.
-- El endpoint /v1/sync usa la service_role key y salta el RLS.
-- ============================================================
alter table profiles          enable row level security;
alter table api_keys          enable row level security;
alter table trading_accounts  enable row level security;
alter table trades            enable row level security;
alter table open_positions    enable row level security;

create policy "own profile"   on profiles         for select using (auth.uid() = id);
create policy "own keys"      on api_keys         for all    using (auth.uid() = user_id);
create policy "own accounts"  on trading_accounts for select using (auth.uid() = user_id);
create policy "own trades"    on trades           for select using (
  account_id in (select id from trading_accounts where user_id = auth.uid()));
create policy "own positions" on open_positions   for select using (
  account_id in (select id from trading_accounts where user_id = auth.uid()));

-- Crear perfil automaticamente al registrarse un usuario
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
