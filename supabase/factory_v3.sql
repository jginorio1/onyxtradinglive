-- ============================================================
-- Onyx Bot Factory · Fase 3 — Pipeline de 6 meses en cuenta demo
--   · Avance por etapas con score-gate.
--   · Semáforo automático: verde / amarillo (mitad de riesgo) / naranja (paper).
--   · Correlación entre robots.
-- ============================================================

alter table public.factory_bots add column if not exists live_account   uuid;      -- cuenta demo conectada
alter table public.factory_bots add column if not exists live_magic     bigint;    -- magic del robot en esa cuenta
alter table public.factory_bots add column if not exists stage_index    int default 0;
alter table public.factory_bots add column if not exists stage_started_at   timestamptz;
alter table public.factory_bots add column if not exists pipeline_started_at timestamptz;
alter table public.factory_bots add column if not exists score          int default 0;   -- score de la etapa actual
alter table public.factory_bots add column if not exists health         text default 'green'; -- green | yellow | orange
alter table public.factory_bots add column if not exists risk_factor    numeric default 1;    -- 1 = normal, 0.5 = mitad, 0 = paper
alter table public.factory_bots add column if not exists paper          boolean default false;
alter table public.factory_bots add column if not exists paper_started_at   timestamptz;
alter table public.factory_bots add column if not exists real_ready     boolean default false; -- completó el pipeline
alter table public.factory_bots add column if not exists real_approved  boolean default false; -- el admin lo aprobó (1 clic)
alter table public.factory_bots add column if not exists max_corr       numeric;   -- correlación máx con otro robot activo
alter table public.factory_bots add column if not exists corr_with      text;      -- nombre del robot más correlacionado
alter table public.factory_bots add column if not exists last_pipeline_at timestamptz;

-- Historial de transiciones del pipeline (auditoría).
create table if not exists public.factory_stage_log (
  id         uuid primary key default gen_random_uuid(),
  bot_id     uuid references public.factory_bots(id) on delete cascade,
  from_stage text,
  to_stage   text,
  event      text,          -- advance | archive | health | paper | paper_exit | real
  score      int,
  health     text,
  note       text,
  created_at timestamptz default now()
);
create index if not exists factory_stage_log_bot on public.factory_stage_log(bot_id, created_at desc);
alter table public.factory_stage_log enable row level security;
