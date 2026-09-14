-- ============================================================
-- TradingView → Onyx → EA (señales que ejecuta tu EA de Copy)
--
-- Idea: una alerta de TradingView manda un webhook a Onyx; Onyx mete un
-- comando en la MISMA cola que ya usa el copy trading (copy_commands), y el
-- EA esclavo que el trader ya tiene instalado lo ejecuta en su cuenta real.
-- No hace falta cambiar el EA ni reinstalar nada.
--
-- Ejecuta este archivo una vez en Supabase (SQL Editor → pegar → Run).
-- ============================================================

-- 1) La cola de comandos ahora admite señales sin enlace de copy (link_id nulo)
alter table public.copy_commands alter column link_id drop not null;
alter table public.copy_commands add column if not exists source text not null default 'copy';   -- copy | tradingview

-- 2) Ajustes de TradingView por cada cuenta conectada
alter table public.trading_accounts add column if not exists tv_token text;                       -- secreto del webhook
alter table public.trading_accounts add column if not exists tv_enabled boolean not null default false;
alter table public.trading_accounts add column if not exists tv_default_lot numeric not null default 0.01;  -- lote si la alerta no manda uno
alter table public.trading_accounts add column if not exists tv_max_lot numeric not null default 0;         -- tope de lote (0 = sin tope)
alter table public.trading_accounts add column if not exists tv_symbols jsonb not null default '[]'::jsonb; -- lista blanca (vacía = todos)
create unique index if not exists trading_accounts_tv_token on public.trading_accounts(tv_token) where tv_token is not null;

-- 3) Registro de señales recibidas (para el historial en el panel)
create table if not exists public.tv_signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  action text, symbol text, lots numeric, sl numeric, tp numeric,
  status text not null default 'queued',   -- queued | rejected
  error text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tv_signals_acc on public.tv_signals(account_id, created_at desc);
