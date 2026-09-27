-- =====================================================================
-- Red de ventas · v7 — "al mejor nivel"
-- Metas y bonos, extracto, mini-CRM, kit de materiales, contrato/fiscal,
-- landing personalizado y reparto de leads. Idempotente.
-- (Los ajustes de auto-asignación / auto-ascenso / notificaciones viven en
--  app_settings key 'sales', no requieren columnas nuevas.)
-- =====================================================================

-- Metas por vendedor y periodo (YYYY-MM). Si no hay fila, se usa la meta
-- global de los ajustes. bonus_amount se paga como comisión al cumplir.
create table if not exists sales_goals (
  id uuid primary key default uuid_generate_v4(),
  rep_id uuid not null references sales_reps(id) on delete cascade,
  period text not null,                         -- 'YYYY-MM'
  target_clients int not null default 0,        -- meta de clientes activos nuevos
  target_amount numeric not null default 0,     -- meta de comisión generada ($)
  bonus_amount numeric not null default 0,      -- bono al cumplir ($)
  created_at timestamptz default now(),
  unique (rep_id, period)
);

-- Bonos otorgados (idempotente por rep+period). Se refleja como comisión.
create table if not exists sales_bonuses (
  id uuid primary key default uuid_generate_v4(),
  rep_id uuid not null references sales_reps(id) on delete cascade,
  period text not null,
  amount numeric not null default 0,
  reason text,
  created_at timestamptz default now(),
  unique (rep_id, period)
);

-- Notas y seguimiento por cliente (mini-CRM del vendedor).
create table if not exists sales_client_notes (
  id uuid primary key default uuid_generate_v4(),
  rep_id uuid not null references sales_reps(id) on delete cascade,
  client_user_id uuid references auth.users(id) on delete set null,
  note text,
  followup_at timestamptz,                       -- recordatorio de seguimiento
  done boolean not null default false,
  created_at timestamptz default now()
);

-- Kit de materiales de venta (guiones, banners, PDFs, videos, plantillas).
create table if not exists sales_assets (
  id uuid primary key default uuid_generate_v4(),
  kind text not null default 'link',             -- link | script | image | pdf | video
  title text not null,
  body text,                                     -- texto (guiones / plantillas)
  url text,                                      -- enlace o archivo
  lang text not null default 'es',               -- es | en | all
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Formalización del vendedor: contrato aceptado + datos fiscales + bio/foto
-- para el landing personalizado.
alter table sales_reps add column if not exists contract_signed_at timestamptz;
alter table sales_reps add column if not exists contract_name text;        -- nombre con que firmó
alter table sales_reps add column if not exists tax_form_type text;        -- w9 | w8 | other | none
alter table sales_reps add column if not exists tax_data jsonb default '{}'::jsonb;  -- datos fiscales (cifrados a nivel app si aplica)
alter table sales_reps add column if not exists bio text;                  -- para el landing
alter table sales_reps add column if not exists photo_url text;            -- para el landing
alter table sales_reps add column if not exists auto_promoted boolean default false; -- subió por regla (reversible)
alter table sales_reps add column if not exists promoted_at timestamptz;

create index if not exists sales_goals_rep_idx on sales_goals (rep_id, period);
create index if not exists sales_notes_rep_idx on sales_client_notes (rep_id, followup_at);
create index if not exists sales_assets_active_idx on sales_assets (active, sort);

alter table sales_goals enable row level security;
alter table sales_bonuses enable row level security;
alter table sales_client_notes enable row level security;
alter table sales_assets enable row level security;

notify pgrst, 'reload schema';
