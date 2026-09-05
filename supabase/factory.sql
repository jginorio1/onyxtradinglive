-- ============================================================
-- Onyx Bot Factory · Fase 1
-- Fábrica interna de robots (solo admin): subir datos con validación
-- de calidad de tick, y constructor con nombre automático ÚNICO no editable.
-- Fases siguientes añaden: laboratorio de robustez, pipeline de 6 meses,
-- semáforo y correlación.
-- ============================================================

-- Datos de backtest subidos, con su veredicto de calidad de tick.
create table if not exists public.factory_datasets (
  id            uuid primary key default gen_random_uuid(),
  symbol        text,
  timeframe     text,
  filename      text,
  years         numeric,
  from_date     timestamptz,
  to_date       timestamptz,
  rows          bigint,                 -- nº de ticks/barras leídas
  has_ticks     boolean default false,  -- true = ticks reales (bid/ask), false = solo barras OHLC
  quality_score int  default 0,         -- 0..100
  verdict       text default 'reservas',-- apta | reservas | rechazada
  checks        jsonb default '[]'::jsonb, -- [{key,label,status,detail}]
  metrics       jsonb default '{}'::jsonb, -- métricas crudas usadas para el veredicto
  created_by    uuid,
  created_at    timestamptz default now()
);
create index if not exists factory_datasets_created on public.factory_datasets(created_at desc);

-- Robots de la fábrica. El nombre es único y no editable.
create table if not exists public.factory_bots (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,   -- p.ej. ONYX-Falcon-014 (no editable)
  codename      text,
  seq           int,
  platform      text default 'mt5',     -- mt4 | mt5
  symbol        text,
  timeframe     text,
  strategy      jsonb default '{}'::jsonb, -- familia, sesión, notas, parámetros
  dataset_id    uuid references public.factory_datasets(id) on delete set null,
  stage         text default 'genesis', -- genesis | lab | s1..s4 | listo | real | archived
  status        text default 'draft',   -- draft | activo | archivado
  health        text default 'green',   -- green | yellow | orange (fases siguientes)
  created_by    uuid,
  created_at    timestamptz default now()
);
create index if not exists factory_bots_created on public.factory_bots(created_at desc);
create index if not exists factory_bots_seq on public.factory_bots(seq desc);

alter table public.factory_datasets enable row level security;
alter table public.factory_bots enable row level security;
-- Solo el service role (backend admin) accede; sin políticas públicas.
