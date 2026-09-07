-- ============================================
-- Onyx Manager · Fase 1 (núcleo)
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Configuración del gestor por cuenta de trading
create table if not exists manager_configs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,
  enabled boolean not null default false,
  units text not null default 'pips',        -- pips | r | money
  config jsonb not null default '{}'::jsonb, -- breakeven, trailing, partials
  version int not null default 1,            -- sube en cada cambio; el EA la compara
  updated_at timestamptz default now(),
  unique (account_id)
);

-- Plantillas reutilizables del trader ("Mi setup FTMO")
create table if not exists manager_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  units text not null default 'pips',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Qué hizo el EA, cuándo y por qué
create table if not exists manager_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  account_id uuid references trading_accounts(id) on delete cascade,
  kind text not null,        -- breakeven | trailing | partial | close_all | blocked | info
  detail text,
  symbol text,
  ticket bigint,
  amount numeric,
  created_at timestamptz default now()
);

-- Cola de acciones rápidas que el EA recoge en su siguiente sync
create table if not exists manager_commands (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,
  command text not null,     -- close_all | close_profitable | close_losing | close_half | sl_to_be
  params jsonb default '{}'::jsonb,
  status text not null default 'pending',  -- pending | done | expired
  created_at timestamptz default now(),
  done_at timestamptz
);

-- El EA nos dice en qué hora vive su servidor (para convertir horarios más adelante)
alter table trading_accounts add column if not exists server_offset int;
alter table trading_accounts add column if not exists ea_version text;

create index if not exists manager_events_acc_idx on manager_events (account_id, created_at desc);
create index if not exists manager_commands_pending_idx on manager_commands (account_id, status);

-- Capacidades nuevas por plan (el gestor básico en Pro, el avanzado en Elite)
update plans set capabilities = capabilities
  || '{"manager": true}'::jsonb
  where id in ('pro', 'elite');
update plans set capabilities = capabilities
  || '{"manager_advanced": true}'::jsonb
  where id = 'elite';
update plans set capabilities = capabilities
  || '{"manager": false, "manager_advanced": false}'::jsonb
  where id = 'free';

notify pgrst, 'reload schema';
