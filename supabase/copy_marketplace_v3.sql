-- ============================================================
-- Onyx Copy — Marketplace F4: comisión por rendimiento (high-water mark) +
-- anti-gaming reforzado. Correr una vez en Supabase → SQL Editor. Idempotente.
--
-- F4 alinea incentivos: además de la suscripción, el trader puede cobrar un % de
-- la GANANCIA NUEVA del seguidor, con marca de agua (high-water mark): solo se
-- cobra por profit por encima del máximo anterior, nunca en la recuperación de
-- un drawdown. Anti-gaming: banderas de riesgo y auto-retiro del ranking.
-- ============================================================

-- % de comisión por rendimiento que fija el trader (0-30). 0 = solo suscripción.
alter table strategy_providers add column if not exists perf_fee_pct numeric not null default 0;
-- Anti-gaming: banderas detectadas por el motor y retiro automático del ranking.
alter table strategy_providers add column if not exists flags jsonb not null default '[]'::jsonb;
alter table strategy_providers add column if not exists auto_delisted boolean not null default false;

-- Seguidores: marca de agua de profit y datos para cobrar la comisión de rendimiento.
alter table copy_follows add column if not exists perf_fee_pct numeric not null default 0;
alter table copy_follows add column if not exists hwm_profit numeric not null default 0;   -- máximo profit acumulado ya cobrado
alter table copy_follows add column if not exists stripe_customer_id text;
alter table copy_follows add column if not exists perf_started_at timestamptz;

-- Libro de comisiones de rendimiento (una fila por período cobrado). Idempotente.
create table if not exists copy_perf_charges (
  id           uuid primary key default gen_random_uuid(),
  follow_id    uuid,
  provider_id  uuid,
  period_start timestamptz,
  period_end   timestamptz,
  profit_cents int not null default 0,     -- ganancia nueva sobre la marca de agua
  fee_cents    int not null default 0,     -- comisión total (trader + Onyx)
  onyx_cents   int not null default 0,     -- parte de Onyx
  net_cents    int not null default 0,     -- parte del trader
  currency     text not null default 'usd',
  invoice_id   text unique,
  status       text not null default 'pending',   -- pending | charged | failed | skipped
  created_at   timestamptz not null default now()
);
create index if not exists copy_perf_provider_idx on copy_perf_charges (provider_id, created_at desc);

alter table copy_perf_charges enable row level security;

notify pgrst, 'reload schema';
