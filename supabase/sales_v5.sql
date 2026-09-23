-- ============================================================
-- Onyx Trading Live · Red de VENTAS v5
--   Sistema de DESEMPEÑO + ATENCIÓN + RESEÑAS + EVALUACIONES 360
--   · sales_reviews      → reseñas de clientes sobre su vendedor (internas)
--   · sales_evaluations  → evaluaciones 360 (supervisor↔vendedor)
--   · sales_actions      → bitácora del "plan de manejo" (promover/coaching/pausar)
--   · sales_reps.perms   → permisos por representante (override del nivel)
-- Ejecuta después de sales_v4.sql.
-- ============================================================

-- Permisos por representante (JSON). Si es null, hereda los del nivel.
alter table sales_reps add column if not exists perms jsonb;

-- Reseñas de clientes (internas por defecto: solo admin + supervisor).
create table if not exists sales_reviews (
  id              uuid primary key default gen_random_uuid(),
  rep_id          uuid not null references sales_reps(id) on delete cascade,
  client_user_id  uuid references auth.users(id) on delete set null,
  rating          int  not null check (rating between 1 and 5),
  comment         text,
  source          text not null default 'prompt',   -- prompt | email | manual
  visibility      text not null default 'internal',  -- internal | public
  created_at      timestamptz not null default now()
);
create index if not exists sales_reviews_rep_idx on sales_reviews (rep_id, created_at desc);
create index if not exists sales_reviews_client_idx on sales_reviews (client_user_id, created_at desc);

-- Evaluaciones 360. Una por período/evaluador/evaluado.
create table if not exists sales_evaluations (
  id              uuid primary key default gen_random_uuid(),
  period          text not null,                     -- p.ej. '2026-09'
  rater_rep_id    uuid references sales_reps(id) on delete set null,  -- null = admin
  ratee_rep_id    uuid not null references sales_reps(id) on delete cascade,
  direction       text not null,                     -- sup_to_rep | rep_to_sup | admin
  scores          jsonb not null default '{}'::jsonb,-- {criterio: 1..5}
  overall         numeric,                           -- promedio 1..5
  comment         text,
  created_at      timestamptz not null default now()
);
create unique index if not exists sales_eval_uniq on sales_evaluations (period, coalesce(rater_rep_id,'00000000-0000-0000-0000-000000000000'::uuid), ratee_rep_id, direction);
create index if not exists sales_eval_ratee_idx on sales_evaluations (ratee_rep_id, created_at desc);

-- Bitácora del plan de manejo (acciones tomadas sobre un rep).
create table if not exists sales_actions (
  id          uuid primary key default gen_random_uuid(),
  rep_id      uuid not null references sales_reps(id) on delete cascade,
  kind        text not null,   -- promote | demote | coach | praise | warn | pause | resume | note
  note        text,
  tier        text,            -- tier del rep al momento (star|solid|risk)
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists sales_actions_rep_idx on sales_actions (rep_id, created_at desc);

alter table sales_reviews     enable row level security;
alter table sales_evaluations enable row level security;
alter table sales_actions     enable row level security;

notify pgrst, 'reload schema';
