-- ============================================================
-- TradeLocker (retail) — el trader conecta SU cuenta de SU bróker (que use
-- TradeLocker) con su propio login. TradeLocker es una plataforma multi-bróker:
-- un único endpoint demo/live; el "server" identifica al bróker.
--
-- 1) Catálogo de servers (editable desde admin): nombre visible + el string
--    "server" de TradeLocker + si es prop (aviso) + si permite copy.
-- 2) Tabla de conexiones: tokens cifrados (access + refresh), NUNCA la contraseña.
-- Idempotente.
-- ============================================================

create table if not exists public.tl_servers (
  code         text primary key,          -- p.ej. 'fundingpips'
  name         text not null,             -- 'FundingPips'
  server       text not null,             -- string "server" que pide TradeLocker al hacer login
  demo_default boolean not null default false, -- si por defecto es entorno demo
  is_prop      boolean not null default false, -- prop firm → muestra aviso de reglas
  copy_allowed boolean not null default true,  -- permite activar copy
  enabled      boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.tl_servers enable row level security;

create table if not exists public.tradelocker_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  account_id      bigint,                  -- trading_accounts.id (Guardian/Copy/dashboard)
  enabled         boolean not null default true,
  server          text,                    -- server usado en el login
  demo            boolean not null default false,
  tl_account_id   text,                    -- accountId (path de /trade)
  acc_num         text,                    -- accNum (cabecera)
  access_token    text,                    -- cifrado
  refresh_token   text,                    -- cifrado
  token_at        timestamptz,
  expire_at       timestamptz,
  status          text not null default 'ok',   -- ok | reauth
  role            text not null default 'both', -- master | slave | both
  copy_enabled    boolean not null default false,
  label           text,
  master_snapshot jsonb,
  last_sync_at    timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.tradelocker_connections enable row level security;
create index if not exists idx_tl_conn_user on public.tradelocker_connections(user_id);
create index if not exists idx_tl_conn_enabled on public.tradelocker_connections(enabled);
create unique index if not exists uq_tl_conn_acct on public.tradelocker_connections(user_id, tl_account_id);

-- La cola de copia ya existe (copy_commands); slave_ticket ya se añadió con MatchTrader.
alter table public.copy_commands add column if not exists slave_ticket text;

-- Semillas de ejemplo (edítalas/añade desde admin). Confirma el "server" real de cada bróker.
insert into public.tl_servers(code, name, server, demo_default, is_prop, copy_allowed, sort) values
  ('fundingpips', 'FundingPips', 'FundingPips', false, true, true, 1),
  ('alpha-capital', 'Alpha Capital', 'AlphaCapitalGroup', false, true, true, 2),
  ('tradelocker-demo', 'TradeLocker (Demo)', 'OSP', true, false, true, 99)
on conflict (code) do nothing;
