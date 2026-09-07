-- ============================================================
-- Onyx Bot Factory · Fase 4B — Generador de estrategias
-- Guarda cada lote generado: la configuración de bloques, el tamaño del espacio
-- y una muestra de candidatos exportada a MetaTrader.
-- ============================================================
create table if not exists public.factory_genruns (
  id          uuid primary key default gen_random_uuid(),
  config      jsonb default '{}'::jsonb,   -- bloques elegidos
  space_size  numeric,                     -- combinaciones posibles
  sampled     int,                         -- candidatos generados
  candidates  jsonb default '[]'::jsonb,   -- muestra (hasta 2000 guardados)
  note        text,
  created_by  uuid,
  created_at  timestamptz default now()
);
create index if not exists factory_genruns_created on public.factory_genruns(created_at desc);
alter table public.factory_genruns enable row level security;
