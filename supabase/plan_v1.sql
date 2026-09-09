-- ============================================================
-- Mi plan y hábitos: el plan de trading escrito por el trader + check-in diario.
-- Convive con el Guardian (que impone las reglas duras en el EA). Idempotente.
-- ============================================================

-- El plan (uno por usuario). Se guarda como jsonb para dar cabida a cualquier
-- estilo de trader (scalper, day, swing, fondeo, cripto…) y reglas propias.
create table if not exists trading_plans (
  user_id    uuid primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Check-in diario: qué hábitos cumplió ese día + una nota.
create table if not exists plan_checkins (
  user_id    uuid not null,
  day        date not null,
  items      jsonb not null default '{}'::jsonb,   -- { habitKey: true/false }
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists plan_checkins_user_idx on plan_checkins (user_id, day);
