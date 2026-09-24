-- ============================================================
-- MatchTrader Platform API (retail) — el trader conecta SU cuenta de SU bróker.
-- 1) Catálogo de brókers/prop firms (editable desde admin): nombre + URL de la
--    Platform API + si es prop (para el aviso) + si se permite copy.
-- 2) Columnas nuevas en matchtrader_connections para la sesión retail: tokens
--    cifrados (co-auth + trading), dominio de trading, uuid de cuenta, estado.
-- Idempotente.
-- ============================================================

create table if not exists public.mt_brokers (
  code        text primary key,           -- p.ej. 'fundednext'
  name        text not null,              -- 'FundedNext'
  base_url    text not null,              -- URL base de la Platform API del bróker
  is_prop     boolean not null default false,  -- prop firm → muestra aviso de reglas
  copy_allowed boolean not null default true,  -- permite activar copy (el trader decide)
  enabled     boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.mt_brokers enable row level security;

-- Sesión retail en la tabla de conexiones existente.
alter table public.matchtrader_connections add column if not exists kind text not null default 'platform'; -- platform | broker
alter table public.matchtrader_connections add column if not exists broker_code text;
alter table public.matchtrader_connections add column if not exists trading_domain text;
alter table public.matchtrader_connections add column if not exists account_uuid text;
alter table public.matchtrader_connections add column if not exists co_token text;        -- cifrado
alter table public.matchtrader_connections add column if not exists trading_token text;   -- cifrado
alter table public.matchtrader_connections add column if not exists token_at timestamptz;
alter table public.matchtrader_connections add column if not exists status text not null default 'ok'; -- ok | reauth
alter table public.matchtrader_connections add column if not exists copy_enabled boolean not null default false;
alter table public.matchtrader_connections add column if not exists login text;
alter table public.matchtrader_connections add column if not exists role text not null default 'both';
alter table public.matchtrader_connections add column if not exists master_snapshot jsonb;
alter table public.matchtrader_connections add column if not exists label text;
-- api_key/system_uuid ya existen de la versión anterior; en Platform no se usa api_key.
alter table public.matchtrader_connections alter column api_key drop not null;

alter table public.copy_commands add column if not exists slave_ticket text;

-- Semillas de ejemplo (edítalas/añade desde admin). FundedNext: confirma su base_url real.
insert into public.mt_brokers(code, name, base_url, is_prop, copy_allowed, sort) values
  ('fundednext', 'FundedNext', 'https://mtr.fundednext.com', true, true, 1)
on conflict (code) do nothing;
