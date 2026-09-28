-- ============================================================
-- DXtrade (Devexperts) — el trader conecta SU cuenta de SU bróker (que use DXtrade)
-- con su propio login. A diferencia de TradeLocker, DXtrade se despliega POR BRÓKER:
-- cada bróker/prop firm tiene su propio HOST (la API vive bajo /dxsca-web).
--
-- 1) Catálogo de servers (editable desde admin): nombre visible + host del bróker +
--    dominio por defecto + si es prop (aviso) + si permite copy.
-- 2) Tabla de conexiones: token de sesión cifrado, NUNCA la contraseña.
-- Idempotente.
-- ============================================================

create table if not exists public.dx_servers (
  code           text primary key,          -- p.ej. 'ftmo-dxtrade'
  name           text not null,             -- 'FTMO (DXtrade)'
  host           text not null,             -- host del bróker, ej. 'dxtrade.ftmo.com'
  domain_default text not null default 'default', -- dominio/clearing que pide el login
  demo_default   boolean not null default false,
  is_prop        boolean not null default false, -- prop firm → muestra aviso de reglas
  copy_allowed   boolean not null default true,
  enabled        boolean not null default true,
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);
alter table public.dx_servers enable row level security;

create table if not exists public.dxtrade_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  account_id      bigint,                  -- trading_accounts.id (Guardian/Copy/dashboard)
  enabled         boolean not null default true,
  server          text,                    -- host del bróker usado en el login
  domain          text not null default 'default',
  demo            boolean not null default false,
  dx_account      text,                    -- "clearing:code" (ej. default:AB12345)
  access_token    text,                    -- sessionToken cifrado
  refresh_token   text,                    -- DXtrade no usa refresh (columna por paridad)
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
alter table public.dxtrade_connections enable row level security;
create index if not exists idx_dx_conn_user on public.dxtrade_connections(user_id);
create index if not exists idx_dx_conn_enabled on public.dxtrade_connections(enabled);
create unique index if not exists uq_dx_conn_acct on public.dxtrade_connections(user_id, dx_account);

-- La cola de copia ya existe (copy_commands); slave_ticket ya se añadió con MatchTrader.
alter table public.copy_commands add column if not exists slave_ticket text;

-- Semillas de ejemplo (edítalas/añade desde admin). Confirma el HOST real de cada bróker
-- (el mismo dominio donde entras a la plataforma web de DXtrade de ese bróker).
insert into public.dx_servers(code, name, host, domain_default, demo_default, is_prop, copy_allowed, sort) values
  ('ftmo-dxtrade', 'FTMO (DXtrade)', 'dxtrade.ftmo.com', 'default', false, true, true, 1),
  ('the5ers-dxtrade', 'The5ers (DXtrade)', 'dxtrade.the5ers.com', 'default', false, true, true, 2),
  ('dxtrade-demo', 'DXtrade (Demo)', 'demo.dx.trade', 'default', true, false, true, 99)
on conflict (code) do nothing;
