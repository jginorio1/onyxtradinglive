-- Onyx Copy Trading · esquema Fase 1
-- Enlaces master→esclava, cola de comandos y log. Ejecutar en Supabase SQL Editor.

create table if not exists public.copy_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  master_account_id uuid not null,
  slave_account_id uuid not null,
  mode text not null default 'balance',        -- balance | risk | pips | fixed
  multiplier numeric not null default 1,
  risk_pct numeric not null default 1,          -- para mode=risk (% del balance)
  pip_risk numeric not null default 20,         -- para mode=pips
  max_lot numeric not null default 50,
  reverse boolean not null default false,
  symbol_map jsonb not null default '{}'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  humanize jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (master_account_id, slave_account_id)
);
create index if not exists copy_links_owner on public.copy_links(owner_id);
create index if not exists copy_links_master on public.copy_links(master_account_id) where enabled;

create table if not exists public.copy_commands (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.copy_links(id) on delete cascade,
  slave_account_id uuid not null,
  action text not null,                          -- open | close | modify
  master_ticket text,
  base_symbol text,
  side text,                                     -- buy | sell
  volume_hint numeric,
  sl numeric, tp numeric, price numeric,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',        -- pending | done | failed | skipped
  error text,
  created_at timestamptz not null default now(),
  taken_at timestamptz, done_at timestamptz
);
create index if not exists copy_commands_queue on public.copy_commands(slave_account_id, status, created_at);

create table if not exists public.copy_log (
  id bigserial primary key,
  owner_id uuid not null,
  link_id uuid,
  kind text not null,                            -- copied | closed | skipped | error | modify
  symbol text,
  detail jsonb not null default '{}'::jsonb,
  ok boolean not null default true,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists copy_log_owner on public.copy_log(owner_id, created_at desc);

-- RLS: el acceso a estas tablas va por el service role (supabaseAdmin) desde el backend,
-- igual que el resto de tablas de Onyx. No se exponen directamente al cliente.
