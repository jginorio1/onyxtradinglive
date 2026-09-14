-- ============================================================
-- Onyx Bot Factory · Fase 2 — Laboratorio de robustez
--   · Corridas del laboratorio (Monte Carlo, IS/OOS, walk-forward, sensibilidad).
--   · Comparación constructor/lab vs backtest de MetaTrader (divergencia).
--   · Compuerta "listo para demo" para continuar el pipeline.
-- ============================================================

create table if not exists public.factory_labruns (
  id             uuid primary key default gen_random_uuid(),
  bot_id         uuid references public.factory_bots(id) on delete cascade,
  trades         int,
  net            numeric,
  pf             numeric,
  maxdd          numeric,
  is_pf          numeric,     -- profit factor in-sample
  oos_pf         numeric,     -- profit factor out-of-sample
  oos_retention  numeric,     -- oos_pf / is_pf (0..1.2)
  wfo_consistency numeric,    -- fracción de ventanas rentables
  mc_loss_prob   numeric,     -- prob. de terminar en pérdida (Monte Carlo)
  mc_median_dd   numeric,
  mc_p95_dd      numeric,
  sensitivity    numeric,     -- plateau score (null si no hay grid de optimización)
  param_count    int,
  robustness_score int,
  verdict        text,        -- robusto | moderado | fragil
  flags          jsonb default '[]'::jsonb,
  charts         jsonb default '{}'::jsonb,  -- datos para las gráficas
  expected       jsonb default '{}'::jsonb,  -- KPIs esperados (del lab)
  mt_backtest    jsonb,       -- KPIs del backtest real de MetaTrader (si se comparó)
  divergence     numeric,     -- 0 = idéntico, mayor = más lejos
  ai_audit       text,        -- interpretación de Claude
  mutations      jsonb default '[]'::jsonb,  -- sugerencias de mutación
  created_by     uuid,
  created_at     timestamptz default now()
);
create index if not exists factory_labruns_bot on public.factory_labruns(bot_id, created_at desc);
alter table public.factory_labruns enable row level security;

-- Resultado del laboratorio reflejado en el robot (para el pipeline).
alter table public.factory_bots add column if not exists robustness_score int;
alter table public.factory_bots add column if not exists robustness_verdict text;
alter table public.factory_bots add column if not exists bt_divergence numeric;
alter table public.factory_bots add column if not exists demo_ready boolean default false;
alter table public.factory_bots add column if not exists lab_at timestamptz;
