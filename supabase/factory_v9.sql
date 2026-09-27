-- ============================================================
-- Onyx Bot Factory · v9 — Bloques personalizados (creados por Claude)
--  · Reglas de entrada nuevas, más allá de las preconfiguradas, definidas como
--    condiciones sobre indicadores (DSL) que el motor de backtest ejecuta.
-- ============================================================

create table if not exists public.factory_blocks (
  id         uuid primary key default gen_random_uuid(),
  category   text default 'entry',              -- por ahora: entry
  block_id   text not null,                     -- p.ej. cb_rsi_div_vol
  es         text,
  en         text,
  dsl        jsonb default '{}'::jsonb,          -- {conds:[{ind,field,op,level}], dir}
  notes      text,
  origin     text default 'ai',                  -- ai | custom
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists factory_blocks_cat on public.factory_blocks(category, created_at desc);

notify pgrst, 'reload schema';
