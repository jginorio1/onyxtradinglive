-- ============================================================
-- Módulo de bots (traders algorítmicos): rendimiento por estrategia,
-- separado en "En pruebas" (demo/forward) y "En vivo" (real/fondeo).
-- Cada operación queda etiquetada con el magic number del EA que la abrió.
-- Correr una sola vez en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- 1) Etiquetar cada operación con el bot que la generó
alter table trades         add column if not exists magic      bigint;
alter table trades         add column if not exists ea_comment text;
alter table open_positions add column if not exists magic      bigint;
alter table open_positions add column if not exists ea_comment text;

create index if not exists trades_magic_idx on trades (account_id, magic);

-- 2) Configuración por bot (nombre, modo y criterios de graduación)
create table if not exists bots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  magic      bigint not null,
  name       text,
  mode       text not null default 'auto',          -- auto | testing | live (override manual)
  criteria   jsonb not null default '{}'::jsonb,     -- {minDays, minTrades, pf, maxDD}
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, magic)
);

-- Solo el backend (service role) accede; bloqueamos el acceso público.
alter table bots enable row level security;
