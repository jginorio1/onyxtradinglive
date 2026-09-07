-- ============================================================
-- Onyx Copy — Marketplace de traders calificados (F1)
-- Correr una vez en Supabase → SQL Editor. Idempotente.
--
-- strategy_providers: un trader que pone su cuenta a calificar. Onyx AI + KPIs
-- calculan un score (0-100) y lo ubican en un tier (silver/gold/diamond). El
-- ranking público lee SOLO campos seguros (nunca login/fondos).
-- ============================================================
create table if not exists strategy_providers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  account_id   uuid not null unique,               -- una cuenta = un proveedor
  display_name text,                                -- nombre público (alias)
  avatar_url   text,
  score        numeric not null default 0,          -- Onyx Score 0-100
  tier         text not null default 'none',        -- none | silver | gold | diamond
  pillars      jsonb not null default '{}'::jsonb,  -- {discipline,risk,performance,consistency}
  stats        jsonb not null default '{}'::jsonb,  -- {trades,tradingDays,winRate,pf,rr,maxDDpct,net}
  style_note   text,                                 -- resumen de estilo (Onyx AI, opcional)
  followers    int not null default 0,
  fee_month    numeric,                              -- precio mensual sugerido para copiarlo
  verified     boolean not null default false,       -- cuenta live verificada (gate Gold/Diamond)
  listed       boolean not null default false,       -- visible en el ranking público
  status       text not null default 'active',       -- active | paused | removed
  scored_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists strategy_providers_rank_idx on strategy_providers (listed, status, score desc);
create index if not exists strategy_providers_user_idx on strategy_providers (user_id);

-- Solo el backend (service role) escribe; el ranking público se sirve vía service role.
alter table strategy_providers enable row level security;

notify pgrst, 'reload schema';
