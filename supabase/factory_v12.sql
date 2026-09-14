-- ============================================================
-- Onyx Bot Factory · v12 — Gestor de estrategias.
--   · Carpetas propias (tags): agrupa robots como quieras.
--   · Lotes (corridas): cada run del autopiloto guarda su ficha completa
--     (dataset, resolución, receta, MM, conteos, avg) con un nº correlativo,
--     y cada robot lleva su batch_id/batch_no para trazabilidad total.
-- Idempotente: se puede correr varias veces.
-- ============================================================

-- Carpetas personalizadas del admin.
create table if not exists public.factory_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text default '#a06bff',
  created_by uuid,
  created_at timestamptz default now()
);
alter table public.factory_bots add column if not exists folder_id uuid;

-- Lotes: una fila por corrida del autopiloto.
create table if not exists public.factory_batches (
  id           uuid primary key default gen_random_uuid(),
  batch_no     int,                       -- nº correlativo global (#1, #2, …)
  created_by   uuid,
  created_at   timestamptz default now(),
  dataset_name text,
  symbol       text,
  timeframe    text,                       -- temporalidad de la búsqueda
  search_tf    text,                       -- resolución elegida (auto/M5/…)
  mode         text,                       -- 'evolve' | 'random'
  recipe       text,                       -- preset de bloques
  oos_pct      int,
  risk_pct     numeric,
  n_requested  bigint,                     -- estrategias pedidas
  generated    bigint,                     -- evaluadas de verdad
  accepted     bigint,                     -- pasaron el gate
  created      int,                        -- robots creados
  avg_score    int,                        -- Onyx medio del lote
  ai_audited   boolean default false,
  config       jsonb default '{}'::jsonb   -- snapshot completo para re-correr igual
);
alter table public.factory_bots add column if not exists batch_id uuid;
alter table public.factory_bots add column if not exists batch_no int;

create index if not exists idx_factory_bots_folder on public.factory_bots(folder_id);
create index if not exists idx_factory_bots_batch  on public.factory_bots(batch_id);
