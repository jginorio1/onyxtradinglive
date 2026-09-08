-- ============================================================
-- Copy del mentor (Onyx Academy · Fase 2) · esquema base.
-- Reutiliza el motor de copy existente (copy_links / copy_commands):
--   · La OFERTA guarda qué cuenta maestra transmite el mentor y a qué precio.
--   · La SUSCRIPCIÓN ata a un alumno; cuando conecta su cuenta se crea un
--     copy_link (escalado proporcional + Guardian/Mi reto obligatorios).
-- Acceso solo desde el servidor (service_role); RLS activo sin políticas públicas.
-- ============================================================

create table if not exists academy_copy_offers (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null,                 -- profiles.id del mentor (dueño de la academia)
  master_account_id uuid,                  -- trading_accounts.id que transmite (su maestra)
  enabled boolean not null default false,  -- ofrecer el copy sí/no
  price_cents integer not null default 0,  -- precio mensual del copy
  currency text not null default 'usd',
  min_capital_cents integer not null default 0,  -- capital mínimo exigido al alumno (0 = sin mínimo)
  allow_funded boolean not null default true,    -- permitir cuentas de fondeo
  default_multiplier numeric not null default 1, -- multiplicador de riesgo por defecto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mentor_id)
);

create table if not exists academy_copy_subs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null,
  mentor_id uuid not null,
  student_id uuid not null,
  slave_account_id uuid,                    -- cuenta del alumno que copia (al conectarla)
  copy_link_id uuid,                        -- enlace creado en copy_links (al conectar)
  account_type text not null default 'own', -- 'own' (capital propio) | 'funded' (fondeo)
  risk_multiplier numeric not null default 1,
  -- Reglas de fondeo capturadas para los límites del copy (Mi reto):
  funded_daily_pct numeric,                 -- pérdida diaria máx. de la firma (%)
  funded_max_dd_pct numeric,                -- drawdown máx. de la firma (%)
  status text not null default 'pending_connect', -- pending_connect | active | paused | canceled
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mentor_id, student_id)
);

create index if not exists idx_acopy_offers_mentor on academy_copy_offers (mentor_id);
create index if not exists idx_acopy_subs_mentor on academy_copy_subs (mentor_id);
create index if not exists idx_acopy_subs_student on academy_copy_subs (student_id);
create index if not exists idx_acopy_subs_sub on academy_copy_subs (stripe_subscription_id);

alter table academy_copy_offers enable row level security;
alter table academy_copy_subs   enable row level security;
