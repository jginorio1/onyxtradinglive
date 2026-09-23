-- ============================================================
-- Onyx Trading Live · NÓMINA (equipo interno) v1
--   Empleados/colaboradores con sueldo fijo, pagados por Stripe Connect o USDT.
--   Vive "encima" del área Equipo. Un empleado puede NO tener acceso al panel
--   (solo cobra): en ese caso user_id puede ser null (pago manual) o apuntar a
--   una cuenta normal (para su panel self-serve y conectar su cobro).
-- Ejecuta en Supabase SQL Editor.
-- ============================================================

-- Ficha del empleado / colaborador.
create table if not exists staff (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete set null,  -- opcional: su cuenta en la app
  name               text not null,
  email              text,
  department         text not null default 'other',   -- dev | management | marketing | design | ops | other
  position           text,                            -- título del puesto (ej. "Backend Sr.")
  salary             numeric not null default 0,      -- sueldo por periodo (mensual)
  currency           text not null default 'USD',
  pay_cycle          text not null default 'monthly', -- monthly (por ahora)
  payout_method      text not null default 'stripe',  -- stripe | usdt | manual
  status             text not null default 'active',  -- active | paused | ended
  start_date         date,
  stripe_account_id  text,
  payouts_enabled    boolean not null default false,
  on_hold            boolean not null default false,  -- freno de pago por persona
  payout_usdt_trc20  text,
  payout_usdt_erc20  text,
  payout_usdt_network text default 'trc20',
  note               text,
  created_at         timestamptz not null default now()
);
create index if not exists staff_user_idx on staff (user_id);
create index if not exists staff_status_idx on staff (status);

-- Un pago de nómina a un empleado, por periodo (idempotente por periodo).
create table if not exists staff_payments (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references staff(id) on delete cascade,
  period       text not null,                    -- 'YYYY-MM'
  amount       numeric not null default 0,
  currency     text not null default 'USD',
  method       text not null default 'stripe',   -- stripe | usdt | manual
  status       text not null default 'pending',  -- pending | approved | paid | failed | skipped
  ref          text,                             -- transfer id / txid / referencia
  note         text,
  paid_at      timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists staff_payments_uniq on staff_payments (staff_id, period);
create index if not exists staff_payments_period_idx on staff_payments (period, status);

alter table staff          enable row level security;
alter table staff_payments enable row level security;

-- Ajustes de la nómina (guardados en app_settings key 'payroll').
insert into app_settings (key, value)
values ('payroll', '{"enabled":true,"pay_day":1,"auto_pay":false,"review_before_pay":true,"currency":"USD","departments":["dev","management","marketing","design","ops","other"]}'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
