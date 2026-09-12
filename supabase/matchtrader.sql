-- ============================================================
-- MatchTrader (BETA) · conexión por API del broker.
-- MatchTrader no permite instalar EAs; la integración es server-side contra
-- la API REST del broker. Aquí guardamos las credenciales que el trader pega.
-- El motor (lib/matchtrader.ts) reutiliza el MISMO Guardian y Copy que MT/cTrader;
-- solo faltan por rellenar 3 llamadas a la API real del broker (ver el TODO).
-- ============================================================
create table if not exists public.matchtrader_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.trading_accounts(id) on delete cascade,
  user_id uuid not null,
  api_base text not null,          -- URL base de la API del broker (te la da el broker)
  api_key  text not null,          -- clave/token del broker
  system_uuid text,                -- algunos brokers piden un systemUuid / accountId
  enabled boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mtr_conn_user on public.matchtrader_connections(user_id);
create index if not exists mtr_conn_acc  on public.matchtrader_connections(account_id) where enabled;
alter table public.matchtrader_connections enable row level security;
