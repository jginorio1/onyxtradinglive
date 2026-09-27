-- ============================================================
-- Onyx Bot Factory · v8 — Biblioteca de plantillas (estilo StrategyQuant)
--  · Plantillas guardadas por instrumento + temporalidad + bloques + rangos.
--  · Reutilizables en el generador. Se pueden crear a mano o con Claude AI.
-- ============================================================

create table if not exists public.factory_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  symbol      text,
  timeframe   text,
  family      text,                                  -- tendencia | rango | ruptura | ...
  config      jsonb  default '{}'::jsonb,            -- GenConfig: bloques elegidos por clave
  costs       jsonb  default '{}'::jsonb,            -- spread/slippage/commission/moneyPerPip/lot
  filters     jsonb  default '{}'::jsonb,            -- {minPf, maxDd, minTr}
  notes       text,
  origin      text default 'custom',                 -- preset | custom | ai
  ai_rationale text,                                 -- por qué Claude la propuso (si origin=ai)
  created_by  uuid,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists factory_templates_created on public.factory_templates(created_at desc);
create index if not exists factory_templates_symbol on public.factory_templates(symbol);

notify pgrst, 'reload schema';
